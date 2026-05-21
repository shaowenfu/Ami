# 2026-05-21 邮箱 Auth 与动态 Token 链路收尾

今天把上一阶段留下的 Auth 专项补齐了。项目之前已经有 Space、Message、SSE 和 Mem0 的关键骨架，前端也能通过静态 `EXPO_PUBLIC_AMI_ACCESS_TOKEN` 接真实后端，但这只能算烟囱式接通，不是一个真正可用的账号系统。这次的目标是把注册、登录、登出、注销和用户管理链路拉成闭环，同时把短信验证码改成邮箱验证码。

## 做了什么

- 新增 `docs/tasks/email-auth-user-management-plan.md`，把邮箱注册登录、用户管理、SecureStore token、HTTP/SSE refresh 机制和验收链路落成任务文档。
- 后端新增 `EmailService`，用标准库 SMTP 发送验证码；SMTP 未配置时自动降级到 Console Email Provider，便于本地开发。
- 新增 `/auth/email/send` 和 `/auth/email/verify`。注册场景返回一次性 `verification_ticket`，登录场景可直接返回 token pair。
- 用户模型改为 email-first：`email` 必备、`phone` 可选；登录 identifier 支持用户名、邮箱、手机号。
- 注册、密码登录、refresh、logout、account delete、`/auth/me` 形成闭环。注销后会撤销全部 refresh token，并且受保护接口会重新校验用户仍为 active，避免旧 access token 在过期前继续访问。
- Space 邀请从单一手机号改为 `identifier`，可用邮箱、手机号或用户名查找用户，同时响应里新增 `invitee_contact`。
- 前端新增 `expo-secure-store`，实现 `lib/auth/tokenStore.ts`；Web 端降级到 `localStorage`。
- 前端 HTTP client 改为动态读取 access token，401 时用 refresh token 无感刷新并重试一次；refresh 失败清理会话并跳转登录。
- SSE client 连接前异步读取 token，遇到 401 会尝试 refresh 后重连。
- 新增登录/注册页面，复用现有 Apple Clay 风格，支持密码登录、邮箱验证码登录、邮箱注册、验证码倒计时和密码设置。
- 全局入口根据 auth 状态跳转；空间列表、邀请和聊天改为依赖真实登录态；个人页增加退出登录和密码注销入口。
- 更新 `static/auth-overview.html`，避免静态 Auth 指南还停留在短信验证码时代。
- 同步 `seed_test_space.py` 到新 User 字段，保留静态 token 冒烟测试能力。

## 验证结果

- `npx tsc --noEmit` 通过。
- `python -m compileall Amiend\core Amiend\dependencies Amiend\infrastructure Amiend\routers Amiend\services` 通过。
- `git diff --check` 通过。
- Expo Web `/auth/login` 和 `/auth/register` 渲染冒烟通过。
- 使用 `3378616865@qq.com` 和固定验证码 `123456` 跑通端到端链路：
  - 发送注册验证码。
  - 验证邮箱验证码并拿到注册 ticket。
  - 注册并签发 token pair。
  - `/auth/me` 返回当前用户。
  - refresh 成功签发新 token pair。
  - logout 成功撤销 refresh token。
  - 密码登录成功。
  - 发送注销验证码并用 ticket 注销账号。
  - 注销后旧 access token 被拒绝，旧 refresh token 也无法继续刷新。

## 注意事项

- 本地验收使用 `EMAIL_DEV_FIXED_CODE=123456`，生产环境应移除固定验证码并配置真实 SMTP。
- 历史短信接口仍保留，主要是为了兼容旧客户端和已有代码路径；当前前端已经切到邮箱验证码。
- 测试邮箱在验收最后被注销，因此数据库中对应账号会处于 inactive 状态。
- 旧测试数据里有缺少 `username`、`email` 的文档，用户索引改为 sparse unique 以兼容历史脏数据；新注册请求仍由 Pydantic 保证必填。
