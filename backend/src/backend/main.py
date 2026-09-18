from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from backend.config import HOST, PORT, CORS_ORIGINS
from backend.api.apis import api_router
from backend.rag.pipeline import policy_kb


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize RAG knowledge base & BM25 index
    policy_kb.initialize()
    yield
    # Shutdown logic (if any)


app = FastAPI(
    title="HotelMate Booking Engine Copilot API",
    description="Multi-agent backend for conversational hotel reservations with Agentic RAG policy Q&A.",
    version="0.0.1",
    lifespan=lifespan,
)

# CORS middleware for frontend connection (Vite dev server & web clients)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(api_router)


def dev():
    """Run development server with hot-reload."""
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)


def start():
    """Run production ASGI server."""
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=False)


def main():
    """Default CLI entrypoint."""
    dev()


if __name__ == "__main__":
    main()
