"""Entity schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID

from app.models.enums import EntityAction


class EntityBase(BaseModel):
    entity_type: str
    start_char: int
    end_char: int
    bbox: List[float] = Field(..., min_length=4, max_length=4)
    confidence: float
    page_num: int


class EntityRead(EntityBase):
    id: UUID
    document_id: UUID
    page_id: Optional[UUID] = None
    rule_id: Optional[UUID] = None
    action_taken: EntityAction
    reviewer_id: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    original_text: Optional[str] = None
    replacement_text: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EntityUpdate(BaseModel):
    action_taken: Optional[EntityAction] = None
    replacement_text: Optional[str] = None
    reviewer_id: Optional[UUID] = None


class EntityBatchUpdate(BaseModel):
    entities: List[EntityUpdate]
    document_id: UUID


class EntityStats(BaseModel):
    total: int
    by_type: dict
    by_action: dict
    pending_review: int
    reviewed: int
