"""Document management endpoints."""
import uuid
import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
import minio
from minio.error import S3Error

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.document import Document, DocumentStatus, DocumentPage
from app.models.entity import DetectedEntity
from app.models.user import User
from app.schemas.document import DocumentRead, DocumentList, DocumentDetail, DocumentStatusUpdate, PageRead
from app.schemas.entity import EntityRead
from app.workers.celery_app import process_document_task, redact_document_task, export_document_task
from app.services.storage import get_minio_client, ensure_bucket

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """Upload a document for processing."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    await ensure_bucket()

    client = get_minio_client()
    file_id = uuid.uuid4()
    object_name = f"originals/{file_id}{ext}"

    try:
        client.put_object(
            settings.MINIO_BUCKET,
            object_name,
            data=content,
            length=len(content),
            content_type=file.content_type or "application/octet-stream",
        )
    except S3Error as e:
        raise HTTPException(500, f"Storage error: {e}")

    doc = Document(
        original_filename=file.filename,
        original_path=object_name,
        status=DocumentStatus.UPLOADED,
        created_by=uuid.UUID(current_user["sub"]),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    process_document_task.delay(str(doc.id))

    return doc


@router.get("", response_model=List[DocumentList])
async def list_documents(
    status_filter: Optional[DocumentStatus] = Query(None, alias="status"),
    assigned_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """List documents with filtering."""
    user_id = uuid.UUID(current_user["sub"])
    user_roles = current_user.get("realm_access", {}).get("roles", [])

    query = select(Document).options(selectinload(Document.assignee))

    if "admin" not in user_roles:
        if assigned_only or "transcriptor" in user_roles:
            query = query.where(Document.assigned_to == user_id)
        elif "aprobador" in user_roles:
            query = query.where(Document.status.in_([
                DocumentStatus.READY_FOR_APPROVAL,
                DocumentStatus.APPROVED,
                DocumentStatus.REJECTED,
            ]))

    if status_filter:
        query = query.where(Document.status == status_filter)

    query = query.order_by(desc(Document.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    documents = result.scalars().all()

    return [
        DocumentList(
            id=d.id,
            original_filename=d.original_filename,
            status=d.status,
            version=d.version,
            page_count=d.page_count,
            assignee_name=d.assignee.full_name if d.assignee else None,
            assignee_email=d.assignee.email if d.assignee else None,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in documents
    ]


@router.get("/{doc_id}", response_model=DocumentDetail)
async def get_document(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """Get document with full details including entities and pages."""
    user_id = uuid.UUID(current_user["sub"])
    user_roles = current_user.get("realm_access", {}).get("roles", [])

    query = (
        select(Document)
        .options(
            selectinload(Document.pages),
            selectinload(Document.entities),
            selectinload(Document.assignee),
            selectinload(Document.approver),
        )
        .where(Document.id == doc_id)
    )

    if "admin" not in user_roles:
        query = query.where(
            (Document.assigned_to == user_id) |
            (Document.status.in_([
                DocumentStatus.READY_FOR_APPROVAL,
                DocumentStatus.APPROVED,
                DocumentStatus.REJECTED,
            ]))
        )

    result = await db.execute(query)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    return DocumentDetail(
        id=doc.id,
        original_filename=doc.original_filename,
        original_path=doc.original_path,
        redacted_path=doc.redacted_path,
        plain_text_path=doc.plain_text_path,
        status=doc.status,
        version=doc.version,
        page_count=doc.page_count,
        current_rule_set_version=doc.current_rule_set_version,
        assigned_to=doc.assigned_to,
        approved_by=doc.approved_by,
        approved_at=doc.approved_at,
        rejection_reason=doc.rejection_reason,
        created_by=doc.created_by,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        ocr_text="\n\n".join([p.ocr_text or "" for p in doc.pages]),
        entities=[
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
            for e in doc.entities
        ],
        pages=[
            PageRead(
                id=p.id,
                page_num=p.page_num,
                ocr_text=p.ocr_text,
                ocr_confidence=p.ocr_confidence,
                image_width=p.image_width,
                image_height=p.image_height,
                source=p.source,
            )
            for p in doc.pages
        ],
    )


@router.post("/{doc_id}/submit-review", response_model=DocumentRead)
async def submit_for_review(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor")),
):
    """Submit document for approval after review."""
    user_id = uuid.UUID(current_user["sub"])

    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.assigned_to == user_id)
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found or not assigned to you")

    if doc.status != DocumentStatus.IN_REVIEW:
        raise HTTPException(400, "Document must be in review status")

    unreviewed = await db.execute(
        select(func.count(DetectedEntity.id)).where(
            DetectedEntity.document_id == doc_id,
            DetectedEntity.reviewed_at.is_(None),
        )
    )
    if unreviewed.scalar() > 0:
        raise HTTPException(400, "All entities must be reviewed before submission")

    doc.status = DocumentStatus.READY_FOR_APPROVAL
    await db.commit()
    await db.refresh(doc)

    return doc


@router.post("/{doc_id}/approve", response_model=DocumentRead)
async def approve_document(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("aprobador", "admin")),
):
    """Approve document and queue redaction/export."""
    user_id = uuid.UUID(current_user["sub"])

    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.status != DocumentStatus.READY_FOR_APPROVAL:
        raise HTTPException(400, "Document not ready for approval")

    doc.status = DocumentStatus.APPROVED
    doc.approved_by = user_id
    doc.approved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(doc)

    redact_document_task.delay(str(doc.id))
    export_document_task.delay(str(doc.id))

    return doc


@router.post("/{doc_id}/reject", response_model=DocumentRead)
async def reject_document(
    doc_id: uuid.UUID,
    reason: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("aprobador", "admin")),
):
    """Reject document and return to transcriptor."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.status != DocumentStatus.READY_FOR_APPROVAL:
        raise HTTPException(400, "Document not in approval stage")

    doc.status = DocumentStatus.REJECTED
    doc.rejection_reason = reason
    doc.assigned_to = doc.created_by
    await db.commit()
    await db.refresh(doc)

    return doc


@router.get("/{doc_id}/export")
async def export_document(
    doc_id: uuid.UUID,
    format: str = Query("pdf", pattern="^(pdf|txt)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """Download redacted document."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.status not in [DocumentStatus.APPROVED, DocumentStatus.EXPORTED]:
        raise HTTPException(400, "Document not approved yet")

    if format == "pdf" and doc.redacted_path:
        path = doc.redacted_path
        filename = f"redacted_{doc.original_filename}"
        media_type = "application/pdf"
    elif format == "txt" and doc.plain_text_path:
        path = doc.plain_text_path
        filename = f"clean_{os.path.splitext(doc.original_filename)[0]}.txt"
        media_type = "text/plain"
    else:
        raise HTTPException(404, "Export not available")

    client = get_minio_client()
    try:
        response = client.get_object(settings.MINIO_BUCKET, path)
        data = response.read()
        response.close()
        response.release_conn()
    except S3Error:
        raise HTTPException(404, "File not found in storage")

    return StreamingResponse(
        iter([data]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Delete document (admin only)."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    client = get_minio_client()
    for path in [doc.original_path, doc.redacted_path, doc.plain_text_path]:
        if path:
            try:
                client.remove_object(settings.MINIO_BUCKET, path)
            except S3Error:
                pass

    await db.delete(doc)
    await db.commit()
