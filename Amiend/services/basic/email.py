"""Email verification service with SMTP and console fallback support."""

from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from typing import Optional

from core.config import settings
from core.exceptions import EmailSendFailedError
from core.logger import get_logger

logger = get_logger(__name__)


class EmailService:
    """Send auth verification codes through SMTP."""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        from_address: Optional[str] = None,
        use_tls: Optional[bool] = None,
    ) -> None:
        self._host = host or settings.SMTP_HOST
        self._port = port or settings.SMTP_PORT
        self._username = username or settings.SMTP_USERNAME
        self._password = password or settings.SMTP_PASSWORD
        self._from_address = from_address or settings.SMTP_FROM or self._username
        self._use_tls = settings.SMTP_USE_TLS if use_tls is None else use_tls

        missing = [
            name
            for name, value in [
                ("SMTP_HOST", self._host),
                ("SMTP_USERNAME", self._username),
                ("SMTP_PASSWORD", self._password),
                ("SMTP_FROM", self._from_address),
            ]
            if not value
        ]
        if missing:
            raise EmailSendFailedError(
                message="SMTP email configuration is incomplete.",
                detail=f"Missing: {', '.join(missing)}",
            )

    async def send_verification_code(self, *, email: str, code: str, scene: str) -> None:
        """Send a verification code email."""

        message = EmailMessage()
        message["Subject"] = "Ami 验证码"
        message["From"] = str(self._from_address)
        message["To"] = email
        message.set_content(
            "\n".join(
                [
                    "你的 Ami 验证码是：",
                    "",
                    code,
                    "",
                    f"场景：{scene}",
                    "验证码将在几分钟后失效。如非本人操作，请忽略这封邮件。",
                ]
            )
        )

        try:
            await asyncio.to_thread(self._send_sync, message)
        except Exception as exc:  # pragma: no cover - external SMTP errors are wrapped
            logger.error("Failed to send verification email: %s", exc)
            raise EmailSendFailedError(message="Failed to send verification email.") from exc

        logger.debug("Verification email sent successfully to %s", email)

    def _send_sync(self, message: EmailMessage) -> None:
        assert self._host is not None
        assert self._port is not None

        with smtplib.SMTP(self._host, self._port, timeout=10) as client:
            if self._use_tls:
                client.starttls()
            if self._username and self._password:
                client.login(self._username, self._password)
            client.send_message(message)
