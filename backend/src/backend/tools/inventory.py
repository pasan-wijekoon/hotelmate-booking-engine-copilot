from typing import Dict, Any, List

ROOM_INVENTORY: Dict[str, Dict[str, Any]] = {
    "Standard": {
        "available": 12,
        "max_adults": 2,
        "max_children": 1,
        "base_price_per_night": 120.0,
    },
    "Deluxe": {
        "available": 8,
        "max_adults": 2,
        "max_children": 2,
        "base_price_per_night": 180.0,
    },
    "Family Suite": {
        "available": 4,
        "max_adults": 3,
        "max_children": 3,
        "base_price_per_night": 260.0,
    },
    "Executive Suite": {
        "available": 3,
        "max_adults": 2,
        "max_children": 1,
        "base_price_per_night": 340.0,
    },
}

MEAL_PLAN_OPTIONS: List[str] = [
    "Room Only",
    "Breakfast Included",
    "Half Board",
    "Full Board",
]
