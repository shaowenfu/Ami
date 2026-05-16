# Ami 后端部署链路方案

## 目标

先跑通 Ami 后端的 delivery loop（交付闭环）：

1. 只有 `Amiend/**` 或 `.github/workflows/deploy-backend.yml` 变更时，GitHub Actions 才重新构建后端镜像。
2. GitHub Actions 构建 `Amiend` Docker image（镜像），推送到阿里云 ACR（Alibaba Cloud Container Registry，容器镜像服务）。
3. GitHub Actions 通过 SSH 登录腾讯轻量服务器。
4. 服务器拉取 ACR 镜像，生成 runtime env（运行时环境变量文件），启动或更新 Docker Compose 服务。
5. 后端连接 MongoDB Atlas 云数据库；腾讯服务器本地只运行 `api` 和 `redis`。
6. 部署完成后用 `/health` 做健康检查，失败时尽量回滚旧镜像。

当前阶段 non-goals（非目标）：

- 不配置域名和 HTTPS。
- 不接入 Kubernetes / ECS / ACK 等复杂编排。
- 不在服务器部署 MySQL。
- 不在服务器部署 MongoDB。
- 不把 secrets（密钥）写进 Docker image（镜像）层。

## 已落盘文件

```text
.github/workflows/deploy-backend.yml
Amiend/docker-compose.production.yml
docs/tasks/backend-deployment-chain.md
```

## 触发规则

`deploy-backend.yml` 的触发条件：

```yaml
on:
  push:
    branches:
      - main
    paths:
      - "Amiend/**"
      - ".github/workflows/deploy-backend.yml"
  workflow_dispatch:
```

含义：

- 修改前端 `Amiapp/**` 不会触发后端构建。
- 修改普通文档不会触发后端构建。
- 修改后端或部署 workflow 才触发。
- 仍可通过 `workflow_dispatch` 手动触发。

## 后端运行时架构

生产环境 Docker Compose 只包含：

- `api`：Amiend FastAPI 服务。
- `redis`：Redis，用于 token、短信验证码、频率限制等短期状态。

外部云服务：

- `MongoDB Atlas`：持久化业务数据，包括当前 auth users collection（用户集合）。
- LLM provider：OpenAI-compatible provider（兼容 OpenAI API 的模型服务）。

服务器不再运行：

- MySQL
- 本地 MongoDB

端口：

```text
api:   0.0.0.0:8000 -> 8000
redis: 不暴露公网
```

当前没有域名时，前端真机临时访问：

```text
http://腾讯服务器公网 IP:8000
```

## MongoDB Atlas 配置

需要在 MongoDB Atlas 完成：

1. 创建 cluster（集群）。
2. 创建 database user（数据库用户）。
3. 配置 Network Access（网络访问）。

早期为了快速跑通，可以临时允许：

```text
0.0.0.0/0
```

更稳妥的做法是只允许腾讯轻量服务器公网 IP。

连接串放入 GitHub secret：

```text
MONGODB_ATLAS_URI=mongodb+srv://<user>:<password>@<cluster-host>/?retryWrites=true&w=majority
```

后端运行时会把它写成：

```text
MONGO_URI=${MONGODB_ATLAS_URI}
MONGO_DATABASE=ami
```

## Redis 镜像策略

旧项目已执行过 `tmp/mirror-redis-to-acr.yml`，当前 ACR 中已有：

```text
crpi-oatwdzh41nknuewb.cn-chengdu.personal.cr.aliyuncs.com/entrocut/redis:7-alpine
```

第一轮部署直接复用这个镜像即可，不需要重复从 Docker Hub 拉取。

后续可以再复制一份到 Ami namespace（命名空间）：

```text
crpi-oatwdzh41nknuewb.cn-chengdu.personal.cr.aliyuncs.com/ami/redis:7-alpine
```

## GitHub Actions 配置项

进入 GitHub 仓库：

```text
shaowenfu/Ami
```

路径：

```text
Settings -> Secrets and variables -> Actions
```

### Repository secrets

必填：

```text
ACR_PASSWORD
SERVER_SSH_HOST
SERVER_SSH_USER
SERVER_SSH_KEY
JWT_SECRET_KEY
MONGODB_ATLAS_URI
REDIS_PASSWORD
```

建议也配置：

```text
LLM_API_KEY
```

按需：

```text
ALI_SMS_ACCESS_KEY_ID
ALI_SMS_ACCESS_KEY_SECRET
ALI_SMS_SIGN_NAME
ALI_SMS_TEMPLATE_CODE
DEEPSEEK_API_KEY
DASHSCOPE_API_KEY
ARK_API_KEY
```

说明：

- `ACR_PASSWORD`：阿里云 ACR 登录密码。
- `SERVER_SSH_HOST`：腾讯轻量服务器公网 IP。
- `SERVER_SSH_USER`：SSH 用户，建议用非 root 用户；早期也可以先用 root 跑通。
- `SERVER_SSH_KEY`：私钥内容，不是 `.pub` 公钥。
- `JWT_SECRET_KEY`：至少 32 字节随机字符串。
- `MONGODB_ATLAS_URI`：MongoDB Atlas 连接串。

### Repository variables

必填：

```text
ACR_USERNAME=SherwenF
ACR_REGISTRY=crpi-oatwdzh41nknuewb.cn-chengdu.personal.cr.aliyuncs.com
ACR_IMAGE_NAME=crpi-oatwdzh41nknuewb.cn-chengdu.personal.cr.aliyuncs.com/ami/amiend
```

建议：

```text
REDIS_IMAGE=crpi-oatwdzh41nknuewb.cn-chengdu.personal.cr.aliyuncs.com/entrocut/redis:7-alpine
DEPLOY_DIR=/opt/ami-backend
APP_NAME=Ami
APP_VERSION=0.1.0
CORS_ORIGINS=*
MONGO_DATABASE=ami
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

## 腾讯轻量服务器手动动作

### 1. 安装 Docker

在腾讯服务器上安装：

- Docker Engine
- Docker Compose Plugin

验收命令：

```bash
docker version
docker compose version
```

### 2. 配置 SSH 登录

把 GitHub Actions 使用的公钥加入服务器：

```bash
~/.ssh/authorized_keys
```

本地验证：

```bash
ssh <SERVER_SSH_USER>@<SERVER_SSH_HOST>
```

### 3. 准备部署目录

```bash
sudo mkdir -p /opt/ami-backend
sudo chown -R <SERVER_SSH_USER>:<SERVER_SSH_USER> /opt/ami-backend
```

如果使用 root 用户部署，则不需要 `chown`。

### 4. 开放安全组

腾讯轻量服务器控制台开放：

```text
TCP 22
TCP 8000
```

不要开放 Redis 端口：

```text
6379
```

### 5. 验证服务器可访问 ACR

在腾讯服务器上测试：

```bash
docker login crpi-oatwdzh41nknuewb.cn-chengdu.personal.cr.aliyuncs.com -u SherwenF
docker pull crpi-oatwdzh41nknuewb.cn-chengdu.personal.cr.aliyuncs.com/entrocut/redis:7-alpine
```

### 6. 验证服务器可访问 MongoDB Atlas

如果 Atlas Network Access 只放行固定 IP，确认腾讯轻量服务器公网 IP 已加入 allowlist（白名单）。

## GitHub Actions 流程

### build-and-push job

1. Checkout。
2. 校验 ACR 配置。
3. 登录 ACR public registry。
4. 使用 `Amiend/Dockerfile` 构建镜像。
5. 推送两个 tag：

   ```text
   ${ACR_IMAGE_NAME}:${GITHUB_SHA}
   ${ACR_IMAGE_NAME}:latest
   ```

### deploy job

1. Checkout。
2. 校验 SSH、ACR、JWT、MongoDB Atlas、Redis 配置。
3. 复制 `Amiend/docker-compose.production.yml` 到腾讯服务器 `DEPLOY_DIR`。
4. 通过 SSH 在服务器执行：

   - 生成 `.env.production`
   - `docker login` ACR
   - 记录旧 `ami-api` 容器使用的 image
   - `docker compose pull`
   - 先启动 `redis`
   - 启动 candidate container（候选容器）
   - candidate container 内访问 `http://127.0.0.1:8000/health`
   - candidate 通过后更新正式 `api`
   - 正式容器通过 `/health` 后清理旧镜像
   - 失败则回滚旧镜像

## 第一轮验收标准

GitHub Actions 手动触发成功后：

1. Actions 页面显示 `build-and-push` 和 `deploy` 成功。
2. ACR 中出现 Amiend 镜像：

   ```text
   ami/amiend:<commit sha>
   ami/amiend:latest
   ```

3. 腾讯服务器上容器正常：

   ```bash
   docker ps
   docker compose -f /opt/ami-backend/docker-compose.production.yml ps
   ```

4. 本机访问：

   ```bash
   curl http://<腾讯服务器公网 IP>:8000/health
   ```

   返回：

   ```json
   {"status":"ok"}
   ```

5. Expo Go 真机可以访问：

   ```text
   http://<腾讯服务器公网 IP>:8000/health
   ```

## 后续改进

部署链路跑通后，再做这些改进：

- 增加 `/livez` 和 `/readyz`，区分进程存活与依赖就绪。
- 将 Redis 镜像复制到 `ami/redis:7-alpine`，避免 Ami 项目依赖 `entrocut` namespace。
- 增加 MongoDB Atlas backup（备份）与最小权限账号。
- 增加 HTTPS 和域名。
- 增加 GitHub Environments（环境）审批和 staging / production 区分。
- 增加前端 Expo 配置里的 API endpoint 切换。
