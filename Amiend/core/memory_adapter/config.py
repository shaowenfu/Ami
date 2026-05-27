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
    extra: Optional[str]


_settings: Optional[MemorySettings] = None


def load_settings() -> MemorySettings:
    """Load memory settings from environment variables."""

    enabled_raw = os.getenv("MEM0_ENABLED", os.getenv("MEMORY_ENABLED", "false")).lower()
    enabled = enabled_raw not in {"0", "false", "off", "no"}
    provider = "mem0_platform"
    vector_store_path = (Path(__file__).resolve().parent / "storage" / "memories_db").resolve()
    vector_store_path.mkdir(parents=True, exist_ok=True)

    return MemorySettings(
        enabled=enabled,
        provider=provider,
        default_user_id="demo-user",
        default_agent_prefix="ami",
        search_limit=6,
        vector_store_path=vector_store_path,
        mem0_api_key=os.getenv("MEM0_API_KEY"),
        extra=None,
    )


def get_memory_settings() -> MemorySettings:
    """Lazy singleton accessor."""

    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings
