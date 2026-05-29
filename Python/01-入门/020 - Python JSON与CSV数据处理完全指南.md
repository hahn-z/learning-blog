---
title: "020 - Python JSON与CSV数据处理完全指南"
slug: "020-json-csv"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.318+08:00"
updated_at: "2026-04-29T10:02:47.425+08:00"
reading_time: 25
tags: []
---

## 📊 难度标注

> **难度等级：** ⭐⭐☆☆☆（初级）
> **前置知识：** Python基础语法、文件操作、字典和列表
> **预计学习时间：** 30-40分钟
> **适用场景：** 数据交换、配置文件、数据分析导入导出

---

## 📖 概念讲解

### JSON 与 CSV：两种最常见的数据格式

**JSON（JavaScript Object Notation）** 是轻量级的数据交换格式，广泛用于 Web API、配置文件、NoSQL 数据库。它支持嵌套结构，天然映射 Python 的字典和列表。

**CSV（Comma-Separated Values）** 是最简单的表格数据格式，每行一条记录，字段用逗号分隔。Excel、数据库导入导出都支持 CSV。

### 核心区别

```
JSON                          CSV
├── 树状结构（嵌套）          ├── 表格结构（二维）
├── 支持多种数据类型          ├── 全部是字符串
├── 适合复杂/层级数据          ├── 适合扁平表格数据
├── API 通信首选              ├── 数据分析/Excel 首选
└── 文件通常较小              └── 人类可读性好
```

**JSON 数据类型映射：**

| JSON | Python |
|------|--------|
| object `{}` | `dict` |
| array `[]` | `list` |
| string | `str` |
| number | `int` / `float` |
| boolean | `bool` |
| null | `None` |

---

## 🧠 知识脑图

```
JSON & CSV 处理
├── JSON (json 模块)
│   ├── json.dumps()   → Python → JSON字符串
│   ├── json.loads()   → JSON字符串 → Python
│   ├── json.dump()    → Python → JSON文件
│   ├── json.load()    → JSON文件 → Python
│   ├── ensure_ascii   → 中文处理
│   ├── indent         → 美化输出
│   └── 自定义编码      → JSONEncoder
├── CSV (csv 模块)
│   ├── csv.reader     → 基础读取
│   ├── csv.writer     → 基础写入
│   ├── csv.DictReader → 字典读取（推荐）
│   ├── csv.DictWriter → 字典写入（推荐）
│   └── delimiter      → 自定义分隔符
└── 实战技巧
    ├── JSON ↔ CSV 互转
    ├── 大文件流式处理
    └── 编码问题处理
```

---

## 💻 完整代码示例

### v1 基础：JSON 读写

```python
# v1: Basic JSON read/write
import json

# Python data structure
students = [
    {"name": "Alice", "age": 20, "scores": [85, 92, 78]},
    {"name": "Bob", "age": 22, "scores": [90, 88, 95]},
    {"name": "Charlie", "age": 21, "scores": [76, 85, 90]},
]

# Serialize: Python -> JSON string
json_str = json.dumps(students, ensure_ascii=False, indent=2)
print("JSON string:")
print(json_str)

# Deserialize: JSON string -> Python
data = json.loads(json_str)
print(f"First student: {data[0]['name']}")
print(f"Alice's scores: {data[0]['scores']}")

# Write to file
with open("students.json", "w", encoding="utf-8") as f:
    json.dump(students, f, ensure_ascii=False, indent=2)
print("Saved to students.json")

# Read from file
with open("students.json", "r", encoding="utf-8") as f:
    loaded = json.load(f)
print(f"Loaded {len(loaded)} students")
```

### v2 进阶：CSV 读写与互转

```python
# v2: CSV operations and JSON<->CSV conversion
import json
import csv

# --- CSV writing with DictWriter ---
students = [
    {"name": "Alice", "age": 20, "score": 85},
    {"name": "Bob", "age": 22, "score": 90},
    {"name": "Charlie", "age": 21, "score": 76},
]

with open("students.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["name", "age", "score"])
    writer.writeheader()
    writer.writerows(students)
print("CSV written")

# --- CSV reading with DictReader ---
with open("students.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(f"  {row['name']}: age={row['age']}, score={row['score']}")

# --- JSON -> CSV conversion ---
with open("students.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Flatten nested structure for CSV
flat_data = []
for item in data:
    flat_data.append({
        "name": item["name"],
        "age": item["age"],
        "avg_score": sum(item["scores"]) / len(item["scores"])
    })

with open("students_flat.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["name", "age", "avg_score"])
    writer.writeheader()
    writer.writerows(flat_data)
print("JSON -> CSV converted")

# --- CSV -> JSON conversion ---
with open("students.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

with open("from_csv.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
print("CSV -> JSON converted")
```

### v3 高级：大文件处理与自定义序列化

```python
# v3: Large file handling and custom serialization
import json
import csv
from datetime import datetime

# --- Custom JSON encoder for datetime ---
class UserEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

data = {"event": "login", "time": datetime.now(), "user": "Alice"}
json_str = json.dumps(data, cls=UserEncoder, ensure_ascii=False)
print(f"Custom encoded: {json_str}")

# --- Stream large CSV (line by line) ---
with open("large_data.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "name", "value"])
    for i in range(1, 1001):
        writer.writerow([i, f"item_{i}", i * 10.5])

# Reading large CSV line by line (memory efficient)
total = 0
count = 0
with open("large_data.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        total += float(row["value"])
        count += 1
print(f"Processed {count} rows, total value: {total}")

# --- Stream large JSON (NDJSON format) ---
records = [
    {"id": 1, "msg": "hello"},
    {"id": 2, "msg": "world"},
    {"id": 3, "msg": "python"},
]
with open("data.ndjson", "w", encoding="utf-8") as f:
    for rec in records:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

with open("data.ndjson", "r", encoding="utf-8") as f:
    for line in f:
        obj = json.loads(line.strip())
        print(f"  Record: {obj}")
```

---

## 👀 执行预览

```
JSON string:
[
  {
    "name": "Alice",
    "age": 20,
    "scores": [85, 92, 78]
  },
  ...
]

First student: Alice
Alice's scores: [85, 92, 78]
Saved to students.json
Loaded 3 students

CSV written
  Alice: age=20, score=85
  Bob: age=22, score=90
  Charlie: age=21, score=76

JSON -> CSV converted
CSV -> JSON converted

Custom encoded: {"event": "login", "time": "2024-06-15T14:30:00.123456", "user": "Alice"}
Processed 1000 rows, total value: 525525.0
  Record: {'id': 1, 'msg': 'hello'}
  Record: {'id': 2, 'msg': 'world'}
  Record: {'id': 3, 'msg': 'python'}
```

---

## ⚠️ 注意事项

| 场景 | 注意点 | 建议 |
|------|--------|------|
| JSON中文 | `dumps` 默认转义中文 | 使用 `ensure_ascii=False` |
| CSV换行 | Windows 需要 `newline=""` | 始终添加此参数 |
| 编码 | CSV 可能是 GBK 编码 | 尝试 utf-8，失败用 gbk |
| JSON类型 | JSON 没有 tuple/set | tuple 会变成 array |
| CSV数字 | 读出全是字符串 | 需要手动 int()/float() |
| 嵌套数据 | CSV 无法表示嵌套 | 需要 flatten 或用 JSON |
| 大文件 | json.load 全部读入内存 | 用 NDJSON 逐行处理 |
| BOM头 | Excel 导出的 CSV 可能有 BOM | encoding 用 `utf-8-sig` |

---

## 🚫 避坑指南

### ❌ JSON 序列化 datetime 对象
```python
# Wrong: datetime is not JSON serializable
data = {"time": datetime.now()}
json.dumps(data)  # TypeError!
```
✅ **正确做法：** 自定义编码器或预先转换
```python
# Correct: convert to string first
data = {"time": datetime.now().isoformat()}
json.dumps(data)  # OK

# Or use custom encoder
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)
json.dumps(data, cls=DateTimeEncoder)
```

### ❌ 忘记 newline="" 写 CSV
```python
# Wrong: extra blank lines on Windows
with open("data.csv", "w") as f:
    writer = csv.writer(f)
    # Results in blank lines between rows!
```
✅ **正确做法：** 始终加 newline=""
```python
# Correct: always use newline=""
with open("data.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
```

### ❌ 直接用 csv.reader 忽略表头
```python
# Wrong: first row is header, treated as data
with open("data.csv") as f:
    for row in csv.reader(f):
        print(row)  # header included as data!
```
✅ **正确做法：** 使用 DictReader
```python
# Correct: DictReader handles header automatically
with open("data.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row["name"])  # Access by column name
```

---

## 🏋️ 练习题

### 🟢 入门级

**题目1：** 读取 JSON 配置文件并修改某个值后写回。

```python
import json

with open("config.json", "r", encoding="utf-8") as f:
    config = json.load(f)
config["debug"] = True
with open("config.json", "w", encoding="utf-8") as f:
    json.dump(config, f, indent=2)
```

**题目2：** 将一个 CSV 文件的内容打印为 Markdown 表格。

### 🟡 进阶级

**题目3：** 实现一个函数，将嵌套 JSON 扁平化为 CSV 兼容格式。

```python
def flatten_json(data, parent_key="", sep="."):
    items = []
    for k, v in data.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_json(v, new_key, sep).items())
        else:
            items.append((new_key, v))
    return dict(items)
```

**题目4：** 实现一个 NDJSON 流式处理器，逐行读取并过滤满足条件的记录。

### 🔴 挑战级

**题目5：** 实现一个支持 JSON Pointer (RFC 6901) 的查询函数，如 `resolve_pointer(data, "/students/0/name")` 返回 `"Alice"`。

---

## 🌳 知识点总结

```
JSON & CSV
├── JSON
│   ├── 序列化 → dumps / dump
│   ├── 反序列化 → loads / load
│   ├── 参数 → ensure_ascii / indent / sort_keys
│   ├── 自定义编码 → JSONEncoder
│   └── 流式处理 → NDJSON
├── CSV
│   ├── 基础 → reader / writer
│   ├── 推荐 → DictReader / DictWriter
│   ├── 参数 → delimiter / quotechar
│   └── 编码 → utf-8 / utf-8-sig / gbk
└── 互转
    ├── JSON→CSV → flatten + DictWriter
    └── CSV→JSON → DictReader + dump
```

---

## 🔗 举一反三

| 技术点 | 本文用法 | 扩展场景 |
|--------|---------|---------|
| json.dumps | 序列化数据 | API响应、Redis缓存序列化 |
| json.loads | 解析JSON | Webhook接收、配置读取 |
| csv.DictReader | 读取CSV | 数据迁移、批量导入 |
| csv.DictWriter | 写入CSV | 报表导出、数据备份 |
| ensure_ascii=False | 保留中文 | 中文内容处理必加 |
| JSONEncoder | datetime序列化 | 自定义任意类型的序列化 |
| NDJSON | 流式JSON | 日志处理、大数据管道 |
| utf-8-sig | BOM处理 | 兼容Excel导出的CSV |

---

## 📚 参考资料

- [Python json 官方文档](https://docs.python.org/3/library/json.html)
- [Python csv 官方文档](https://docs.python.org/3/library/csv.html)
- [JSON 规范 (ECMA-404)](https://www.ecma-international.org/publications-and-standards/standards/ecma-404/)
- [RFC 4180 — CSV 格式标准](https://www.rfc-editor.org/rfc/rfc4180)
- [pandas.read_csv](https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html) — 更强大的CSV处理

---

## 🔄 代码演进

| 版本 | 重点 | 适用场景 |
|------|------|---------|
| v1 基础版 | JSON 读写、序列化 | 配置文件、简单数据存储 |
| v2 进阶版 | CSV 读写、JSON↔CSV互转 | 数据导入导出、报表处理 |
| v3 高级版 | 大文件流式处理、自定义编码 | 大数据处理管道、生产环境 |

**演进路径：** v1 满足日常数据读写 → v2 解决格式互转需求 → v3 处理性能和复杂类型。按数据量和复杂度选择合适版本。
