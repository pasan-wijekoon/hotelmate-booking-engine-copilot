from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from backend.models.schemas import ChatRequest
from backend.agents.coordinator import coordinator
from backend.memory.session_store import current_session_id, session_store

router = APIRouter(tags=["Chat"])


@router.post("/api/chat")
async def chat_endpoint(request: ChatRequest, req: Request):
    """
    Main chat endpoint compatible with frontend useChatStream hook.
    Consumes JSON payload {"prompt": "...", "session_id": "..."}
    Returns a single JSON payload {"response": "...", "isTextareaDisabled": false}
    """
    # Determine the client-provided session identifier (may come from body, header, or default)
    client_sid = request.session_id or req.headers.get("X-Session-ID") or "default-session"
    # Resolve or create the internal state_id and corresponding SessionState
    state_id, _ = session_store.get_or_create(client_sid)
    # Store the internal state_id in the context for downstream tools
    token = current_session_id.set(state_id)
    try:
        response_text = await coordinator.run_turn(request.prompt, session_id=state_id)
    finally:
        current_session_id.reset(token)
    # Return both the state_id (internal) and the assistant response
    return {"state_id": state_id, "response": response_text, "isTextareaDisabled": False}
