# 邮箱注册登录与动态 Token 链路落地计划

创建日期：2026-05-21

## 背景

当前应用的前后端骨架、Space / Message / SSE / Mem0 轻量链路已经完成。上一阶段前端为了跑通真实后端，临时使用 `EXPO_PUBLIC_AMI_ACCESS_TOKEN` 静态 token；后端 Auth 虽然已有注册、登录、刷新、登出、注销接口，但验证码链路绑定短信服务。由于短信服务暂不可用，本阶段切换为免费邮箱验证码注册与账号安全链路。

## 目标

- 后端支持邮箱验证码发送、校验、注册、登录、刷新、登出、注销。
- 用户模型改为 email-first，手机号变为可选联系方式。
- Space 邀请从仅手机号扩展为邮箱/手机号/用户名统一 identifier。
- 前端补齐登录、注册 UI。
- 前端 token 从 `.env` 静态配置切换为 `expo-secure-store` 安全存储。
- HTTP 与 SSE 请求动态读取 token，401 后自动 refresh，refresh 失败跳转登录。
- 使用 `3378616865@qq.com` 与固定验证码 `123456` 完成端到端链路验证。

## 后端改造

### 1. 邮箱验证码服务

- 新增 `services/basic/email.py`。
- 使用标准库 `smtplib` + `EmailMessage`，避免新增后端依赖。
- 支持 SMTP 配置：
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USERNAME`
  - `SMTP_PASSWORD`
  - `SMTP_FROM`
  - `SMTP_USE_TLS`
  - `EMAIL_DEV_FIXED_CODE`
- SMTP 未配置时降级为 Console Email Provider，只记录验证码，便于本地开发。

### 2. Auth 接口

新增：

- `POST /auth/email/send`
- `POST /auth/email/verify`

保留：

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/account/delete`
- `GET /auth/me`

注册流程：

1. `/auth/email/send`，`scene=register`。
2. `/auth/email/verify` 返回一次性 `verification_ticket`。
3. `/auth/register` 提交 `email + username + password + verification_ticket`。
4. 返回 `TokenPair`。

登录流程：

- 密码登录支持 `username/email/phone + password`。
- 邮箱验证码登录可通过 `/auth/email/verify`，`scene=login` 直接返回 `TokenPair`。

注销流程：

- 登录态下提交密码，或先通过邮箱验证码拿到 `account_delete` ticket 后提交。
- 注销为软删除 `is_active=false`，并撤销该用户全部 refresh token。

### 3. 数据模型

User：

- `email: str`
- `email_verified_at: datetime | None`
- `phone: str | None`
- `phone_verified_at: datetime | None`
- `username`
- `password_hash`
- `is_active`
- `created_at / updated_at`

索引：

- `username` unique
- `email` unique
- `phone` sparse unique

Space Invitation：

- 请求字段从 `phone` 扩展为 `identifier`。
- 响应保留兼容字段 `invitee_phone`，新增 `invitee_contact`。
- 后端通过 `UserRepository.get_by_identifier()` 查找 invitee。

## 前端改造

### 1. Token 管理

新增 `lib/auth/tokenStore.ts`：

- `saveTokens`
- `getStoredTokens`
- `clearStoredTokens`
- `getAccessToken`
- `getRefreshToken`

使用 `expo-secure-store`，Web 端降级到 `localStorage`。

### 2. HTTP Client

`lib/api/client.ts`：

- 请求前异步读取 access token。
- 自动注入 `Authorization: Bearer <token>` 与 `X-Auth-Token`。
- 401 时用 refresh token 调 `/auth/refresh`。
- refresh 成功后保存新 token，并重试原请求一次。
- refresh 失败清理 token，并广播未授权事件。
- 使用全局 `refreshPromise` 合并并发刷新。

### 3. Auth Store

新增 `store/useAuthStore.ts`：

- `status: checking | authenticated | anonymous`
- `user`
- `bootstrap`
- `login`
- `register`
- `sendEmailCode`
- `verifyEmailCode`
- `logout`
- `deleteAccount`

启动时调用 `bootstrap()`，通过 `/auth/me` 校验已有 token。

### 4. 页面

新增：

- `app/auth/login.tsx`
- `app/auth/register.tsx`

页面使用现有 Apple Clay 组件，保持简洁高级：

- 邮箱/手机号/用户名输入。
- 获取验证码按钮。
- 验证码倒计时。
- 密码设置。
- 登录/注册切换。

根路由：

- 未登录跳转 `/auth/login`。
- 已登录跳转 `/spaces`。

Space 层：

- 列表、邀请、聊天等真实后端页面依赖动态 token。
- 邀请创建改用邮箱/手机号/用户名 identifier。

## 验收链路

1. 启动后端，设置 `EMAIL_DEV_FIXED_CODE=123456`。
2. 调 `/auth/email/send`，邮箱 `3378616865@qq.com`，`scene=register`。
3. 调 `/auth/email/verify`，验证码 `123456`，拿 `verification_ticket`。
4. 调 `/auth/register`，拿 token pair。
5. 调 `/auth/me` 校验 access token。
6. 调 `/auth/refresh` 校验 refresh token。
7. 调 `/auth/logout` 校验 refresh token 撤销。
8. 再次登录，调 `/auth/account/delete` 校验注销与 token 撤销。
