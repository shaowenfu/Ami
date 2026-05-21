# Ami 应用骨架与基础功能实施计划：SSE + Mem0

创建日期：2026-05-21

## 执行进度

- 2026-05-21：完成 M1 基础清理。后端运行路径中的 WebSocket 配置、鉴权辅助、异常命名与主要文档说明已切换为 SSE / Stream 语义。
- 2026-05-21：启动 M2 后端骨架。新增 Space / Invitation 模型、仓库、服务、路由和依赖注入，已注册 `/spaces` 路由。前端全局层与消息/SSE 事件流尚未接入。
- 2026-05-21：完成 M3 后端基础。新增 Message 模型、仓库、服务与 `/spaces/{space_id}/messages` API；新增进程内 SSE Event Bus 与 `/spaces/{space_id}/events` 订阅端点。私聊事件按 `target_user_ids` 只推送给本人，群聊事件推送给空间订阅者。
- 2026-05-21：启动 M4 基础链路。用户消息写入后通过 FastAPI `BackgroundTasks` 启动 Ami 回复任务，复用 SSE 推送 `message.delta`、`message.completed`、`message.failed`；当前仍使用基础 prompt，尚未接入 Mongo/Mem0 上下文构建器。

## 背景

`docs/Design/` 已明确 Ami 的核心产品结构：

- 全局层：个人身份、空间概览、邀请信箱、创建关系。
- 空间层：以某段关系为上下文的 Chat / Tools / Moments / Profile。
- 聊天边界：私聊与群聊必须在数据、召回、推送、界面上严格隔离。
- 存储策略：MongoDB Atlas 作为 Source of Truth，Mem0 承担长期语义记忆。
- 实时通信：项目决策为全部使用 SSE，不再使用 WebSocket。

当前 `Amiend` 已移除 WebSocket 路由与服务聚合，`main.py` 只注册 Auth / Health，并在应用描述中强调 SSE。前端仍是空间层 Demo 形态，缺少全局层与真实 API 接入。后端已有 Auth、Mongo、Redis、LLM Gateway、Memory Adapter 雏形，但尚未建立 Space / Invitation / Message / SSE / Mem0 业务链路。

## Mem0 官方 SDK 调研结论

官方 Platform Quickstart 推荐安装 `mem0ai`，使用 `from mem0 import MemoryClient` 初始化 hosted API 客户端，并通过 `client.add(messages, user_id="user123")` 写入记忆，通过 `client.search("query", filters={"user_id": "user123"})` 搜索记忆。

官方同时区分两种运行方式：

- Mem0 Platform：`MemoryClient(api_key="...")`，使用托管 API、Dashboard 与平台能力。
- Mem0 Open Source：`from mem0 import Memory`，本地初始化 `Memory()` 或 `Memory.from_config(config)`。

对 Ami 来说，第一阶段建议优先接 Mem0 Platform，原因是接入成本低、少维护向量库基础设施；同时在 `core/memory_adapter` 保留 backend contract，未来可替换为 Open Source 本地部署。

Mem0 `add` 的核心参数：

```python
client.add(
    messages=[
        {"role": "user", "content": "..."},
        {"role": "assistant", "content": "..."},
    ],
    user_id="space:<space_id>:private:<user_id>",
    agent_id="ami:<space_id>",
    metadata={
        "space_id": "<space_id>",
        "visibility": "PRIVATE:<user_id>",
        "source": "chat_digest",
        "source_msg_ids": ["msg_xxx"],
    },
)
```

Mem0 Open Source v1.0.0 `add` 支持 `infer` 参数，默认 `infer=True`，由 Mem0 从对话中抽取结构化记忆；`infer=False` 用于原样保存文本。Ami 的后台消化流默认应使用 `infer=True`，只有调试、审计或保存摘要原文时才考虑 `infer=False`。

Mem0 `search` 的核心参数：

```python
client.search(
    "用户当前问题或意图",
    filters={
        "AND": [
            {"user_id": "space:<space_id>:private:<user_id>"},
            {"metadata": {"space_id": "<space_id>"}},
            {"metadata": {"visibility": "PRIVATE:<user_id>"}},
        ]
    },
)
```

注意：Mem0 官方文档说明记忆按 entity scope 存储，`user_id` 与 `agent_id` 是不同实体维度。不要把 `user_id` 与 `agent_id` 放进同一个 `AND` 期待同一条记忆同时命中；如果需要同时召回用户维度与 Agent 维度记忆，应使用 `OR` 或分两次查。

官方过滤器已经支持嵌套 `AND` / `OR` / `NOT`，以及 `eq`、`ne`、`gt`、`gte`、`lt`、`lte`、`in`、`nin` 等操作符。Ami 的隐私边界应使用强过滤器表达，而不是仅依赖 prompt。

参考文档：

- [Mem0 Platform Quickstart](https://docs.mem0.ai/platform/quickstart)
- [Mem0 Add Memory](https://docs.mem0.ai/core-concepts/memory-operations/add)
- [Mem0 Platform Memory Filters](https://docs.mem0.ai/platform/features/v2-memory-filters)
- [Mem0 Open Source Metadata Filtering](https://docs.mem0.ai/open-source/features/metadata-filtering)
- [Mem0 API Changes / v1.0.0 SDK shape](https://docs.mem0.ai/migration/api-changes)

## 核心架构决策

### 1. SSE 是唯一实时通道

所有实时能力统一走 SSE：

- LLM token streaming。
- Ami 回复生成进度。
- 空间内新消息通知。
- 邀请状态变化。
- 工具箱任务状态变化。
- 后台记忆消化结果通知。

客户端写操作仍使用普通 HTTP POST / PATCH / DELETE。服务端推送使用 SSE。也就是说：

- 客户端发送消息：`POST /spaces/{space_id}/messages`
- 客户端订阅空间事件：`GET /spaces/{space_id}/events`
- 服务端按事件类型推送：`message.created`、`message.delta`、`message.completed`、`invitation.updated`、`memory.digest.completed`

### 2. MongoDB 是事实源，Mem0 只做长期语义记忆

MongoDB 保存：

- User
- Space
- SpaceInvitation
- Message
- KnowledgeNode
- Tool / Moment 派生状态

Mem0 保存：

- 对话摘要
- 关系事件
- 长期偏好
- 情绪与冲突模式
- 可被语义检索的情节记忆

任何需要审计、删除、回放、权限判断的数据都必须先在 MongoDB 有源记录，再异步进入 Mem0。

### 3. 隐私隔离由服务端统一强制

前端可以传 `room_scope` 意图，但最终写入与召回 scope 必须由后端根据 `current_user_id` 和 `space_id` 计算：

- 私聊：`PRIVATE:<user_id>`
- 群聊：`SHARED`

`SHARED` 场景只能读取 `SHARED` 记忆。

`PRIVATE:<user_id>` 场景可以读取：

- 当前用户的私聊记忆：`PRIVATE:<user_id>`
- 安全的共享记忆：`SHARED`

不得读取另一方的私聊记忆。

## 后端实施计划

### M1：清理实时通信边界

目标：确认后端已经完全切换到 SSE 语义。

- 移除或废弃 `.env.example` 中的 WebSocket limit 配置，替换为 SSE 配置。
- 清理 `dependencies/auth.py` 中 WebSocket 专用鉴权函数与导入。
- 清理 `core/exceptions.py` 中 WebSocket 专用异常，或改名为 stream/SSE 异常。
- 更新根目录 `README.md`、`Amiend/devDocs/*` 中过时的 WebSocket 描述。
- 新增 SSE 设计文档或在本计划基础上继续细化事件协议。

建议 SSE 配置：

```env
SSE_HEARTBEAT_INTERVAL_SECONDS=15
SSE_RECONNECT_RETRY_MS=3000
SSE_MAX_CONNECTIONS_PER_USER=3
SSE_EVENT_RETENTION_SECONDS=300
```

### M2：建立 Space / Invitation 数据域

目标：完成全局层关系空间创建链路。

新增模型：

- `Space`
- `SpaceMember`
- `SpaceInvitation`
- `AgentProfile`

新增集合：

- `spaces`
- `space_invitations`

新增 API：

- `GET /spaces`
- `GET /spaces/{space_id}`
- `POST /spaces/invitations`
- `GET /spaces/invitations/inbox`
- `POST /spaces/invitations/{invitation_id}/accept`
- `POST /spaces/invitations/{invitation_id}/reject`
- `PATCH /spaces/{space_id}/agent-profile`

关键校验：

- 只能按已注册手机号邀请。
- 不能邀请自己。
- 两个用户之间同类型关系空间重复创建时要有幂等处理。
- 只有邀请接收者能 accept / reject。

### M3：建立 Message + SSE 事件流

目标：替代 WebSocket，形成真实聊天闭环。

新增集合：

- `messages`
- `sse_event_log`（可选，第一版可以用 Redis Stream 替代）

新增 API：

- `GET /spaces/{space_id}/messages?room_scope=PRIVATE_SELF|SHARED`
- `POST /spaces/{space_id}/messages`
- `GET /spaces/{space_id}/events`

SSE 事件格式：

```text
event: message.created
id: <event_id>
data: {"space_id":"...","message_id":"...","room_scope":"SHARED"}
```

建议事件类型：

- `connected`
- `heartbeat`
- `message.created`
- `message.delta`
- `message.completed`
- `message.failed`
- `invitation.updated`
- `space.updated`
- `memory.digest.completed`

第一版可采用 Redis Pub/Sub 或 Redis Stream 做进程内外广播。若后端未来多实例部署，优先 Redis Stream，方便断线续传和事件游标。

### M4：接入基础 Ami 回复

目标：用户发消息后，Ami 能通过 SSE 流式回复。

流程：

1. `POST /spaces/{space_id}/messages` 写入用户消息。
2. 服务端发布 `message.created`。
3. 后端启动 Agent response task。
4. task 调用上下文构建器：
   - MongoDB 最近消息。
   - MongoDB `KnowledgeNode`。
   - Mem0 长期记忆。
5. 调用 `ModelService.generate_response_stream`。
6. 每个 token/chunk 通过 SSE 发布 `message.delta`。
7. 完成后写入 Ami 消息，发布 `message.completed`。

上下文构建器必须是唯一入口：

```python
build_chat_context(
    space_id: str,
    current_user_id: str,
    room_scope: Literal["PRIVATE_SELF", "SHARED"],
    query: str,
)
```

不要在路由或 Agent task 中临时拼接 Mem0 filters。

### M5：实现 Mem0 Adapter

目标：把当前 in-memory placeholder 替换为真实 Mem0 Platform backend。

新增依赖：

```text
mem0ai
```

新增环境变量：

```env
MEMORY_PROVIDER=mem0_platform
MEM0_API_KEY=
MEM0_DEFAULT_AGENT_PREFIX=ami
MEM0_SEARCH_LIMIT=6
MEM0_ENABLED=true
```

建议 adapter 接口：

```python
class MemoryBackend:
    def add(
        self,
        messages: Sequence[Mapping[str, str]],
        *,
        user_id: str,
        agent_id: str | None,
        metadata: Mapping[str, Any],
        infer: bool = True,
    ) -> dict:
        ...

    def search(
        self,
        query: str,
        *,
        filters: Mapping[str, Any],
        limit: int,
    ) -> list[MemorySnippet]:
        ...
```

建议命名空间：

- 私聊用户记忆：`user_id = "space:<space_id>:private:<user_id>"`
- 共享关系记忆：`user_id = "space:<space_id>:shared"`
- Agent 记忆：`agent_id = "ami:<space_id>"`

建议 metadata：

```json
{
  "space_id": "space_xxx",
  "visibility": "PRIVATE:user_xxx",
  "room_scope": "PRIVATE:user_xxx",
  "source": "chat_digest",
  "source_msg_ids": ["msg_xxx"],
  "created_by": "memory_digest_worker"
}
```

群聊搜索 filter：

```python
{
    "AND": [
        {"user_id": f"space:{space_id}:shared"},
        {"metadata": {"space_id": space_id}},
        {"metadata": {"visibility": "SHARED"}},
    ]
}
```

私聊搜索 filter：

```python
{
    "OR": [
        {
            "AND": [
                {"user_id": f"space:{space_id}:private:{current_user_id}"},
                {"metadata": {"space_id": space_id}},
                {"metadata": {"visibility": f"PRIVATE:{current_user_id}"}},
            ]
        },
        {
            "AND": [
                {"user_id": f"space:{space_id}:shared"},
                {"metadata": {"space_id": space_id}},
                {"metadata": {"visibility": "SHARED"}},
            ]
        },
    ]
}
```

### M6：后台记忆消化

目标：把实时聊天和长期记忆写入解耦。

触发条件：

- 每个 space/room_scope 新增 N 条消息。
- 每天低峰定时任务。
- 用户手动保存某条重要瞬间。

消化流程：

1. 从 MongoDB 读取未消化消息。
2. 使用低温模型提取：
   - 可确认事实 → `KnowledgeNode`
   - 情节摘要 → Mem0
   - 关系事件 → `moments`
3. 写入 digest checkpoint。
4. 发布 `memory.digest.completed` SSE 事件。

第一版可以先不引入 Celery，使用 FastAPI `BackgroundTasks` 或一个简单 asyncio worker；当任务量变大后再升级到独立 worker。

## 前端实施计划

### F1：路由重组

目标：实现全局层与空间层分离。

建议结构：

```text
app/
  auth/
    login.tsx
    profile-setup.tsx
  spaces/
    index.tsx
    create.tsx
    invitations.tsx
  space/
    [spaceId]/
      _layout.tsx
      chat.tsx
      tools.tsx
      moments.tsx
      profile.tsx
```

当前 `(tabs)` 下页面可迁移到 `space/[spaceId]/`，并通过 `spaceId` 获取上下文。

### F2：API Client 与状态层

拆分当前 `useAmiMockStore`：

- `authStore`
- `spaceStore`
- `chatStore`
- `relationshipToolsStore`
- `mockFixtures`

新增 HTTP client：

- 自动附带 access token。
- 统一处理 refresh token。
- 统一错误模型。

### F3：SSE Client

React Native 端需要确认目标运行环境对 `EventSource` 的支持情况。若原生端不可直接使用浏览器 `EventSource`，可引入 RN SSE polyfill，或使用 fetch streaming 方案。

客户端行为：

- 进入空间后订阅 `GET /spaces/{spaceId}/events`。
- 离开空间后关闭订阅。
- 收到 `heartbeat` 保持连接活跃。
- 断线后按服务端 `retry` 或本地指数退避重连。
- 使用 SSE `Last-Event-ID` 做断线续传预留。

### F4：私聊/群聊强视觉区分

聊天页不只是 segmented control，还需要：

- 页面背景或输入区颜色区分。
- 顶部标题明确显示“只和 Ami 聊”或“三人关系群聊”。
- 输入框 placeholder 区分。
- 群聊发送前可以保留轻量提示，降低误发风险。

## 验收标准

### 第一阶段验收

- 用户能注册/登录。
- 用户能看到空间概览。
- 用户能按手机号邀请另一位用户。
- 被邀请者能接受邀请。
- 双方能进入同一个 Space。
- 私聊与群聊能分别发送消息。
- 消息写入 MongoDB。
- 前端通过 SSE 收到新消息事件。
- Ami 能通过 SSE 流式返回基础回复。
- `SHARED` 不会读取任何 `PRIVATE:*` 记忆。

### 第二阶段验收

- Mem0 Platform backend 可通过 env 开关启用。
- 后台 digest 能把消息摘要写入 Mem0。
- 私聊搜索只返回当前用户私聊 + shared 记忆。
- 群聊搜索只返回 shared 记忆。
- 断开 Mem0 时应用仍能退化到 MongoDB 最近消息上下文。

## 推荐执行顺序

1. 清理 WebSocket 残留文案与配置，建立 SSE 术语一致性。
2. 实现 Space / Invitation 后端与全局层前端。
3. 实现 Message REST API 与 Space SSE endpoint。
4. 把现有聊天 Demo 接入真实消息数据。
5. 接入基础 LLM SSE 流式回复。
6. 实现 Mem0 Platform adapter。
7. 增加后台 digest 与隐私过滤测试。

## 风险与注意事项

- SSE 是服务端到客户端单向通道，客户端写操作必须保持 HTTP API，不要把“发送消息”设计成 SSE。
- 移动端后台、锁屏、网络切换会导致 SSE 断开，必须有重连与消息补拉。
- Mem0 过滤器是隐私边界的一部分，但不是唯一边界；MongoDB 查询、上下文构建、LLM prompt 都要共享同一套 scope 规则。
- 记忆删除需要设计从 MongoDB 源消息到 Mem0 memory id 的映射，否则用户删除消息后长期记忆可能残留。
- `agent_id` 与 `user_id` 是不同 entity scope，不要误用 `AND` 组合导致查不到记忆。
