"""Document schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from uuid import UUID

from app.models.enums import DocumentStatus
from app.schemas.entity import EntityRead
from app.schemas.user import UserRead


class DocumentBase(BaseModel):
    original_filename: str


class DocumentCreate(DocumentBase):
    pass


class DocumentRead(DocumentBase):
    id: UUID
    status: DocumentStatus
    version: int
    page_count: int
    assigned_to: Optional[UUID] = None
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentList(BaseModel):
    id: UUID
    original_filename: str
    status: DocumentStatus
    version: int
    page_count: int
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDetail(DocumentRead):
    original_path: str
    redacted_path: Optional[str] = None
    plain_text_path: Optional[str] = None
    current_rule_set_version: Optional[int] = None
    ocr_text: Optional[str] = None
    entities: List[EntityRead] = []
    pages: List["PageRead"] = []

    model_config = ConfigDict(from_attributes=True)


class DocumentStatusUpdate(BaseModel):
    status: DocumentStatus
    rejection_reason: Optional[str] = None


class PageRead(BaseModel):
    id: UUID
    page_num: int
    ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    source: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Resolve forward references
DocumentDetail.model_rebuild()
