---
title: "001 - Python简介与环境搭建"
slug: "001-python-intro"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:17.955+08:00"
updated_at: "2026-04-29T10:02:47.224+08:00"
reading_time: 20
tags: []
---

## 📊 难度标注

> **难度：** ⭐☆☆☆☆ 入门级
> **前置知识：** 无
> **预计用时：** 30-45分钟
> **学习目标：** 理解Python是什么，能独立搭建开发环境并运行代码

---

## 📖 概念讲解

### Python是什么？

Python是一种**解释型、高级、通用**编程语言，由Guido van Rossum于1991年创建。它的设计哲学强调**代码可读性**，语法简洁到接近自然语言。

**为什么学Python？**

- **语法简洁**：同样的功能，Python代码量通常是Java的1/3
- **应用广泛**：Web开发、数据分析、人工智能、自动化脚本、爬虫……
- **生态丰富**：PyPI上有40万+第三方库，几乎你想做的都有人做过
- **学习曲线平缓**：最适合作为第一门编程语言
- **就业需求高**：连续多年位居TIOBE编程语言排行榜前列

### Python vs 其他语言

| 特性 | Python | Java | C++ | JavaScript |
|------|--------|------|-----|------------|
| 学习难度 | 低 | 中 | 高 | 中 |
| 执行速度 | 较慢 | 中 | 快 | 快 |
| 代码量 | 少 | 多 | 多 | 中 |
| 主要领域 | AI/数据/Web | 企业级 | 系统/游戏 | 前端/全栈 |
| 运行方式 | 解释执行 | 编译+JVM | 编译执行 | 解释执行 |

### 解释型 vs 编译型

简单理解：
- **编译型**（C/C++）：写完代码 → 整体翻译成机器码 → 运行。像翻译一本书。
- **解释型**（Python）：写完代码 → 逐行翻译并运行。像同声传译。

Python解释器逐行读取代码，翻译成字节码，再由虚拟机执行。

---

## 🗺️ 知识脑图

```
Python入门
├── 认识Python
│   ├── 历史：1991年 Guido van Rossum 创建
│   ├── 特点：简洁、易学、强大
│   ├── 应用：Web / AI / 数据分析 / 自动化
│   └── 版本：Python 3.x（必选）
├── 环境搭建
│   ├── Python 安装（3.12+）
│   ├── VS Code 安装与配置
│   ├── 终端基础操作
│   └── 第一个程序：Hello World
├── 包管理
│   ├── pip 基本用法
│   ├── 虚拟环境（venv）
│   └── 常用包推荐
└── 学习路线
    ├── 基础语法（变量、条件、循环）
    ├── 数据结构（列表、字典、集合）
    ├── 函数与模块
    └── 项目实战
```

---

## 💻 完整Python代码

### 第一个程序：Hello World

```python
# hello.py - Your first Python program
# Every programmer's journey starts here!

print("Hello, World!")
print("Welcome to Python!")
print("Python is awesome!")
```

### 使用变量和基本运算

```python
# basics.py - Basic variables and operations

# Variable assignment
name = "Python"
version = 3.12
year = 1991

# Print with f-string formatting
print(f"Language: {name}")
print(f"Current version: {version}")
print(f"Created in: {year}")
print(f"Age: {2024 - year} years old")

# Basic arithmetic
print(f"\n--- Arithmetic ---")
print(f"10 + 3 = {10 + 3}")    # Addition
print(f"10 - 3 = {10 - 3}")    # Subtraction
print(f"10 * 3 = {10 * 3}")    # Multiplication
print(f"10 / 3 = {10 / 3:.2f}")  # Division (2 decimal places)
print(f"10 // 3 = {10 // 3}")  # Floor division
print(f"10 % 3 = {10 % 3}")    # Modulo (remainder)
print(f"10 ** 3 = {10 ** 3}")  # Exponent
```

### 交互式输入

```python
# interactive.py - Get user input

name = input("What's your name? ")
age = input("How old are you? ")

# Calculate birth year
birth_year = 2024 - int(age)

print(f"\nHello, {name}!")
print(f"You were born in {birth_year}.")
print(f"In 10 years, you'll be {int(age) + 10} years old.")
```

### 检查Python环境信息

```python
# check_env.py - Check your Python environment

import sys
import platform

print("=== Python Environment Info ===")
print(f"Python version: {sys.version}")
print(f"Python path: {sys.executable}")
print(f"OS: {platform.system()} {platform.release()}")
print(f"Architecture: {platform.machine()}")
print(f"\nPython version details:")
print(f"  Major: {sys.version_info.major}")
print(f"  Minor: {sys.version_info.minor}")
print(f"  Micro: {sys.version_info.micro}")
```

---

## 👀 执行预览

**运行 hello.py：**

```
$ python hello.py
Hello, World!
Welcome to Python!
Python is awesome!
```

**运行 basics.py：**

```
$ python basics.py
Language: Python
Current version: 3.12
Created in: 1991
Age: 33 years old

--- Arithmetic ---
10 + 3 = 13
10 - 3 = 7
10 * 3 = 30
10 / 3 = 3.33
10 // 3 = 3
10 % 3 = 1
10 ** 3 = 1000
```

**运行 check_env.py：**

```
$ python check_env.py
=== Python Environment Info ===
Python version: 3.12.4 (main, Jun  6 2024, 18:26:44)
Python path: /usr/bin/python3
OS: Linux 6.5.0
Architecture: x86_64

Python version details:
  Major: 3
  Minor: 12
  Micro: 4
```

**检查 pip 版本：**

```
$ pip --version
pip 24.0 from /usr/lib/python3.12/site-packages/pip (python 3.12)

$ pip install requests
Successfully installed requests-2.32.3
```

---

## ⚠️ 注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| Python版本 | Python 2 已于2020年停止维护 | 务必使用 Python 3.10+ |
| 安装路径 | Windows安装时默认不加入PATH | 勾选 "Add Python to PATH" |
| 编辑器 | 记事本也能写，但体验极差 | 推荐VS Code + Python扩展 |
| 缩进 | Python用缩进表示代码块 | 统一使用4个空格，不用Tab |
| 编码 | 中文可能导致编码错误 | 文件首行加 `# -*- coding: utf-8 -*-` |
| pip权限 | Linux/Mac可能需要权限 | 使用 `pip install --user` 或虚拟环境 |
| 虚拟环境 | 直接装全局会污染环境 | 每个项目都建虚拟环境 |

### 环境搭建步骤（Windows）

1. 访问 [python.org](https://www.python.org/downloads/) 下载最新版
2. 运行安装程序，**勾选 "Add Python to PATH"**
3. 点击 "Install Now"
4. 打开命令提示符，输入 `python --version` 验证

### 环境搭建步骤（macOS）

```bash
# Method 1: Official installer - Download from python.org

# Method 2: Homebrew (recommended)
brew install python3

# Verify
python3 --version
```

### 环境搭建步骤（Linux）

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip

# Verify
python3 --version
```

### 虚拟环境设置

```bash
# Create virtual environment
python3 -m venv myproject

# Activate (Linux/macOS)
source myproject/bin/activate

# Activate (Windows)
myproject\Scripts\activate

# Deactivate
deactivate
```

---

## 🚫 避坑指南

### ❌ Windows安装时没勾选 PATH

```
# Command prompt shows:
# 'python' is not recognized as an internal or external command
```

✅ **解决方法：** 重新运行安装程序，勾选 "Add Python to PATH"，或手动添加环境变量。

### ❌ 混用 Python 2 和 Python 3

```bash
# Some systems have both python and python3
python --version    # Might be Python 2.7!
python3 --version   # Always Python 3.x
```

✅ **解决方法：** 始终使用 `python3` 和 `pip3` 命令，或设置别名 `alias python=python3`。

### ❌ 用Tab键缩进

```python
# Mixing tabs and spaces causes error:
# TabError: inconsistent use of tabs and spaces in indentation
if True:
    print("tab")  # Tab here
        print("spaces")  # Spaces here → ERROR
```

✅ **解决方法：** 编辑器设置中把Tab替换为4个空格。VS Code默认已如此。

### ❌ 中文路径导致问题

```
# Running script from a Chinese-character path may fail
# C:\Users\张三\Desktop\python\hello.py
```

✅ **解决方法：** 项目路径全部使用英文和下划线，如 `C:\projects\python_basics\`。

### ❌ 直接用系统全局 pip 安装

```bash
# This may break system packages
pip install flask  # Danger on Linux!
```

✅ **解决方法：** 先创建虚拟环境再安装包。

---

## 🏋️ 练习题

### 🟢 入门题

**1. 环境验证**

编写一个脚本 `my_info.py`，输出以下信息：
- Python版本号
- 你的操作系统
- 当前日期时间

提示：使用 `sys`、`platform`、`datetime` 模块。

**2. 简单计算器**

编写脚本，用 `input()` 获取两个数字，输出它们的加减乘除结果。

### 🟡 进阶题

**3. 温度转换器**

编写一个程序：
- 输入华氏温度
- 输出对应的摄氏温度（公式：C = (F - 32) × 5/9）
- 结果保留两位小数

**4. 个人名片生成器**

用变量存储姓名、年龄、城市、爱好，然后用 f-string 输出一张格式化的名片。

### 🔴 挑战题

**5. 命令行计算器（增强版）**

编写脚本实现：
- 输入一个数学表达式字符串（如 `"3 + 5 * 2"`）
- 输出计算结果
- 支持加减乘除和括号

提示：研究 `eval()` 函数的安全用法。

---

## 🌳 知识点总结

```
Python环境搭建
├── Python基础
│   ├── 解释型语言 → 逐行执行
│   ├── 动态类型 → 变量无需声明类型
│   ├── 缩进语法 → 4空格为标准
│   └── f-string → 格式化字符串的最佳方式
├── 工具链
│   ├── python3 → 运行解释器
│   ├── pip → 包管理器
│   ├── venv → 虚拟环境
│   └── VS Code → 推荐编辑器
├── 核心命令
│   ├── python3 script.py → 执行脚本
│   ├── python3 -m venv env → 创建虚拟环境
│   ├── pip install package → 安装包
│   └── pip list → 查看已安装包
└── 最佳实践
    ├── 使用 Python 3.10+
    ├── 每个项目独立虚拟环境
    ├── 统一4空格缩进
    └── 英文路径命名
```

---

## 🔄 举一反三

| 你学到的 | 可以应用到 | 例子 |
|----------|-----------|------|
| print()输出 | 调试代码、查看变量值 | `print(f"debug: x={x}")` |
| input()输入 | 命令行交互工具 | 批量重命名文件脚本 |
| f-string格式化 | 日志输出、报告生成 | 生成CSV行 `f"{name},{score}"` |
| 变量赋值 | 存储配置、中间结果 | `API_URL = "http://..."` |
| 算术运算 | 数据处理、计算 | 计算平均分、税率 |
| pip安装包 | 扩展Python能力 | 安装requests做HTTP请求 |

---

## 📚 参考资料

- [Python官方文档](https://docs.python.org/3/)
- [Python官方教程](https://docs.python.org/3/tutorial/)
- [Real Python](https://realpython.com/) - 优质英文教程
- [VS Code Python配置](https://code.visualstudio.com/docs/python/python-tutorial)
- [PEP 8 代码风格指南](https://peps.python.org/pep-0008/)

---

## 🔬 代码演进

### v1：最简版本

```python
# v1: Minimal version
print("Hello, World!")
```

### v2：加入变量和格式化

```python
# v2: Variables and formatting
language = "Python"
version = 3.12
print(f"Learning {language} {version}")
print("Hello, World!")
```

### v3：完整的环境信息脚本

```python
# v3: Complete environment info script
import sys
import platform
from datetime import datetime

def show_info():
    # Display Python environment information
    print("=" * 40)
    print("   Python Environment Report")
    print("=" * 40)
    print(f"Python:    {sys.version}")
    print(f"Platform:  {platform.system()} {platform.release()}")
    print(f"Machine:   {platform.machine()}")
    print(f"Path:      {sys.executable}")
    print(f"Date:      {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("=" * 40)

if __name__ == "__main__":
    show_info()
```

> **下一步：** 环境搭建完成后，我们将在下一篇文章学习 [变量与数据类型](/posts/002-variables-types)，开始真正编写有意义的程序！
