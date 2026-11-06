"""Celery tasks for document processing pipeline."""
import asyncio
import uuid
import os
import tempfile
from datetime import datetime
from typing import Optional
from celery import shared_task
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
import structlog

from app.core.config import settings
from app.models.document import Document, DocumentStatus, DocumentPage
from app.models.entity import DetectedEntity
from app.models.audit import AuditLog
from app.models.rule import WithdrawalRule
from app.services.ocr import extract_text_with_bboxes
from app.services.pii import pii_service
from app.services.pdf_redactor import redact_pdf
from app.services.storage import get_minio_client, download_file, upload_file

logger = structlog.get_logger(__name__)

# Database engine for workers
engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncSession:
    return async_session_maker()


def log_audit(
    db: AsyncSession,
    document_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    action: str,
    details: dict = None,
) -> None:
    """Add audit log entry."""
    audit = AuditLog(
        document_id=document_id,
        user_id=user_id,
        action=action,
        details=details or {},
    )
    db.add(audit)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_document_task(self, doc_id: str):
    """Main document processing pipeline: OCR -> PII Detection."""
    asyncio.run(_process_document(doc_id))


async def _process_document(doc_id: str):
    doc_uuid = uuid.UUID(doc_id)
    async with get_db_session() as db:
        doc = await db.get(Document, doc_uuid)
        if not doc:
            logger.error("Document not found", doc_id=doc_id)
            return

        try:
            # ===== STAGE 1: OCR =====
            doc.status = DocumentStatus.OCR_PROCESSING
            await db.commit()
            log_audit(db, doc_uuid, None, "OCR_STARTED")

            # Download from MinIO
            client = get_minio_client()
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                response = client.get_object(settings.MINIO_BUCKET, doc.original_path)
                with open(tmp_path, "wb") as f:
                    f.write(response.read())
                response.close()
                response.release_conn()
            except Exception as e:
                logger.error("Failed to download document", error=str(e))
                raise

            # Extract text with bboxes
            pages = await extract_text_with_bboxes(tmp_path)

            # Save pages to DB
            full_text_parts = []
            for page_data in pages:
                page = DocumentPage(
                    document_id=doc_uuid,
                    page_num=page_data["page_num"],
                    ocr_text=page_data["text"],
                    ocr_confidence=sum(w.get("confidence", 1.0) for w in page_data.get("words", [])) / max(len(page_data.get("words", [])), 1) if page_data.get("words") else None,
                    image_width=page_data.get("image_width"),
                    image_height=page_data.get("image_height"),
                    source=page_data.get("source", "ocr"),
                )
                db.add(page)
                full_text_parts.append(page_data["text"])

            doc.ocr_text = "\n\n".join(full_text_parts)
            doc.page_count = len(pages)
            doc.status = DocumentStatus.OCR_DONE
            await db.commit()
            log_audit(db, doc_uuid, None, "OCR_COMPLETED", {"pages": len(pages)})

            # ===== STAGE 2: PII Detection =====
            doc.status = DocumentStatus.PII_DETECTING
            await db.commit()

            # Initialize PII service if needed
            if pii_service._analyzer is None:
                await pii_service.initialize(
                    settings.PRESIDIO_ANALYZER_URL,
                    settings.PRESIDIO_ANONYMIZER_URL,
                )

            # Analyze full text
            analyzer_results = await pii_service.analyze(doc.ocr_text)

            # Map entities to pages with bboxes
            mapped_entities = pii_service.map_entities_to_pages(analyzer_results, pages)

            # Apply rules to determine actions
            rules_result = await db.execute(
                select(WithdrawalRule).where(WithdrawalRule.is_active == True)
            )
            rules = {r.entity_type: r for r in rules_result.scalars().all()}

            # Save entities
            for entity_data in mapped_entities:
                entity_type = entity_data["entity_type"]
                rule = rules.get(entity_type)

                entity = DetectedEntity(
                    document_id=doc_uuid,
                    page_id=None,  # Will be set after pages are flushed
                    entity_type=entity_type,
                    start_char=entity_data["start"],
                    end_char=entity_data["end"],
                    bbox=entity_data["bbox"],
                    confidence=entity_data["score"],
                    rule_id=rule.id if rule else None,
                    action_taken=rule.action if rule else "remove",
                    original_text=doc.ocr_text[entity_data["start"]:entity_data["end"]] if entity_data["end"] <= len(doc.ocr_text) else None,
                )
                db.add(entity)

            await db.flush()  # Get page IDs

            # Update entities with page_id
            for entity_data in mapped_entities:
                page_result = await db.execute(
                    select(DocumentPage).where(
                        DocumentPage.document_id == doc_uuid,
                        DocumentPage.page_num == entity_data["page_num"],
                    )
                )
                page = page_result.scalar_one_or_none()
                if page:
                    entity_result = await db.execute(
                        select(DetectedEntity).where(
                            DetectedEntity.document_id == doc_uuid,
                            DetectedEntity.start_char == entity_data["start"],
                            DetectedEntity.end_char == entity_data["end"],
                        )
                    )
                    entity = entity_result.scalar_one_or_none()
                    if entity:
                        entity.page_id = page.id

            doc.status = DocumentStatus.PII_DONE
            await db.commit()
            log_audit(db, doc_uuid, None, "PII_DETECTED", {"count": len(mapped_entities)})

            # Auto-transition to review if assigned
            if doc.assigned_to:
                doc.status = DocumentStatus.IN_REVIEW
                await db.commit()

        except Exception as e:
            logger.error("Document processing failed", doc_id=doc_id, error=str(e))
            doc.status = DocumentStatus.FAILED
            await db.commit()
            log_audit(db, doc_uuid, None, "PROCESSING_FAILED", {"error": str(e)})
            raise
        finally:
            # Cleanup temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def redact_document_task(self, doc_id: str):
    """Generate redacted PDF from approved document."""
    asyncio.run(_redact_document(doc_id))


async def _redact_document(doc_id: str):
    doc_uuid = uuid.UUID(doc_id)
    async with get_db_session() as db:
        doc = await db.get(Document, doc_uuid)
        if not doc:
            logger.error("Document not found for redaction", doc_id=doc_id)
            return

        try:
            doc.status = DocumentStatus.REDACTING
            await db.commit()

            # Download original
            client = get_minio_client()
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_in:
                in_path = tmp_in.name
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_out:
                out_path = tmp_out.name

            try:
                response = client.get_object(settings.MINIO_BUCKET, doc.original_path)
                with open(in_path, "wb") as f:
                    f.write(response.read())
                response.close()
                response.release_conn()
            except Exception as e:
                logger.error("Failed to download for redaction", error=str(e))
                raise

            # Get approved entities
            result = await db.execute(
                select(DetectedEntity).where(
                    DetectedEntity.document_id == doc_uuid,
                    DetectedEntity.reviewed_at.is_not(None),
                )
            )
            entities = result.scalars().all()

            entity_list = [
                {
                    "page": e.page_id,
                    "page_num": e.page.page_num if e.page else 1,
                    "bbox": e.bbox,
                    "entity_type": e.entity_type,
                    "action_taken": e.action_taken.value,
                }
                for e in entities
            ]

            # Apply redaction
            redact_pdf(in_path, out_path, entity_list)

            # Upload redacted PDF
            with open(out_path, "rb") as f:
                redacted_data = f.read()

            redacted_object = f"redacted/{doc_uuid}_redacted.pdf"
            await upload_file(redacted_object, redacted_data, "application/pdf")

            doc.redacted_path = redacted_object
            doc.status = DocumentStatus.REDACTED
            await db.commit()
            log_audit(db, doc_uuid, None, "REDACTION_COMPLETED", {"entities_redacted": len(entities)})

        except Exception as e:
            logger.error("Redaction failed", doc_id=doc_id, error=str(e))
            doc.status = DocumentStatus.FAILED
            await db.commit()
            log_audit(db, doc_uuid, None, "REDACTION_FAILED", {"error": str(e)})
            raise
        finally:
            for p in [in_path, out_path]:
                if os.path.exists(p):
                    os.unlink(p)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def export_document_task(self, doc_id: str):
    """Export clean text version of document."""
    asyncio.run(_export_document(doc_id))


async def _export_document(doc_id: str):
    doc_uuid = uuid.UUID(doc_id)
    async with get_db_session() as db:
        doc = await db.get(Document, doc_uuid)
        if not doc:
            return

        try:
            # Get all entities with their actions
            result = await db.execute(
                select(DetectedEntity).where(
                    DetectedEntity.document_id == doc_uuid,
                    DetectedEntity.reviewed_at.is_not(None),
                ).order_by(DetectedEntity.page_id, DetectedEntity.start_char)
            )
            entities = result.scalars().all()

            # Build clean text by applying redactions
            if not doc.ocr_text:
                return

            text = doc.ocr_text
            # Apply from end to start to preserve positions
            for entity in sorted(entities, key=lambda e: e.start_char, reverse=True):
                if entity.action_taken == "remove":
                    replacement = entity.replacement_text or "[REDACTED]"
                elif entity.action_taken == "generalize":
                    replacement = entity.replacement_text or "[GENERALIZED]"
                elif entity.action_taken == "pseudonymize":
                    replacement = entity.replacement_text or "[PSEUDONYMIZED]"
                elif entity.action_taken == "keep":
                    continue  # Keep original
                else:
                    replacement = "[REDACTED]"

                text = text[:entity.start_char] + replacement + text[entity.end_char:]

            # Upload clean text
            text_object = f"exports/{doc_uuid}_clean.txt"
            await upload_file(text_object, text.encode("utf-8"), "text/plain")

            doc.plain_text_path = text_object
            doc.status = DocumentStatus.EXPORTED
            await db.commit()
            log_audit(db, doc_uuid, None, "EXPORT_COMPLETED")

        except Exception as e:
            logger.error("Export failed", doc_id=doc_id, error=str(e))
            log_audit(db, doc_uuid, None, "EXPORT_FAILED", {"error": str(e)})


@shared_task
def cleanup_temp_files():
    """Periodic cleanup of temporary files."""
    import shutil
    temp_dir = tempfile.gettempdir()
    for item in os.listdir(temp_dir):
        if item.startswith("tmp") and os.path.isfile(os.path.join(temp_dir, item)):
            try:
                os.unlink(os.path.join(temp_dir, item))
            except Exception:
                pass
    logger.info("Temp cleanup completed")
