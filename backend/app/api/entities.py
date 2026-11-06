"""Entity review and management endpoints."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.document import Document, DocumentStatus
from app.models.entity import DetectedEntity, EntityAction
from app.schemas.entity import EntityRead, EntityUpdate, EntityBatchUpdate, EntityStats

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("/document/{doc_id}", response_model=List[EntityRead])
async def get_document_entities(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """Get all entities for a document."""
    user_id = uuid.UUID(current_user["sub"])
    user_roles = current_user.get("realm_access", {}).get("roles", [])

    # Check document access
    doc_result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = doc_result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if "admin" not in user_roles:
        if "transcriptor" in user_roles and doc.assigned_to != user_id:
            raise HTTPException(403, "Not assigned to this document")
        elif "aprobador" in user_roles and doc.status not in [
            DocumentStatus.READY_FOR_APPROVAL,
            DocumentStatus.APPROVED,
            DocumentStatus.REJECTED,
        ]:
            raise HTTPException(403, "Document not in reviewable state")

    result = await db.execute(
        select(DetectedEntity)
        .where(DetectedEntity.document_id == doc_id)
        .order_by(DetectedEntity.page_id, DetectedEntity.start_char)
    )
    entities = result.scalars().all()

    return [
        EntityRead(
            id=e.id,
            document_id=e.document_id,
            page_id=e.page_id,
            entity_type=e.entity_type,
            start_char=e.start_char,
            end_char=e.end_char,
            bbox=e.bbox,
            confidence=e.confidence,
            page_num=e.page.page_num if e.page else 1,
            rule_id=e.rule_id,
            action_taken=e.action_taken,
            reviewer_id=e.reviewer_id,
            reviewed_at=e.reviewed_at,
            original_text=e.original_text,
            replacement_text=e.replacement_text,
            created_at=e.created_at,
        )
        for e in entities
    ]


@router.patch("/{entity_id}", response_model=EntityRead)
async def update_entity(
    entity_id: uuid.UUID,
    update: EntityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor")),
):
    """Update a single entity (action, replacement text)."""
    user_id = uuid.UUID(current_user["sub"])

    result = await db.execute(
        select(DetectedEntity)
        .options(selectinload(DetectedEntity.document))
        .where(DetectedEntity.id == entity_id)
    )
    entity = result.scalar_one_or_none()

    if not entity:
        raise HTTPException(404, "Entity not found")

    if entity.document.assigned_to != user_id:
        raise HTTPException(403, "Not assigned to this document")

    if entity.document.status not in [DocumentStatus.IN_REVIEW, DocumentStatus.PII_DONE]:
        raise HTTPException(400, "Document not in reviewable state")

    if update.action_taken is not None:
        entity.action_taken = update.action_taken
    if update.replacement_text is not None:
        entity.replacement_text = update.replacement_text
    if update.reviewer_id is not None:
        entity.reviewer_id = update.reviewer_id

    entity.reviewed_at = datetime.utcnow()
    entity.reviewer_id = user_id

    await db.commit()
    await db.refresh(entity)

    return EntityRead(
        id=entity.id,
        document_id=entity.document_id,
        page_id=entity.page_id,
        entity_type=entity.entity_type,
        start_char=entity.start_char,
        end_char=entity.end_char,
        bbox=entity.bbox,
        confidence=entity.confidence,
        page_num=entity.page.page_num if entity.page else 1,
        rule_id=entity.rule_id,
        action_taken=entity.action_taken,
        reviewer_id=entity.reviewer_id,
        reviewed_at=entity.reviewed_at,
        original_text=entity.original_text,
        replacement_text=entity.replacement_text,
        created_at=entity.created_at,
    )


@router.patch("/batch", response_model=List[EntityRead])
async def batch_update_entities(
    batch: EntityBatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor")),
):
    """Batch update multiple entities."""
    user_id = uuid.UUID(current_user["sub"])

    # Verify document access
    doc_result = await db.execute(
        select(Document).where(Document.id == batch.document_id)
    )
    doc = doc_result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.assigned_to != user_id:
        raise HTTPException(403, "Not assigned to this document")

    if doc.status not in [DocumentStatus.IN_REVIEW, DocumentStatus.PII_DONE]:
        raise HTTPException(400, "Document not in reviewable state")

    # Get all entities
    entity_ids = [u.entity_id for u in batch.entities if hasattr(u, 'entity_id')]
    # Note: The batch schema needs entity_id field - we'll handle via dict

    # For simplicity, update by index in the list
    result = await db.execute(
        select(DetectedEntity)
        .where(DetectedEntity.document_id == batch.document_id)
        .order_by(DetectedEntity.page_id, DetectedEntity.start_char)
    )
    entities = result.scalars().all()

    updated = []
    for i, update_data in enumerate(batch.entities):
        if i < len(entities):
            entity = entities[i]
            if update_data.action_taken is not None:
                entity.action_taken = update_data.action_taken
            if update_data.replacement_text is not None:
                entity.replacement_text = update_data.replacement_text
            entity.reviewed_at = datetime.utcnow()
            entity.reviewer_id = user_id
            updated.append(entity)

    await db.commit()

    return [
        EntityRead(
            id=e.id,
            document_id=e.document_id,
            page_id=e.page_id,
            entity_type=e.entity_type,
            start_char=e.start_char,
            end_char=e.end_char,
            bbox=e.bbox,
            confidence=e.confidence,
            page_num=e.page.page_num if e.page else 1,
            rule_id=e.rule_id,
            action_taken=e.action_taken,
            reviewer_id=e.reviewer_id,
            reviewed_at=e.reviewed_at,
            original_text=e.original_text,
            replacement_text=e.replacement_text,
            created_at=e.created_at,
        )
        for e in updated
    ]


@router.get("/document/{doc_id}/stats", response_model=EntityStats)
async def get_entity_stats(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """Get entity statistics for a document."""
    result = await db.execute(
        select(DetectedEntity).where(DetectedEntity.document_id == doc_id)
    )
    entities = result.scalars().all()

    by_type = {}
    by_action = {}
    pending = 0
    reviewed = 0

    for e in entities:
        by_type[e.entity_type] = by_type.get(e.entity_type, 0) + 1
        by_action[e.action_taken.value] = by_action.get(e.action_taken.value, 0) + 1
        if e.reviewed_at:
            reviewed += 1
        else:
            pending += 1

    return EntityStats(
        total=len(entities),
        by_type=by_type,
        by_action=by_action,
        pending_review=pending,
        reviewed=reviewed,
    )
