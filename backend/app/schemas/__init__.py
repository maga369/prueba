"""Pydantic schemas for API."""
from app.schemas.user import UserRead, UserCreate, UserUpdate
from app.schemas.document import (
    DocumentCreate,
    DocumentRead,
    DocumentList,
    DocumentDetail,
    DocumentStatusUpdate,
    PageRead,
)
from app.schemas.entity import (
    EntityRead,
    EntityUpdate,
    EntityBatchUpdate,
    EntityStats,
)
from app.schemas.rule import RuleCreate, RuleRead, RuleUpdate, RuleList
from app.schemas.audit import AuditLogRead, AuditLogList
from app.schemas.auth import Token, TokenData, LoginRequest

__all__ = [
    "UserRead",
    "UserCreate",
    "UserUpdate",
    "DocumentCreate",
    "DocumentRead",
    "DocumentList",
    "DocumentDetail",
    "DocumentStatusUpdate",
    "PageRead",
    "EntityRead",
    "EntityUpdate",
    "EntityBatchUpdate",
    "EntityStats",
    "RuleCreate",
    "RuleRead",
    "RuleUpdate",
    "RuleList",
    "AuditLogRead",
    "AuditLogList",
    "Token",
    "TokenData",
    "LoginRequest",
]
