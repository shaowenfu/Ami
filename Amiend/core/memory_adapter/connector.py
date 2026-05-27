"""Memory adapter façade.

The business layer should depend on this module instead of importing Mem0 SDK
objects directly. The adapter keeps a small in-memory backend for local
development, and can switch to Mem0 Platform by setting env vars.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, MutableSequence, Optional, Sequence

from core.logger import get_logger

from .config import MemorySettings, get_memory_settings
from .normalizer import normalize_query

logger = get_logger(__name__)


@dataclass(frozen=True)
class MemorySnippet:
    """Normalized memory search result used by application services."""

    text: str
    id: Optional[str] = None
    score: Optional[float] = None
    metadata: Mapping[str, Any] = field(default_factory=dict)
    raw: Any = None


class MemoryBackend:
    """Backend contract shared by in-memory and Mem0 Platform implementations."""

    def add(
        self,
        messages: Sequence[Mapping[str, str]],
        *,
        user_id: str,
        agent_id: Optional[str],
        metadata: Optional[Mapping[str, Any]],
        infer: bool = True,
    ) -> Mapping[str, Any]:
        raise NotImplementedError("Implement memory add() for your backend.")

    def search(
        self,
        query: str,
        *,
        filters: Mapping[str, Any],
        limit: int,
    ) -> list[MemorySnippet]:
        raise NotImplementedError("Implement memory search() for your backend.")


class _InMemoryBackend(MemoryBackend):
    """Minimal scoped backend for bootstrapping and tests."""

    def __init__(self) -> None:
        self._store: list[dict[str, Any]] = []

    def add(
        self,
        messages: Sequence[Mapping[str, str]],
        *,
        user_id: str,
        agent_id: Optional[str],
        metadata: Optional[Mapping[str, Any]],
        infer: bool = True,
    ) -> Mapping[str, Any]:
        text = "\n".join(
            f"{message.get('role', '')}: {message.get('content', '')}".strip()
            for message in messages
            if str(message.get("content", "")).strip()
        )
        if not text:
            return {"status": "SKIPPED", "reason": "empty_messages"}

        memory_id = f"local-{len(self._store) + 1}"
        self._store.append(
            {
                "id": memory_id,
                "memory": text,
                "user_id": user_id,
                "agent_id": agent_id,
                "metadata": dict(metadata or {}),
                "infer": infer,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {"status": "SUCCEEDED", "id": memory_id}

    def search(
        self,
        query: str,
        *,
        filters: Mapping[str, Any],
        limit: int,
    ) -> list[MemorySnippet]:
        matches = [record for record in self._store if _matches_filter(record, filters)]
        selected = matches[-limit:] if limit > 0 else matches
        return [
            MemorySnippet(
                id=str(record.get("id")),
                text=str(record.get("memory", "")),
                metadata=record.get("metadata") or {},
                raw=record,
            )
            for record in selected
        ]


class _Mem0PlatformBackend(MemoryBackend):
    """Mem0 Platform backend using the official `mem0ai` SDK."""

    def __init__(self, settings: MemorySettings) -> None:
        if not settings.mem0_api_key:
            raise RuntimeError("MEM0_API_KEY is required when MEMORY_PROVIDER=mem0_platform.")

        try:
            from mem0 import MemoryClient
        except ImportError as exc:  # pragma: no cover - depends on optional SDK
            raise RuntimeError("mem0ai is not installed. Add `mem0ai` to the backend environment.") from exc

        self._client = MemoryClient(api_key=settings.mem0_api_key)

    def add(
        self,
        messages: Sequence[Mapping[str, str]],
        *,
        user_id: str,
        agent_id: Optional[str],
        metadata: Optional[Mapping[str, Any]],
        infer: bool = True,
    ) -> Mapping[str, Any]:
        payload: dict[str, Any] = {
            "messages": [dict(message) for message in messages],
            "user_id": user_id,
            "infer": infer,
        }
        if agent_id:
            payload["agent_id"] = agent_id
        if metadata:
            payload["metadata"] = dict(metadata)

        try:
            result = self._client.add(**payload)
        except TypeError:
            payload.pop("infer", None)
            result = self._client.add(**payload)

        if isinstance(result, Mapping):
            return result
        return {"result": result}

    def search(
        self,
        query: str,
        *,
        filters: Mapping[str, Any],
        limit: int,
    ) -> list[MemorySnippet]:
        try:
            result = self._client.search(query, filters=dict(filters), top_k=limit)
        except TypeError:
            try:
                result = self._client.search(query, filters=dict(filters), limit=limit)
            except TypeError:
                result = self._client.search(query, filters=dict(filters))
        return _normalize_search_results(result, limit=limit)


@dataclass(frozen=True)
class MemoryClients:
    backend: MemoryBackend
    default_user_id: str
    default_agent_prefix: str
    search_limit: int
    enabled: bool


_clients: Optional[MemoryClients] = None


def _build_backend(settings: MemorySettings) -> MemoryBackend:
    if not settings.enabled:
        logger.info("Memory adapter disabled; using inert in-memory backend.")
        return _InMemoryBackend()

    provider = (settings.provider or "in_memory").lower()
    if provider in {"mem0", "mem0_platform", "platform"}:
        logger.info("Memory adapter using Mem0 Platform backend.")
        return _Mem0PlatformBackend(settings)

    logger.info("Memory adapter using in-memory backend: %s", provider)
    return _InMemoryBackend()


def init_memory_adapter(settings: Optional[MemorySettings] = None) -> MemoryClients:
    """Initialize the shared memory backend (idempotent)."""

    global _clients
    if _clients is not None:
        return _clients

    effective_settings = settings or get_memory_settings()
    backend = _build_backend(effective_settings)
    _clients = MemoryClients(
        backend=backend,
        default_user_id=effective_settings.default_user_id,
        default_agent_prefix=effective_settings.default_agent_prefix,
        search_limit=effective_settings.search_limit,
        enabled=effective_settings.enabled,
    )
    return _clients


def _require_clients() -> MemoryClients:
    if _clients is None:
        init_memory_adapter()
    return _clients  # type: ignore[return-value]


def store_memories(
    messages: Sequence[Mapping[str, str]],
    user_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    *,
    metadata: Optional[Mapping[str, Any]] = None,
    infer: bool = True,
) -> Mapping[str, Any]:
    if not messages:
        return {"status": "SKIPPED", "reason": "empty_messages"}
    clients = _require_clients()
    if not clients.enabled:
        raise RuntimeError("Memory adapter is disabled; enable it before storing memories.")

    normalized: MutableSequence[dict[str, str]] = []
    for msg in messages:
        role = str(msg.get("role", "")).strip()
        content = str(msg.get("content", "")).strip()
        if not role or not content:
            continue
        normalized.append({"role": role, "content": content})

    if not normalized:
        return {"status": "SKIPPED", "reason": "empty_messages"}

    return clients.backend.add(
        normalized,
        user_id=user_id or clients.default_user_id,
        agent_id=agent_id,
        metadata=metadata,
        infer=infer,
    )


def fetch_memory_snippets(
    query: str,
    *,
    filters: Optional[Mapping[str, Any]] = None,
    user_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    limit: Optional[int] = None,
    context: Optional[Mapping[str, Any]] = None,
) -> list[MemorySnippet]:
    cleaned_query = normalize_query(query, context=context)
    if not cleaned_query:
        return []
    clients = _require_clients()
    if not clients.enabled:
        raise RuntimeError("Memory adapter is disabled; enable it before fetching memories.")

    safe_limit = max(1, limit or clients.search_limit)
    effective_filters = dict(filters or _legacy_entity_filter(user_id or clients.default_user_id, agent_id))
    return clients.backend.search(
        query=cleaned_query,
        filters=effective_filters,
        limit=safe_limit,
    )


def fetch_memories(
    query: str,
    user_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    limit: int = 3,
    context: Optional[Mapping[str, Any]] = None,
    *,
    filters: Optional[Mapping[str, Any]] = None,
) -> list[str]:
    snippets = fetch_memory_snippets(
        query=query,
        filters=filters,
        user_id=user_id,
        agent_id=agent_id,
        limit=limit,
        context=context,
    )
    return [snippet.text for snippet in snippets if snippet.text]


def build_memory_block(
    query: str,
    user_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    limit: int = 3,
    header: str = "Relevant memories:",
    context: Optional[Mapping[str, Any]] = None,
    *,
    filters: Optional[Mapping[str, Any]] = None,
) -> str:
    snippets = fetch_memories(
        query=query,
        user_id=user_id,
        agent_id=agent_id,
        limit=limit,
        context=context,
        filters=filters,
    )
    if not snippets:
        return ""
    lines = "\n".join(f"- {snippet}" for snippet in snippets)
    return f"{header}\n{lines}\n"


def is_memory_enabled() -> bool:
    return _require_clients().enabled


def _legacy_entity_filter(user_id: str, agent_id: Optional[str]) -> Mapping[str, Any]:
    if agent_id:
        return {"OR": [{"user_id": user_id}, {"agent_id": agent_id}]}
    return {"user_id": user_id}


def _normalize_search_results(result: Any, *, limit: int) -> list[MemorySnippet]:
    if isinstance(result, Mapping):
        raw_items = result.get("results") or result.get("memories") or []
    else:
        raw_items = result or []

    snippets: list[MemorySnippet] = []
    for item in list(raw_items)[:limit]:
        if isinstance(item, Mapping):
            text = str(item.get("memory") or item.get("text") or item.get("content") or "").strip()
            if not text:
                continue
            score_raw = item.get("score")
            score = float(score_raw) if isinstance(score_raw, (int, float)) else None
            snippets.append(
                MemorySnippet(
                    id=str(item.get("id")) if item.get("id") else None,
                    text=text,
                    score=score,
                    metadata=item.get("metadata") or {},
                    raw=item,
                )
            )
        else:
            text = str(item).strip()
            if text:
                snippets.append(MemorySnippet(text=text, raw=item))
    return snippets


def _matches_filter(record: Mapping[str, Any], condition: Mapping[str, Any]) -> bool:
    if not condition:
        return True
    if "AND" in condition:
        return all(_matches_filter(record, item) for item in condition["AND"])
    if "OR" in condition:
        return any(_matches_filter(record, item) for item in condition["OR"])
    if "NOT" in condition:
        value = condition["NOT"]
        if isinstance(value, list):
            return not any(_matches_filter(record, item) for item in value)
        return not _matches_filter(record, value)

    for key, expected in condition.items():
        actual = record.get(key)
        if key == "metadata" and isinstance(expected, Mapping):
            actual_metadata = record.get("metadata") or {}
            for metadata_key, metadata_value in expected.items():
                if actual_metadata.get(metadata_key) != metadata_value:
                    return False
            continue
        if isinstance(expected, Mapping):
            if "in" in expected and actual not in expected["in"]:
                return False
            if "ne" in expected and actual == expected["ne"]:
                return False
            if "eq" in expected and actual != expected["eq"]:
                return False
            continue
        if actual != expected:
            return False
    return True
