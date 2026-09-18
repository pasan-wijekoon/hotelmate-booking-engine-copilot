from datetime import datetime, date
from typing import Annotated, Optional, List
from agent_framework import tool
from backend.memory.session_store import session_store
from backend.tools.inventory import ROOM_INVENTORY, MEAL_PLAN_OPTIONS

_DATE_FORMATS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d %B %Y",
    "%B %d, %Y",
    "%B %d %Y",
)


def _parse_date(value: str) -> Optional[date]:
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def get_current_d2(session_id: Optional[str] = None):
    return session_store.get_or_create(session_id).d2_reservation


@tool
def record_check_in_date(
    check_in_date: Annotated[
        str,
        "The guest's requested check-in date, in any common format the guest used.",
    ],
) -> str:
    """Parse and save the check-in date to D2 (Conversation Memory)."""
    parsed = _parse_date(check_in_date)
    if not parsed:
        return (
            f"Couldn't understand '{check_in_date}' as a date. "
            "Ask the guest to re-enter it, e.g. YYYY-MM-DD."
        )

    d2 = get_current_d2()
    d2.check_in_date = parsed.isoformat()
    return f"Saved check-in date: {parsed.isoformat()}"


@tool
def record_check_out_date(
    check_out_date: Annotated[
        str,
        "The guest's requested check-out date, in any common format the guest used.",
    ],
) -> str:
    """Parse and save the check-out date to D2 (Conversation Memory). Must be after check-in."""
    parsed = _parse_date(check_out_date)
    if not parsed:
        return (
            f"Couldn't understand '{check_out_date}' as a date. "
            "Ask the guest to re-enter it, e.g. YYYY-MM-DD."
        )

    d2 = get_current_d2()
    if d2.check_in_date:
        check_in = date.fromisoformat(d2.check_in_date)
        if parsed <= check_in:
            return (
                "Check-out date must be after the check-in date. "
                "Ask the guest to re-enter it."
            )

    d2.check_out_date = parsed.isoformat()
    return f"Saved check-out date: {parsed.isoformat()}"


@tool
def record_adult_count(
    adults: Annotated[
        int,
        "How many adults the guest initially says will be staying.",
    ],
) -> str:
    """Save the guest's initial adult count to D2 (Conversation Memory)."""
    if adults < 1:
        return (
            "There must be at least one adult. "
            "Ask the guest to re-enter the count."
        )

    d2 = get_current_d2()
    d2.adults_count = adults
    return f"Saved initial adult count: {adults}"


@tool
def get_available_room_types() -> str:
    """
    Look up available room types and how many rooms are available in each,
    from Room Inventory.
    """
    lines = [
        (
            f"{name}: {info['available']} available "
            f"(max {info['max_adults']} adults, "
            f"{info['max_children']} children, ${info.get('base_price_per_night', 0):.0f}/night)"
        )
        for name, info in ROOM_INVENTORY.items()
        if info["available"] > 0
    ]

    if not lines:
        return "No room types currently have availability."

    return "\n".join(lines)


@tool
def record_selected_room_type(
    room_type: Annotated[
        str,
        "The room type name the guest selected, exactly as shown to them.",
    ],
) -> str:
    """Save the guest's selected room type to D2 after checking availability."""
    match = next(
        (name for name in ROOM_INVENTORY if name.lower() == room_type.strip().lower()),
        None,
    )
    if not match:
        return (
            f"'{room_type}' isn't a recognized room type. "
            "Show the available types again."
        )

    info = ROOM_INVENTORY[match]
    if info["available"] <= 0:
        return (
            f"'{match}' has no rooms available. "
            "Ask the guest to pick a different type."
        )

    d2 = get_current_d2()
    d2.room_type = match
    return f"Saved selected room type: {match}"


@tool
def record_occupancy(
    adults: Annotated[
        int,
        "Final number of adults for the booking, step 1 of the 2-step occupancy question.",
    ],
    children: Annotated[
        int,
        "Number of children for the booking, step 2 of the 2-step occupancy question.",
    ],
) -> str:
    """
    Save the final adult and children counts to D2, capped by the
    max occupancy of the previously selected room type.
    """
    d2 = get_current_d2()
    if not d2.room_type:
        return (
            "No room type has been selected yet. "
            "Ask the guest to pick a room type first."
        )

    limits = ROOM_INVENTORY[d2.room_type]

    if adults < 1 or adults > limits["max_adults"]:
        return (
            f"{d2.room_type} allows between 1 and "
            f"{limits['max_adults']} adults. Ask again."
        )

    if children < 0 or children > limits["max_children"]:
        return (
            f"{d2.room_type} allows at most "
            f"{limits['max_children']} children. Ask again."
        )

    d2.adults_count = adults
    d2.children_count = children
    d2.child_ages = []

    return f"Saved occupancy: {adults} adults, {children} children"


@tool
def record_child_ages(
    ages: Annotated[
        List[int],
        "One age per child, in the order the guest gave them.",
    ],
) -> str:
    """Save the children's ages to D2. Only call this if children_count > 0."""
    d2 = get_current_d2()
    expected = d2.children_count

    if not expected:
        return (
            "No children were recorded for this booking, "
            "so ages aren't needed."
        )

    if len(ages) != expected:
        return (
            f"Expected {expected} age(s) but got {len(ages)}. "
            "Ask the guest again."
        )

    d2.child_ages = list(ages)
    return f"Saved child ages: {ages}"


@tool
def record_meal_plan(
    meal_plan: Annotated[
        str,
        "The meal plan the guest selected, exactly as shown to them.",
    ],
) -> str:
    """Save the guest's selected meal plan to D2 (Conversation Memory)."""
    match = next(
        (
            option
            for option in MEAL_PLAN_OPTIONS
            if option.lower() == meal_plan.strip().lower()
        ),
        None,
    )

    if not match:
        return (
            f"'{meal_plan}' isn't one of the meal plan options: "
            f"{', '.join(MEAL_PLAN_OPTIONS)}."
        )

    d2 = get_current_d2()
    d2.meal_plan = match
    return f"Saved meal plan: {match}"


@tool
def check_reservation_status() -> str:
    """Check which reservation fields are still missing from D2."""
    d2 = get_current_d2()
    missing = d2.missing_fields()
    if not missing:
        return "All reservation fields are recorded."

    return f"Still missing: {', '.join(missing)}"


@tool
def route_to_booking_policy_agent() -> str:
    """
    Route to the Booking Policy Agent (P4) when the guest has
    a policy question.
    """
    session = session_store.get_or_create()
    session.interrupted_from = "reservation"
    session.active_agent = "policy"
    return "Routing to Booking Policy Agent to answer your policy question."


@tool
def return_to_coordinator_agent() -> str:
    """
    Return control to the Coordinator Agent (P2) once the
    reservation is complete.
    """
    session = session_store.get_or_create()
    d2 = session.d2_reservation
    if not d2.is_complete():
        missing = ", ".join(d2.missing_fields())
        return f"Cannot return to Coordinator Agent yet — still missing: {missing}."

    session.active_agent = "completed"
    return (
        "Returned to Coordinator Agent (P2). "
        f"Reservation payload: {d2.model_dump()}"
    )


reservation_agent_tools = [
    record_check_in_date,
    record_check_out_date,
    record_adult_count,
    get_available_room_types,
    record_selected_room_type,
    record_occupancy,
    record_child_ages,
    record_meal_plan,
    check_reservation_status,
    route_to_booking_policy_agent,
    return_to_coordinator_agent,
]
