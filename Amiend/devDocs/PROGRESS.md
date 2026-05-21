# Nova FastAPI Starter · Progress Log

Purpose: track important/structural updates. Keep entries concise, deterministic, and reviewable.

## Update Rules
- Scope: architecture/layout changes, config/env schema updates, dependency shifts, breaking API/SSE contract changes, infra/docker adjustments, and key docs revisions.
- Format: append as table rows with date (YYYY-MM-DD), area, change summary, author/PR (if applicable).
- Exclusions: routine refactors without behavior change, minor copy tweaks, formatting-only commits.
- When to update: whenever a change impacts how to run, configure, extend, or integrate the framework.

## Log
| Date       | Area            | Change                                                                 | Author/PR |
| ---------- | --------------- | ---------------------------------------------------------------------- | --------- |
| 2024-06-XX | Docker/Config   | Simplified Dockerfile/compose; unified `.env.example`; ops profiles.   | -         |
| 2024-06-XX | WS/Services     | Consolidated WebSocket manager/service; pruned domain handlers.        | -         |
| 2024-06-XX | Docs/Static     | Rebuilt static index/auth guide/WS tester/notifications as generic.    | -         |
| 2025-12-14 | Architecture    | Renamed to "Nova"; decoupled Config (LLM/SMS); added Docker Memory Adapter (Chroma). | -         |
| 2026-05-21 | Streams/Config  | Replaced WebSocket runtime assumptions with SSE settings and stream errors. | Codex    |
| 2026-05-21 | Spaces/Messages | Added relationship space invitations plus Mongo-backed messages and space SSE stream endpoints. | Codex    |
| 2026-05-21 | Agent Streaming | Added background Ami reply generation that emits message delta/completed/failed SSE events. | Codex    |
| 2026-05-21 | Memory/Context | Added chat context builder and Mem0 Platform Adapter with private/shared memory filters. | Codex    |
| 2026-05-21 | Memory Digest | Persisted completed chat exchanges to Mem0 and emit memory.digest.completed over SSE. | Codex    |
