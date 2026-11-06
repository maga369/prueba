"""Celery application configuration."""
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings


celery_app = Celery(
    "legal_redactor",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Madrid",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.tasks.process_document_task": {"queue": "ocr"},
        "app.workers.tasks.ocr_task": {"queue": "ocr"},
        "app.workers.tasks.pii_task": {"queue": "pii"},
        "app.workers.tasks.redact_document_task": {"queue": "redaction"},
        "app.workers.tasks.export_document_task": {"queue": "export"},
    },
    beat_schedule={
        # Cleanup old temp files daily at 3 AM
        "cleanup-temp-files": {
            "task": "app.workers.tasks.cleanup_temp_files",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)

# Import tasks to register them
from app.workers import tasks  # noqa
