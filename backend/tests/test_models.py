"""Tests for database models."""
import pytest
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.document import Document, DocumentStatus, DocumentPage
from app.models.entity import DetectedEntity, EntityAction
from app.models.rule import WithdrawalRule
from app.models.audit import AuditLog
from app.models.enums import UserRole


class TestUserModel:
    """Tests for User model."""

    async def test_create_user(self, db_session: AsyncSession):
        user = User(
            id=uuid.uuid4(),
            keycloak_sub="test-sub-123",
            email="test@example.com",
            full_name="Test User",
            role=UserRole.TRANSCRIPTOR,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.role == UserRole.TRANSCRIPTOR
        assert user.is_active is True
        assert user.created_at is not None

    async def test_user_unique_email(self, db_session: AsyncSession):
        user1 = User(
            id=uuid.uuid4(),
            keycloak_sub="sub-1",
            email="duplicate@example.com",
            role=UserRole.TRANSCRIPTOR,
        )
        user2 = User(
            id=uuid.uuid4(),
            keycloak_sub="sub-2",
            email="duplicate@example.com",
            role=UserRole.APROBADOR,
        )
        db_session.add(user1)
        await db_session.commit()

        db_session.add(user2)
        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()


class TestDocumentModel:
    """Tests for Document model."""

    async def test_create_document(self, db_session: AsyncSession):
        user_id = uuid.uuid4()
        # Create user first
        user = User(
            id=user_id,
            keycloak_sub="creator-sub",
            email="creator@example.com",
            role=UserRole.TRANSCRIPTOR,
        )
        db_session.add(user)
        await db_session.commit()

        doc = Document(
            original_filename="test.pdf",
            original_path="originals/test.pdf",
            status=DocumentStatus.UPLOADED,
            created_by=user_id,
        )
        db_session.add(doc)
        await db_session.commit()
        await db_session.refresh(doc)

        assert doc.id is not None
        assert doc.original_filename == "test.pdf"
        assert doc.status == DocumentStatus.UPLOADED
        assert doc.version == 1
        assert doc.page_count == 0
        assert doc.created_by == user_id

    async def test_document_status_transitions(self, db_session: AsyncSession):
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            keycloak_sub="creator-sub",
            email="creator@example.com",
            role=UserRole.TRANSCRIPTOR,
        )
        db_session.add(user)
        await db_session.commit()

        doc = Document(
            original_filename="test.pdf",
            original_path="originals/test.pdf",
            status=DocumentStatus.UPLOADED,
            created_by=user_id,
        )
        db_session.add(doc)
        await db_session.commit()

        # Test valid transitions
        valid_transitions = [
            DocumentStatus.OCR_PROCESSING,
            DocumentStatus.OCR_DONE,
            DocumentStatus.PII_DETECTING,
            DocumentStatus.PII_DONE,
            DocumentStatus.IN_REVIEW,
            DocumentStatus.READY_FOR_APPROVAL,
            DocumentStatus.APPROVED,
        ]

        for status in valid_transitions:
            doc.status = status
            await db_session.commit()
            assert doc.status == status


class TestDetectedEntityModel:
    """Tests for DetectedEntity model."""

    async def test_create_entity(self, db_session: AsyncSession):
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            keycloak_sub="creator-sub",
            email="creator@example.com",
            role=UserRole.TRANSCRIPTOR,
        )
        db_session.add(user)
        await db_session.commit()

        doc = Document(
            original_filename="test.pdf",
            original_path="originals/test.pdf",
            status=DocumentStatus.PII_DONE,
            created_by=user_id,
        )
        db_session.add(doc)
        await db_session.commit()
        await db_session.refresh(doc)

        entity = DetectedEntity(
            document_id=doc.id,
            entity_type="ES_NIF",
            start_char=10,
            end_char=19,
            bbox=[100.0, 200.0, 300.0, 220.0],
            confidence=0.95,
            action_taken=EntityAction.REMOVE,
            original_text="12345678Z",
        )
        db_session.add(entity)
        await db_session.commit()
        await db_session.refresh(entity)

        assert entity.id is not None
        assert entity.entity_type == "ES_NIF"
        assert entity.action_taken == EntityAction.REMOVE
        assert entity.confidence == 0.95


class TestWithdrawalRuleModel:
    """Tests for WithdrawalRule model."""

    async def test_create_rule(self, db_session: AsyncSession):
        rule = WithdrawalRule(
            name="Test DNI Rule",
            entity_type="ES_NIF",
            pattern_regex=r"\b[0-9]{8}[A-Z]\b",
            action=EntityAction.REMOVE,
            config={"test": True},
        )
        db_session.add(rule)
        await db_session.commit()
        await db_session.refresh(rule)

        assert rule.id is not None
        assert rule.name == "Test DNI Rule"
        assert rule.entity_type == "ES_NIF"
        assert rule.action == EntityAction.REMOVE
        assert rule.version == 1
        assert rule.is_active is True

    async def test_rule_version_increment(self, db_session: AsyncSession):
        rule = WithdrawalRule(
            name="Test Rule",
            entity_type="ES_NIF",
            action=EntityAction.REMOVE,
        )
        db_session.add(rule)
        await db_session.commit()

        original_version = rule.version
        rule.name = "Updated Rule"
        rule.version += 1
        await db_session.commit()

        assert rule.version == original_version + 1


class TestAuditLogModel:
    """Tests for AuditLog model."""

    async def test_create_audit_log(self, db_session: AsyncSession):
        user_id = uuid.uuid4()
        doc_id = uuid.uuid4()

        audit = AuditLog(
            document_id=doc_id,
            user_id=user_id,
            action="ENTITY_REVIEWED",
            details={"entity_id": str(uuid.uuid4()), "action_before": "REMOVE", "action_after": "KEEP"},
            ip_address="127.0.0.1",
            user_agent="Test Agent",
        )
        db_session.add(audit)
        await db_session.commit()
        await db_session.refresh(audit)

        assert audit.id is not None
        assert audit.action == "ENTITY_REVIEWED"
        assert audit.details["action_before"] == "REMOVE"
        assert audit.details["action_after"] == "KEEP"
        assert audit.created_at is not None
