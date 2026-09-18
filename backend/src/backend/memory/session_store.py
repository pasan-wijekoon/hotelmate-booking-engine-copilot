import time
import uuid
from typing import Dict, Optional, List, Any, Tuple
from dataclasses import dataclass, field
from contextvars import ContextVar
from backend.models.schemas import GuestIdentity, ReservationDetails

# Thread-safe storage for the current session ID (internal state_id) in an async request
current_session_id: ContextVar[Optional[str]] = ContextVar("current_session_id", default=None)


@dataclass
class SessionState:
    """Encapsulates the conversational state and memory stores for a single guest session.
    The `session_id` is the internal **state_id** (UUID) used by the coordinator.
    """
    session_id: str
    d1_identity: GuestIdentity = field(default_factory=GuestIdentity)
    d2_reservation: ReservationDetails = field(default_factory=ReservationDetails)
    active_agent: str = "root"  # "root" -> "reservation" -> "completed"
    interrupted_from: Optional[str] = None  # Tracks caller agent when routing to policy agent
    chat_history: List[Dict[str, str]] = field(default_factory=list)
    # Mapping of agent name -> AgentFramework Session (stored by coordinator)
    agent_sessions: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.updated_at = time.time()

    def add_message(self, role: str, content: str) -> None:
        self.chat_history.append({"role": role, "content": content})
        self.touch()


class SessionStore:
    """In‑memory registry that maps **client‑provided session IDs** to internal **state IDs**,
    and stores the corresponding ``SessionState`` objects.
    """

    def __init__(self) -> None:
        # client_session_id -> state_id (UUID)
        self._session_map: Dict[str, str] = {}
        # state_id -> SessionState
        self._states: Dict[str, SessionState] = {}
        self._default_session_id = "default-session"

    def get_or_create(self, client_session_id: Optional[str] = None) -> Tuple[str, SessionState]:
        """Return a tuple ``(state_id, SessionState)``.
        If the client session already has a mapped state, reuse it; otherwise generate a new UUID.
        """
        client_sid = client_session_id or current_session_id.get() or self._default_session_id
        client_sid = client_sid.strip() if client_sid and isinstance(client_sid, str) else self._default_session_id
        # Resolve or create a state_id for this client session
        state_id = self._session_map.get(client_sid)
        if not state_id:
            state_id = str(uuid.uuid4())
            self._session_map[client_sid] = state_id
        # Ensure a SessionState exists for the state_id
        if state_id not in self._states:
            self._states[state_id] = SessionState(session_id=state_id)
        session = self._states[state_id]
        session.touch()
        return state_id, session

    def get_by_state_id(self, state_id: str) -> Optional[SessionState]:
        return self._states.get(state_id)

    def delete(self, client_session_id: Optional[str] = None) -> bool:
        """
        Delete a session using the client-provided session identifier.
        If ``client_session_id`` is None, the default session is used.
        Returns True if a session was found and removed, False otherwise.
        """
        client_sid = client_session_id or self._default_session_id
        client_sid = client_sid.strip() if client_sid and isinstance(client_sid, str) else self._default_session_id
        state_id = self._session_map.get(client_sid)
        if not state_id:
            return False
        # Remove the mapping from client to state
        del self._session_map[client_sid]
        # Remove the actual SessionState if it exists
        if state_id in self._states:
            del self._states[state_id]
        return True


    def get_agent_session(self, state_id: str, agent_name: str) -> Any:
        """Return the stored AgentFramework session for the given agent, or None."""
        sess = self.get_by_state_id(state_id)
        return sess.agent_sessions.get(agent_name) if sess else None

    def set_agent_session(self, state_id: str, agent_name: str, agent_session: Any) -> None:
        """Persist the AgentFramework session for the given agent within the SessionState."""
        sess = self.get_by_state_id(state_id)
        if sess:
            sess.agent_sessions[agent_name] = agent_session
        else:
            raise KeyError(f"State ID {state_id} not found in SessionStore")

    @property
    def count(self) -> int:
        return len(self._states)


# Global singleton instance
session_store = SessionStore()
