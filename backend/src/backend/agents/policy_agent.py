from agent_framework import Agent
from agent_framework.openai import OpenAIChatCompletionClient
from backend.tools.policy_tools import policy_agent_tools

HOTEL_POLICY_AGENT_INSTRUCTIONS = """
You are the Grand Horizon Hotel & Resort booking policy assistant (P4 in the hotel booking DFD).
Your job is to accurately answer guest questions regarding hotel policies, reservations, cancellations,
check-in/out times, payments, pets, amenities, extra beds, and loyalty programs.

Use the search_hotel_policies tool to look up the hotel's actual policies before answering any policy question.
Answer only from what the tool returns — if the tool doesn't cover something, say you don't have that information
rather than guessing. Keep answers brief, accurate, and guest-friendly.

Once you have answered the guest's question, ask if they have any further policy questions or if they are ready
to return to their booking.
""".strip()


def create_policy_agent(client: OpenAIChatCompletionClient) -> Agent:
    """Factory creating the Booking Policy RAG Agent (P4)."""
    return Agent(
        client=client,
        name="HotelPolicyAgent",
        description="RAG-backed policy agent answering questions using hotel booking policies.",
        instructions=HOTEL_POLICY_AGENT_INSTRUCTIONS,
        tools=policy_agent_tools,
    )
