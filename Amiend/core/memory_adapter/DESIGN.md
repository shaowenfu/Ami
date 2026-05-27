# Memory Adapter 设计说明

## 目标
1. 在不侵入现有分层的前提下，为后端注入 Mem0 Platform 记忆能力。
2. 让该模块保持独立，可随时整体迁出构建独立服务。
3. 对外仅暴露最小 方法（初始化、写入、读取），方便任何 Service/Router 调用。

## 单独建模块的原因
- **隔离性**：所有实现都位于 `core/memory_adapter/`，其他目录无需了解 DashScope、DeepSeek、Mem0 细节。
- **可迁移**：目录内包含配置、初始化、存储路径，只要复制整个目录即可在其他项目复用。
- **一致性**：业务只通过统一的 `store_memories` / `fetch_memories` 访问记忆，避免重复造轮子，也方便后续做审计或日志扩展。

## 关键设计
| 主题 | 方案 | 理由 |
| --- | --- | --- |
| 配置管理 | `MemorySettings` + 惰性单例 | 相比引入完整配置框架更轻量，满足当前需求。 |
| 初始化方式 | `init_memory_adapter()` 惰性单例 | 保障只初始化一次；禁用记忆时使用 inert in-memory backend 保持应用可启动。 |
| 后端选择 | `MEMORY_PROVIDER=mem0_platform` / `in_memory` | 第一阶段优先接 Mem0 Platform，保留本地后端用于测试与降级。 |
| API 范围 | `store_memories`、`fetch_memory_snippets`、`fetch_memories`、`build_memory_block`、`normalize_query` | 对外直接提供常用操作，方便复用并减少重复胶水代码。 |
| Query Normalization | `normalizer.py` + 可配置映射表 | 通过 JSON 规则和临时上下文替换，在不依赖小模型的情况下提升检索命中率。 |


## 并发考虑
Mem0 Platform SDK 当前按同步接口接入。异步业务服务调用时应使用 `asyncio.to_thread` 或等价线程池包装，当前 `ContextOrchestrator` 已这样处理，避免阻塞 SSE/HTTP 请求事件循环。

## 迁移路径
当需要把记忆系统拆成独立微服务时：
1. 复制整个 `core/memory_adapter` 目录到新仓库。
2. 为其新增 FastAPI 路由，将 HTTP 请求映射到现有的 `store/fetch` 方法。
3. 如需多实例共享，改写配置指向远程向量库（Chroma Server、Weaviate 等）。

由于该模块未引用项目其余代码，迁移时无需额外解耦工作。
