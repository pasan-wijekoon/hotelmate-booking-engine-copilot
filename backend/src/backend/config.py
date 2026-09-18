import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DOC_PATH = BASE_DIR / "experiments" / "documents" / "hotel_booking_policies.md"
DEFAULT_CHROMA_DIR = BASE_DIR / "experiments" / "notebooks" / "chroma_db"

def resolve_project_path(env_var: str, default: Path) -> Path:
    """
    Resolves a path from an environment variable.
    If the path is relative, it is resolved relative to BASE_DIR.
    """
    val = os.getenv(env_var)
    if val is None:
        return default
    path = Path(val)
    if not path.is_absolute():
        return BASE_DIR / path
    return path

# LLM & Embedding configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434/v1"))
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "llama3.1")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "ollama")

# Document & Storage paths
HOTEL_POLICY_DOC_PATH = resolve_project_path("HOTEL_POLICY_DOC_PATH", DEFAULT_DOC_PATH)
CHROMA_PERSIST_DIR = resolve_project_path("CHROMA_PERSIST_DIR", DEFAULT_CHROMA_DIR)
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "hotelmate_knowledge")

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5000"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

# Ensure at least one origin; fall back to allow all in dev mode
if not CORS_ORIGINS:
    CORS_ORIGINS = ["*"]
