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
               │ HTTP / SSE
┌──────────────▼──────────────────┐
│           Amiend                │
│       FastAPI (后端服务)          │
│  JWT Auth · LLM Gateway         │
│  SSE Streams · SMS · Memory     │
└──────────────┬──────────┬────────┘
               │          │
      ┌────────▼───┐ ┌────▼┐
      │MongoDB Atlas│ │Redis│
      └────────────┘ └─────┘
```

- **Amiapp**（`Amiapp/`）：React Native + Expo 移动端前端，负责 UI 渲染、本地状态管理和用户交互。
- **Amiend**（`Amiend/`）：FastAPI 后端服务，负责认证鉴权、LLM 对话流、SSE 实时推送和数据持久化。

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
| 实时通信 | Server-Sent Events (SSE) | 服务端到客户端的统一实时推送与流式输出 |
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
│   ├── routers/            #   API 路由层（auth / health / SSE streams）
│   ├── services/           #   业务逻辑层（auth / llm / sms / streams）
│   ├── infrastructure/     #   基础设施层（db / models / repositories）
│   ├── dependencies/       #   FastAPI 依赖注入（providers + auth）
│   ├── core/               #   核心模块（config / exceptions / logger / memory）
│   ├── static/             #   静态演示页面
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

#### 方案 A：局域网无线直连（最常用）
如果手机和电脑可以连接到同一个 Wi-Fi，你可以直接使用局域网连接，这是最快、最方便的方式：

1. **启动服务**：直接运行 `npm run start`（不需要加 `--tunnel`）。
2. **扫码**：用手机扫描终端生成的二维码。
3. **若扫码后仍然报错/连不上，请检查这三项**：
   - **关闭代理/VPN**：请确保**电脑和手机上**都关闭了所有的 VPN、梯子或抓包软件（如 Clash、Shadowrocket 等），否则流量会被导向代理服务器而无法走局域网。
   - **修改 Windows 网络为专用**：在 Windows 右下角 Wi-Fi 图标 -> 属性 -> 将网络配置文件由 **“公用”** 改为 **“专用”**（如果是公用，Windows 防火墙会默认屏蔽 Expo 服务的端口）。
   - 确认手机和电脑确实在同一个局域网网段内。

---

#### 方案 B：安卓 USB 有线连接（最稳定，推荐 Android 用户）
如果你使用的是 Android 手机，且局域网 Wi-Fi 限制了设备互访（例如公司网络或公共 Wi-Fi），你可以用 USB 线连接手机进行调试，彻底免受网络和防火墙干扰：

1. 用 USB 数据线将手机连接到电脑，确保手机已开启 **“USB 调试”** 权限。
2. 在电脑终端运行以下端口反向代理命令：
   ```bash
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:8000 tcp:8000
   ```
   - `8081` 用于让手机上的 Expo Go 通过 USB 访问电脑上的 Metro/Expo 打包服务。
   - `8000` 用于让手机上的 Ami App 通过 USB 访问电脑本地运行的 FastAPI 后端。
3. 在电脑终端启动后端服务：
   ```bash
   cd Amiend
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. 在电脑终端启动前端开发服务器：
   ```bash
   cd Amiapp
   npm run start
   ```
5. 在手机的 Expo Go 客户端中，选择 **"Enter URL manually"**（手动输入 URL），输入以下地址：
   ```text
   exp://localhost:8081
   ```
   即可通过 USB 极速下载 bundle 并开始调试！

在这种模式下，手机不是单纯的投屏窗口：Ami App 的 JS 代码实际运行在手机上的 Expo Go 中，只是 bundle 从电脑的 Metro 服务下载。App 发起 API 请求时，也是手机上的 App 在发请求。

需要特别注意 `localhost` 的含义：

- `exp://localhost:8081` 会因为 `adb reverse tcp:8081 tcp:8081` 被转发到电脑的 Metro 服务。
- `http://localhost:8000` 会因为 `adb reverse tcp:8000 tcp:8000` 被转发到电脑的 FastAPI 服务。
- 如果只转发 `8081`，手机能下载前端 bundle，但前端请求 `http://localhost:8000` 时会访问手机自己的 8000 端口，而不是电脑后端，真实 API 链路会断。

因此，USB 真机调试完整链路是：

```text
手机 Expo Go
  -> localhost:8081，经 USB 转发到电脑 Metro，下载前端 bundle
  -> localhost:8000，经 USB 转发到电脑 FastAPI，请求真实后端
  -> FastAPI 访问 MongoDB / Redis / LLM / Mem0 等后端依赖
```

### 前端调试 (VS Code)

项目已配置 `.vscode/launch.json`，可通过 VS Code 进行前端断点调试（请确保已安装官方 **Expo Tools** 插件）：

1. **手动启动服务**：在 `Amiapp` 目录下通过命令行运行开发服务器：
   ```bash
   cd Amiapp
   npm start
   ```
2. **运行应用**：在模拟器中或通过 Expo Go 打开应用。
3. **附加调试器**：在 VS Code 中，打开 **运行和调试 (Run and Debug)** 视图，选择 **Ami Frontend (Expo)** 配置，按 `F5` 启动，即可连接并支持在代码中设置断点。

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
