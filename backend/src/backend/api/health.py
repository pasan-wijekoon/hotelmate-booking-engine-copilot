from fastapi import APIRouter
from backend.models.schemas import SystemHealthResponse
from backend.memory.session_store import session_store
from backend.rag.pipeline import policy_kb
from backend.config import OLLAMA_CHAT_MODEL, OLLAMA_EMBEDDING_MODEL

router = APIRouter(tags=["Health"])


@router.get("/api/health", response_model=SystemHealthResponse)
async def health_check():
    """Returns system status, active session count, knowledge base chunks, and model configuration."""
    return SystemHealthResponse(
        status="healthy",
        version="0.0.1",
        active_sessions=session_store.count,
        knowledge_base_chunks=len(policy_kb.bm25_doc_ids),
        models={
            "chat_model": OLLAMA_CHAT_MODEL,
            "embedding_model": OLLAMA_EMBEDDING_MODEL,
        },
    )
