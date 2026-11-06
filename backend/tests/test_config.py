"""Tests for configuration."""
import pytest
from app.core.config import Settings


def test_settings_loads():
    """Test that settings can be instantiated with required fields."""
    settings = Settings(
        SECRET_KEY="test-secret-key-min-32-chars-long",
        DATABASE_URL="postgresql+asyncpg://test:test@localhost/test",
        REDIS_URL="redis://localhost:6379/0",
        MINIO_ENDPOINT="http://localhost:9000",
        MINIO_ACCESS_KEY="test",
        MINIO_SECRET_KEY="test",
        KEYCLOAK_URL="http://localhost:8080",
        KEYCLOAK_REALM="test",
        KEYCLOAK_CLIENT_ID="test",
    )
    assert settings.APP_NAME == "Legal Redactor API"
    assert settings.SECRET_KEY == "test-secret-key-min-32-chars-long"
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 60


def test_cors_origins_default():
    """Test default CORS origins."""
    settings = Settings(
        SECRET_KEY="test-secret-key-min-32-chars-long",
        DATABASE_URL="postgresql+asyncpg://test:test@localhost/test",
        REDIS_URL="redis://localhost:6379/0",
        MINIO_ENDPOINT="http://localhost:9000",
        MINIO_ACCESS_KEY="test",
        MINIO_SECRET_KEY="test",
        KEYCLOAK_URL="http://localhost:8080",
        KEYCLOAK_REALM="test",
        KEYCLOAK_CLIENT_ID="test",
    )
    assert "http://localhost:5173" in settings.CORS_ORIGINS
    assert "http://127.0.0.1:5173" in settings.CORS_ORIGINS
