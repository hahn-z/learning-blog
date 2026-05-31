---
title: "015 - CI与CD：Python项目自动化交付流水线"
slug: "015-ci-cd"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.431+08:00"
updated_at: "2026-04-29T10:02:47.625+08:00"
reading_time: 42
tags: []
---

---
difficulty: ⭐⭐⭐⭐高级
tags: [Python, CI, CD, GitHub Actions, 自动化]
---

# CI与CD：Python项目自动化交付流水线

> **难度标注：⭐⭐⭐⭐ 高级** | 适合有一定 Python 和 Git 基础，想搭建自动化流水线的开发者

## 一、概念讲解

### 什么是 CI/CD？

**CI（Continuous Integration，持续集成）**：代码变更自动触发构建和测试，确保每次提交都是可工作的。

**CD（Continuous Deployment/Delivery，持续部署/交付）**：通过所有检查的代码自动部署到目标环境。

```
开发者推送代码
    |
[CI] 代码检出 -> 安装依赖 -> 运行测试 -> 代码检查 -> 构建
    | (全部通过)
[CD] 打包 -> 部署到Staging -> 验收测试 -> 部署到Production
```

### CI/CD 的核心价值

| 价值 | 说明 |
|------|------|
| **快速反馈** | 几分钟内发现代码问题，不用等到发布 |
| **一致性** | 构建和部署流程标准化，消除"在我机器上能跑" |
| **安全性** | 自动化测试守卫，减少人工遗漏 |
| **效率** | 自动执行重复性操作，释放人力 |
| **可追溯** | 每次部署都有记录，方便回滚 |

### 常见 CI/CD 工具对比

| 工具 | 类型 | 特点 | 适用场景 |
|------|------|------|----------|
| GitHub Actions | 云端 | 与 GitHub 深度集成，YAML 配置 | 开源项目、GitHub 托管 |
| GitLab CI | 云端/自建 | 与 GitLab 深度集成，功能全面 | GitLab 用户 |
| Jenkins | 自建 | 插件丰富，高度可定制 | 企业内部、复杂流水线 |
| CircleCI | 云端 | 速度快，Docker 支持好 | 中小团队 |
| Azure DevOps | 云端 | 微软生态，企业级 | .NET + Python 混合项目 |

**本文以 GitHub Actions 为例**，因为它免费、普及度最高、配置简单。

## 二、脑图

```
Python CI/CD
├── CI（持续集成）
│   ├── 代码检出
│   ├── Python 版本矩阵
│   ├── 依赖安装（pip/poetry）
│   ├── 代码检查
│   │   ├── ruff（Linter + Formatter）
│   │   ├── mypy（类型检查）
│   │   └── black（格式检查）
│   ├── 运行测试
│   │   ├── pytest
│   │   ├── 覆盖率报告
│   │   └── 并行测试
│   └── 安全检查
│       ├── pip-audit（依赖漏洞）
│       └── bandit（代码安全）
├── CD（持续部署）
│   ├── 构建产物
│   │   ├── Wheel / Sdist
│   │   ├── Docker 镜像
│   │   └── 静态文件
│   ├── 发布
│   │   ├── PyPI 发布
│   │   ├── GitHub Release
│   │   └── Docker Hub
│   └── 部署
│       ├── 服务器部署（SSH）
│       ├── 容器编排（K8s）
│       └── Serverless
├── GitHub Actions
│   ├── Workflow 文件 (.github/workflows/)
│   ├── 触发条件（push/PR/schedule）
│   ├── Jobs / Steps / Actions
│   ├── 矩阵策略
│   ├── 缓存依赖
│   └── Secrets 管理
└── 最佳实践
    ├── 分支策略（trunk-based / GitFlow）
    ├── 环境隔离（dev/staging/prod）
    ├── 回滚策略
    └── 监控告警
```

## 三、完整代码示例

### 项目结构

```
myapp/
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI 流水线
│       ├── cd.yml              # CD 流水线
│       └── release.yml         # 发布流程
├── src/
│   └── myapp/
│       ├── __init__.py
│       ├── app.py
│       └── config.py
├── tests/
│   ├── conftest.py
│   └── test_app.py
├── Dockerfile
├── pyproject.toml
└── Makefile
```

### src/myapp/app.py -- 应用代码

```python
"""A simple FastAPI application for CI/CD demonstration."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="MyApp", version="1.0.0")


class Item(BaseModel):
    """Item model for API."""
    name: str
    price: float
    description: str = ""


# In-memory store (replace with DB in production)
_items: dict[int, Item] = {}
_next_id = 1


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/items")
def list_items() -> list[Item]:
    """List all items."""
    return list(_items.values())


@app.post("/items", status_code=201)
def create_item(item: Item) -> Item:
    """Create a new item."""
    global _next_id
    _items[_next_id] = item
    _next_id += 1
    return item


@app.get("/items/{item_id}")
def get_item(item_id: int) -> Item:
    """Get an item by ID."""
    if item_id not in _items:
        raise HTTPException(status_code=404, detail="Item not found")
    return _items[item_id]


@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int):
    """Delete an item by ID."""
    if item_id not in _items:
        raise HTTPException(status_code=404, detail="Item not found")
    del _items[item_id]
```

### tests/test_app.py -- 测试代码

```python
"""Tests for the FastAPI application."""
import pytest
from fastapi.testclient import TestClient
from myapp.app import app, _items

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_items():
    """Clear items before each test."""
    _items.clear()
    yield
    _items.clear()


def test_health_check():
    """Test the health check endpoint."""
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_list_items_empty():
    """Test listing items when empty."""
    resp = client.get("/items")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_and_get_item():
    """Test creating and retrieving an item."""
    # Create
    resp = client.post("/items", json={
        "name": "Widget", "price": 9.99, "description": "A widget"
    })
    assert resp.status_code == 201
    assert resp.json()["name"] == "Widget"

    # Get
    resp = client.get("/items/1")
    assert resp.status_code == 200
    assert resp.json()["price"] == 9.99


def test_get_item_not_found():
    """Test getting a non-existent item returns 404."""
    resp = client.get("/items/999")
    assert resp.status_code == 404


def test_delete_item():
    """Test deleting an item."""
    client.post("/items", json={"name": "Widget", "price": 9.99})
    resp = client.delete("/items/1")
    assert resp.status_code == 204

    # Verify deleted
    resp = client.get("/items/1")
    assert resp.status_code == 404
```

### pyproject.toml -- 项目配置

```toml
[project]
name = "myapp"
version = "1.0.0"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn>=0.24.0",
    "pydantic>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4",
    "pytest-cov>=4.1",
    "httpx>=0.25",
    "ruff>=0.1",
    "mypy>=1.7",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --cov=myapp --cov-report=term-missing"

[tool.ruff]
line-length = 88
select = ["E", "F", "I", "W"]

[tool.mypy]
strict = true
```

### Dockerfile

```dockerfile
# Multi-stage build for smaller image
FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY src/ src/

EXPOSE 8000
CMD ["uvicorn", "myapp.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Makefile -- 常用命令

```makefile
.PHONY: install test lint format check build docker

install:
	pip install -e ".[dev]"

test:
	pytest

lint:
	ruff check src/ tests/
	mypy src/

format:
	ruff format src/ tests/

check: format lint test

build:
	python -m build

docker:
	docker build -t myapp:latest .
```

### .github/workflows/ci.yml -- CI 流水线

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: "pip"

      - name: Install dependencies
        run: pip install -e ".[dev]"

      - name: Lint with ruff
        run: ruff check src/ tests/

      - name: Type check with mypy
        run: mypy src/

      - name: Run tests with coverage
        run: pytest --cov=myapp --cov-report=xml --cov-report=term-missing

      - name: Upload coverage to Codecov
        if: matrix.python-version == '3.12'
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Check dependencies for vulnerabilities
        run: |
          pip install pip-audit
          pip-audit

  docker-build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .
      - name: Test Docker image
        run: |
          docker run -d -p 8000:8000 --name myapp myapp:${{ github.sha }}
          sleep 5
          curl -f http://localhost:8000/ || exit 1
          docker stop myapp
```

### .github/workflows/cd.yml -- CD 流水线

```yaml
name: CD

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    needs: []
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Build package
        run: |
          pip install build
          python -m build

      - name: Build and push Docker image
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USER }}" --password-stdin
          docker build -t myorg/myapp:staging .
          docker push myorg/myapp:staging

      - name: Deploy to staging
        run: |
          echo "Deploying to staging server..."
          # ssh ${{ secrets.STAGING_HOST }} "docker pull myorg/myapp:staging && docker-compose up -d"

  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying to production..."
          # In real life: pull latest image, rolling update, health check
```

### .github/workflows/release.yml -- 发布流程

```yaml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Build package
        run: |
          pip install build
          python -m build

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
        with:
          password: ${{ secrets.PYPI_API_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*
          generate_release_notes: true
```

## 四、执行预览

```bash
# 本地运行 CI 流程
$ make check
ruff format src/ tests/
3 files formatted
ruff check src/ tests/
All checks passed!
mypy src/
Success: no issues found in 5 source files
pytest -v --cov=myapp --cov-report=term-missing
===================== test session starts =====================
tests/test_app.py::test_health_check PASSED               [ 20%]
tests/test_app.py::test_list_items_empty PASSED           [ 40%]
tests/test_app.py::test_create_and_get_item PASSED        [ 60%]
tests/test_app.py::test_get_item_not_found PASSED         [ 80%]
tests/test_app.py::test_delete_item PASSED                [100%]
===================== 5 passed ==============================
Name          Stmts   Miss  Cover   Missing
-------------------------------------------
myapp/app.py     25      0   100%
-------------------------------------------
TOTAL            25      0   100%
```

```bash
# Docker 构建和测试
$ docker build -t myapp:latest .
$ docker run -d -p 8000:8000 myapp:latest
$ curl http://localhost:8000/
{"status":"ok","version":"1.0.0"}

# 打 Tag 触发发布
$ git tag v1.0.0
$ git push origin v1.0.0
# -> GitHub Actions 自动发布到 PyPI + 创建 Release
```

## 五、注意事项

| 场景 | 注意点 | 建议 |
|------|--------|------|
| Secrets 管理 | API Key 不能明文写在 YAML | 用 GitHub Secrets |
| 缓存依赖 | 每次安装依赖很慢 | 用 `cache: "pip"` 或 `actions/cache` |
| 矩阵策略 | 测试所有 Python 版本很耗时 | PR 只测最新版，merge 测全矩阵 |
| Docker 层缓存 | 每次构建镜像慢 | 多阶段构建 + .dockerignore |
| 测试环境隔离 | 测试之间互相影响 | 用 fixture 清理、独立数据库 |
| 并行 vs 串行 | 并行快但有资源限制 | 独立 Job 并行，有依赖的串行 |
| 回滚策略 | 部署失败怎么回滚 | 保留上一个镜像版本 |
| 分支保护 | 直接 push main 有风险 | 开启分支保护 + 必须 PR + CI 通过 |

## 六、避坑指南

### 把密钥写在 YAML vs 用 Secrets

```yaml
# Bad: Hardcoded secrets
- name: Deploy
  run: ssh user@host "docker pull myapp"
  env:
    SSH_KEY: "-----BEGIN RSA PRIVATE KEY-----..."  # Leaked!

# Good: Use GitHub Secrets
- name: Deploy
  run: ssh -i <(echo "${{ secrets.SSH_KEY }}") user@host "docker pull myapp"
```

### 每次全量安装依赖 vs 利用缓存

```yaml
# Bad: No cache, installs everything every time
- run: pip install -e ".[dev]"  # Slow every time

# Good: Use setup-python cache
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: "pip"  # Cache pip downloads
- run: pip install -e ".[dev]"
```

### 一个 Job 包揽一切 vs 拆分 Job 并行

```yaml
# Bad: Sequential everything
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: pip install -e ".[dev]"
      - run: ruff check .
      - run: mypy .
      - run: pytest
      - run: docker build .

# Good: Parallel jobs with dependencies
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: ruff check . && mypy .

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ["3.10", "3.11", "3.12"]
    steps:
      - run: pytest

  docker:
    needs: [lint, test]  # Only after lint+test pass
    runs-on: ubuntu-latest
    steps:
      - run: docker build -t myapp .
```

### 不测试 Docker 镜像 vs 构建后冒烟测试

```yaml
# Bad: Build but never test the image
- run: docker build -t myapp .

# Good: Build, run, and smoke test
- run: docker build -t myapp:latest .
- run: |
    docker run -d -p 8000:8000 --name test myapp:latest
    sleep 3
    curl -f http://localhost:8000/ || (docker logs test && exit 1)
    docker stop test
```

## 七、练习题

### 基础题

1. **创建第一个 Workflow**：在现有项目中创建 `.github/workflows/ci.yml`，实现：推送时自动运行 pytest。

2. **添加 Lint 步骤**：在 CI 中添加 ruff 检查步骤，确保代码风格一致。

3. **Matrix 测试**：配置 GitHub Actions 在 Python 3.10、3.11、3.12 三个版本上运行测试。

### 进阶题

4. **完整 CI 流水线**：为你的项目搭建包含以下步骤的 CI：
   - 代码检出 + 缓存
   - Lint (ruff)
   - 类型检查 (mypy)
   - 测试 + 覆盖率
   - Docker 构建 + 冒烟测试

5. **自动发布**：创建 release workflow，当推送 `v*` tag 时：
   - 构建 Python 包
   - 发布到 TestPyPI（测试用）
   - 创建 GitHub Release

6. **定时任务**：创建一个每天早上 8 点运行的 workflow，检查依赖是否有安全漏洞。

### 挑战题

7. **蓝绿部署**：实现蓝绿部署策略：
   - 两个完全相同的生产环境
   - 新版本部署到空闲环境
   - 健康检查通过后切换流量
   - 失败则自动回滚

8. **多环境 Pipeline**：构建完整的多环境部署流水线：
   - PR -> CI 测试 + 预览环境
   - Merge to develop -> 部署到 Staging + 集成测试
   - Merge to main -> 部署到 Production + 烟雾测试 + 监控告警
   - Tag -> 正式版本发布

## 八、知识点总结

```
CI/CD 知识树
├── 1. CI（持续集成）
│   ├── 自动触发（push/PR）
│   ├── 依赖安装 + 缓存
│   ├── 代码检查（lint/type）
│   ├── 自动化测试
│   ├── 覆盖率报告
│   └── 安全扫描
├── 2. CD（持续部署）
│   ├── 构建产物（wheel/docker）
│   ├── 多环境（staging/prod）
│   ├── 部署策略（蓝绿/滚动）
│   └── 健康检查 + 回滚
├── 3. GitHub Actions
│   ├── Workflow YAML
│   ├── Triggers（push/PR/tag/schedule）
│   ├── Jobs + Steps
│   ├── Matrix 策略
│   ├── Secrets + Environments
│   └── 常用 Actions（checkout/setup-python）
├── 4. Docker 集成
│   ├── Dockerfile（多阶段构建）
│   ├── Docker Hub 推送
│   ├── .dockerignore
│   └── 容器冒烟测试
└── 5. 最佳实践
    ├── 分支保护 + PR Review
    ├── Secrets 管理
    ├── 依赖缓存
    ├── 矩阵策略优化
    └── 监控 + 告警
```

## 九、举一反三

| 你学到的 | 可以应用到 | 示例 |
|----------|-----------|------|
| GitHub Actions YAML | 其他 CI/CD 工具 | GitLab CI、Jenkins Pipeline 逻辑相同 |
| Matrix 策略 | 多平台兼容测试 | Python 多版本、OS 多系统、浏览器多版本 |
| Docker 多阶段构建 | 任何语言的项目 | Node.js、Go、Rust 项目同理 |
| 环境隔离 | 多租户系统 | dev -> staging -> production 逐步验证 |
| Secrets 管理 | 任何涉及凭证的场景 | API Key、数据库密码、SSH 密钥 |
| 蓝绿部署 | 零停机发布策略 | 电商大促、金融系统上线 |

## 十、参考资料

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [GitHub Actions 入门教程](https://docs.github.com/en/actions/quickstart)
- [Python Packaging User Guide](https://packaging.python.org/)
- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [Continuous Delivery -- Martin Fowler](https://martinfowler.com/bliki/ContinuousDelivery.html)
- [GitHub Actions 实践指南 -- Real Python](https://realpython.com/python-github-actions/)

## 十一、代码演进

### v1 -- 本地手动脚本

```bash
#!/bin/bash
# deploy.sh -- Manual deployment script

set -e
echo "Running tests..."
pytest

echo "Building Docker image..."
docker build -t myapp:latest .

echo "Deploying to server..."
ssh prod-server "docker pull myapp:latest && docker-compose up -d"

echo "Done!"
```

**问题**：依赖手动执行，容易忘记步骤，没有质量门禁。

### v2 -- 基础 CI

```yaml
# .github/workflows/ci.yml -- Basic CI
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e ".[dev]"
      - run: pytest
```

**改进**：自动触发、云端运行。**问题**：没有 lint、没有多版本、没有缓存。

### v3 -- 完整 CI/CD 流水线

```yaml
# Full pipeline with matrix, caching, lint, security, deploy
name: CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  lint: { ... }        # ruff + mypy
  test: { ... }        # Matrix 3 Python versions
  security: { ... }    # pip-audit
  docker: { ... }      # Build + smoke test
  deploy-staging: { ... }   # Auto deploy on merge to develop
  deploy-production: { ... } # Manual approval for production
  release: { ... }     # PyPI + GitHub Release on tag
```

**最终形态**：并行执行、矩阵覆盖、安全扫描、多环境部署、自动发布、完整的质量门禁。
