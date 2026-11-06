"""Authentication schemas."""
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None


class TokenData(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
    roles: list[str] = []


class LoginRequest(BaseModel):
    username: str
    password: str


class KeycloakTokenResponse(BaseModel):
    access_token: str
    expires_in: int
    refresh_expires_in: int
    refresh_token: str
    token_type: str
    id_token: Optional[str] = None
    not_before_policy: int
    session_state: str
    scope: str


class UserInfo(BaseModel):
    sub: str
    email: str
    name: Optional[str] = None
    preferred_username: str
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    realm_access: Dict[str, list[str]] = {}
    resource_access: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)
