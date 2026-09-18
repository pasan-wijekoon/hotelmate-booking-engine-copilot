import os
import re
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Any
import chromadb
from rank_bm25 import BM25Okapi
from agent_framework.openai import OpenAIEmbeddingClient
from backend.config import (
    OLLAMA_BASE_URL,
    OLLAMA_API_KEY,
    OLLAMA_EMBEDDING_MODEL,
    CHROMA_PERSIST_DIR,
    CHROMA_COLLECTION_NAME,
    HOTEL_POLICY_DOC_PATH,
)


def load_markdown(file_path: Path) -> str:
    """Read a Markdown file as plain text."""
    if not file_path.exists():
        return ""
    return file_path.read_text(encoding="utf-8")


def chunk_markdown(
    text: str,
    chunk_size: int = 1200,
    chunk_overlap: int = 200,
) -> List[str]:
    """Split Markdown content into overlapping chunks with normalized whitespace."""
    text = " ".join(text.split())
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - chunk_overlap
    return chunks


def tokenize(text: str) -> List[str]:
    """Simple tokenizer for BM25 lexical search."""
    return re.findall(r"\w+", text.lower())


class PolicyKnowledgeBase:
    """Encapsulates ChromaDB vector storage and BM25 lexical indexing for hybrid search."""

    def __init__(self) -> None:
        self.chroma_dir = CHROMA_PERSIST_DIR
        self.collection_name = CHROMA_COLLECTION_NAME
        self.doc_path = HOTEL_POLICY_DOC_PATH

        self.chroma_client: Optional[chromadb.ClientAPI] = None
        self.collection: Optional[chromadb.Collection] = None
        self.embedding_client: Optional[OpenAIEmbeddingClient] = None

        self.bm25: Optional[BM25Okapi] = None
        self.bm25_doc_ids: List[str] = []
        self.bm25_documents: List[str] = []
        self.initialized = False

    def initialize(self) -> None:
        """Initialize clients and load/index policy documents."""
        self.chroma_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(path=str(self.chroma_dir))
        self.collection = self.chroma_client.get_or_create_collection(name=self.collection_name)

        self.embedding_client = OpenAIEmbeddingClient(
            base_url=OLLAMA_BASE_URL,
            api_key=OLLAMA_API_KEY,
            model=OLLAMA_EMBEDDING_MODEL,
        )

        # Refresh in-memory BM25 index from ChromaDB or raw file
        self._sync_knowledge_base()
        self.initialized = True

    def _sync_knowledge_base(self) -> None:
        """Loads chunks from ChromaDB and initializes BM25 index."""
        if not self.collection:
            return

        data = self.collection.get(include=["documents"])
        doc_count = len(data.get("ids", []))

        # If Chroma is empty or documents need initial loading, chunk from file
        if doc_count == 0 and self.doc_path.exists():
            markdown_content = load_markdown(self.doc_path)
            chunks = chunk_markdown(markdown_content)
            if chunks:
                # Add text directly so BM25 is immediately usable
                ids = [f"chunk-{i}" for i in range(len(chunks))]
                metadatas = [{"chunk_index": i, "file_type": "markdown"} for i in range(len(chunks))]
                self.collection.upsert(ids=ids, documents=chunks, metadatas=metadatas)
                data = {"ids": ids, "documents": chunks}

        self.bm25_doc_ids = data.get("ids", [])
        self.bm25_documents = data.get("documents", [])

        if self.bm25_documents:
            corpus = [tokenize(doc) for doc in self.bm25_documents]
            self.bm25 = BM25Okapi(corpus)

    async def ingest_documents_with_embeddings(self, batch_size: int = 32) -> int:
        """Generate and upsert embeddings for chunks in the knowledge base."""
        if not self.doc_path.exists():
            return 0

        markdown_content = load_markdown(self.doc_path)
        chunks = chunk_markdown(markdown_content)
        if not chunks or not self.collection or not self.embedding_client:
            return 0

        total = len(chunks)
        for batch_start in range(0, total, batch_size):
            batch_end = min(batch_start + batch_size, total)
            batch_chunks = chunks[batch_start:batch_end]

            try:
                generated = await self.embedding_client.get_embeddings(batch_chunks)
                batch_vectors = [e.vector for e in generated]
            except Exception:
                # If embeddings model is unavailable, save chunks without embeddings
                batch_vectors = None

            ids = [f"chunk-{i}" for i in range(batch_start, batch_end)]
            metadatas = [{"chunk_index": i, "file_type": "markdown"} for i in range(batch_start, batch_end)]

            if batch_vectors:
                self.collection.upsert(ids=ids, embeddings=batch_vectors, documents=batch_chunks, metadatas=metadatas)
            else:
                self.collection.upsert(ids=ids, documents=batch_chunks, metadatas=metadatas)

        self._sync_knowledge_base()
        return total

    async def semantic_search(self, query: str, top_k: int = 3) -> List[Tuple[str, str, float]]:
        """Vector similarity search against Chroma collection."""
        if not self.collection or not self.embedding_client:
            return []

        try:
            generated = await self.embedding_client.get_embeddings([query])
            query_vector = [e.vector for e in generated][0]

            results = self.collection.query(
                query_embeddings=[query_vector],
                n_results=min(top_k, len(self.bm25_doc_ids) or 1),
            )
            if results and results.get("ids") and results["ids"][0]:
                return list(zip(results["ids"][0], results["documents"][0], results["distances"][0]))
        except Exception:
            pass
        return []

    def keyword_search(self, query: str, top_k: int = 3) -> List[Tuple[str, str, float]]:
        """Lexical search using BM25 over chunk text."""
        if not self.bm25 or not self.bm25_doc_ids:
            return []

        scores = self.bm25.get_scores(tokenize(query))
        ranked = sorted(
            zip(self.bm25_doc_ids, self.bm25_documents, scores),
            key=lambda item: item[2],
            reverse=True,
        )
        return ranked[:top_k]

    async def hybrid_search(self, query: str, top_k: int = 3, k_rrf: int = 60) -> List[Tuple[str, str, float]]:
        """
        Combine semantic and keyword rankings via Reciprocal Rank Fusion (RRF).
        """
        num_docs = len(self.bm25_doc_ids)
        if num_docs == 0:
            return []

        semantic_results = await self.semantic_search(query, top_k=num_docs)
        keyword_results = self.keyword_search(query, top_k=num_docs)

        rrf_scores: Dict[str, float] = {}

        for rank, (doc_id, _doc, _distance) in enumerate(semantic_results):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1 / (k_rrf + rank + 1)

        for rank, (doc_id, _doc, _score) in enumerate(keyword_results):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1 / (k_rrf + rank + 1)

        id_to_doc = dict(zip(self.bm25_doc_ids, self.bm25_documents))
        ranked_ids = sorted(rrf_scores.items(), key=lambda item: item[1], reverse=True)

        return [
            (doc_id, id_to_doc.get(doc_id, ""), score)
            for doc_id, score in ranked_ids[:top_k]
        ]


# Global singleton instance
policy_kb = PolicyKnowledgeBase()


def init_cli() -> None:
    """CLI command to initialize and index policy knowledge base standalone."""
    print("[INFO] Initializing Hotel Policy Knowledge Base (BM25 + Vector DB)...")
    policy_kb.initialize()
    print(f"[OK] Policy KB initialized successfully with {len(policy_kb.bm25_doc_ids)} chunks.")

