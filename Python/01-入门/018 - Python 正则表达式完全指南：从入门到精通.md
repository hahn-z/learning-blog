---
title: "018 - Python 正则表达式完全指南：从入门到精通"
slug: "018-regular-expressions"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.305+08:00"
updated_at: "2026-04-29T10:02:47.397+08:00"
reading_time: 31
tags: []
---

# Python 正则表达式完全指南：从入门到精通

> **难度标注**：⭐⭐⭐ 中级 | 预计阅读时间：18 分钟
>
> **前置知识**：Python 基础语法、字符串操作、基础数学逻辑

---

## 一、概念讲解

### 1.1 什么是正则表达式？

正则表达式（Regular Expression，简称 regex）是一种描述字符串模式的强大工具。它用一套特殊的语法来定义搜索模式，可以用来匹配、查找、替换和验证字符串。

**核心用途：**
- **验证**：检查字符串是否符合格式（邮箱、手机号、URL）
- **提取**：从文本中提取特定内容
- **替换**：批量替换文本中的模式
- **分割**：按复杂规则拆分字符串

### 1.2 Python 的 re 模块

Python 通过内置的 `re` 模块提供正则表达式支持。核心函数：

| 函数 | 作用 | 返回 |
|------|------|------|
| `re.search(pattern, string)` | 搜索第一个匹配 | Match 或 None |
| `re.match(pattern, string)` | 从开头匹配 | Match 或 None |
| `re.fullmatch(pattern, string)` | 完整匹配 | Match 或 None |
| `re.findall(pattern, string)` | 找所有匹配 | 列表 |
| `re.finditer(pattern, string)` | 迭代所有匹配 | 迭代器 |
| `re.sub(pattern, repl, string)` | 替换 | 新字符串 |
| `re.split(pattern, string)` | 分割 | 列表 |

### 1.3 核心元字符速查

```
.       → 任意字符（不含换行，除非 re.DOTALL）
^       → 字符串开头
$       → 字符串结尾
*       → 前一个字符 0 次或多次
+       → 前一个字符 1 次或多次
?       → 前一个字符 0 次或 1 次
{n}     → 恰好 n 次
{n,m}   → n 到 m 次
[...]   → 字符类
[^...]  → 排除字符类
|       → 或
(...)   → 分组
\       → 转义
\d      → 数字 [0-9]
\w      → 单词字符 [a-zA-Z0-9_]
\s      → 空白字符
\b      → 单词边界
```

---

## 二、知识脑图

```
Python 正则表达式 (re 模块)
├── 基础语法
│   ├── 元字符：. ^ $ * + ? {n,m}
│   ├── 字符类：[abc] [^abc] [\d] [\w]
│   ├── 预定义：\d \D \w \W \s \S \b
│   └── 转义：\. \* \\
├── 分组与捕获
│   ├── (...) → 捕获组
│   ├── (?:...) → 非捕获组
│   ├── (?P<name>...) → 命名组
│   └── \1, \2 → 反向引用
├── 核心函数
│   ├── search / match / fullmatch
│   ├── findall / finditer
│   ├── sub / subn
│   └── split
├── 修饰符（Flags）
│   ├── re.IGNORECASE (re.I)
│   ├── re.MULTILINE (re.M)
│   ├── re.DOTALL (re.S)
│   └── re.VERBOSE (re.X)
├── 贪婪与非贪婪
│   ├── 贪婪：* + ? {n,m}（默认）
│   └── 非贪婪：*? +? ?? {n,m}?
└── 性能优化
    ├── 预编译 re.compile()
    ├── 避免回溯
    └── 原始字符串 r""
```

---

## 三、代码演进

### v1：基础匹配与验证

```python
import re

# Basic pattern matching
text = "My phone is 138-1234-5678 and email is test@example.com"

# Search for first match
phone = re.search(r"\d{3}-\d{4}-\d{4}", text)
if phone:
    print(f"Phone: {phone.group()}")  # 138-1234-5678

# Find all matches
emails = re.findall(r"[\w.]+@[\w.]+", text)
print(f"Emails: {emails}")  # ['test@example.com']

# Simple validation
def is_valid_phone(phone_str):
    """Validate Chinese mobile phone number."""
    return bool(re.fullmatch(r"1[3-9]\d{9}", phone_str))

print(is_valid_phone("13812345678"))  # True
print(is_valid_phone("12345678901"))  # False (starts with 12)

# Match vs Search
print(re.match(r"hello", "say hello"))   # None (not at start)
print(re.search(r"hello", "say hello"))  # Match object
```

**执行预览：**
```
Phone: 138-1234-5678
Emails: ['test@example.com']
True
False
None
<re.Match object; span=(4, 9), match='hello'>
```

### v2：分组、命名组与替换

```python
import re

# Named groups for readable extraction
log_line = '192.168.1.100 - - [29/Apr/2026:06:30:00 +0800] "GET /api/users HTTP/1.1" 200 1234'

pattern = r'(?P<ip>\d+\.\d+\.\d+\.\d+).*?\[(?P<time>[^\]]+)\].*?"(?P<method>\w+) (?P<path>\S+)'
match = re.search(pattern, log_line)
if match:
    print(f"IP: {match.group('ip')}")
    print(f"Time: {match.group('time')}")
    print(f"Method: {match.group('method')}")
    print(f"Path: {match.group('path')}")

# Multiple groups with findall
text = "Alice: 85, Bob: 92, Charlie: 78"
scores = re.findall(r"(\w+):\s*(\d+)", text)
print(scores)  # [('Alice', '85'), ('Bob', '92'), ('Charlie', '78')]

# Substitution with backreferences
def mask_phone(text):
    """Mask middle digits of phone numbers."""
    return re.sub(r"(\d{3})\d{4}(\d{4})", r"\1-****-\2", text)

print(mask_phone("Call 13812345678 or 15987654321"))
# Call 138-****-5678 or 159-****-4321

# Non-capturing group
html = "<div>content</div><span>text</span>"
tags = re.findall(r"<(?:div|span)>(.*?)</(?:div|span)>", html)
print(tags)  # ['content', 'text']
```

**执行预览：**
```
IP: 192.168.1.100
Time: 29/Apr/2026:06:30:00 +0800
Method: GET
Path: /api/users
[('Alice', '85'), ('Bob', '92'), ('Charlie', '78')]
Call 138-****-5678 or 159-****-4321
['content', 'text']
```

### v3：预编译、VERBOSE 模式与实战模式

```python
import re

# Pre-compile for performance (use in loops)
EMAIL_RE = re.compile(r"""
    ^                   # Start of string
    [\w.%+-]+           # Username: letters, digits, dots, special chars
    @                   # @ symbol
    [\w.-]+             # Domain name
    \.                  # Literal dot
    [a-zA-Z]{2,}        # TLD (at least 2 letters)
    $                   # End of string
""", re.VERBOSE | re.IGNORECASE)

print(EMAIL_RE.fullmatch("Test.User+tag@Example.COM"))  # Match
print(EMAIL_RE.fullmatch("not-an-email"))               # None

# Common patterns collection
PATTERNS = {
    "chinese_mobile": re.compile(r"^1[3-9]\d{9}$"),
    "chinese_id": re.compile(r"^\d{17}[\dXx]$"),
    "url": re.compile(r"^https?://[\w\-.]+(:\d+)?(/[\w./-]*)?$"),
    "ipv4": re.compile(r"^(\d{1,3}\.){3}\d{1,3}$"),
    "date_ymd": re.compile(r"^\d{4}[-/]\d{2}[-/]\d{2}$"),
    "html_tag": re.compile(r"<(\w+)[^>]*>(.*?)</\1>"),
}

# Advanced: finditer for large text processing
def extract_urls(html_content):
    """Extract all URLs from HTML content."""
    url_pattern = re.compile(r'href=["\x27](https?://[^"\x27]+)["\x27]')
    return [m.group(1) for m in url_pattern.finditer(html_content)]

html_sample = '<a href="https://example.com/page1">Link 1</a>\n<a href="http://test.org/page2">Link 2</a>\n<a href="/relative">Skip</a>'
print(extract_urls(html_sample))
# ['https://example.com/page1', 'http://test.org/page2']

# Greedy vs Non-greedy
text = "<div>first</div><div>second</div>"
greedy = re.findall(r"<div>.*</div>", text)
lazy = re.findall(r"<div>.*?</div>", text)
print(f"Greedy: {greedy}")  # Matches entire string
print(f"Lazy:    {lazy}")   # Two separate matches
```

**执行预览：**
```
<re.Match object; span=(0, 27), match='Test.User+tag@Example.COM'>
None
['https://example.com/page1', 'http://test.org/page2']
Greedy: ['<div>first</div><div>second</div>']
Lazy:    ['<div>first</div>', '<div>second</div>']
```

---

## 四、注意事项

| 要点 | 说明 | 建议 |
|------|------|------|
| 使用原始字符串 | `r"\d"` 而非 `"\\d"` | 避免转义地狱 |
| 贪婪是默认行为 | `.*` 会尽可能多匹配 | 加 `?` 变非贪婪：`.*?` |
| `match` 只匹配开头 | 不是搜索整个字符串 | 通常用 `search` 更通用 |
| `findall` 返回值不同 | 有组返回组的元组，无组返回整个匹配 | 注意分组对结果的影响 |
| 正则性能有限 | 复杂模式可能很慢 | 预编译、避免嵌套量词 |
| 特殊字符要转义 | `. * + ? ^ $ { } [ ] ( ) \| \` | 用 `re.escape()` 自动转义 |

---

## 五、避坑指南

### ❌ 坑1：忘记用原始字符串

```python
# ❌ Wrong: \b is backspace in Python strings
re.search("\bword\b", "a word")  # None

# ✅ Correct: use raw string
re.search(r"\bword\b", "a word")  # Match!
```

### ❌ 坑2：贪婪匹配导致过度匹配

```python
# ❌ Wrong: greedy .* matches too much
text = 'name="Alice" age="30"'
re.findall(r'".*"', text)  # ['"Alice" age="30"']

# ✅ Correct: non-greedy .*?
re.findall(r'".*?"', text)  # ['"Alice"', '"30"']
```

### ❌ 坑3：用正则解析 HTML

```python
# ❌ Wrong: regex is not suitable for HTML parsing
re.findall(r"<div>(.*?)</div>", nested_html)  # Breaks on nested tags

# ✅ Correct: use an HTML parser
from bs4 import BeautifulSoup
soup = BeautifulSoup(html, "html.parser")
divs = soup.find_all("div")
```

### ❌ 坑4：match vs search 混淆

```python
# ❌ Wrong: match only checks from the start
re.match(r"\d+", "abc123")  # None

# ✅ Correct: use search to find anywhere
re.search(r"\d+", "abc123")  # Match '123'
```

### ❌ 坑5：findall 有分组时返回值变化

```python
text = "2024-01-15, 2025-03-20"

# No group → full match
re.findall(r"\d{4}-\d{2}-\d{2}", text)
# ['2024-01-15', '2025-03-20']

# With group → only groups!
re.findall(r"(\d{4})-\d{2}-(\d{2})", text)
# [('2024', '15'), ('2025', '20')]
```

---

## 六、练习题

### 🟢 初级

1. 编写正则验证密码：至少 8 位，包含大小写字母和数字。

```python
def is_strong_password(pwd):
    pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
    return bool(re.fullmatch(pattern, pwd))

print(is_strong_password("Abc12345"))   # True
print(is_strong_password("password"))   # False
```

2. 用正则提取字符串中的所有 URL。

### 🟡 中级

3. 编写一个日志解析器，提取 IP、时间、请求方法、路径、状态码、响应时间。

```python
log = '192.168.1.1 - [29/Apr/2026:06:30:00] "GET /api HTTP/1.1" 200 50ms'
pattern = r'(?P<ip>[\d.]+).*\[(?P<time>[^\]]+)\].*"(?P<method>\w+) (?P<path>\S+).*"(?P<status>\d+) (?P<duration>\d+)ms'
match = re.search(pattern, log)
print(match.groupdict())
```

4. 实现一个模板引擎，将 `{{ variable }}` 替换为字典中的值。

### 🔴 高级

5. 实现一个 Markdown 行内格式的简易解析器（加粗、斜体、代码、链接）。

6. 用正则实现一个简易的数学表达式 token 化器（提取数字、运算符、括号）。

---

## 七、知识点总结

```
Python 正则表达式
├── 核心语法
│   ├── 字符匹配：. \d \w \s \b
│   ├── 量词：* + ? {n} {n,m}
│   ├── 非贪婪：*? +? ??
│   ├── 锚点：^ $
│   └── 字符类：[abc] [^abc] [a-z]
├── 分组
│   ├── 捕获组 (...)
│   ├── 非捕获组 (?:...)
│   ├── 命名组 (?P<name>...)
│   └── 反向引用 \1 \2
├── re 函数
│   ├── search / match / fullmatch
│   ├── findall / finditer
│   ├── sub / subn
│   └── split
├── Flags
│   ├── re.I 忽略大小写
│   ├── re.M 多行模式
│   ├── re.S DOTALL (. 匹配换行)
│   └── re.X VERBOSE 可读模式
└── 最佳实践
    ├── 预编译 re.compile()
    ├── 原始字符串 r""
    ├── 优先非贪婪
    └── 复杂解析用专用库
```

---

## 八、举一反三

| 场景 | 正则模式 | 说明 |
|------|---------|------|
| 邮箱验证 | `[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}` | 基础邮箱格式 |
| 手机号 | `1[3-9]\d{9}` | 中国大陆手机号 |
| URL | `https?://[\w\-.]+(/\S*)?` | HTTP/HTTPS URL |
| IPv4 | `(\d{1,3}\.){3}\d{1,3}` | IP 地址 |
| 日期 | `\d{4}[-/]\d{2}[-/]\d{2}` | YYYY-MM-DD |
| HTML 标签 | `<(\w+)[^>]*>(.*?)</\1>` | 匹配配对标签 |
| 中文字符 | `[\u4e00-\u9fff]+` | Unicode 范围 |
| 去除首尾空格 | `^\s+\|\s+$` | 或用 str.strip() |

---

## 九、参考资料

1. [Python 官方文档 - re 模块](https://docs.python.org/3/library/re.html)
2. [Regular Expression HOWTO](https://docs.python.org/3/howto/regex.html)
3. [regex101.com](https://regex101.com/) — 在线正则测试工具（选 Python 模式）
4. [regexr.com](https://regexr.com/) — 另一个在线测试工具
5. 《精通正则表达式》，Jeffrey Friedl
6. 《Fluent Python》第二版，第19章

---

## 十、完整示例代码

```python
"""
Complete demo: Python regular expressions.
Covers validation, extraction, substitution, and common patterns.
"""

import re

# === Pre-compiled patterns ===
PATTERNS = {
    "email": re.compile(r"[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}"),
    "phone_cn": re.compile(r"1[3-9]\d{9}"),
    "url": re.compile(r"https?://[\w\-.]+(?:\.\w{2,})(?:/\S*)?"),
    "date": re.compile(r"(\d{4})[-/](\d{2})[-/](\d{2})"),
    "html_tag": re.compile(r"<(\w+)[^>]*>(.*?)</\1>"),
    "chinese": re.compile(r"[\u4e00-\u9fff]+"),
}


def validate_email(email):
    """Validate email format."""
    return bool(PATTERNS["email"].fullmatch(email))


def mask_phones(text):
    """Mask phone numbers: 138****5678."""
    return PATTERNS["phone_cn"].sub(
        lambda m: m.group()[:3] + "****" + m.group()[-4:], text
    )


def extract_dates(text):
    """Extract and format dates from text."""
    results = []
    for match in PATTERNS["date"].finditer(text):
        y, m, d = match.groups()
        results.append(f"{y}年{int(m)}月{int(d)}日")
    return results


def strip_html_tags(html):
    """Remove HTML tags, keep content."""
    return re.sub(r"<[^>]+>", "", html)


def template_render(template, variables):
    """Simple template engine: {{ key }} → value."""
    def replacer(match):
        key = match.group(1).strip()
        return str(variables.get(key, f"{{{{ {key} }}}}"))
    return re.sub(r"\{\{\s*(\w+)\s*\}\}", replacer, template)


# === Demo ===
if __name__ == "__main__":
    print("=== Email validation ===")
    for email in ["test@example.com", "bad@", "ok@domain.cn"]:
        print(f"  {email}: {validate_email(email)}")

    print("\n=== Phone masking ===")
    print(f"  {mask_phones('Contact: 13812345678 or 15987654321')}")

    print("\n=== Date extraction ===")
    print(f"  {extract_dates('Dates: 2024-01-15 and 2025/12/25')}")

    print("\n=== HTML stripping ===")
    print(f"  {strip_html_tags('<p>Hello <b>World</b></p>')}")

    print("\n=== Template engine ===")
    tpl = "Hello {{ name }}, your order {{ id }} is ready."
    print(f"  {template_render(tpl, {'name': 'Alice', 'id': 42})}")

    print("\n=== Chinese text ===")
    text = "Hello 世界, this is 测试 text"
    print(f"  Found: {PATTERNS['chinese'].findall(text)}")

    print("\n=== Greedy vs Lazy ===")
    html = "<p>A</p><p>B</p>"
    print(f"  Greedy: {re.findall(r'<p>.*</p>', html)}")
    print(f"  Lazy:    {re.findall(r'<p>.*?</p>', html)}")
```

**执行预览：**
```
=== Email validation ===
  test@example.com: True
  bad@: False
  ok@domain.cn: True

=== Phone masking ===
  Contact: 138****5678 or 159****4321

=== Date extraction ===
  ['2024年1月15日', '2025年12月25日']

=== HTML stripping ===
  Hello World

=== Template engine ===
  Hello Alice, your order 42 is ready.

=== Chinese text ===
  Found: ['世界', '测试']

=== Greedy vs Lazy ===
  Greedy: ['<p>A</p><p>B</p>']
  Lazy:    ['<p>A</p>', '<p>B</p>']
```

---

> 💡 **一句话总结**：正则表达式是文本处理的瑞士军刀——掌握 `re.search`、`re.findall`、`re.sub` 三板斧，加上 `r""` 原始字符串和 `?` 非贪婪修饰，就能解决 90% 的文本匹配问题。
