"""Withdrawal rule model."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, Enum, Integer, Boolean, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.models.enums import EntityAction


class WithdrawalRule(Base):
    __tablename__ = "withdrawal_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    pattern_regex: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    action: Mapped[EntityAction] = mapped_column(Enum(EntityAction), nullable=False)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])
    entities: Mapped[list["DetectedEntity"]] = relationship("DetectedEntity", back_populates="rule")

    # Indexes
    __table_args__ = (
        Index("ix_rules_entity_active", "entity_type", "is_active"),
        Index("ix_rules_version", "version"),
    )

    def __repr__(self) -> str:
        return f"<WithdrawalRule(id={self.id}, name={self.name}, entity_type={self.entity_type}, action={self.action})>"
