# Ami Context Orchestration Core Protocol Plan

Date: 2026-05-27

## 1. Product Understanding

Ami is not a generic chatbot and not a neutral judge between two people. Ami is a long-term third presence inside a two-person relationship space: a shared companion, memory keeper, and relationship infrastructure. Its value comes from staying aware of both people, understanding the relationship over time, and helping emotions, facts, needs, promises, and important moments become maintainable relationship assets.

The key product thesis for the next backend phase is:

> Ami's intelligence and emotional tact are determined primarily by context orchestration, not by a clever one-off prompt.

Prompt wording is the last mile. The actual defense and intelligence must happen before generation:

1. Database queries decide which records can become candidates.
2. The orchestrator decides how candidate information is rendered for the current mode.
3. The prompt explains source semantics to the model.
4. The model performs relationship expression using already-curated context.

## 2. Current Problem

The current backend has a useful first version:

- User messages are persisted in MongoDB.
- Ami replies through the OpenAI-compatible LLM gateway.
- SSE streams `message.delta` and completion events.
- `ContextOrchestrator` assembles recent Mongo messages, Mem0 snippets, relationship summaries, and source-labeled prompt sections.
- Memory writes happen after a completed exchange.

But the existing context model is too coarse:

- Private chat currently behaves as if Ami should only know the current user's private memory plus shared memory.
- Shared chat currently behaves as if Ami should only know shared memory.
- `privacy_rule` in the prompt is treated as a protection mechanism, but prompt-level privacy rules are weak and should not be the main defense.
- `AgentProfile.tone` is too shallow for the product direction and does not represent Ami's evolving self-understanding.
- There is no stable compressed relationship state that is always present in chat context.
- There is no separate orchestration mechanism for private two-person mode and shared three-person mode.

## 3. Corrected Mental Model

Ami should have one continuous internal relationship awareness across three information sources:

1. User A private chat with Ami.
2. User B private chat with Ami.
3. Shared chat between User A, User B, and Ami.

The distinction is not whether Ami knows something. The distinction is how Ami may use it in the current audience.

This creates two layers:

- **Agent-visible context**: what Ami may know internally.
- **Audience-rendered context**: how that knowledge may appear in the prompt for the current chat mode.

For example, when User A privately chats with Ami, Ami may benefit from knowing that User B has also been stressed recently. But the context renderer should not inject User B's private raw messages. It should inject a derived signal such as:

> The other partner has recently shown sensitivity around pressure and may respond better to lower-friction invitations.

This lets Ami act like a trustworthy shared friend: aware, careful, and useful.

## 4. Data Model Changes

### 4.1 AgentProfile

Replace the old `tone` field with two explicit fields:

```json
{
  "name": "Ami",
  "self_recognition": "Ami's evolving self-summary about who it is in this relationship.",
  "prompt": "Optional user-defined custom instruction for this relationship-local Ami."
}
```

Static identity, mission, relationship position, and boundaries do not belong in MongoDB. They should live in the hardcoded base prompt because they are product invariants.

Field semantics:

- `name`: relationship-local display name.
- `self_recognition`: Ami's evolving self-recognition. Updated by sleep jobs.
- `prompt`: relationship-local customization. Manually editable by users later.

### 4.2 Space Long-Term Summary Fields

Add three simple string fields to `Space`:

```json
{
  "user_a_profile": "Compressed profile of the first member.",
  "user_b_profile": "Compressed profile of the second member.",
  "relationship_summary": "Compressed summary of important relationship facts, patterns, commitments, and recent themes."
}
```

These are stable compressed working-memory layers and should be included in every Ami reply. They are updated by the future sleep mechanism.

The first implementation can map:

- `user_a_profile` to `members[0]`
- `user_b_profile` to `members[1]`

Later, if relation roles become more complex, we can introduce explicit member labels.

## 5. Core Context Protocol

The orchestrator produces a `ContextBundle` and renders it into a prompt block.

### 5.1 Private Chat Bundle

Private mode is used when the current user chats one-on-one with Ami.

```json
{
  "mode": "PRIVATE_WITH_USER",
  "current_user_id": "user_a",
  "other_user_id": "user_b",
  "agent_profile": {
    "name": "Ami",
    "self_recognition": "...",
    "prompt": "..."
  },
  "long_term_state": {
    "current_user_profile": "...",
    "other_user_profile": "...",
    "relationship_summary": "..."
  },
  "recent_context": {
    "current_private_messages": "...",
    "shared_messages": "...",
    "other_private_signals": "..."
  },
  "retrieved_memories": {
    "current_private": "...",
    "shared": "...",
    "other_private_signals": "..."
  }
}
```

Private mode should include:

- Current user's private recent messages as direct context.
- Shared recent messages as openly referenceable context.
- Other user's private information only as derived signals, not raw private quotes.
- Current user's profile, other user's profile, relationship summary, Ami self-recognition, and custom prompt.

### 5.2 Shared Chat Bundle

Shared mode is used when both users and Ami are in the room.

```json
{
  "mode": "SHARED_WITH_BOTH",
  "audience_user_ids": ["user_a", "user_b"],
  "agent_profile": {
    "name": "Ami",
    "self_recognition": "...",
    "prompt": "..."
  },
  "long_term_state": {
    "user_a_profile": "...",
    "user_b_profile": "...",
    "relationship_summary": "..."
  },
  "recent_context": {
    "shared_messages": "...",
    "private_derived_signals": "..."
  },
  "retrieved_memories": {
    "shared": "...",
    "private_derived_signals": "..."
  }
}
```

Shared mode should include:

- Shared recent messages as direct context.
- Shared long-term memories as openly referenceable context.
- Private-derived relationship signals only as abstract, non-attributed observations.
- Both user profiles, relationship summary, Ami self-recognition, and custom prompt.

## 6. Source Semantics

The rendered prompt must explicitly label information source categories:

- `CURRENT_PRIVATE`: said by the current user privately to Ami. Ami can naturally respond, quote, and ask follow-up questions.
- `OTHER_PRIVATE_SIGNAL`: derived from the other partner's private interactions with Ami. Ami can use it only as background understanding. It should not reveal source, quote, or attribute it.
- `SHARED`: known to both partners and Ami. Ami can reference it openly.
- `PRIVATE_DERIVED_SIGNAL`: low-sensitive internal relationship signal derived from private chats. In shared mode, it must not be attributed to either partner or framed as private knowledge.
- `LONG_TERM_STATE`: compressed profiles, relationship summary, and Ami self-recognition maintained by sleep jobs.

The critical point: raw private data from the other partner should not be rendered into a prompt for the current audience. It must first be summarized into signals.

## 7. Prompt Shapes

### 7.1 Private Chat System Prompt

```text
# Static Identity
You are {agent_name}, a long-term relationship companion inside a two-person relationship space.
You are not a judge and not a messenger that mechanically passes secrets between partners.
You care about both people and help the relationship become more understandable, kind, repairable, and alive.

# Current Mode
Mode: Private chat with {current_user_id}
Audience: only {current_user_id}

# Ami Profile
Name: {agent_profile.name}
Self-recognition:
{agent_profile.self_recognition}
Relationship-local custom prompt:
{agent_profile.prompt}

# Long-Term Relationship State
Current user profile:
{current_user_profile}

Other partner profile:
{other_user_profile}

Relationship summary:
{relationship_summary}

# Source Semantics
- CURRENT_PRIVATE: directly said by the current user to Ami. You may respond naturally to it.
- OTHER_PRIVATE_SIGNAL: derived from the other partner's private interactions with Ami. Use only as background understanding. Do not reveal source, quote, or attribute.
- SHARED: known to both partners and Ami. You may reference it openly.

# Context
## CURRENT_PRIVATE recent messages
...

## SHARED recent messages and memories
...

## OTHER_PRIVATE_SIGNAL
...

# Task
Reply in concise, gentle Chinese as Ami.
Use source awareness. Be emotionally accurate, concrete, and proportionate.
```

### 7.2 Shared Chat System Prompt

```text
# Static Identity
You are {agent_name}, a long-term relationship companion inside this two-person relationship.
You are not a judge. You help both people understand each other and maintain the relationship.

# Current Mode
Mode: Shared chat with both partners
Audience: {user_a_id}, {user_b_id}

# Ami Profile
Name: {agent_profile.name}
Self-recognition:
{agent_profile.self_recognition}
Relationship-local custom prompt:
{agent_profile.prompt}

# Long-Term Relationship State
User A profile:
{user_a_profile}

User B profile:
{user_b_profile}

Relationship summary:
{relationship_summary}

# Source Semantics
- SHARED: known to both partners and Ami. You may reference it openly.
- PRIVATE_DERIVED_SIGNAL: Ami's low-sensitive internal understanding derived from private chats. Do not attribute it to either partner or expose private details.

# Context
## SHARED recent messages and memories
...

## PRIVATE_DERIVED_SIGNAL
...

# Task
Reply in concise, gentle Chinese as Ami.
Help the two people move toward clearer, kinder communication.
Do not reveal private-chat details or imply one partner privately told Ami something.
```

## 8. Query and Rendering Policy

### 8.1 Private Mode

Mongo recent messages:

- Fetch current user's private room.
- Fetch shared room.
- Optionally fetch the other user's private room only for signal rendering, not raw injection.

Mem0 memories:

- Fetch current user's private memory.
- Fetch shared memory.
- Optionally fetch other user's private memory and render only as abstract signal text.

### 8.2 Shared Mode

Mongo recent messages:

- Fetch shared room.
- Optionally derive very low-sensitive signals from private summaries, never raw private messages.

Mem0 memories:

- Fetch shared memory.
- Optionally include private-derived signals only if the renderer can keep them abstract.

### 8.3 First Implementation Simplification

The first implementation will not call an extra LLM to summarize other-private raw messages into signals. It will still create the two-mode protocol and include long-term fields. For private-derived signals, it can initially use:

- Empty string when no safe summarizer exists.
- Future hook points for sleep-generated profile and relationship summary fields.

This avoids unsafe raw leakage while establishing the orchestration protocol.

## 9. Sleep Mechanism Design

The sleep mechanism runs once per active space during low-traffic hours.

Inputs:

- Yesterday's User A private messages.
- Yesterday's User B private messages.
- Yesterday's shared messages.
- Existing `user_a_profile`, `user_b_profile`, `relationship_summary`.
- Existing `agent_profile.self_recognition`.

Outputs:

- Updated `user_a_profile`.
- Updated `user_b_profile`.
- Updated `relationship_summary`.
- Updated `agent_profile.self_recognition`.
- New Mem0 episodic memories with source metadata.
- Optional structured facts/commitments later.

The sleep job should preserve provenance. Even when it updates compressed text fields, the summarizer prompt should treat private details carefully and distinguish:

- What Ami may know internally.
- What can be openly referenced.
- What should only influence tone or timing.

## 10. Heartbeat Mechanism Design

Heartbeat is the basis of proactive Ami messages. It should run periodically, for example every 5-15 minutes.

For each active space, it evaluates lightweight conditions:

- Shared room has no user message for more than 4 hours and there is an unresolved shared topic.
- One user expressed distress privately and has not followed up after a configured interval.
- A commitment or important date is approaching.
- Recent interaction pattern indicates distance, avoidance, or repair opportunity.

Heartbeat flow:

```text
heartbeat tick
  -> load active spaces
  -> evaluate triggers
  -> build context through ContextOrchestrator
  -> generate proactive candidate
  -> delivery policy check
  -> persist AGENT message
  -> SSE / push notification
```

The first implementation should only create the architectural path. Actual proactive sending should be conservative and probably disabled by default until product behavior is reviewed.

## 11. Implementation Plan

### Phase 1: Core Protocol Foundation

- Add this design document.
- Refactor `AgentProfile` to `name`, `self_recognition`, `prompt`.
- Add `user_a_profile`, `user_b_profile`, `relationship_summary` to `Space`.
- Do not keep legacy `tone` compatibility; new local data should use the new protocol model directly.
- Update create-space defaults.
- Update frontend API types and display fallback.

### Phase 2: Context Orchestrator

- Use `ContextOrchestrator` as the only context assembly entry point.
- Do not keep compatibility aliases; use `ContextOrchestrator` as the only context entry point.
- Implement separate private and shared prompt renderers.
- Include long-term state in every prompt.
- Keep memory lookups source-aware.
- Avoid injecting other user's raw private messages.

### Phase 3: Message Generation Integration

- `MessageService.generate_agent_reply` loads the current `Space`.
- It calls the orchestrator with space, current user, room scope, and user input.
- It passes the rendered system prompt to the LLM.
- It keeps the existing SSE and persistence behavior.

### Phase 4: Sleep and Heartbeat

- Add sleep service and scheduled runner.
- Add summary update repository method.
- Add heartbeat runner with dry-run mode.
- Add delivery policy.

## 12. Acceptance Criteria for Phase 1-3

- Backend compiles.
- Existing message endpoints still work.
- New spaces include the new profile fields.
- Existing spaces missing new fields still validate with defaults.
- Private chat and shared chat produce different system prompt structures.
- `AgentProfile.prompt` and `AgentProfile.self_recognition` are included in generated prompts.
- `user_a_profile`, `user_b_profile`, and `relationship_summary` are included in generated prompts.
- No other user's raw private messages are injected into the first implementation.
