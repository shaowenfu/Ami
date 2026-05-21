"""Authentication dependencies for HTTP endpoints."""

from typing import Optional

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.exceptions import InvalidTokenError
from services.basic.auth import TokenService
from core.logger import get_logger

security = HTTPBearer(auto_error=False)
logger = get_logger(__name__)
token_service = TokenService()


# ----------------------------------------------------
# HTTP: 验证 Access Token 并返回 user_id
# ----------------------------------------------------
async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
) -> str:
    """Validate JWT access token from headers and return user_id (sub)."""

    token = _extract_http_token(credentials, x_auth_token)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token. Provide Authorization: Bearer <token> or X-Auth-Token header.",
        )

    return _decode_access_token_http(token)


def _extract_http_token(
    credentials: Optional[HTTPAuthorizationCredentials],
    x_auth_token: Optional[str],
) -> Optional[str]:
    if credentials and credentials.credentials:
        return credentials.credentials
    if x_auth_token:
        return x_auth_token
    return None


def _decode_access_token(token: str) -> str:
    """Decode an access token and return the subject user_id."""

    if not token or not token.strip():
        raise InvalidTokenError(message="Token cannot be empty.")

    payload = token_service.decode_token(token, "access")
    return str(payload.user_id)


def _decode_access_token_http(token: str) -> str:
    token_prefix = token[:20] + "..." if len(token) > 20 else token
    try:
        user_id = _decode_access_token(token)
        logger.debug(f"Token validation successful: user_id={user_id}")
        return user_id
    except InvalidTokenError as exc:
        logger.warning(
            "Token validation failed: %s (Token prefix: %s)",
            exc.message,
            token_prefix,
        )
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(
            "Token validation failed: Unknown error - %s: %s (Token prefix: %s)",
            type(exc).__name__,
            str(exc),
            token_prefix,
        )
        raise HTTPException(status_code=500, detail="Token validation failed.") from exc
