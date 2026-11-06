"""Audit log endpoints."""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.audit import AuditLog
from app.models.document import Document
from app.schemas.audit import AuditLogRead, AuditLogList

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/document/{doc_id}", response_model=AuditLogList)
async def get_document_audit(
    doc_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """Get audit log for a specific document."""
    # Verify document exists
    doc_result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = doc_result.scalar_one_or_none()
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(404, "Document not found")

    query = select(AuditLog).where(AuditLog.document_id == doc_id)

    if action:
        query = query.where(AuditLog.action == action)

    # Total count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.order_by(desc(AuditLog.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    return AuditLogList(
        items=[
            AuditLogRead(
                id=item.id,
                document_id=item.document_id,
                user_id=item.user_id,
                action=item.action,
                details=item.details,
                ip_address=str(item.ip_address) if item.ip_address else None,
                user_agent=item.user_agent,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/user/{user_id}", response_model=AuditLogList)
async def get_user_audit(
    user_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Get audit log for a specific user (admin only)."""
    query = select(AuditLog).where(AuditLog.user_id == user_id)

    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.order_by(desc(AuditLog.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    return AuditLogList(
        items=[
            AuditLogRead(
                id=item.id,
                document_id=item.document_id,
                user_id=item.user_id,
                action=item.action,
                details=item.details,
                ip_address=str(item.ip_address) if item.ip_address else None,
                user_agent=item.user_agent,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats/summary")
async def get_audit_summary(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Get audit statistics summary (admin only)."""
    query = select(AuditLog.action, func.count(AuditLog.id)).group_by(AuditLog.action)

    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    result = await db.execute(query)
    by_action = {action: count for action, count in result.all()}

    # Documents processed
    doc_query = select(func.count(Document.id)).where(Document.status == "approved")
    if start_date:
        doc_query = doc_query.where(Document.approved_at >= start_date)
    if end_date:
        doc_query = doc_query.where(Document.approved_at <= end_date)
    docs_approved = (await db.execute(doc_query)).scalar()

    return {
        "by_action": by_action,
        "documents_approved": docs_approved,
        "total_events": sum(by_action.values()),
    }
