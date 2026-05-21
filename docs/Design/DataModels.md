在应用架构中，最核心的数据模型是关系空间（Space）和消息/记忆（Message & Memory）。一切交互都围绕这两个对象展开。结合之前确定的 MongoDB Atlas + Mem0 技术栈，下面是核心的集合设计（Collections）和数据流转链路。

## 一、 核心数据模型定义 (Data Models)

在 MongoDB Atlas 中，我们可以采用灵活的文档结构来定义以下四个核心集合：

### 1. User 集合 (全局层)

存储独立个体的账号资产。

```json
{
  "_id": "user_101",
  "phone_number": "+8613800000000",
  "profile": {
    "nickname": "Alex",
    "avatar_url": "https://..."
  },
  "created_at": ISODate("2026-05-21T00:00:00Z"),
  "active_spaces": ["space_999"] // 冗余存储用户所在的空间ID，加速概览页加载
}

```

### 2. Space 集合 (空间层 - 核心实体)

定义两个人与 Ami 绑定的“关系结界”。

```json
{
  "_id": "space_999",
  "members": [
    {
      "user_id": "user_101",
      "joined_at": ISODate("2026-05-21T00:00:00Z"),
      "role": "INITIATOR"
    },
    {
      "user_id": "user_102",
      "joined_at": ISODate("2026-05-21T00:05:00Z"),
      "role": "INVITEE"
    }
  ],
  "agent_profile": {
    "name": "Ami",
    "tone": "empathetic_and_humorous" // Ami 的系统人设
  },
  "status": "ACTIVE" // PENDING_INVITE, ACTIVE, DISSOLVED
}

```

### 3. Message 集合 (交互数据)

记录每一次发言，是最原始的数据流。这里的 `room_scope` 是整个应用隐私安全的基石。

```json
{
  "_id": "msg_555",
  "space_id": "space_999",
  "sender": {
    "type": "USER", // 或 "AGENT"
    "id": "user_101"
  },
  "room_scope": "PRIVATE_A", // SHARED (三人), PRIVATE_A (私聊), PRIVATE_B (私聊)
  "content": "我有点担心明天的面试，没有复习好。",
  "timestamp": ISODate("2026-05-21T10:00:00Z")
}

```

### 4. KnowledgeNode 集合 (结构化记忆)

存储 Ami 从对话中提取的确定性事实和偏好（知识图谱）。

```json
{
  "_id": "node_888",
  "space_id": "space_999",
  "triplet": {
    "subject": "user_101",
    "predicate": "IS_ANXIOUS_ABOUT",
    "object": "upcoming_interview"
  },
  "visibility": "PRIVATE_A", // 继承自原消息的 room_scope，确保不会在群聊中泄露
  "confidence": 0.9,
  "source_msg_ids": ["msg_555"], // 数据溯源
  "updated_at": ISODate("2026-05-21T10:05:00Z")
}

```

*(注：长文本的情节记忆 Episodic Memory 则交给 Mem0 API 直接管理，我们只需在 Mem0 的 payload 中传入相同的 `space_id` 和 `visibility` 标签即可。)*

---

## 二、 核心数据流转思路 (Core Data Flow)

一条消息从发送到最终变成 Ami 的长期记忆，需要经历一条严密的双轨管道。

### 轨道 1：实时问答流 (Track 1: Real-time Response Stream)

这是面向用户的即时反馈回路，核心在于“带着上下文和边界感去回复”。

1. **消息持久化 (Message Persistence):**
前端发送消息，后端立刻将数据写入 MongoDB 的 `Message` 集合。

2. **上下文隔离召回 (Context-Isolated Retrieval):**
根据当前所在的房间作用域（`room_scope`），后端并发查询 MongoDB (短期消息与结构化知识) 和 Mem0 (长期情节记忆)。
如果 `room_scope` 为 `SHARED`，系统将屏蔽所有带有 `PRIVATE` 标签的记忆节点。

3. **流式推流生成 (Streaming Generation):**
将安全的记忆片段注入到大语言模型（如 Gemini）的系统提示词中，生成回复，并将结果写入数据库，同时通过 Server-Sent Events 推送给客户端。


### 轨道 2：异步消化流 (Track 2: Asynchronous Digestion Stream)

为了不阻塞实时聊天，记忆的沉淀和“反思”需要在后台离线进行。

1. **批处理触发 (Batch Triggering):**
当某个空间积攒了特定数量的新消息（例如 20 条），或者在夜间低峰期，系统触发一次消化任务。

2. **信息萃取 (Information Extraction):**
后台调用较低温度的推理模型，分析这些对话，提取出新的三元组知识（存入 MongoDB）和事件摘要（写入 Mem0 API）。

3. **主动干预评估 (Proactive Intervention Assessment):**
模型评估双方的情感走向。如果检测到冷战或高度焦虑，Ami 将触发“主动私聊”或“群内缓和”机制，向消息队列投递一条主动发送的任务。  
