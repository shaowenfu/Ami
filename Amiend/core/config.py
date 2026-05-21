"""
Core configuration (generic, project-agnostic).

Environment variables (examples):
- APP_NAME / APP_VERSION
- MONGO_URI / MONGO_DATABASE
- REDIS_HOST / REDIS_PORT / REDIS_PASSWORD
- JWT_SECRET_KEY / JWT_ALGORITHM / ACCESS_TOKEN_EXPIRE_MINUTES / REFRESH_TOKEN_EXPIRE_MINUTES
- CORS_ORIGINS (comma separated, "*" allowed)
- SSE_HEARTBEAT_INTERVAL_SECONDS / SSE_RECONNECT_RETRY_MS / SSE_MAX_CONNECTIONS_PER_USER
- MEMORY_* (see core.memory_adapter.config)
- LLM_* (provider-specific fields are intentionally placeholders; implement your own mapping in services/basic/llm.py)
- SMS_* (optional; see services/basic/sms.py for expected fields)
"""
from __future__ import annotations

import os
from typing import List, Optional

from dotenv import load_dotenv

# Auto-load .env if present
load_dotenv(dotenv_path=".env", override=False)


class Settings:
    """Generic settings loader."""

    def __init__(self) -> None:
        # App
        self.APP_NAME: str = os.getenv("APP_NAME", "Ami")
        self.APP_VERSION: str = os.getenv("APP_VERSION", "0.1.0")

        # MongoDB
        self.MONGO_URI: str = os.getenv("MONGO_URI", "")
        self.MONGO_DATABASE: str = os.getenv("MONGO_DATABASE", "ami")

        # Redis
        self.REDIS_HOST: str = os.getenv("REDIS_HOST", "redis")
        self.REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
        self.REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")

        # JWT
        secret = os.getenv("JWT_SECRET_KEY")
        if not secret:
            raise RuntimeError("JWT_SECRET_KEY is required.")
        self.JWT_SECRET_KEY: str = secret
        self.JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1500"))
        self.REFRESH_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "10080"))

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
        self.SSE_HEARTBEAT_INTERVAL_SECONDS: int = int(os.getenv("SSE_HEARTBEAT_INTERVAL_SECONDS", "15"))
        self.SSE_RECONNECT_RETRY_MS: int = int(os.getenv("SSE_RECONNECT_RETRY_MS", "3000"))
        self.SSE_MAX_CONNECTIONS_PER_USER: int = int(os.getenv("SSE_MAX_CONNECTIONS_PER_USER", "3"))
        self.SSE_EVENT_RETENTION_SECONDS: int = int(os.getenv("SSE_EVENT_RETENTION_SECONDS", "300"))

        # -----------------------------------------------------------------------
        # AI / LLM Configuration (Unified Interface)
        # -----------------------------------------------------------------------
        # Point these to any OpenAI-compatible provider (DeepSeek, Moonshot, LocalAI, etc.)
        self.DEFAULT_MODEL_PROVIDER: str = os.getenv("DEFAULT_MODEL_PROVIDER", "openai")
        self.LLM_API_KEY: Optional[str] = os.getenv("LLM_API_KEY")
        self.LLM_BASE_URL: Optional[str] = os.getenv("LLM_BASE_URL")
        self.LLM_MODEL: Optional[str] = os.getenv("LLM_MODEL", "gpt-3.5-turbo")

        # -----------------------------------------------------------------------
        # Memory / Context Configuration
        # -----------------------------------------------------------------------
        self.MEMORY_ENABLED: bool = os.getenv("MEMORY_ENABLED", "false").lower() == "true"
        self.MEMORY_VECTOR_STORE_HOST: str = os.getenv("MEMORY_VECTOR_STORE_HOST", "localhost")
        self.MEMORY_VECTOR_STORE_PORT: int = int(os.getenv("MEMORY_VECTOR_STORE_PORT", "8000"))
        # Example: 'chroma', 'qdrant', 'mem0'
        self.MEMORY_PROVIDER: str = os.getenv("MEMORY_PROVIDER", "chroma")

        # -----------------------------------------------------------------------
        # SMS Configuration (Generic)
        # -----------------------------------------------------------------------
        # Adapters in services/sms.py will map these generic keys to provider-specifics
        self.SMS_ACCESS_KEY_ID: Optional[str] = os.getenv("SMS_ACCESS_KEY_ID")
        self.SMS_ACCESS_KEY_SECRET: Optional[str] = os.getenv("SMS_ACCESS_KEY_SECRET")
        self.SMS_SIGN_NAME: Optional[str] = os.getenv("SMS_SIGN_NAME")
        self.SMS_TEMPLATE_CODE: Optional[str] = os.getenv("SMS_TEMPLATE_CODE")
        self.SMS_REGION: str = os.getenv("SMS_REGION", "cn-hangzhou")
        
        self.SMS_CODE_LENGTH: int = int(os.getenv("SMS_CODE_LENGTH", "6"))
        self.SMS_CODE_TTL_SECONDS: int = int(os.getenv("SMS_CODE_TTL_SECONDS", "300"))
        self.SMS_RESEND_COOLDOWN_SECONDS: int = int(os.getenv("SMS_RESEND_COOLDOWN_SECONDS", "60"))
        self.SMS_MAX_ATTEMPTS: int = int(os.getenv("SMS_MAX_ATTEMPTS", "5"))
        self.SMS_DAILY_LIMIT_PER_PHONE: int = int(os.getenv("SMS_DAILY_LIMIT_PER_PHONE", "20"))
        self.SMS_TICKET_TTL_SECONDS: int = int(os.getenv("SMS_TICKET_TTL_SECONDS", "600"))

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
