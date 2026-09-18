from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from backend.models.schemas import ChatRequest
from backend.agents.coordinator import coordinator

router = APIRouter(tags=["Chat"])


@router.post("/api/chat")
async def chat_endpoint(request: ChatRequest, req: Request):
    """
    Main chat endpoint compatible with frontend useChatStream hook.
    Consumes JSON payload {"prompt": "...", "session_id": "..."}
    Returns a single JSON payload {"response": "...", "isTextareaDisabled": false}
    """
    # Extract session_id from request body or headers/client IP
    session_id = request.session_id or req.headers.get("X-Session-ID") or "default-session"

    response_text = await coordinator.run_turn(request.prompt, session_id=session_id)
    return {"response": response_text, "isTextareaDisabled": False}
