"""Rule schemas."""
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict
from uuid import UUID

from app.models.enums import EntityAction


class RuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    entity_type: str
    pattern_regex: Optional[str] = None
    action: EntityAction
    config: Dict = {}
    is_active: bool = True


class RuleCreate(RuleBase):
    pass


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    pattern_regex: Optional[str] = None
    action: Optional[EntityAction] = None
    config: Optional[Dict] = None
    is_active: Optional[bool] = None


class RuleRead(RuleBase):
    id: UUID
    version: int
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RuleList(BaseModel):
    id: UUID
    name: str
    entity_type: str
    action: EntityAction
    is_active: bool
    version: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
