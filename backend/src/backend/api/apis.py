from fastapi import APIRouter
from backend.api.chat import router as chat_router
from backend.api.health import router as health_router

api_router = APIRouter()
api_router.include_router(chat_router)
api_router.include_router(health_router)
