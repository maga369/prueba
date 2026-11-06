"""Initial schema for Legal Redactor.

Revision ID: 001
Revises:
Create Date: 2026-11-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ENUMS
    op.execute("""
        CREATE TYPE document_status AS ENUM (
            'UPLOADED', 'OCR_PROCESSING', 'OCR_DONE',
            'PII_DETECTING', 'PII_DONE', 'IN_REVIEW',
            'READY_FOR_APPROVAL', 'APPROVED', 'REJECTED',
            'EXPORTED', 'FAILED'
        );
        CREATE TYPE entity_action AS ENUM (
            'REMOVE', 'GENERALIZE', 'PSEUDONYMIZE', 'KEEP', 'MANUAL_EDIT'
        );
        CREATE TYPE user_role AS ENUM ('transcriptor', 'aprobador', 'admin');
    """)

    # USERS
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("keycloak_sub", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("full_name", sa.String(255)),
        sa.Column("role", sa.Enum("transcriptor", "aprobador", "admin", name="user_role"), nullable=False),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_users_email_active", "users", ["email", "is_active"])
    op.create_index("ix_users_role_active", "users", ["role", "is_active"])

    # WITHDRAWAL RULES
    op.create_table(
        "withdrawal_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("entity_type", sa.String(50), nullable=False, index=True),
        sa.Column("pattern_regex", sa.String(500)),
        sa.Column("action", sa.Enum("REMOVE", "GENERALIZE", "PSEUDONYMIZE", "KEEP", name="entity_action"), nullable=False),
        sa.Column("config", postgresql.JSONB, server_default="{}"),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("version", sa.Integer, default=1),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_rules_entity_active", "withdrawal_rules", ["entity_type", "is_active"])
    op.create_index("ix_rules_version", "withdrawal_rules", ["version"])

    # DOCUMENTS
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("original_path", sa.String(512), nullable=False),
        sa.Column("redacted_path", sa.String(512)),
        sa.Column("plain_text_path", sa.String(512)),
        sa.Column("status", sa.Enum(name="document_status"), nullable=False, default="UPLOADED", index=True),
        sa.Column("version", sa.Integer, default=1),
        sa.Column("current_rule_set_version", sa.Integer),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), index=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("rejection_reason", sa.Text),
        sa.Column("page_count", sa.Integer, default=0),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_documents_status_created", "documents", ["status", "created_at"])
    op.create_index("ix_documents_assigned_status", "documents", ["assigned_to", "status"])
    op.create_index("ix_documents_creator_created", "documents", ["created_by", "created_at"])

    # DOCUMENT PAGES
    op.create_table(
        "document_pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("page_num", sa.Integer, nullable=False),
        sa.Column("ocr_text", sa.Text),
        sa.Column("ocr_confidence", sa.Float),
        sa.Column("image_width", sa.Integer),
        sa.Column("image_height", sa.Integer),
        sa.Column("source", sa.String(20)),
        sa.UniqueConstraint("document_id", "page_num", name="uq_doc_page"),
    )

    # DETECTED ENTITIES
    op.create_table(
        "detected_entities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("document_pages.id", ondelete="CASCADE"), index=True),
        sa.Column("entity_type", sa.String(50), nullable=False, index=True),
        sa.Column("start_char", sa.Integer, nullable=False),
        sa.Column("end_char", sa.Integer, nullable=False),
        sa.Column("bbox", postgresql.JSONB, nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("withdrawal_rules.id")),
        sa.Column("action_taken", sa.Enum(name="entity_action"), nullable=False, default="REMOVE"),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("original_text", sa.Text),
        sa.Column("replacement_text", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_entities_doc_reviewed", "detected_entities", ["document_id", "reviewed_at"])
    op.create_index("ix_entities_type_action", "detected_entities", ["entity_type", "action_taken"])

    # AUDIT LOG
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="SET NULL"), index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), index=True),
        sa.Column("action", sa.String(50), nullable=False, index=True),
        sa.Column("details", postgresql.JSONB),
        sa.Column("ip_address", postgresql.INET),
        sa.Column("user_agent", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )
    op.create_index("ix_audit_doc_created", "audit_log", ["document_id", "created_at"])
    op.create_index("ix_audit_user_created", "audit_log", ["user_id", "created_at"])
    op.create_index("ix_audit_action_created", "audit_log", ["action", "created_at"])

    # TRIGGER for updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END $$;
    """)
    for tbl in ["users", "withdrawal_rules", "documents"]:
        op.execute(f"""
            CREATE TRIGGER trig_{tbl}_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """)

    # VIEW for dashboard
    op.execute("""
        CREATE VIEW v_document_summary AS
        SELECT
            d.id, d.original_filename, d.status, d.version, d.page_count,
            d.assigned_to, u.email AS assignee_email, u.full_name AS assignee_name,
            d.approved_by, d.approved_at, d.rejection_reason,
            d.created_at, d.updated_at,
            COUNT(e.id) FILTER (WHERE e.action_taken = 'REMOVE') AS entities_removed,
            COUNT(e.id) FILTER (WHERE e.action_taken = 'KEEP') AS entities_kept,
            COUNT(e.id) FILTER (WHERE e.action_taken = 'GENERALIZE') AS entities_generalized,
            COUNT(e.id) FILTER (WHERE e.reviewed_at IS NULL) AS entities_pending_review
        FROM documents d
        LEFT JOIN users u ON d.assigned_to = u.id
        LEFT JOIN detected_entities e ON e.document_id = d.id
        GROUP BY d.id, u.email, u.full_name;
    """)

    # FUNCTION for edit permission check
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_document_can_edit(doc_uuid UUID, user_uuid UUID)
        RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
            SELECT status IN ('IN_REVIEW', 'REJECTED', 'PII_DONE')
            FROM documents WHERE id = doc_uuid AND assigned_to = user_uuid;
        $$;
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_document_summary")
    op.execute("DROP FUNCTION IF EXISTS fn_document_can_edit(UUID, UUID)")
    op.execute("DROP TRIGGER IF EXISTS trig_users_updated_at ON users")
    op.execute("DROP TRIGGER IF EXISTS trig_withdrawal_rules_updated_at ON withdrawal_rules")
    op.execute("DROP TRIGGER IF EXISTS trig_documents_updated_at ON documents")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
    op.drop_table("audit_log")
    op.drop_table("detected_entities")
    op.drop_table("document_pages")
    op.drop_table("documents")
    op.drop_table("withdrawal_rules")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS document_status")
    op.execute("DROP TYPE IF EXISTS entity_action")
    op.execute("DROP TYPE IF EXISTS user_role")
