"""Audit log schemas."""
from datetime import datetime
from typing import Optional, Dict
from pydantic import BaseModel, ConfigDict
from uuid import UUID


class AuditLogRead(BaseModel):
    id: int
    document_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    action: str
    details: Optional[Dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogList(BaseModel):
    items: list[AuditLogRead]
    total: int
    page: int
    page_size: int
