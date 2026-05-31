---
title: "006 - Python字典(Dictionary)详解：键值对的艺术"
slug: "006-dictionaries"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.235+08:00"
updated_at: "2026-04-29T10:02:47.271+08:00"
reading_time: 34
tags: []
---

# 🟢 Python字典(Dictionary)详解

> **难度：** ⭐⭐ 入门级 | **阅读时间：** 15分钟 | **前置知识：** 列表、元组、基本数据类型

## 一、概念讲解

字典(Dictionary)是Python中最重要的数据结构之一，它是**键值对(key-value)** 的无序集合，通过键快速查找值。

**核心特征：**
- **键值对**：每个元素由唯一的键和对应的值组成
- **可变**：可以增删改键值对
- **键唯一**：同一个键只能出现一次
- **键必须可哈希**：字符串、数字、元组可以；列表、字典不行
- **查找极快**：O(1) 时间复杂度

```python
# A person described by a dict
person = {
    "name": "Alice",
    "age": 30,
    "skills": ["Python", "SQL"],
}
```

## 二、知识脑图

```
Dictionary (字典)
├── 创建
│   ├── 字面量: {"a": 1, "b": 2}
│   ├── dict(): dict(a=1, b=2)
│   ├── fromkeys(): dict.fromkeys(["a","b"], 0)
│   ├── 推导式: {k: v for k, v in pairs}
│   └── zip: dict(zip(keys, vals))
├── 访问
│   ├── d[key] — KeyError if missing
│   ├── d.get(key, default)
│   ├── d.setdefault(key, default)
│   └── 遍历: keys(), values(), items()
├── 修改
│   ├── d[key] = value
│   ├── update(other_dict)
│   ├── pop(key), popitem()
│   └── del d[key], clear()
├── 高级
│   ├── 嵌套字典
│   ├── defaultdict
│   ├── OrderedDict (Python 3.7+默认有序)
│   ├── ChainMap
│   └── Counter
└── 序列化
    ├── json.dumps() / json.loads()
    └── 与API交互的标准格式
```

## 三、完整代码示例

```python
# ============================================
# Python Dictionary Complete Guide
# ============================================

# --- 1. Creating dictionaries ---
# Literal
student = {"name": "Alice", "age": 20, "major": "CS"}

# From keyword arguments
config = dict(host="localhost", port=8080, debug=True)

# From list of tuples
pairs = [("a", 1), ("b", 2), ("c", 3)]
d = dict(pairs)

# From zip
keys = ["name", "age", "city"]
values = ["Bob", 25, "Beijing"]
person = dict(zip(keys, values))

# fromkeys with default value
counter = dict.fromkeys(["apple", "banana", "cherry"], 0)

print("student:", student)
print("config:", config)
print("counter:", counter)

# --- 2. Accessing values ---
scores = {"math": 95, "english": 88, "science": 92}

# Direct access (raises KeyError if missing)
print("Math:", scores["math"])

# Safe access with get()
print("History:", scores.get("history"))           # None
print("History:", scores.get("history", "N/A"))    # N/A

# setdefault: get or set if missing
scores.setdefault("art", 85)
print("Art (setdefault):", scores["art"])

# --- 3. Modifying dictionaries ---
user = {"name": "Charlie", "email": "c@example.com"}

# Add / update
user["age"] = 28
user["email"] = "new@example.com"
print("After add/update:", user)

# Update with another dict
user.update({"role": "admin", "active": True})
print("After update:", user)

# Remove
removed = user.pop("active")
print(f"Popped '{removed}':", user)

last = user.popitem()  # Removes last inserted (Python 3.7+)
print(f"Popped last {last}:", user)

# --- 4. Iterating ---
grades = {"Alice": 92, "Bob": 85, "Carol": 88, "Dave": 95}

# Iterate keys
print("--- Keys ---")
for name in grades:
    print(f"  {name}")

# Iterate key-value pairs
print("--- Items ---")
for name, score in grades.items():
    print(f"  {name}: {score}")

# Iterate values
print(f"Average: {sum(grades.values()) / len(grades):.1f}")

# Check membership
print("Alice in grades?", "Alice" in grades)

# --- 5. Dictionary comprehension ---
# Square mapping
squares = {x: x**2 for x in range(1, 6)}
print("Squares:", squares)

# Filter
high_scores = {k: v for k, v in grades.items() if v >= 90}
print("High scores:", high_scores)

# Transform
letter_grades = {
    name: ("A" if s >= 90 else "B" if s >= 80 else "C")
    for name, s in grades.items()
}
print("Letter grades:", letter_grades)

# Swap keys and values
inverted = {v: k for k, v in grades.items()}
print("Inverted:", inverted)

# --- 6. Nested dictionaries ---
company = {
    "engineering": {
        "frontend": ["Alice", "Bob"],
        "backend": ["Charlie", "Dave"],
    },
    "design": {
        "ui": ["Eve"],
        "ux": ["Frank"],
    },
}

# Access nested
print("Backend team:", company["engineering"]["backend"])

# Safe nested access
def safe_get(d, *keys, default=None):
    """Safely traverse nested dicts."""
    result = d
    for key in keys:
        if isinstance(result, dict) and key in result:
            result = result[key]
        else:
            return default
    return result

print("Deep access:", safe_get(company, "engineering", "frontend"))
print("Missing path:", safe_get(company, "hr", "recruiting", default="N/A"))

# --- 7. Special dict types ---
from collections import defaultdict, Counter, OrderedDict
import json

# defaultdict — auto-create missing keys
word_count = defaultdict(int)
for word in "the cat sat on the mat the cat ate".split():
    word_count[word] += 1
print("Word count:", dict(word_count))

# Group items by key
groups = defaultdict(list)
students = [("A", "Alice"), ("B", "Bob"), ("A", "Amy"), ("B", "Bill")]
for grade, name in students:
    groups[grade].append(name)
print("Groups:", dict(groups))

# Counter
text = "abracadabra"
char_freq = Counter(text)
print("Char freq:", char_freq)
print("Top 3:", char_freq.most_common(3))

# --- 8. JSON serialization ---
data = {"name": "Alice", "scores": [92, 88, 95], "active": True}

# Dict to JSON string
json_str = json.dumps(data, indent=2)
print("JSON:\n", json_str)

# JSON string to dict
parsed = json.loads(json_str)
print("Parsed:", parsed["name"])

# --- 9. Merge dicts (Python 3.9+) ---
defaults = {"theme": "dark", "lang": "en", "font": 14}
user_prefs = {"lang": "zh", "font": 16}

# Python 3.9+ merge operator
merged = defaults | user_prefs
print("Merged:", merged)

# Python 3.5+ unpacking
merged2 = {**defaults, **user_prefs}
print("Merged (unpack):", merged2)
```

### 执行预览

```
student: {'name': 'Alice', 'age': 20, 'major': 'CS'}
config: {'host': 'localhost', 'port': 8080, 'debug': True}
counter: {'apple': 0, 'banana': 0, 'cherry': 0}
Math: 95
History: N/A
Art (setdefault): 85
After add/update: {'name': 'Charlie', 'email': 'new@example.com', 'age': 28}
After update: {'name': 'Charlie', 'email': 'new@example.com', 'age': 28, 'role': 'admin', 'active': True}
--- Items ---
  Alice: 92
  Bob: 85
  Carol: 88
  Dave: 95
Average: 90.0
Squares: {1: 1, 2: 4, 3: 9, 4: 16, 5: 25}
High scores: {'Alice': 92, 'Dave': 95}
Word count: {'the': 3, 'cat': 2, 'sat': 1, 'on': 1, 'mat': 1, 'ate': 1}
Top 3: [('a', 5), ('b', 2), ('r', 2)]
Merged: {'theme': 'dark', 'lang': 'zh', 'font': 16}
```

## 四、注意事项

| 注意点 | 说明 | 示例 |
|--------|------|------|
| 键不存在 | 直接 `d[key]` 会报 KeyError | 用 `d.get(key, default)` |
| 键必须可哈希 | 列表、字典不能做键 | `d = {[1]: 2}` → TypeError |
| 遍历时修改 | 遍历时不能增删键 | 先收集 `list(d.keys())` 再改 |
| 浅拷贝 | `.copy()` 只复制一层 | 嵌套字典仍共享引用 |
| 布尔键陷阱 | `True` 和 `1` 是同一个键 | `{True: "a", 1: "b"}` 只保留一个 |
| 排序 | 字典本身无序（3.7+保持插入序） | 需要 `sorted(d.items())` |

## 五、避坑指南

### ❌ 直接访问可能不存在的键
```python
# ❌ Crashes if key missing
d = {"name": "Alice"}
print(d["age"])  # KeyError: 'age'
```

### ✅ 正确写法
```python
# ✅ Use get() with default
print(d.get("age", "unknown"))  # unknown
```

### ❌ 遍历时修改字典
```python
# ❌ RuntimeError: dictionary changed size during iteration
d = {"a": 1, "b": 2, "c": 3}
for key in d:
    if d[key] < 2:
        del d[key]
```

### ✅ 正确写法
```python
# ✅ Collect keys first, or use dict comprehension
d = {"a": 1, "b": 2, "c": 3}
d = {k: v for k, v in d.items() if v >= 2}
print(d)  # {'b': 2, 'c': 3}
```

### ❌ 用可变对象做键
```python
# ❌ Lists are unhashable
d = {[1, 2]: "value"}  # TypeError
```

### ✅ 正确写法
```python
# ✅ Use tuple as key
d = {(1, 2): "value"}  # OK
```

### ❌ 深层嵌套直接访问
```python
# ❌ Cascading KeyError risk
data = {"user": {"profile": {"name": "Alice"}}}
data["user"]["settings"]["theme"]  # KeyError
```

### ✅ 正确写法
```python
# ✅ Use chained get()
data.get("user", {}).get("settings", {}).get("theme", "dark")
```

## 六、练习题

### 🟢 入门题
1. 创建一个字典存储你的3个好友信息（姓名、年龄、城市），遍历打印
2. 合并两个字典：`{"a": 1, "b": 2}` 和 `{"b": 3, "c": 4}`，重复键取后者

### 🟡 进阶题
3. 用字典实现一个简易电话簿：支持添加、查找、删除、列出所有联系人
4. 统计一段英文中每个单词出现的频率，按频率降序排列

### 🔴 挑战题
5. 实现一个嵌套字典的深度合并函数：`deep_merge(d1, d2)`，字典类型的值递归合并
6. 用字典实现一个LRU缓存（最近最少使用），支持 `get` 和 `put`，容量限制

**参考答案：**

```python
# 🟢 Q1
friends = {
    "alice": {"age": 25, "city": "Beijing"},
    "bob": {"age": 28, "city": "Shanghai"},
    "carol": {"age": 23, "city": "Shenzhen"},
}
for name, info in friends.items():
    print(f"{name}: {info['age']}yo, {info['city']}")

# 🟢 Q2
d1, d2 = {"a": 1, "b": 2}, {"b": 3, "c": 4}
merged = {**d1, **d2}  # or d1 | d2
print(merged)  # {'a': 1, 'b': 3, 'c': 4}

# 🟡 Q3
class PhoneBook:
    def __init__(self):
        self.contacts = {}
    
    def add(self, name, phone):
        self.contacts[name] = phone
    
    def find(self, name):
        return self.contacts.get(name, "Not found")
    
    def remove(self, name):
        self.contacts.pop(name, None)
    
    def list_all(self):
        return self.contacts.copy()

# 🟡 Q4
def word_freq(text):
    from collections import Counter
    words = text.lower().split()
    return Counter(words).most_common()

# 🔴 Q5
def deep_merge(base, override):
    result = base.copy()
    for key, val in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(val, dict):
            result[key] = deep_merge(result[key], val)
        else:
            result[key] = val
    return result

# 🔴 Q6
from collections import OrderedDict
class LRUCache:
    def __init__(self, capacity):
        self.cache = OrderedDict()
        self.capacity = capacity
    
    def get(self, key):
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        return -1
    
    def put(self, key, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)

cache = LRUCache(2)
cache.put("a", 1)
cache.put("b", 2)
print(cache.get("a"))  # 1
cache.put("c", 3)      # Evicts "b"
print(cache.get("b"))  # -1
```

## 七、知识点总结

```
Dictionary 知识树
├── 基础
│   ├── 创建: {}, dict(), fromkeys(), zip()
│   ├── 访问: d[k], get(), setdefault()
│   ├── 修改: 赋值, update(), pop(), del
│   └── 遍历: keys(), values(), items()
├── 高级
│   ├── 推导式: {k: v for ...}
│   ├── 嵌套: 多层字典
│   ├── 合并: | 运算符, {**d1, **d2}
│   └── 解包: **dict
├── collections
│   ├── defaultdict: 自动初始化缺失键
│   ├── Counter: 计数器
│   └── OrderedDict: 有序字典
├── 序列化
│   ├── json.dumps(): dict → JSON
│   └── json.loads(): JSON → dict
└── 注意事项
    ├── 键必须可哈希
    ├── 遍历时不能修改
    ├── 浅拷贝陷阱
    └── get() 比直接访问安全
```

## 八、举一反三

| 场景 | 数据结构 | 原因 |
|------|----------|------|
| 配置管理 | dict | 键值对，灵活嵌套 |
| API响应 | dict | JSON天然映射 |
| 计数统计 | Counter/defaultdict | 自动处理缺失键 |
| 缓存 | dict | O(1)查找，键值对应 |
| 分组 | defaultdict(list) | 按键归拢数据 |
| 权限映射 | dict | 角色→权限列表 |
| 数据库记录 | dict | 字段名→值的映射 |
| 国际化 | dict | 语言代码→翻译文本 |

## 九、参考资料

- [Python官方文档 - Dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries)
- [Real Python - Dictionaries](https://realpython.com/python-dicts/)
- [Python collections模块](https://docs.python.org/3/library/collections.html)

## 十、代码演进

### v1 — 基础：简单字典操作
```python
# v1: Basic dict operations
user = {"name": "Alice", "age": 30}
user["email"] = "alice@example.com"
print(user.get("phone", "N/A"))
for key, value in user.items():
    print(f"{key}: {value}")
```

### v2 — 进阶：配置管理器
```python
# v2: Config manager with nested dicts
class ConfigManager:
    def __init__(self, defaults=None):
        self._config = defaults or {}
    
    def get(self, key_path, default=None):
        keys = key_path.split(".")
        result = self._config
        for key in keys:
            if isinstance(result, dict) and key in result:
                result = result[key]
            else:
                return default
        return result
    
    def set(self, key_path, value):
        keys = key_path.split(".")
        config = self._config
        for key in keys[:-1]:
            config = config.setdefault(key, {})
        config[keys[-1]] = value
    
    def update(self, data):
        self._config.update(data)

cfg = ConfigManager({"db": {"host": "localhost", "port": 5432}})
cfg.set("db.port", 3306)
cfg.set("app.debug", True)
print(cfg.get("db.host"))       # localhost
print(cfg.get("app.debug"))     # True
print(cfg.get("cache.ttl", 300))  # 300
```

### v3 — 高级：带持久化的数据仓库
```python
# v3: Persistent data store with JSON
import json
import os
from datetime import datetime

class DataStore:
    """Lightweight key-value store with JSON persistence."""
    
    def __init__(self, filepath="data.json"):
        self._filepath = filepath
        self._data = self._load()
    
    def _load(self):
        if os.path.exists(self._filepath):
            with open(self._filepath) as f:
                return json.load(f)
        return {}
    
    def _save(self):
        with open(self._filepath, "w") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)
    
    def get(self, key, default=None):
        return self._data.get(key, default)
    
    def set(self, key, value):
        self._data[key] = {
            "value": value,
            "updated_at": datetime.now().isoformat(),
        }
        self._save()
    
    def delete(self, key):
        if key in self._data:
            del self._data[key]
            self._save()
            return True
        return False
    
    def search(self, prefix):
        return {k: v for k, v in self._data.items() if k.startswith(prefix)}
    
    def list_all(self):
        return dict(self._data)

store = DataStore("/tmp/my_store.json")
store.set("user:1", {"name": "Alice", "role": "admin"})
store.set("user:2", {"name": "Bob", "role": "user"})
store.set("config:theme", "dark")
print("User 1:", store.get("user:1"))
print("Users:", store.search("user:"))
```
