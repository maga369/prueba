"""MinIO storage service."""
import minio
from minio.error import S3Error
from fastapi import HTTPException

from app.core.config import settings


_minio_client = None


def get_minio_client() -> minio.Minio:
    """Get or create MinIO client (singleton)."""
    global _minio_client
    if _minio_client is None:
        _minio_client = minio.Minio(
            settings.MINIO_ENDPOINT.replace("http://", "").replace("https://", ""),
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _minio_client


async def ensure_bucket() -> None:
    """Ensure the default bucket exists."""
    client = get_minio_client()
    if not client.bucket_exists(settings.MINIO_BUCKET):
        client.make_bucket(settings.MINIO_BUCKET)
        # Set bucket policy for public read if needed
        # policy = ...
        # client.set_bucket_policy(settings.MINIO_BUCKET, policy)


async def upload_file(
    object_name: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload file to MinIO and return object name."""
    client = get_minio_client()
    await ensure_bucket()

    try:
        client.put_object(
            settings.MINIO_BUCKET,
            object_name,
            data=data,
            length=len(data),
            content_type=content_type,
        )
        return object_name
    except S3Error as e:
        raise HTTPException(500, f"Storage upload failed: {e}")


async def download_file(object_name: str) -> bytes:
    """Download file from MinIO."""
    client = get_minio_client()

    try:
        response = client.get_object(settings.MINIO_BUCKET, object_name)
        data = response.read()
        response.close()
        response.release_conn()
        return data
    except S3Error as e:
        raise HTTPException(404, f"File not found: {e}")


async def delete_file(object_name: str) -> None:
    """Delete file from MinIO."""
    client = get_minio_client()

    try:
        client.remove_object(settings.MINIO_BUCKET, object_name)
    except S3Error:
        pass  # Ignore if not found


async def get_presigned_url(object_name: str, expires: int = 3600) -> str:
    """Generate presigned URL for direct access."""
    client = get_minio_client()
    return client.presigned_get_object(settings.MINIO_BUCKET, object_name, expires=expires)
