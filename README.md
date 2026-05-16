# Ami

**以亲密关系为核心的双人 Agent 应用。** 通过私密 Agent 对话、伴侣与 Agent 的三人群聊，以及可被 Agent 调用的关系工具箱，帮助两个人把日常沟通中的情绪、需求、承诺和记忆转化为可记录、可复盘、可行动的共同关系空间。

## 项目目标与愿景

- 让亲密关系从一种只能靠感觉、记忆和临场情绪维系的状态，变成一个可以被共同看见、共同维护、共同复盘、共同成长的生命系统。
- 帮助两个人在日常生活中更好地理解彼此、记住彼此、回应彼此，并把关系中的重要瞬间沉淀为共同记忆。
- 致力于成为每一段认真关系背后的智能关系基础设施。

## 架构总览

```
┌─────────────────────────────────┐
│           Amiapp                │
│    React Native + Expo (移动端)  │
│  expo-router · NativeWind       │
│  Zustand · AsyncStorage         │
└──────────────┬──────────────────┘
               │ HTTP / WebSocket
┌──────────────▼──────────────────┐
│           Amiend                │
│       FastAPI (后端服务)          │
│  JWT Auth · LLM Gateway         │
│  WebSocket · SMS · Memory       │
└──────────────┬──────────┬────────┘
               │          │
      ┌────────▼───┐ ┌────▼┐
      │MongoDB Atlas│ │Redis│
      └────────────┘ └─────┘
```

- **Amiapp**（`Amiapp/`）：React Native + Expo 移动端前端，负责 UI 渲染、本地状态管理和用户交互。
- **Amiend**（`Amiend/`）：FastAPI 后端服务，负责认证鉴权、LLM 对话流、WebSocket 实时通信和数据持久化。

## 技术栈

### 前端（Amiapp）

| 层 | 方案 | 说明 |
|---|---|---|
| 框架 | Expo SDK 52 + React Native 0.76 | 托管原生层，跨 iOS/Android |
| 路由 | expo-router (file-based) | `app/` 目录即路由表 |
| 样式 | NativeWind v4 | Tailwind CSS for React Native |
| 状态管理 | Zustand + AsyncStorage | 轻量级，支持持久化 |
| 语言 | TypeScript (strict) | 类型安全 |

### 后端（Amiend）

| 层 | 方案 | 说明 |
|---|---|---|
| Web 框架 | FastAPI 0.121 | 异步 Python Web 框架 |
| 鉴权 | JWT（双 Token） + bcrypt | Access 15min / Refresh 7d |
| LLM 集成 | OpenAI SDK 兼容层 | 一行环境变量切换 Provider |
| 实时通信 | WebSocket | JWT 鉴权，可扩展消息路由 |
| 数据库 | MongoDB Atlas + Motor (async) | 用户、chat、agent 等业务数据 |
| 缓存 | Redis 7 | Token 管理、验证码、频率限制 |
| 向量记忆 | Mem0 + ChromaDB（可选） | 默认关闭，env 开启 |
| 日志 | structlog | 结构化日志 |
| 容器化 | Docker + Docker Compose | 一键部署 |
| 语言 | Python 3.11+ | — |

## 项目结构

```
Ami/
├── Amiapp/                 # 前端 — React Native + Expo 移动应用
│   ├── app/                #   路由页面
│   ├── components/         #   可复用组件
│   ├── stores/             #   Zustand stores
│   ├── styles/             #   Tailwind 全局样式 + 主题变量
│   ├── hooks/              #   自定义 Hooks
│   ├── types/              #   TypeScript 类型声明
│   ├── constants/          #   常量定义
│   ├── utils/              #   工具函数
│   └── assets/             #   静态资源
├── Amiend/                 # 后端 — FastAPI 服务
│   ├── routers/            #   API 路由层（auth / health / websocket）
│   ├── services/           #   业务逻辑层（auth / llm / sms / websocket）
│   ├── infrastructure/     #   基础设施层（db / models / repositories）
│   ├── dependencies/       #   FastAPI 依赖注入（providers + auth）
│   ├── core/               #   核心模块（config / exceptions / logger / memory）
│   ├── static/             #   静态测试页面（WebSocket 测试等）
│   ├── devDocs/            #   开发文档
│   ├── main.py             #   应用入口
│   ├── Dockerfile          #   容器构建文件
│   └── docker-compose.yml  #   服务编排
└── docs/                   # 项目级文档
    └── diary/              #   开发日志
```

## 快速开始

### 后端

```bash
cd Amiend

# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 MONGO_URI、JWT_SECRET_KEY、LLM_API_KEY 等

# 2. 启动依赖服务
docker compose up -d redis

# 3. 安装 Python 依赖
pip install -r requirements.txt

# 4. 启动后端
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Swagger 文档：http://localhost:8000/docs

### 前端

```bash
cd Amiapp

# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm start
```

使用 [Expo Go](https://expo.dev/go) 扫码即可在真机上预览。

WSL2 下真机调试需要隧道模式：

```bash
npx expo start --tunnel
```

### 全栈启动（Docker）

```bash
cd Amiend
docker compose up -d
```

## 主题系统（前端）

NativeWind 的 Tailwind CSS 类名，语义化颜色通过 CSS 变量定义：

| 类名 | 说明 |
|---|---|
| `bg-background` | 页面背景色 |
| `text-foreground` | 正文颜色 |
| `text-muted-foreground` | 辅助文字颜色 |
| `bg-card` / `text-card-foreground` | 卡片组件 |
| `border-border` | 边框颜色 |
| `text-primary` | 主色 |

当前使用默认主题（Obsidian Light），多主题切换的结构已预留。

## Non-goals（当前阶段不做的）

- 不引入多主题动态切换系统（结构已预留）
- 不引入第三方 UI 组件库（保持轻量）
- 不配置 EAS Build（真机通过 Expo Go 直连）
- 不做 iOS/Android 原生模块深度定制
