---
title: "017 - Docker + Python：从开发到生产部署全指南"
slug: "017-docker-python"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.548+08:00"
updated_at: "2026-04-29T10:02:47.79+08:00"
reading_time: 25
tags: []
---

# Docker + Python：从开发到生产部署全指南

> **难度：⭐⭐⭐ 中高级** | **预计阅读：20 分钟** | **Python 3.8+ / Docker 24+**

## 一、概念讲解

Docker 解决了"在我机器上能跑"的经典问题。对于 Python 项目，它解决了：

- **依赖地狱**：不同项目需要不同 Python 版本和库版本
- **环境一致性**：开发、测试、生产环境完全一致
- **部署简化**：一条命令启动完整服务栈
- **隔离性**：多个服务互不干扰

**核心术语**：

| 术语 | 说明 | 类比 |
|------|------|------|
| **Dockerfile** | 构建镜像的脚本 | 菜谱 |
| **Image** | 只读模板，包含运行所需的一切 | 菜品的模具 |
| **Container** | 镜像的运行实例 | 做出来的那道菜 |
| **Volume** | 持久化数据存储 | 菜的保鲜盒 |
| **Docker Compose** | 多容器编排工具 | 一桌宴席的统筹 |

## 二、脑图（ASCII）

```
              Docker + Python 部署
                     |
        +------------+------------+
        |            |            |
    Dockerfile    Compose      优化
        |            |            |
   +----+----+  +---+---+  +----+----+
   |基础镜像 |  |多服务 |  |多阶段构建|
   |依赖安装 |  |网络   |  |镜像瘦身 |
   |CMD/ENTRY|  |Volume |  |安全加固 |
   +---------+  +-------+  +---------+
```

## 三、完整代码

### v1：最简 Dockerfile

```dockerfile
# Dockerfile - Simple Python container
FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

CMD ["python", "app.py"]
```

```python
# app.py - Simple FastAPI application
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello from Docker!", "version": "1.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

```text
# requirements.txt
fastapi==0.115.0
uvicorn==0.32.0
```

构建与运行：
```bash
docker build -t myapp:v1 .
docker run -p 8000:8000 myapp:v1
```

### v2：多阶段构建 + docker-compose

```dockerfile
# Dockerfile - Multi-stage build
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

# Security: run as non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app
COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: "3.8"

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./app:/app
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

```python
# app.py - Updated with DB and Redis
from fastapi import FastAPI
from pydantic import BaseModel
import psycopg
import redis
import os
import json

app = FastAPI()

def get_db():
    return psycopg.connect(os.environ["DATABASE_URL"])

def get_redis():
    return redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))

class Item(BaseModel):
    name: str
    value: int

@app.post("/items")
def create_item(item: Item):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO items (name, value) VALUES (%s, %s) RETURNING id",
                       (item.name, item.value))
            item_id = cur.fetchone()[0]
    return {"id": item_id, **item.model_dump()}

@app.get("/items")
def list_items():
    r = get_redis()
    cached = r.get("items:all")
    if cached:
        return json.loads(cached)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, value FROM items")
            items = [{"id": row[0], "name": row[1], "value": row[2]} for row in cur.fetchall()]
    r.setex("items:all", 60, json.dumps(items))
    return items
```

### v3：生产级部署 + Nginx + 监控

```dockerfile
# Dockerfile.prod - Production optimized
FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
RUN groupadd -r appuser && useradd -r -g appuser appuser
WORKDIR /app
COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser . .
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - web
    restart: always

  web:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
    depends_on:
      db:
        condition: service_healthy
    restart: always
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
    secrets:
      - db_password
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    restart: always

volumes:
  pgdata:
  redisdata:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

```nginx
# nginx.conf
events { worker_connections 1024; }

http {
    upstream web {
        server web:8000;
    }

    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;

    server {
        listen 80;
        server_name example.com;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name example.com;
        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;

        location / {
            limit_req zone=api burst=10 nodelay;
            proxy_pass http://web;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            proxy_pass http://web/health;
            access_log off;
        }
    }
}
```

## 四、执行预览

```
$ docker compose up --build
[+] Building 12.3s
[+] Running 5/5
 ✔ Network myapp_default    Created
 ✔ Container myapp-db-1     Healthy
 ✔ Container myapp-redis-1  Started
 ✔ Container myapp-web-1    Started
 ✔ Container myapp-nginx-1  Started

$ curl http://localhost/health
{"status":"healthy"}

$ curl -X POST http://localhost/items \
  -H "Content-Type: application/json" \
  -d '{"name":"test","value":42}'
{"id":1,"name":"test","value":42}

$ docker compose ps
NAME              STATUS         PORTS
myapp-db-1        Up (healthy)   5432/tcp
myapp-redis-1     Up             6379/tcp
myapp-web-1       Up             8000/tcp
myapp-nginx-1     Up             0.0.0.0:80->80/tcp
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 基础镜像 | `python:3.12` 约 1GB，`-slim` 约 150MB | 生产用 slim 或 alpine |
| .dockerignore | 避免复制不必要文件 | 排除 .git, __pycache__, .env |
| 层缓存 | COPY requirements.txt 在 COPY . 之前 | 依赖不变时复用缓存 |
| 安全 | 默认以 root 运行 | 创建非 root 用户 |
| 环境变量 | 不要硬编码密码 | 用 Docker secrets 或 env_file |
| 日志 | Docker 默认 json-file 驱动 | 生产配置日志轮转 |
| 多阶段构建 | 减少最终镜像大小 | 编译和运行阶段分离 |
| 数据持久化 | 容器删除后数据丢失 | 重要数据用 Volume |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 | 原因 |
|------------|------------|------|
| 用 `python:3.12` 完整镜像 | 用 `python:3.12-slim` | 镜像体积差 6 倍 |
| `COPY . .` 在 pip install 之前 | 先 COPY requirements.txt 再 pip | 无法利用缓存 |
| 在容器内生成文件不加 Volume | 持久化数据挂载 Volume | 容器重建数据丢失 |
| `docker exec` 手动改容器 | 修改 Dockerfile 重新构建 | 不可复现 |
| 用 `latest` tag | 用明确版本号 tag | 不可预测的部署结果 |
| 一个容器跑多个服务 | 每个服务一个容器 | 违背单一职责 |

## 七、练习题

🟢 **基础题**：为一个 Flask 应用编写 Dockerfile，要求镜像小于 200MB。

```python
# Hint: use python:3.12-slim + gunicorn
```

🟡 **进阶题**：编写 docker-compose.yml，包含 Django + PostgreSQL + Redis + Celery Worker + Celery Beat 五个服务，配置健康检查和依赖关系。

🔴 **挑战题**：设计零停机部署方案：(1) 蓝绿部署或滚动更新 (2) 数据库迁移在部署流程中的位置 (3) 回滚策略。

## 八、知识点总结

```
Docker + Python 知识树
├── Dockerfile
│   ├── 基础镜像选择
│   ├── 多阶段构建
│   ├── 层缓存优化
│   └── 安全最佳实践
├── Docker Compose
│   ├── 服务编排
│   ├── 网络配置
│   ├── Volume 持久化
│   └── 健康检查
├── 生产部署
│   ├── Nginx 反向代理
│   ├── SSL/TLS 配置
│   ├── 资源限制
│   └── 日志管理
└── CI/CD
    ├── 镜像构建流水线
    ├── 镜像仓库推送
    └── 自动部署
```

## 九、举一反三

| 场景 | Docker 方案 | 关键技术 |
|------|-------------|----------|
| 微服务架构 | 每个服务独立镜像 + compose | 服务发现 + 网络隔离 |
| CI/CD 流水线 | Docker-in-Docker 构建 | 多阶段构建 + 镜像缓存 |
| 开发环境统一 | devcontainer.json | VS Code Remote Containers |
| 爬虫集群 | 多 Worker 容器 + Redis 队列 | 水平扩展 + 共享队列 |
| ML 模型部署 | GPU 镜像 + FastAPI | nvidia-docker + 模型加载 |

## 十、参考资料

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文件参考](https://docs.docker.com/compose/compose-file/)
- [Python Docker 最佳实践](https://docs.docker.com/language/python/)
- [多阶段构建指南](https://docs.docker.com/build/building/multi-stage/)

## 十一、代码演进路线

```
v1 (入门)      ->  v2 (工程化)       ->  v3 (生产级)
--------------------------------------------------
单 Dockerfile      多阶段构建          Nginx 反向代理
无优化             docker-compose      SSL 证书
root 运行          非 root 用户        Docker Secrets
开发模式           健康检查            资源限制
手动构建           Volume 持久化       零停机部署
```
