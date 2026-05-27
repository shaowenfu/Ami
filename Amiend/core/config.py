"""Core runtime configuration.

Only deployment facts and secrets should come from environment variables.
Stable product defaults live here to keep local `.env` and GitHub Actions small.
"""
from __future__ import annotations

import os
from typing import List, Optional

from dotenv import load_dotenv

# Auto-load .env if present
load_dotenv(dotenv_path=".env", override=False)


class Settings:
    """Application settings with conservative code defaults."""

    def __init__(self) -> None:
        # App
        self.APP_NAME: str = "Ami"
        self.APP_VERSION: str = "0.1.0"

        # MongoDB
        self.MONGO_URI: str = os.getenv("MONGO_URI", "")
        self.MONGO_DATABASE: str = "ami"

        # Redis
        self.REDIS_HOST: str = os.getenv("REDIS_HOST", "127.0.0.1")
        self.REDIS_PORT: int = 6379
        self.REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")

        # JWT
        secret = os.getenv("JWT_SECRET_KEY")
        if not secret:
            raise RuntimeError("JWT_SECRET_KEY is required.")
        self.JWT_SECRET_KEY: str = secret
        self.JWT_ALGORITHM: str = "HS256"
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
        self.REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080

        # Optional static access tokens (testing)
        self.STATIC_ACCESS_TOKENS = self._load_static_tokens(os.getenv("STATIC_ACCESS_TOKENS", ""))

        # CORS
        cors_origins_env = os.getenv("CORS_ORIGINS", "*")
        self.CORS_ORIGINS: List[str] = (
            ["*"]
            if cors_origins_env.strip() == "*"
            else [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
        )

        # SSE stream settings
        self.SSE_HEARTBEAT_INTERVAL_SECONDS: int = 15
        self.SSE_RECONNECT_RETRY_MS: int = 3000
        self.SSE_MAX_CONNECTIONS_PER_USER: int = 3
        self.SSE_EVENT_RETENTION_SECONDS: int = 300

        # OpenAI-compatible LLM endpoint.
        self.DEFAULT_MODEL_PROVIDER: str = "custom"
        self.LLM_API_KEY: Optional[str] = os.getenv("LLM_API_KEY")
        self.LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
        self.LLM_MODEL: str = os.getenv("LLM_MODEL", "deepseek-v4-flash")

        # Memory / context. Provider and tuning are fixed; key + enable flag are external.
        self.MEMORY_ENABLED: bool = os.getenv("MEM0_ENABLED", os.getenv("MEMORY_ENABLED", "false")).lower() == "true"
        self.MEMORY_VECTOR_STORE_HOST: str = "localhost"
        self.MEMORY_VECTOR_STORE_PORT: int = 8000
        self.MEMORY_PROVIDER: str = "mem0_platform"
        self.MEM0_API_KEY: Optional[str] = os.getenv("MEM0_API_KEY")
        self.MEM0_DEFAULT_AGENT_PREFIX: str = "ami"
        self.MEM0_SEARCH_LIMIT: int = 6

        # SMS remains optional/legacy. Email is the active auth channel.
        self.SMS_ACCESS_KEY_ID: Optional[str] = os.getenv("SMS_ACCESS_KEY_ID")
        self.SMS_ACCESS_KEY_SECRET: Optional[str] = os.getenv("SMS_ACCESS_KEY_SECRET")
        self.SMS_SIGN_NAME: Optional[str] = os.getenv("SMS_SIGN_NAME")
        self.SMS_TEMPLATE_CODE: Optional[str] = os.getenv("SMS_TEMPLATE_CODE")
        self.SMS_REGION: str = "cn-hangzhou"
        
        self.SMS_CODE_LENGTH: int = 6
        self.SMS_CODE_TTL_SECONDS: int = 300
        self.SMS_RESEND_COOLDOWN_SECONDS: int = 60
        self.SMS_MAX_ATTEMPTS: int = 5
        self.SMS_DAILY_LIMIT_PER_PHONE: int = 20
        self.SMS_TICKET_TTL_SECONDS: int = 600

        # Email verification. If SMTP is incomplete, the service logs codes locally.
        self.SMTP_HOST: Optional[str] = os.getenv("SMTP_HOST")
        self.SMTP_PORT: int = 587
        self.SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
        self.SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
        self.SMTP_FROM: Optional[str] = os.getenv("SMTP_FROM")
        self.SMTP_USE_TLS: bool = True
        self.EMAIL_DEV_FIXED_CODE: Optional[str] = os.getenv("EMAIL_DEV_FIXED_CODE")

    @staticmethod
    def _load_static_tokens(raw: str) -> dict[str, str]:
        tokens: dict[str, str] = {}
        if not raw:
            return tokens
        parts = [item.strip() for item in raw.split(",") if item.strip()]
        for part in parts:
            if ":" in part:
                token, user_id = part.split(":", 1)
                if token and user_id:
                    tokens[token] = user_id
            else:
                tokens[part] = part
        return tokens


settings = Settings()
