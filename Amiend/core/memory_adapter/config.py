"""Memory adapter configuration."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class MemorySettings:
    """Runtime settings for the memory adapter."""

    enabled: bool
    provider: str
    default_user_id: str
    default_agent_prefix: str
    search_limit: int
    vector_store_path: Path
    mem0_api_key: Optional[str]
    mem0_org_id: Optional[str]
    mem0_project_id: Optional[str]
    extra: Optional[str]


_settings: Optional[MemorySettings] = None


def load_settings() -> MemorySettings:
    """Load memory settings from environment variables."""

    enabled_raw = os.getenv("MEM0_ENABLED", os.getenv("MEMORY_ENABLED", "false")).lower()
    enabled = enabled_raw not in {"0", "false", "off", "no"}
    provider = (
        os.getenv("MEMORY_PROVIDER")
        or os.getenv("MEMORY_BACKEND")
        or ("mem0_platform" if os.getenv("MEM0_API_KEY") else "in_memory")
    )
    base_dir = Path(os.getenv("MEMORY_BASE_DIR", Path(__file__).resolve().parent))
    vector_store_path = Path(
        os.getenv(
            "MEMORY_VECTOR_STORE_PATH",
            base_dir / "storage" / "memories_db",
        )
    ).resolve()
    vector_store_path.mkdir(parents=True, exist_ok=True)

    return MemorySettings(
        enabled=enabled,
        provider=provider,
        default_user_id=os.getenv("MEMORY_DEFAULT_USER_ID", "demo-user"),
        default_agent_prefix=os.getenv("MEM0_DEFAULT_AGENT_PREFIX", "ami"),
        search_limit=int(os.getenv("MEM0_SEARCH_LIMIT", "6")),
        vector_store_path=vector_store_path,
        mem0_api_key=os.getenv("MEM0_API_KEY"),
        mem0_org_id=os.getenv("MEM0_ORG_ID"),
        mem0_project_id=os.getenv("MEM0_PROJECT_ID"),
        extra=os.getenv("MEMORY_EXTRA"),
    )


def get_memory_settings() -> MemorySettings:
    """Lazy singleton accessor."""

    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings
