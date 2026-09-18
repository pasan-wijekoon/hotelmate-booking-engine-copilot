import json
import asyncio
from datetime import date
from typing import AsyncGenerator, Optional
from agent_framework import Agent
from agent_framework.openai import OpenAIChatCompletionClient
from backend.config import OLLAMA_BASE_URL, OLLAMA_API_KEY, OLLAMA_CHAT_MODEL
from backend.memory.session_store import session_store, SessionState
from backend.tools.inventory import ROOM_INVENTORY
from backend.agents.root_agent import create_root_agent
from backend.agents.reservation_agent import create_reservation_agent
from backend.agents.policy_agent import create_policy_agent


# Policy question trigger keywords for system-wide interrupt detection
POLICY_KEYWORDS = [
    "cancellation", "cancel", "refund", "pet", "pets", "dog", "dogs", "cat", "cats",
    "check-in", "check in", "check-out", "check out", "late arrival", "early check",
    "policy", "policies", "deposit", "pre-authorization", "resort fee",
    "loyalty", "silver", "gold", "platinum", "extra bed", "crib", "rollaway"
]


class CoordinatorOrchestrator:
    """Master multi-agent coordinator managing agent handoffs, policy interrupts, and streaming."""

    def __init__(self) -> None:
        self.client = OpenAIChatCompletionClient(
            base_url=OLLAMA_BASE_URL,
            api_key=OLLAMA_API_KEY,
            model=OLLAMA_CHAT_MODEL,
        )
        self.root_agent = create_root_agent(self.client)
        self.reservation_agent = create_reservation_agent(self.client)
        self.policy_agent = create_policy_agent(self.client)

    def _is_policy_query(self, prompt: str) -> bool:
        lowered = prompt.lower()
        return any(keyword in lowered for keyword in POLICY_KEYWORDS)

    def _calculate_estimated_total(self, session: SessionState) -> str:
        d2 = session.d2_reservation
        if not d2.check_in_date or not d2.check_out_date or not d2.room_type:
            return "N/A"
        try:
            d_in = date.fromisoformat(d2.check_in_date)
            d_out = date.fromisoformat(d2.check_out_date)
            nights = max(1, (d_out - d_in).days)
            room_info = ROOM_INVENTORY.get(d2.room_type, {})
            room_rate = room_info.get("base_price_per_night", 150.0)
            room_cost = room_rate * nights

            meal_rates = {
                "Room Only": 0.0,
                "Breakfast Included": 25.0,
                "Half Board": 55.0,
                "Full Board": 85.0,
            }
            meal_rate = meal_rates.get(d2.meal_plan or "Room Only", 0.0)
            total_guests = (d2.adults_count or 1) + (d2.children_count or 0)
            meal_cost = meal_rate * total_guests * nights
            total = room_cost + meal_cost
            return f"${total:,.2f} (${room_cost:,.2f} room + ${meal_cost:,.2f} meals for {nights} night{'s' if nights > 1 else ''})"
        except Exception:
            return "Calculated upon check-in"

    def format_reservation_summary(self, session: SessionState) -> str:
        d1 = session.d1_identity
        d2 = session.d2_reservation
        total_estimate = self._calculate_estimated_total(session)

        summary = (
            f"### 🎉 Reservation Details Confirmed\n\n"
            f"**Guest Information:**\n"
            f"- **Name:** {d1.first_name} {d1.last_name}\n"
            f"- **Email:** {d1.email}\n"
            f"- **Phone:** {d1.phone_number}\n\n"
            f"**Stay Details:**\n"
            f"- **Check-in:** {d2.check_in_date}\n"
            f"- **Check-out:** {d2.check_out_date}\n"
            f"- **Room Type:** {d2.room_type}\n"
            f"- **Occupancy:** {d2.adults_count} Adult(s)"
            + (f", {d2.children_count} Child(ren) (Ages: {', '.join(map(str, d2.child_ages))})" if d2.children_count else "")
            + f"\n- **Meal Plan:** {d2.meal_plan}\n"
            f"- **Estimated Total:** {total_estimate}\n\n"
            f"Thank you for choosing Grand Horizon Hotel & Resort! If you have any further questions or policy inquiries, please feel free to ask."
        )
        return summary

    async def run_turn(self, prompt: str, session_id: Optional[str] = None) -> str:
        """Processes a single conversational turn through the coordinator."""
        session = session_store.get_or_create(session_id)
        session.add_message("user", prompt)

        # Check for system-wide policy interrupt
        if self._is_policy_query(prompt) and session.active_agent != "policy":
            session.interrupted_from = session.active_agent
            session.active_agent = "policy"

        active = session.active_agent
        response_text = ""

        if active == "root":
            res = await self.root_agent.run(prompt)
            response_text = res.text
            if session.d1_identity.is_complete() and session.active_agent == "reservation":
                # Seamlessly transition to reservation agent welcome
                res2 = await self.reservation_agent.run("Guest identity recorded. Please proceed to ask for check-in date.")
                response_text = f"{response_text}\n\n{res2.text}"

        elif active == "reservation":
            res = await self.reservation_agent.run(prompt)
            response_text = res.text
            if session.d2_reservation.is_complete():
                session.active_agent = "completed"
                summary = self.format_reservation_summary(session)
                response_text = f"{response_text}\n\n{summary}"

        elif active == "policy":
            res = await self.policy_agent.run(prompt)
            response_text = res.text
            # If guest says they have no more questions or wants to continue
            lower_p = prompt.lower()
            if any(w in lower_p for w in ["no", "nope", "continue", "back", "book", "done"]):
                return_agent = session.interrupted_from or "reservation"
                session.active_agent = return_agent
                session.interrupted_from = None
                response_text += f"\n\nReturning to your booking details..."

        elif active == "completed":
            # Answer any post-booking policy inquiries or general greetings
            if self._is_policy_query(prompt):
                res = await self.policy_agent.run(prompt)
                response_text = res.text
            else:
                response_text = f"Your reservation is already confirmed! Here is your summary:\n\n{self.format_reservation_summary(session)}"

        session.add_message("assistant", response_text)
        return response_text

    async def stream_turn(self, prompt: str, session_id: Optional[str] = None) -> AsyncGenerator[str, None]:
        """
        Yields NDJSON chunks compatible with frontend useChatStream hook:
        {"response": "token", "isTextareaDisabled": false}\n
        """
        try:
            full_response = await self.run_turn(prompt, session_id)

            # Stream words/tokens for smooth typewriter effect in frontend UI
            words = full_response.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                chunk_json = json.dumps({"response": chunk, "isTextareaDisabled": False})
                yield f"{chunk_json}\n"
                await asyncio.sleep(0.015)  # Natural typewriter pacing

        except Exception as err:
            err_msg = f"Error processing request: {str(err)}"
            error_chunk = json.dumps({"response": err_msg, "isTextareaDisabled": False})
            yield f"{error_chunk}\n"


# Global singleton coordinator
coordinator = CoordinatorOrchestrator()
