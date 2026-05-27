# Memory Adapter 使用指南

该模块是一个可以直接放入 `/core` 的记忆适配器，不需要业务层直接依赖 Mem0 SDK 即可提供记忆读写能力。当前默认目标是 Mem0 Platform，同时保留禁用状态下的 in-memory backend 方便本地启动。

## 1. 安装依赖
运行环境需要包含以下库：
- `mem0ai`
- `python-dotenv`

## 2. 配置环境变量
在 `.env` 或配置中心写入：
```
MEM0_ENABLED=true
MEMORY_PROVIDER=mem0_platform
MEM0_API_KEY=...
MEM0_DEFAULT_AGENT_PREFIX=ami
MEM0_SEARCH_LIMIT=6
MEMORY_DEFAULT_USER_ID=demo-user
MEM0_NORMALIZATION_FILE=可选规则文件路径
```
如果 `MEM0_ENABLED=false`，启动时会使用本地 in-memory backend，不需要 `MEM0_API_KEY`。

## 3. 应用启动时初始化
在后端启动流程（如 `main.py` 的 lifespan）中调用一次 `init_memory_adapter()`：
```python
from core.memory_adapter import init_memory_adapter

def lifespan(app: FastAPI):
    init_memory_adapter()
    yield
```
该函数会校验必要的环境变量并创建共享的 `Memory` 实例，可安全重复调用。

## 4. 使用公开方法
- `store_memories(messages, user_id=None, agent_id=None, metadata=None, infer=True)`
  `messages` 为 `{ "role": str, "content": str }` 的列表，空值会被自动过滤。`metadata` 应写入 `space_id`、`visibility`、`source` 等审计字段。
- `fetch_memory_snippets(query, filters=..., limit=6, context=None)`
  先执行 `query_normalization`，再用 Mem0 filters 返回结构化 `MemorySnippet` 列表。
- `fetch_memories(query, user_id=None, limit=3, context=None, filters=None)`
  返回纯文本记忆列表，主要用于兼容旧调用。
- `build_memory_block(query, user_id=None, limit=3, header="相关记忆：", filters=None)`
  直接返回格式化好的中文记忆块，例如：
  ```
  相关记忆：
  - 用户喜欢早上冥想
  - 最近正在准备考试
  ```
  可直接放入 prompt 的 system 字段或其它上下文。

如果未传 `user_id`，会退回到 `MEMORY_DEFAULT_USER_ID`，多用户场景请务必传入真实用户 ID 或显式 filters。

**Ami 空间命名空间**
关系空间内统一使用以下命名空间：
```python
private_user_id = f"space:{space_id}:private:{user_id}"
shared_user_id = f"space:{space_id}:shared"
agent_id = f"ami:{space_id}"
```
私聊查询只能召回当前用户私聊记忆与 shared 记忆；群聊查询只能召回 shared 记忆。业务层应优先通过 `services.basic.chat_context.ContextOrchestrator` 统一构建 filters。

## 5. 运维提示
- 适配器内部是同步实现；异步服务中建议使用 `asyncio.to_thread` 包裹，当前 `ContextOrchestrator` 已这样处理。
- 真正的瓶颈通常是 Mem0 / LLM 请求配额，注意监控调用量与失败率。
- 若后续要拆分成独立服务，直接连同 `.env` 配置一起复制整个 `core/memory_adapter` 目录即可，无需调整其他代码。

## 6. Query Normalization 规则维护
- 默认规则文件为 `core/memory_adapter/normalization_map.json`，可通过 `MEM0_NORMALIZATION_FILE` 指向自定义路径。
- 文件结构：
  ```json
  {
    "replacements": {
      "AI助手": "陪伴代理A"
    },
    "regex_replacements": [
      {
        "pattern": "\\s+",
        "replacement": " "
      }
    ]
  }
  ```
- 测试或运营人员可以直接编辑该文件新增映射，重启服务后即生效。
- 如需临时扩展（例如根据上下文把“他”替换成当前 agent 名称），在调用 `fetch_memories` 或 `build_memory_block` 时传入 `context={"replacements": {"他": "Agent A"}}` 即可。
- 不熟悉 JSON 写法时，可参考 `core/memory_adapter/NORMALIZATION_GUIDE.md` 获取图文指引。
