"""Database enums."""
import enum


class DocumentStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    OCR_PROCESSING = "ocr_processing"
    OCR_DONE = "ocr_done"
    PII_DETECTING = "pii_detecting"
    PII_DONE = "pii_done"
    IN_REVIEW = "in_review"
    READY_FOR_APPROVAL = "ready_for_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPORTED = "exported"
    FAILED = "failed"


class EntityAction(str, enum.Enum):
    REMOVE = "remove"
    GENERALIZE = "generalize"
    PSEUDONYMIZE = "pseudonymize"
    KEEP = "keep"
    MANUAL_EDIT = "manual_edit"


class UserRole(str, enum.Enum):
    TRANSCRIPTOR = "transcriptor"
    APROBADOR = "aprobador"
    ADMIN = "admin"


class AuditAction(str, enum.Enum):
    UPLOAD = "upload"
    OCR_STARTED = "ocr_started"
    OCR_COMPLETED = "ocr_completed"
    PII_DETECTED = "pii_detected"
    ENTITY_REVIEWED = "entity_reviewed"
    ENTITY_UPDATED = "entity_updated"
    SUBMITTED_FOR_APPROVAL = "submitted_for_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EDITED = "edited"
    EXPORTED = "exported"
    DOWNLOADED = "downloaded"
    RULE_CREATED = "rule_created"
    RULE_UPDATED = "rule_updated"
    RULE_DELETED = "rule_deleted"
