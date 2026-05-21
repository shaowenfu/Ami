技术栈选型战略：Ami 双人 Agent 关系基础设施

Technology Stack Strategy: Ami Dual-Agent Relationship Infrastructure

1. 概述 (Overview)

本文档确立了 Ami 双人 Agent 系统的核心存储与检索技术选型。基于 Ami 作为“关系合伙人”的产品定位，其系统必须兼顾长效对话的连贯性（语义理解）以及关系图谱的确切性（事实存储），同时满足极高的数据隐私边界要求。

经过综合评估，本项目确立采用 MongoDB Atlas 配合 Mem0 的混合存储与检索架构。

2. 核心技术选型 (Core Technology Stack)

2.1 关系图谱与基础数据管理：MongoDB Atlas

MongoDB Atlas 将作为系统的“Source of Truth（单一数据源）”，负责结构化数据与状态数据的持久化。

选型优势:

灵活的文档模型 (Schema-flexible): 亲密关系中产生的事实（如偏好、雷区、纪念日）种类繁多，且结构不断演进。MongoDB 的 NoSQL 文档特性完美契合这种非固定的属性存储（例如存储知识图谱三元组或用户自定义配置）。

高并发写入与扩展性 (Scalability): 能够高效处理持续产生的聊天流原始数据（Message Logs）和系统状态变更。

原生支持向量检索 (Atlas Vector Search): 虽然主要的语义检索由 Mem0 承担，但 MongoDB Atlas 原生集成的向量能力使得在同一平台上可以进行复杂元数据与小规模向量的混合查询，降低了未来数据架构分裂的风险。

2.2 长期语义记忆引擎：Mem0

Mem0 是一个专为 AI 应用设计的记忆层（Memory Layer），作为 Ami 的“海马体”，它将负责处理情节记忆（Episodic Memory）的提炼、存储和召回。

选型优势:

开箱即用的 Agent 记忆机制 (Out-of-the-box Memory Management): Mem0 原生支持针对特定实体（Entity，如用户、Agent 实例）进行记忆的添加、更新和查询，极大地简化了复杂的 Embedding、Chunking 和 RAG（检索增强生成）工程。

丰富的元数据过滤 (Metadata Filtering): Ami 的核心难点在于“三人房与单人房的隐私隔离”。Mem0 允许在存储和搜索时注入复杂的元数据过滤器，这使得我们在架构层面即可保证信息的物理隔离，防止 LLM 发生隐私泄漏（幻觉）。

开发者友好: 提供了完善的 REST APIs（如 /v1/memories/add, /v1/memories/search），支持快速集成与敏捷迭代。

3. 架构分工与数据流转策略 (Architecture Division & Data Flow Strategy)

本架构将记忆处理分为“确切事实的图谱管理”与“模糊上下文的语义检索”双轨并行。

3.1 前台交互流：组装上下文 (Foreground Interaction Stream: Context Assembly)

在调用大语言模型（LLM）生成回复前，系统需要组装记忆。

确定边界: 服务端首先解析请求来源（群聊或特定用户的私聊），确立本次会话的权限边界标识。

双轨召回 (Dual Retrieval):

MongoDB 检索: 获取该特定关系（Relationship ID）下的结构化设定与基础事实（如：今天的日期、两人的基本资料）。

Mem0 检索: 利用 Mem0 的 Search Memories API，基于当前用户意图，配合严格的权限过滤条件（Filters），召回相关的历史对话片段与过往事件摘要。

Prompt 组装: 将两路召回的结果合并，注入到 LLM 的 System Prompt 中。

3.2 后台消化流：记忆沉淀与成长 (Background Digestion Stream: Memory Consolidation)

Ami 的“成长”发生在后台的异步处理中。

流式写入: 所有的原始聊天记录会实时存入 MongoDB，作为基础数据池。

异步提炼: 后台任务（例如积攒一定对话量或夜间低谷期）会调取原始记录，通过 LLM 将其提炼为有价值的“记忆块”。

分类存储:

若是新出现的确切事实（如“确立了新的纪念日”），则更新至 MongoDB 中维护的关系知识图谱。

若是对话总结或情绪体验（如“昨天因为谁洗碗发生了争吵”），则调用 Mem0 的 Add Memories API，附加对应的用户/关系标识与隐私标签存入 Mem0。

4. 结论 (Conclusion)

MongoDB Atlas 保证了底层数据的稳固、可扩展与高度的模式灵活性；Mem0 则大幅度降低了构建智能体长期记忆检索系统的门槛，并在机制上保障了严苛的隔离需求。二者的结合，为 Ami 实现“具备长期记忆、懂得分寸感、伴随关系成长的智能关系基础设施”提供了坚实且敏捷的技术底座。