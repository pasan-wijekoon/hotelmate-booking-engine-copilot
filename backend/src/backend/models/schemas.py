from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Payload sent by chat clients (frontend or API consumers)."""
    prompt: str = Field(..., description="The user prompt message")
    session_id: Optional[str] = Field(None, description="Optional conversation session identifier")


class ChatStreamChunk(BaseModel):
    """NDJSON chunk format expected by the frontend's useChatStream hook."""
    response: str = Field(..., description="Text content or token delta")
    isTextareaDisabled: bool = Field(False, description="Whether textarea input should be disabled")


class GuestIdentity(BaseModel):
    """D1 — Root Agent Memory schema."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None

    def missing_fields(self) -> List[str]:
        missing = []
        if not self.first_name:
            missing.append("first_name")
        if not self.last_name:
            missing.append("last_name")
        if not self.email:
            missing.append("email")
        if not self.phone_number:
            missing.append("phone_number")
        return missing

    def is_complete(self) -> bool:
        return len(self.missing_fields()) == 0


class ReservationDetails(BaseModel):
    """D2 — Conversation Memory schema."""
    check_in_date: Optional[str] = None
    check_out_date: Optional[str] = None
    adults_count: Optional[int] = None
    room_type: Optional[str] = None
    children_count: Optional[int] = None
    child_ages: List[int] = Field(default_factory=list)
    meal_plan: Optional[str] = None

    def missing_fields(self) -> List[str]:
        missing = []
        if self.check_in_date is None:
            missing.append("check_in_date")
        if self.check_out_date is None:
            missing.append("check_out_date")
        if self.adults_count is None:
            missing.append("adults_count")
        if self.room_type is None:
            missing.append("room_type")
        if self.children_count is None:
            missing.append("children_count")
        elif self.children_count > 0 and len(self.child_ages) < self.children_count:
            missing.append("child_ages")
        if self.meal_plan is None:
            missing.append("meal_plan")
        return missing

    def is_complete(self) -> bool:
        return len(self.missing_fields()) == 0


class RoomTypeInfo(BaseModel):
    """Room Inventory item description."""
    name: str
    available: int
    max_adults: int
    max_children: int
    base_price_per_night: float = 0.0


class SystemHealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    active_sessions: int
    knowledge_base_chunks: int
    models: Dict[str, str]
