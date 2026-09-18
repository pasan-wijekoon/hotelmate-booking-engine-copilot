import time
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field
from backend.models.schemas import GuestIdentity, ReservationDetails


@dataclass
class SessionState:
    """Encapsulates the conversational state and memory stores for a single guest session."""
    session_id: str
    d1_identity: GuestIdentity = field(default_factory=GuestIdentity)
    d2_reservation: ReservationDetails = field(default_factory=ReservationDetails)
    active_agent: str = "root"  # "root" -> "reservation" -> "completed"
    interrupted_from: Optional[str] = None  # Tracks caller agent when routing to policy agent
    chat_history: List[Dict[str, str]] = field(default_factory=list)
    agent_session: Optional[Any] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.updated_at = time.time()

    def add_message(self, role: str, content: str) -> None:
        self.chat_history.append({"role": role, "content": content})
        self.touch()


class SessionStore:
    """In-memory session registry with thread-safe access and default fallback session."""

    def __init__(self) -> None:
        self._sessions: Dict[str, SessionState] = {}
        self._default_session_id = "default-session"

    def get_or_create(self, session_id: Optional[str] = None) -> SessionState:
        sid = session_id.strip() if session_id and session_id.strip() else self._default_session_id
        if sid not in self._sessions:
            self._sessions[sid] = SessionState(session_id=sid)
        session = self._sessions[sid]
        session.touch()
        return session

    def get(self, session_id: str) -> Optional[SessionState]:
        return self._sessions.get(session_id)

    def delete(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def list_sessions(self) -> List[str]:
        return list(self._sessions.keys())

    @property
    def count(self) -> int:
        return len(self._sessions)


# Global singleton instance
session_store = SessionStore()
