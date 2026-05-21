# Amiend

Ami 的 FastAPI 后端服务，当前目标是为移动端快速迭代提供稳定的 API、Auth（鉴权）、SSE（Server-Sent Events 实时流通信）、LLM Gateway（模型网关）和部署链路。我们**全部采用 SSE 技术**来实现所有实时通信与流式数据推送需求。

## 技术栈

| 层 | 方案 |
|---|---|
| Web framework | FastAPI |
| Auth | JWT + bcrypt |
| Database | MongoDB Atlas + Motor |
| Cache | Redis |
| LLM | OpenAI-compatible SDK |
| Runtime | Docker + Docker Compose |

## 本地启动

```bash
cd Amiend
cp .env.example .env
# 编辑 .env，填入 JWT_SECRET_KEY、MONGO_URI、REDIS_PASSWORD、LLM_API_KEY 等

docker compose up -d redis

source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API 文档：

```text
http://localhost:8000/docs
```

健康检查：

```text
http://localhost:8000/health
```

## 生产部署

生产部署由仓库根目录的 GitHub Actions workflow 负责：

```text
.github/workflows/deploy-backend.yml
```

触发规则：

- `main` 分支下 `Amiend/**` 变化时自动部署。
- `.github/workflows/deploy-backend.yml` 变化时自动部署。
- 支持手动 `workflow_dispatch`。

生产 compose 文件：

```text
Amiend/docker-compose.production.yml
```

生产环境只在腾讯轻量服务器运行：

- `api`
- `redis`

持久化数据库使用 MongoDB Atlas，不在服务器本地部署 MySQL 或 MongoDB。

完整部署说明见：

```text
docs/tasks/backend-deployment-chain.md
```
