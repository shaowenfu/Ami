"""Core dependency providers for auth, data access, LLM, memory, and SSE."""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException

from core.config import settings
from core.logger import get_logger
from dependencies.auth import get_current_user_id
from infrastructure.db.mongo_client import get_database
from infrastructure.db.redis_client import get_redis_client
from infrastructure.repositories.message_repository import MessageRepository
from infrastructure.repositories.space_repository import SpaceRepository
from infrastructure.repositories.user_repository import UserRepository
from services.basic.auth import AuthService, TokenService
from services.basic.chat_context import ContextOrchestrator
from services.basic.email import EmailService
from services.basic.heartbeat import HeartbeatService
from services.basic.llm import ModelService
from services.basic.message import MessageService
from services.basic.sleep import SleepDigestService
from services.basic.sse import SseEventBus
from services.basic.space import SpaceService
from services.basic.sms import SmsService

logger = get_logger(__name__)


# -----------------------------------------------------------------
# Config / shared services
# -----------------------------------------------------------------

def get_config():
    """Return global settings instance."""

    return settings


_model_service: Optional[ModelService] = None
_sse_event_bus: Optional[SseEventBus] = None


def get_model_service(config=None) -> ModelService:
    """Provide a singleton ModelService instance for all requests."""

    global _model_service
    if _model_service is None:
        if config is None:
            config = get_config()
        _model_service = ModelService(config)
    return _model_service


async def close_model_service() -> None:
    """Shutdown hook to close underlying HTTP clients."""

    global _model_service
    if _model_service is not None:
        await _model_service.aclose()
        _model_service = None


def get_sse_event_bus() -> SseEventBus:
    """Provide the in-process SSE event bus singleton."""

    global _sse_event_bus
    if _sse_event_bus is None:
        _sse_event_bus = SseEventBus(
            max_connections_per_user=settings.SSE_MAX_CONNECTIONS_PER_USER,
            reconnect_retry_ms=settings.SSE_RECONNECT_RETRY_MS,
        )
    return _sse_event_bus


# -----------------------------------------------------------------
# Repository providers
# -----------------------------------------------------------------

async def get_user_repository() -> UserRepository:
    """Provide UserRepository bound to the default MongoDB database."""

    return UserRepository(get_database())


async def get_space_repository() -> SpaceRepository:
    """Provide SpaceRepository bound to the default MongoDB database."""

    return SpaceRepository(get_database())


async def get_message_repository() -> MessageRepository:
    """Provide MessageRepository bound to the default MongoDB database."""

    return MessageRepository(get_database())


async def get_current_active_user_id(
    current_user_id: Annotated[str, Depends(get_current_user_id)],
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> str:
    """Validate that the decoded token still belongs to an active user."""

    user = await user_repository.get_by_id(current_user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive.")
    return current_user_id


def get_context_orchestrator(
    message_repository: Annotated[MessageRepository, Depends(get_message_repository)],
) -> ContextOrchestrator:
    """Provide the single entry point for Mongo + memory chat context."""

    return ContextOrchestrator(message_repository=message_repository)


# -----------------------------------------------------------------
# Auth / token / SMS providers
# -----------------------------------------------------------------

def get_token_service() -> TokenService:
    """Provide the token service used for JWT operations."""

    return TokenService()


class _ConsoleSmsService:
    """Fallback SMS provider that logs codes instead of sending them."""

    async def send_login_code(self, phone: str, code: str) -> None:
        logger.info("Console SMS provider sending code. phone=%s code=%s", phone, code)


class _ConsoleEmailService:
    """Fallback email provider that logs codes instead of sending them."""

    async def send_verification_code(self, *, email: str, code: str, scene: str) -> None:
        logger.info("Console Email provider sending code. email=%s scene=%s code=%s", email, scene, code)


_sms_service_singleton: SmsService | _ConsoleSmsService | None = None
_email_service_singleton: EmailService | _ConsoleEmailService | None = None


def get_sms_service() -> SmsService | _ConsoleSmsService:
    """Provide SMS service; fall back to console provider if Aliyun is unavailable."""

    global _sms_service_singleton
    if _sms_service_singleton is not None:
        return _sms_service_singleton

    try:
        _sms_service_singleton = SmsService()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Falling back to console SMS provider: %s", exc)
        _sms_service_singleton = _ConsoleSmsService()
    return _sms_service_singleton


def get_email_service() -> EmailService | _ConsoleEmailService:
    """Provide email service; fall back to console provider if SMTP is unavailable."""

    global _email_service_singleton
    if _email_service_singleton is not None:
        return _email_service_singleton

    try:
        _email_service_singleton = EmailService()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Falling back to console email provider: %s", exc)
        _email_service_singleton = _ConsoleEmailService()
    return _email_service_singleton


def get_auth_service(
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
    token_service: Annotated[TokenService, Depends(get_token_service)],
    sms_service: Annotated[SmsService | _ConsoleSmsService, Depends(get_sms_service)],
    email_service: Annotated[EmailService | _ConsoleEmailService, Depends(get_email_service)],
) -> AuthService:
    """Provide authentication service wiring repository, token, and Redis."""

    redis_client = get_redis_client()
    return AuthService(
        user_repository=user_repository,
        token_service=token_service,
        redis_client=redis_client,
        sms_service=sms_service,
        email_service=email_service,
    )


def get_space_service(
    space_repository: Annotated[SpaceRepository, Depends(get_space_repository)],
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> SpaceService:
    """Provide relationship space workflows."""

    return SpaceService(
        space_repository=space_repository,
        user_repository=user_repository,
    )


def get_message_service(
    message_repository: Annotated[MessageRepository, Depends(get_message_repository)],
    space_repository: Annotated[SpaceRepository, Depends(get_space_repository)],
    event_bus: Annotated[SseEventBus, Depends(get_sse_event_bus)],
    context_orchestrator: Annotated[ContextOrchestrator, Depends(get_context_orchestrator)],
) -> MessageService:
    """Provide space message workflows."""

    return MessageService(
        message_repository=message_repository,
        space_repository=space_repository,
        event_bus=event_bus,
        model_service_factory=lambda: get_model_service(get_config()),
        context_orchestrator=context_orchestrator,
    )


def get_sleep_digest_service(
    space_repository: Annotated[SpaceRepository, Depends(get_space_repository)],
    message_repository: Annotated[MessageRepository, Depends(get_message_repository)],
) -> SleepDigestService:
    """Provide Ami's daily sleep digestion service."""

    return SleepDigestService(
        space_repository=space_repository,
        message_repository=message_repository,
        model_service_factory=lambda: get_model_service(get_config()),
    )


def get_heartbeat_service(
    space_repository: Annotated[SpaceRepository, Depends(get_space_repository)],
    message_repository: Annotated[MessageRepository, Depends(get_message_repository)],
) -> HeartbeatService:
    """Provide dry-run heartbeat evaluation for proactive behavior."""

    return HeartbeatService(
        space_repository=space_repository,
        message_repository=message_repository,
    )


# -----------------------------------------------------------------
# Type aliases for FastAPI Depends
# -----------------------------------------------------------------

UserRepositoryDep = Annotated[UserRepository, Depends(get_user_repository)]
SpaceRepositoryDep = Annotated[SpaceRepository, Depends(get_space_repository)]
MessageRepositoryDep = Annotated[MessageRepository, Depends(get_message_repository)]
ContextOrchestratorDep = Annotated[ContextOrchestrator, Depends(get_context_orchestrator)]
TokenServiceDep = Annotated[TokenService, Depends(get_token_service)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
SpaceServiceDep = Annotated[SpaceService, Depends(get_space_service)]
MessageServiceDep = Annotated[MessageService, Depends(get_message_service)]
SleepDigestServiceDep = Annotated[SleepDigestService, Depends(get_sleep_digest_service)]
HeartbeatServiceDep = Annotated[HeartbeatService, Depends(get_heartbeat_service)]
SseEventBusDep = Annotated[SseEventBus, Depends(get_sse_event_bus)]
SmsServiceDep = Annotated[SmsService | _ConsoleSmsService, Depends(get_sms_service)]
EmailServiceDep = Annotated[EmailService | _ConsoleEmailService, Depends(get_email_service)]
ModelServiceDep = Annotated[ModelService, Depends(get_model_service)]
CurrentUserIdDep = Annotated[str, Depends(get_current_active_user_id)]
