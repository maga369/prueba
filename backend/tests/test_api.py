"""Tests for API endpoints."""
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.models.enums import DocumentStatus, UserRole


pytestmark = pytest.mark.asyncio


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    async def test_health_check(self, async_client: AsyncClient):
        response = await async_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "legal-redactor-api"

    async def test_liveness_check(self, async_client: AsyncClient):
        response = await async_client.get("/health/live")
        assert response.status_code == 200
        assert response.json()["status"] == "alive"


class TestAuthEndpoints:
    """Tests for authentication endpoints."""

    @patch("app.api.auth.httpx.AsyncClient.post")
    async def test_login_success(self, mock_post, async_client: AsyncClient):
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test-access-token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": "test-refresh-token",
        }
        mock_post.return_value = mock_response

        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "testpass"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["access_token"] == "test-access-token"
        assert data["token_type"] == "Bearer"

    @patch("app.api.auth.httpx.AsyncClient.post")
    async def test_login_failure(self, mock_post, async_client: AsyncClient):
        mock_response = AsyncMock()
        mock_response.status_code = 401
        mock_post.return_value = mock_response

        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "wrong", "password": "wrong"},
        )
        assert response.status_code == 401


class TestDocumentEndpoints:
    """Tests for document endpoints."""

    async def test_upload_document_unauthorized(self, async_client: AsyncClient):
        # Without auth token
        response = await async_client.post(
            "/api/v1/documents/upload",
            files={"file": ("test.pdf", b"fake pdf content", "application/pdf")},
        )
        assert response.status_code == 401

    async def test_list_documents_unauthorized(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/documents")
        assert response.status_code == 401


class TestRulesEndpoints:
    """Tests for rules endpoints."""

    async def test_list_rules_unauthorized(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/rules")
        assert response.status_code == 401

    async def test_get_entity_types_unauthorized(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/rules/entity-types/list")
        assert response.status_code == 401


class TestAuditEndpoints:
    """Tests for audit endpoints."""

    async def test_get_document_audit_unauthorized(self, async_client: AsyncClient):
        import uuid
        response = await async_client.get(f"/api/v1/audit/document/{uuid.uuid4()}")
        assert response.status_code == 401

    async def test_get_audit_summary_unauthorized(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/audit/stats/summary")
        assert response.status_code == 401


class TestUsersEndpoints:
    """Tests for users endpoints."""

    async def test_get_me_unauthorized(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/users/me")
        assert response.status_code == 401

    async def test_list_users_unauthorized(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/users")
        assert response.status_code == 401
