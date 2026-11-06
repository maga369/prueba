"""Detected entity model."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Enum, Integer, Float, ForeignKey, JSON, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.models.enums import EntityAction


class DetectedEntity(Base):
    __tablename__ = "detected_entities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    page_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_pages.id", ondelete="CASCADE"), nullable=True, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    start_char: Mapped[int] = mapped_column(Integer, nullable=False)
    end_char: Mapped[int] = mapped_column(Integer, nullable=False)
    bbox: Mapped[dict] = mapped_column(JSON, nullable=False)  # [x0, y0, x1, y1] in PDF points
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("withdrawal_rules.id"), nullable=True
    )
    action_taken: Mapped[EntityAction] = mapped_column(
        Enum(EntityAction), default=EntityAction.REMOVE, nullable=False
    )
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    original_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    replacement_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="entities")
    page: Mapped[Optional["DocumentPage"]] = relationship("DocumentPage", back_populates="entities")
    rule: Mapped[Optional["WithdrawalRule"]] = relationship("WithdrawalRule")
    reviewer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewer_id])

    # Indexes
    __table_args__ = (
        Index("ix_entities_doc_reviewed", "document_id", "reviewed_at"),
        Index("ix_entities_type_action", "entity_type", "action_taken"),
        Index("ix_entities_page_bbox", "page_id", "bbox"),
    )

    def __repr__(self) -> str:
        return f"<DetectedEntity(id={self.id}, type={self.entity_type}, action={self.action_taken})>"
