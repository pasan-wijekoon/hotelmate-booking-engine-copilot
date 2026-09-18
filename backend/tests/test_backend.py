import json
from fastapi.testclient import TestClient
from backend.main import app
from backend.memory.session_store import session_store
from backend.rag.pipeline import policy_kb
from backend.tools.root_tools import (
    record_first_and_last_name,
    record_email,
    record_phone_number,
    check_identity_status,
)
from backend.tools.reservation_tools import (
    record_check_in_date,
    record_check_out_date,
    record_adult_count,
    get_available_room_types,
    record_selected_room_type,
    record_occupancy,
    record_child_ages,
    record_meal_plan,
    check_reservation_status,
)


def test_d1_root_tools():
    session_store.delete("default-session")
    session = session_store.get_or_create("default-session")
    
    # Name
    res = record_first_and_last_name(first_name="Amara", last_name="Perera")
    assert "Amara Perera" in res
    assert session.d1_identity.first_name == "Amara"
    assert session.d1_identity.last_name == "Perera"

    # Email invalid then valid
    res_bad = record_email(email="bad-email")
    assert "doesn't look like a valid email" in res_bad
    res_good = record_email(email="amara@example.com")
    assert "Saved email" in res_good
    assert session.d1_identity.email == "amara@example.com"

    # Phone
    res_phone = record_phone_number(phone_number="+94 77 123 4567")
    assert "Saved phone number" in res_phone
    assert session.d1_identity.phone_number == "+94 77 123 4567"

    # Status
    status = check_identity_status()
    assert "All identity fields are recorded" in status
    assert session.d1_identity.is_complete()


def test_d2_reservation_tools():
    session_store.delete("default-session")
    session = session_store.get_or_create("default-session")

    # Dates
    res_in = record_check_in_date(check_in_date="2026-12-10")
    assert "2026-12-10" in res_in
    res_out = record_check_out_date(check_out_date="2026-12-14")
    assert "2026-12-14" in res_out

    # Invalid check-out before check-in
    res_bad_out = record_check_out_date(check_out_date="2026-12-09")
    assert "Check-out date must be after" in res_bad_out

    # Adult count
    res_adults = record_adult_count(adults=2)
    assert "Saved initial adult count: 2" in res_adults

    # Room availability & selection
    rooms = get_available_room_types()
    assert "Deluxe" in rooms
    res_room = record_selected_room_type(room_type="Deluxe")
    assert "Saved selected room type: Deluxe" in res_room

    # Occupancy limits
    res_occ = record_occupancy(adults=2, children=1)
    assert "Saved occupancy: 2 adults, 1 children" in res_occ
    res_ages = record_child_ages(ages=[8])
    assert "Saved child ages" in res_ages

    # Meal plan
    res_meal = record_meal_plan(meal_plan="Breakfast Included")
    assert "Saved meal plan: Breakfast Included" in res_meal

    # Check complete
    res_status = check_reservation_status()
    assert "All reservation fields are recorded" in res_status


def test_rag_bm25_pipeline():
    policy_kb.initialize()
    assert len(policy_kb.bm25_doc_ids) > 0
    results = policy_kb.keyword_search("cancellation policy", top_k=2)
    assert len(results) > 0
    assert any("Cancellation" in doc or "cancellation" in doc for _, doc, _ in results)


def test_health_api():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.0.1"

    # Redundant un-prefixed route should be 404
    assert client.get("/health").status_code == 404


def test_chat_api_ndjson_streaming():
    client = TestClient(app)
    payload = {"prompt": "Hi, I would like to book a room."}
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    assert "application/x-ndjson" in response.headers.get("content-type", "")

    # Redundant un-prefixed route should be 404
    assert client.post("/chat", json=payload).status_code == 404

    # Parse streamed lines
    lines = response.text.strip().split("\n")
    assert len(lines) > 0
    first_chunk = json.loads(lines[0])
    assert "response" in first_chunk
    assert "isTextareaDisabled" in first_chunk
