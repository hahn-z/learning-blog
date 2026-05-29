---
title: "024 - Python 虚拟环境与 pip：项目依赖管理完全指南"
slug: "024-venv-pip"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.339+08:00"
updated_at: "2026-04-29T10:02:47.473+08:00"
reading_time: 25
tags: []
---

# Python 虚拟环境与 pip：项目依赖管理完全指南

> **难度：** 🟢 入门 | **预计阅读：** 20 分钟
> **前置知识：** Python 基础安装、命令行操作

---

## 一、概念讲解：为什么需要虚拟环境？

想象这个场景：

```
项目A 需要 Django 3.2
项目B 需要 Django 4.2
你的系统全局只能装一个 Django
```

**虚拟环境（Virtual Environment）** 就是每个项目专属的 Python 沙箱，互不干扰。

### 核心概念对比

| 概念 | 作用 | 类比 |
|------|------|------|
| 虚拟环境 | 隔离项目依赖 | 每个项目的独立工具箱 |
| pip | Python 包管理器 | 去商店买工具的人 |
| requirements.txt | 依赖清单 | 购物清单 |
| pyproject.toml | 现代项目配置 | 项目说明书 |

### 虚拟环境解决了什么？

- ✅ 不同项目使用不同版本的同一个包
- ✅ 避免全局包冲突
- ✅ 方便复现和部署
- ✅ 保持全局 Python 环境干净

---

## 二、脑图（ASCII）

```
虚拟环境 & pip
├── 虚拟环境工具
│   ├── venv ─── Python 内置（推荐）
│   ├── virtualenv ─── 第三方，功能更强
│   ├── conda ─── 数据科学常用
│   └── poetry ─── 现代包管理
├── venv 工作流
│   ├── python -m venv .venv    (创建)
│   ├── source .venv/bin/activate (激活)
│   ├── pip install xxx          (安装)
│   ├── pip freeze > requirements.txt (导出)
│   └── deactivate               (退出)
├── pip 常用命令
│   ├── install / uninstall
│   ├── list / show / freeze
│   ├── install -r requirements.txt
│   └── install -e . (可编辑模式)
├── 依赖管理
│   ├── requirements.txt ─── 传统方式
│   ├── requirements-dev.txt ─── 开发依赖
│   ├── pyproject.toml ─── 现代方式
│   └── pip-tools ─── 锁定精确版本
└── 最佳实践
    ├── .venv 加入 .gitignore
    ├── requirements.txt 提交到 Git
    ├── 使用 pip-tools 管理版本
    └── Docker 中用 virtualenv 或全局安装
```

---

## 三、完整代码示例

### v1：基础工作流（venv + pip）

```bash
# v1: Basic venv + pip workflow

# 1. Create a virtual environment
python3 -m venv .venv

# 2. Activate it
# On Linux/macOS:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# 3. Verify you're in the venv
which python
# Output: /path/to/project/.venv/bin/python

# 4. Install packages
pip install requests
pip install flask==3.0.0

# 5. Check what's installed
pip list
# Output:
# Package    Version
# flask      3.0.0
# requests   2.31.0

# 6. Save dependencies
pip freeze > requirements.txt

# 7. Leave the virtual environment
deactivate
```

```python
# app.py - A simple app using our installed packages
import requests
from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/weather/<city>")
def get_weather(city: str):
    """Fetch weather data for a city."""
    # Using the requests package we installed
    url = f"https://wttr.in/{city}?format=j1"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        current = data["current_condition"][0]
        return jsonify({
            "city": city,
            "temp_C": current["temp_C"],
            "description": current["weatherDesc"][0]["value"],
        })
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

### v2：多环境管理（dev/prod 依赖分离）

```
Project structure:
myproject/
├── requirements/
│   ├── base.txt        # Common dependencies
│   ├── development.txt # Dev dependencies
│   └── production.txt  # Prod dependencies
├── src/
├── tests/
└── .venv/
```

```
# requirements/base.txt
requests>=2.31.0
flask>=3.0.0
python-dotenv>=1.0.0
```

```
# requirements/development.txt
-r base.txt
pytest>=7.4.0
black>=23.0.0
mypy>=1.7.0
ipython>=8.0.0
```

```
# requirements/production.txt
-r base.txt
gunicorn>=21.2.0
sentry-sdk[flask]>=1.0.0
```

```python
# install_deps.py - Automated dependency management
"""Helper script to set up the development environment."""

import subprocess
import sys
import os
from pathlib import Path

def run(cmd: str) -> None:
    """Run a shell command and check for errors."""
    print(f"Running: {cmd}")
    subprocess.run(cmd, shell=True, check=True)

def setup_dev_env():
    """Set up a complete development environment."""
    venv_path = Path(".venv")

    # Step 1: Create venv if it doesn't exist
    if not venv_path.exists():
        print("Creating virtual environment...")
        run(f"{sys.executable} -m venv .venv")

    # Step 2: Determine pip path
    if os.name == "nt":
        pip_path = str(venv_path / "Scripts" / "pip")
    else:
        pip_path = str(venv_path / "bin" / "pip")

    # Step 3: Upgrade pip
    run(f"{pip_path} install --upgrade pip")

    # Step 4: Install dev dependencies
    run(f"{pip_path} install -r requirements/development.txt")

    print("\n Development environment ready!")
    print("Activate with: source .venv/bin/activate")

if __name__ == "__main__":
    setup_dev_env()
```

### v3：现代项目管理（pyproject.toml + pip-tools）

```toml
# pyproject.toml - Modern Python project configuration
[project]
name = "myproject"
version = "1.0.0"
description = "A modern Python project"
requires-python = ">=3.10"
dependencies = [
    "requests>=2.31.0",
    "flask>=3.0.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "black>=23.0.0",
    "mypy>=1.7.0",
    "ruff>=0.1.0",
]
prod = [
    "gunicorn>=21.2.0",
    "sentry-sdk[flask]>=1.0.0",
]

[tool.pip-tools]
generate-hashes = true

[tool.black]
line-length = 88

[tool.ruff]
line-length = 88
select = ["E", "F", "I"]

[tool.mypy]
strict = true
```

```bash
# v3: Using pip-tools for deterministic builds

# Install pip-tools
pip install pip-tools

# Compile locked dependencies (creates requirements.txt with hashes)
pip-compile pyproject.toml -o requirements.txt

# Compile dev dependencies
pip-compile pyproject.toml --extra dev -o requirements-dev.txt

# Install from compiled requirements (deterministic)
pip-sync requirements.txt requirements-dev.txt
```

```python
# check_env.py - Verify the environment is correctly set up
"""Check that the current environment meets project requirements."""

import sys
import importlib

def check_python_version(required: str = ">=3.10") -> bool:
    """Check if current Python version meets requirements."""
    from packaging.specifiers import SpecifierSet
    spec = SpecifierSet(required)
    current = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    ok = current in spec
    status = "OK" if ok else "FAIL"
    print(f"[{status}] Python {current} (required: {required})")
    return ok

def check_packages(packages: list[str]) -> bool:
    """Check if required packages are importable."""
    all_ok = True
    for pkg in packages:
        try:
            mod = importlib.import_module(pkg)
            version = getattr(mod, "__version__", "unknown")
            print(f"[OK] {pkg} ({version})")
        except ImportError:
            print(f"[FAIL] {pkg} - NOT INSTALLED")
            all_ok = False
    return all_ok

if __name__ == "__main__":
    print("=== Environment Check ===\n")
    py_ok = check_python_version()
    print()
    pkg_ok = check_packages(["requests", "flask", "dotenv"])
    print()
    if py_ok and pkg_ok:
        print("All checks passed!")
    else:
        print("Some checks failed. Run: pip install -r requirements.txt")
```

---

## 四、执行预览

### v1 工作流

```bash
$ python3 -m venv .venv
$ source .venv/bin/activate
(.venv) $ pip install requests flask==3.0.0
Successfully installed requests-2.31.0 flask-3.0.0

(.venv) $ pip freeze > requirements.txt
(.venv) $ cat requirements.txt
flask==3.0.0
requests==2.31.0
```

### v3 环境检查

```
=== Environment Check ===

[OK] Python 3.12.1 (required: >=3.10)

[OK] requests (2.31.0)
[OK] flask (3.0.0)
[OK] dotenv (1.0.0)

All checks passed!
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| .venv 不要提交 Git | 虚拟环境可重建 | 加入 `.gitignore` |
| requirements.txt 要提交 | 他人可复现环境 | 放入版本控制 |
| 版本号锁定 | 避免版本漂移 | 用 `==` 精确锁定 |
| macOS/Linux vs Windows | 激活命令不同 | 文档中注明两种方式 |
| pip 源速度 | 默认 PyPI 可能慢 | 配置国内镜像源 |
| 虚拟环境迁移 | 复制 .venv 不可用 | 删除后重建 |

---

## 六、避坑指南

### ❌ 坑 1：忘记激活虚拟环境

```bash
# ❌ 直接 pip install，装到全局去了
pip install requests

# ✅ 先确认在虚拟环境中
which python  # 应该指向 .venv/bin/python
pip install requests
```

### ❌ 坑 2：requirements.txt 不锁定版本

```
# ❌ 版本范围太宽，不同机器可能装不同版本
requests>=2.0.0

# ✅ 精确锁定版本
requests==2.31.0
```

### ❌ 坑 3：不区分开发和生产依赖

```bash
# ❌ 生产环境装了 pytest
pip install pytest flask requests

# ✅ 分开管理
pip install -r requirements/production.txt  # Only production deps
```

---

## 七、练习题

### 🟢 入门：创建虚拟环境

1. 用 `venv` 创建一个虚拟环境
2. 安装 `requests` 和 `beautifulsoup4`
3. 导出 `requirements.txt`
4. 在另一个目录复现这个环境

### 🟡 进阶：多环境配置

1. 创建 `requirements/base.txt`、`development.txt`、`production.txt`
2. 配置国内 pip 镜像源（如清华源）
3. 编写 `Makefile` 快速设置开发环境

### 🔴 挑战：pyproject.toml 项目

1. 用 `pyproject.toml` 配置一个完整项目
2. 使用 `pip-tools` 编译确定性的依赖文件
3. 编写 `check_env.py` 自动验证环境
4. 配置 pre-commit hooks（black + ruff + mypy）

---

## 八、知识点总结（树状）

```
虚拟环境 & pip
├── venv 命令
│   ├── python -m venv .venv  ─── 创建
│   ├── source .venv/bin/activate ─── 激活(Linux/Mac)
│   ├── .venv\Scripts\activate ─── 激活(Windows)
│   └── deactivate ─── 退出
├── pip 命令
│   ├── install ─── 安装包
│   ├── uninstall ─── 卸载包
│   ├── list ─── 列出已安装
│   ├── freeze ─── 导出依赖
│   ├── show ─── 包详情
│   └── install -r ─── 从文件安装
├── 依赖管理方案
│   ├── requirements.txt ─── 传统
│   ├── pip-tools ─── 确定性构建
│   ├── pyproject.toml ─── 现代
│   └── poetry/pdm ─── 全功能包管理器
└── 镜像源配置
    ├── 清华: https://pypi.tuna.tsinghua.edu.cn/simple
    ├── 阿里: https://mirrors.aliyun.com/pypi/simple
    └── pip config set global.index-url <mirror>
```

---

## 九、举一反三

| 场景 | 推荐方案 | 关键命令 |
|------|----------|----------|
| 学习/小项目 | venv + requirements.txt | `python -m venv .venv` |
| 团队项目 | venv + pip-tools + pyproject.toml | `pip-compile` |
| 数据科学 | conda / miniconda | `conda create -n name` |
| Docker 部署 | 全局安装 + requirements.txt | `pip install --no-cache-dir` |
| 开源库 | pyproject.toml + poetry/pdm | `poetry build` |
| CI/CD | 缓存 .venv + pip-tools | `pip-sync` |

---

## 十、参考资料

- 📖 [venv 官方文档](https://docs.python.org/3/library/venv.html)
- 📖 [pip 用户指南](https://pip.pypa.io/en/stable/user_guide/)
- 📖 [pyproject.toml 规范](https://packaging.python.org/en/latest/specifications/pyproject-toml/)
- 📖 [pip-tools](https://github.com/jazzband/pip-tools)
- 🔧 [poetry](https://python-poetry.org/) - 现代 Python 包管理
- 🔧 [pdm](https://pdm-project.org/) - 另一个现代包管理器

---

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 venv + pip | 最简单，5 分钟上手 | 学习、小项目 |
| v2 多环境分离 | dev/prod 依赖分开 | 团队协作 |
| v3 pyproject.toml + pip-tools | 现代、确定性构建 | 生产项目 |

**演进路径：** `venv 基础 → 多环境分离 → pyproject.toml → pip-tools/poetry`

> 💡 **一句话总结：** 虚拟环境是 Python 项目的地基。不建地基就盖楼，迟早要塌。
