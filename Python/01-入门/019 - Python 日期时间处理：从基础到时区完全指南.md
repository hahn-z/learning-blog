---
title: "019 - Python 日期时间处理：从基础到时区完全指南"
slug: "019-datetime"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.313+08:00"
updated_at: "2026-04-29T10:02:47.411+08:00"
reading_time: 21
tags: []
---

## 📊 难度标注

> **难度等级：** ⭐⭐☆☆☆（初级）
> **前置知识：** Python基础语法、字符串操作
> **预计学习时间：** 30-40分钟
> **适用场景：** 日志记录、定时任务、数据清洗、时间计算

---

## 📖 概念讲解

### 什么是日期时间处理？

日期时间处理是编程中最常见的需求之一——日志需要时间戳、数据库需要记录创建时间、定时任务需要判断执行时机。Python 标准库提供了强大的 `datetime` 模块来处理这些场景。

### 核心对象关系

```
datetime 模块核心类：
├── date        → 日期（年、月、日）
├── time        → 时间（时、分、秒、微秒）
├── datetime    → 日期 + 时间（最常用）
├── timedelta   → 时间差（用于计算）
└── timezone    → 时区（配合 datetime 使用）
```

**关键理解：**
- `datetime` 对象是**不可变的**（immutable），修改操作返回新对象
- `naive` vs `aware`：无时区信息 vs 有时区信息
- 时间戳（timestamp）是 UTC 1970-01-01 00:00:00 到现在的秒数

---

## 🧠 知识脑图

```
Python datetime
├── 获取时间
│   ├── datetime.now()        → 当前本地时间
│   ├── datetime.today()      → 同 now()
│   ├── datetime.utcnow()     → UTC时间(已弃用)
│   └── date.today()          → 当前日期
├── 创建对象
│   ├── datetime(2024,1,1,12,0)
│   ├── date(2024,1,1)
│   └── time(12,30,0)
├── 格式化 ↔ 解析
│   ├── strftime()  → datetime → 字符串
│   ├── strptime()  → 字符串 → datetime
│   └── 格式化符号: %Y %m %d %H %M %S
├── 时间计算
│   ├── timedelta(days=1)
│   ├── dt1 - dt2 → timedelta
│   └── dt + timedelta → 新datetime
├── 时间戳
│   ├── timestamp()  → dt → float
│   └── fromtimestamp() → float → dt
└── 时区
    ├── timezone(timedelta(hours=8))
    ├── astimezone() → 转换时区
    └── pytz / zoneinfo
```

---

## 💻 完整代码示例

### v1 基础：获取与格式化

```python
# v1: Basic datetime operations - get, format, parse
from datetime import datetime, date, time, timedelta

# Get current time
now = datetime.now()
print(f"Current datetime: {now}")
print(f"Current date: {now.date()}")
print(f"Current time: {now.time()}")

# Format datetime to string
formatted = now.strftime("%Y-%m-%d %H:%M:%S")
print(f"Formatted: {formatted}")

# Parse string to datetime
parsed = datetime.strptime("2024-06-15 14:30:00", "%Y-%m-%d %H:%M:%S")
print(f"Parsed: {parsed}")

# Common format examples
print(now.strftime("%Y年%m月%d日 %A"))      # 2024年06月15日 Saturday
print(now.strftime("%Y-%m-%d %I:%M %p"))    # 12-hour format with AM/PM
print(now.strftime("%j"))                    # Day of year (001-366)
```

### v2 进阶：时间计算与时间戳

```python
# v2: Time calculations and timestamps
from datetime import datetime, timedelta, timezone

now = datetime.now()

# --- Timedelta calculations ---
tomorrow = now + timedelta(days=1)
yesterday = now - timedelta(days=1)
next_week = now + timedelta(weeks=1)
print(f"Tomorrow: {tomorrow}")
print(f"Yesterday: {yesterday}")

# Difference between two datetimes
dt1 = datetime(2024, 1, 1)
dt2 = datetime(2024, 12, 31)
diff = dt2 - dt1
print(f"Days between: {diff.days} days")

# --- Timestamp operations ---
ts = now.timestamp()
print(f"Timestamp: {ts}")
dt_from_ts = datetime.fromtimestamp(ts)
print(f"From timestamp: {dt_from_ts}")

# --- Useful calculations ---
new_year = datetime(now.year + 1, 1, 1)
days_left = (new_year - now).days
print(f"Days until New Year: {days_left}")

future = now + timedelta(days=100)
print(f"100 days later: {future.strftime('%Y-%m-%d %A')}")
```

### v3 高级：时区处理

```python
# v3: Timezone handling with zoneinfo (Python 3.9+)
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

# Create timezone-aware datetime
utc_now = datetime.now(timezone.utc)
print(f"UTC now: {utc_now}")

# Timezone conversion
shanghai_tz = ZoneInfo("Asia/Shanghai")
ny_tz = ZoneInfo("America/New_York")

shanghai_time = utc_now.astimezone(shanghai_tz)
ny_time = utc_now.astimezone(ny_tz)
print(f"Shanghai: {shanghai_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
print(f"New York: {ny_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")

# Create datetime in specific timezone
meeting = datetime(2024, 6, 15, 14, 0, tzinfo=shanghai_tz)
meeting_ny = meeting.astimezone(ny_tz)
print(f"Meeting Shanghai: {meeting}")
print(f"Meeting New York: {meeting_ny}")

# Calculate time across timezones
tokyo_tz = ZoneInfo("Asia/Tokyo")
london_tz = ZoneInfo("Europe/London")
tokyo_now = datetime.now(tokyo_tz)
london_now = tokyo_now.astimezone(london_tz)
print(f"Tokyo: {tokyo_now.strftime('%H:%M')}")
print(f"London: {london_now.strftime('%H:%M')}")
```

---

## 👀 执行预览

```
Current datetime: 2024-06-15 14:30:00.123456
Current date: 2024-06-15
Current time: 14:30:00.123456
Formatted: 2024-06-15 14:30:00
Parsed: 2024-06-15 14:30:00
2024年06月15日 Saturday
2024-06-15 02:30 PM
167

Tomorrow: 2024-06-16 14:30:00.123456
Yesterday: 2024-06-14 14:30:00.123456
Days between: 365 days
Timestamp: 1718428200.123456
From timestamp: 2024-06-15 14:30:00.123456
Days until New Year: 200
100 days later: 2024-09-23 Sunday

UTC now: 2024-06-15 06:30:00+00:00
Shanghai: 2024-06-15 14:30:00 CST
New York: 2024-06-15 02:30:00 EDT
Meeting Shanghai: 2024-06-15 14:00:00+08:00
Meeting New York: 2024-06-15 02:00:00-04:00
Tokyo: 15:30
London: 07:30
```

---

## ⚠️ 注意事项

| 场景 | 注意点 | 建议 |
|------|--------|------|
| 时区 | naive datetime 没有时区信息 | 服务端始终使用 aware datetime |
| 格式化 | `%m` 是月份，`%M` 是分钟 | 注意大小写区分 |
| 月份范围 | month 范围 1-12 | 创建时越界会抛 ValueError |
| UTC vs 本地 | `utcnow()` 在 3.12 已弃用 | 用 `now(timezone.utc)` 替代 |
| timedelta 精度 | 最小单位微秒 | 不支持月/年（天数不固定） |
| 字符串解析 | strptime 格式必须完全匹配 | 不匹配会抛 ValueError |
| 闰秒 | Python datetime 不处理闰秒 | 需要用 time 模块处理 |
| 序列化 | datetime 不能直接 JSON 序列化 | 转为 ISO 格式字符串 |

---

## 🚫 避坑指南

### ❌ 混用 naive 和 aware datetime
```python
# Wrong: comparing naive and aware datetime
naive = datetime.now()
aware = datetime.now(timezone.utc)
# naive > aware  → TypeError!
```
✅ **正确做法：** 统一使用 aware datetime
```python
# Correct: both are timezone-aware
dt1 = datetime.now(timezone.utc)
dt2 = datetime.now(ZoneInfo("Asia/Shanghai"))
print(dt1 < dt2)  # Works fine
```

### ❌ 手动计算时区偏移
```python
# Wrong: manual offset
utc_time = datetime.utcnow()
beijing = utc_time + timedelta(hours=8)  # Ignores DST!
```
✅ **正确做法：** 使用 zoneinfo
```python
# Correct: proper timezone conversion
from zoneinfo import ZoneInfo
utc_time = datetime.now(timezone.utc)
beijing = utc_time.astimezone(ZoneInfo("Asia/Shanghai"))
```

### ❌ timedelta 不支持月/年
```python
# Wrong: timedelta doesn't support months
next_month = now + timedelta(months=1)  # TypeError!
```
✅ **正确做法：** 手动计算月份
```python
# Correct: manual month calculation
month = now.month + 1
year = now.year
if month > 12:
    month = 1
    year += 1
next_month = now.replace(year=year, month=month)
```

---

## 🏋️ 练习题

### 🟢 入门级

**题目1：** 写一个函数，接收生日字符串 `"2000-01-15"`，返回当前年龄和距离下次生日的天数。

```python
from datetime import datetime

def birthday_info(birthday_str):
    bday = datetime.strptime(birthday_str, "%Y-%m-%d")
    today = datetime.today()
    age = today.year - bday.year - ((today.month, today.day) < (bday.month, bday.day))
    next_bday = bday.replace(year=today.year)
    if next_bday < today:
        next_bday = next_bday.replace(year=today.year + 1)
    days_until = (next_bday - today).days
    return age, days_until

print(birthday_info("2000-01-15"))
```

**题目2：** 将时间戳 `1718428200` 转为 `"2024-06-15 14:30:00"` 格式字符串。

### 🟡 进阶级

**题目3：** 写一个函数，计算任意两个日期之间有多少个工作日（周一到周五）。

```python
from datetime import datetime, timedelta

def workdays(start, end):
    days = (end - start).days + 1
    count = sum(1 for d in (start + timedelta(i) for i in range(days)) if d.weekday() < 5)
    return count

print(workdays(datetime(2024, 6, 10), datetime(2024, 6, 16)))
```

**题目4：** 实现一个 `format_relative_time(dt)` 函数，返回相对时间描述如"3分钟前"、"2小时前"、"昨天"。

### 🔴 挑战级

**题目5：** 实现一个跨时区会议时间转换器：输入上海时间，同时输出纽约、伦敦、东京的对应时间。

---

## 🌳 知识点总结

```
datetime 模块
├── 基础对象
│   ├── date → 年月日
│   ├── time → 时分秒
│   ├── datetime → 完整时间
│   └── timedelta → 时间差
├── 核心操作
│   ├── 获取 → now() / today()
│   ├── 格式化 → strftime()
│   ├── 解析 → strptime()
│   ├── 计算 → + / - timedelta
│   └── 时间戳 → timestamp() / fromtimestamp()
├── 时区处理
│   ├── timezone → 固定偏移时区
│   ├── ZoneInfo → IANA 时区数据库
│   └── astimezone() → 时区转换
└── 常用格式符
    ├── %Y→年 %m→月 %d→日
    ├── %H→时(24) %M→分 %S→秒
    ├── %I→时(12) %p→AM/PM
    └── %A→星期 %B→月份名
```

---

## 🔗 举一反三

| 技术点 | 本文用法 | 扩展场景 |
|--------|---------|---------|
| strftime | 格式化当前时间 | 日志文件名按日期命名 `app-%Y%m%d.log` |
| timedelta | 加减天数 | 定时任务：每7天清理过期数据 |
| timestamp | 获取时间戳 | 缓存过期判断、API签名 |
| ZoneInfo | 时区转换 | 国际化应用显示用户本地时间 |
| strptime | 解析日期字符串 | CSV/日志中提取日期 |
| weekday() | 判断星期几 | 排班系统、营业时间判断 |
| replace() | 修改日期部分 | 重置时间为零点 `dt.replace(hour=0)` |
| isoformat() | ISO格式输出 | REST API 时间字段标准化 |

---

## 📚 参考资料

- [Python datetime 官方文档](https://docs.python.org/3/library/datetime.html)
- [zoneinfo — IANA 时区数据库](https://docs.python.org/3/library/zoneinfo.html)
- [PEP 495 – Local Time Disambiguation](https://peps.python.org/pep-0495/)
- [dateutil 第三方库](https://dateutil.readthedocs.io/) — 更强大的日期解析

---

## 🔄 代码演进

| 版本 | 重点 | 适用场景 |
|------|------|---------|
| v1 基础版 | 获取时间、格式化、解析 | 日常脚本、日志记录 |
| v2 进阶版 | 时间差计算、时间戳 | 任务调度、倒计时、数据统计 |
| v3 高级版 | 时区处理、ZoneInfo | 国际化应用、跨时区协作 |

**演进路径：** v1 满足 80% 场景 → v2 解决计算需求 → v3 处理时区问题。实际开发中，从 v1 开始，按需升级。
