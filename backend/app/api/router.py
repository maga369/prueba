"""Main API router."""
from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.documents import router as documents_router
from app.api.entities import router as entities_router
from app.api.rules import router as rules_router
from app.api.audit import router as audit_router

api_router = APIRouter()

api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(entities_router, prefix="/entities", tags=["entities"])
api_router.include_router(rules_router, prefix="/rules", tags=["rules"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
