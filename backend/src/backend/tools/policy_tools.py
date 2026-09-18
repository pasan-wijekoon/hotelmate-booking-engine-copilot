from typing import Annotated
from agent_framework import tool
from backend.rag.pipeline import policy_kb
from backend.memory.session_store import session_store


@tool
async def search_hotel_policies(
    query: Annotated[
        str,
        "The guest's question, used to search the hotel policy knowledge base.",
    ],
) -> str:
    """
    Search the Grand Horizon Hotel & Resort booking-policy knowledge base
    and return the most relevant policy excerpts for the given question.
    Call this whenever the guest asks about reservations, cancellations,
    check-in/out times, payments, occupancy, pets, loyalty tiers, or any
    other hotel booking policy. Do not guess at policy details without
    calling this first.
    """
    results = await policy_kb.hybrid_search(query, top_k=3)

    if not results:
        # Fallback to keyword search if hybrid search returned nothing
        keyword_results = policy_kb.keyword_search(query, top_k=3)
        if keyword_results:
            return "\n\n".join(
                f"[{doc_id}] {doc}" for doc_id, doc, _score in keyword_results
            )
        return "No relevant policy information was found."

    return "\n\n".join(
        f"[{doc_id}] {doc}" for doc_id, doc, _score in results
    )


@tool
def return_to_previous_agent() -> str:
    """
    Return control to the agent that was active before the policy question
    was asked (e.g. Reservation Agent or Root Agent).
    """
    session = session_store.get_or_create()
    target_agent = session.interrupted_from or "reservation"
    session.active_agent = target_agent
    session.interrupted_from = None
    return f"Returned control back to {target_agent} agent."


policy_agent_tools = [
    search_hotel_policies,
    return_to_previous_agent,
]
