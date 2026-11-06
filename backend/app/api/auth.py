"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import httpx

from app.core.config import settings
from app.core.security import get_current_user, create_access_token
from app.schemas.auth import Token, UserInfo, KeycloakTokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login", response_model=Token)
async def login(
    credentials: LoginRequest,
):
    """Direct login via Keycloak (for API clients)."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id": settings.KEYCLOAK_CLIENT_ID,
                "client_secret": settings.KEYCLOAK_CLIENT_SECRET,
                "username": credentials.username,
                "password": credentials.password,
                "scope": "openid email profile",
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token_data = response.json()

    return Token(
        access_token=token_data["access_token"],
        token_type=token_data["token_type"],
        expires_in=token_data["expires_in"],
        refresh_token=token_data.get("refresh_token"),
    )


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
):
    """Get current user info from validated token."""
    return UserInfo(**current_user)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
):
    """Refresh access token using refresh token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/token",
            data={
                "grant_type": "refresh_token",
                "client_id": settings.KEYCLOAK_CLIENT_ID,
                "client_secret": settings.KEYCLOAK_CLIENT_SECRET,
                "refresh_token": refresh_token,
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    token_data = response.json()

    return Token(
        access_token=token_data["access_token"],
        token_type=token_data["token_type"],
        expires_in=token_data["expires_in"],
        refresh_token=token_data.get("refresh_token"),
    )


@router.get("/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
):
    """Logout - revoke token in Keycloak (optional)."""
    # In a real implementation, you'd call Keycloak's logout endpoint
    # For now, just return success (client should delete tokens)
    return {"message": "Logged out successfully"}


@router.get("/keycloak-config")
async def get_keycloak_config():
    """Get Keycloak configuration for frontend."""
    return {
        "url": settings.KEYCLOAK_URL,
        "realm": settings.KEYCLOAK_REALM,
        "clientId": settings.KEYCLOAK_CLIENT_ID,
    }
