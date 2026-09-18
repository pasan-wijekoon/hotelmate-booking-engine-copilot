import re
from typing import Annotated
from agent_framework import tool
from backend.memory.session_store import session_store

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^\+?[0-9()\-\s]{7,20}$")


def get_current_d1(session_id: str = "default-session"):
    return session_store.get_or_create(session_id).d1_identity


@tool
def record_first_and_last_name(
    first_name: Annotated[str, "The guest's first name, as given by the guest."],
    last_name: Annotated[str, "The guest's last name, as given by the guest."],
) -> str:
    """Save the guest's first and last name to D1 (Root Agent Memory)."""
    d1 = get_current_d1()
    d1.first_name = first_name.strip()
    d1.last_name = last_name.strip()
    return f"Saved name: {d1.first_name} {d1.last_name}"


@tool
def record_email(
    email: Annotated[str, "The guest's email address, as given by the guest."],
) -> str:
    """Validate and save the guest's email address to D1 (Root Agent Memory)."""
    email = email.strip()
    if not _EMAIL_RE.match(email):
        return (
            f"'{email}' doesn't look like a valid email address. "
            "Ask the guest to double-check it and try again."
        )
    d1 = get_current_d1()
    d1.email = email
    return f"Saved email: {email}"


@tool
def record_phone_number(
    phone_number: Annotated[str, "The guest's phone number, as given by the guest."],
) -> str:
    """Validate and save the guest's phone number to D1 (Root Agent Memory)."""
    phone_number = phone_number.strip()
    if not _PHONE_RE.match(phone_number):
        return (
            f"'{phone_number}' doesn't look like a valid phone number. "
            "Ask the guest to double-check it and try again."
        )
    d1 = get_current_d1()
    d1.phone_number = phone_number
    return f"Saved phone number: {phone_number}"


@tool
def check_identity_status() -> str:
    """Check which identity fields are still missing from D1."""
    d1 = get_current_d1()
    missing = d1.missing_fields()
    if not missing:
        return (
            "All identity fields are recorded. "
            "Ready to hand off to the Coordinator Agent."
        )
    return f"Still missing: {', '.join(missing)}"


@tool
def handoff_to_coordinator_agent() -> str:
    """
    Route the conversation to the Coordinator Agent (P2)
    once identity collection is complete.
    """
    session = session_store.get_or_create()
    d1 = session.d1_identity
    if not d1.is_complete():
        missing = ", ".join(d1.missing_fields())
        return f"Cannot hand off yet — still missing: {missing}."

    session.active_agent = "reservation"
    return (
        "Handoff to Coordinator Agent (P2) complete. "
        f"Identity payload: {d1.model_dump()}"
    )


root_agent_tools = [
    record_first_and_last_name,
    record_email,
    record_phone_number,
    check_identity_status,
    handoff_to_coordinator_agent,
]
