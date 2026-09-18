import json
from fastapi.testclient import TestClient
from backend.main import app
from backend.memory.session_store import session_store


def test_multi_turn_simulation():
    client = TestClient(app)
    session_id = "test-guest-session-101"
    session_store.delete(session_id)
    session = session_store.get_or_create(session_id)

    # 1. Provide identity to D1
    session.d1_identity.first_name = "Kasun"
    session.d1_identity.last_name = "Silva"
    session.d1_identity.email = "kasun.silva@example.com"
    session.d1_identity.phone_number = "+94 71 987 6543"
    session.active_agent = "reservation"

    # 2. Provide reservation to D2
    session.d2_reservation.check_in_date = "2026-11-15"
    session.d2_reservation.check_out_date = "2026-11-18"
    session.d2_reservation.adults_count = 2
    session.d2_reservation.room_type = "Executive Suite"
    session.d2_reservation.meal_plan = "Half Board"

    # 3. Test policy question interrupt via /api/chat
    req_body = {
        "prompt": "What is the cancellation policy for my booking?",
        "session_id": session_id,
    }
    response = client.post("/api/chat", json=req_body)
    assert response.status_code == 200
    assert "application/x-ndjson" in response.headers.get("content-type", "")

    # Collect streamed response text
    streamed_text = ""
    for line in response.text.strip().split("\n"):
        if line.strip():
            chunk = json.loads(line)
            streamed_text += chunk.get("response", "")

    assert len(streamed_text) > 0
    # Policy agent should have been triggered
    assert session.active_agent == "policy" or session.interrupted_from is not None or "cancellation" in streamed_text.lower()


if __name__ == "__main__":
    test_multi_turn_simulation()
    print("Multi-turn flow test passed successfully!")
