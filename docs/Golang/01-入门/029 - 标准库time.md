---
title: "029 - 标准库time"
slug: "029-time"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.913+08:00"
updated_at: "2026-04-29T10:02:44.638+08:00"
reading_time: 25
tags: ["Go基础"]
---


# 029 - 标准库 time

> 难度：⭐⭐⭐（中高级）
>
> 掌握 Go 时间处理的完整体系：创建、解析、格式化、运算、定时器与时区处理。

---

## 一、概念讲解

Go 的 `time` 包是标准库中最常用也最容易踩坑的包之一。Go 采用了独特的时间格式化方式——**用参考时间 `Mon Jan 2 15:04:05 MST 2006` 来定义布局**，而不是传统的 `%Y-%m-%d`。

**核心概念：**

- **Time 类型**：表示一个时间瞬间，包含日期和时刻
- **Duration**：表示时间间隔，单位纳秒（`time.Second` = 1e9 ns）
- **Location**：时区信息
- **Timer/Ticker**：定时器和周期触发器

---

## 二、脑图

```
                  time 包
                    │
      ┌─────────────┼─────────────┐
      │             │             │
   创建/获取      格式化/解析     运算/定时
      │             │             │
  ┌───┼───┐    ┌────┼────┐   ┌───┼───┐
  │   │   │    │    │    │   │   │   │
 Now Date Unix Format Parse  Add Sub Ticker
      │          │          │   │
  UnixMilli   布局2006   Duration Sleep
      │       Location     Equal
   ParseInLocation           Before
                              After
```

---

## 三、完整代码

```go
package main

import (
	"fmt"
	"time"
)

func main() {
	// ========== Getting current time ==========
	now := time.Now()
	fmt.Printf("Now:          %v\n", now)
	fmt.Printf("Type:         %T\n", now)

	// ========== time.Date: construct a specific time ==========
	birthday := time.Date(2000, 1, 15, 10, 30, 0, 0, time.Local)
	fmt.Printf("Birthday:     %v\n", birthday)
	fmt.Printf("Year: %d, Month: %d, Day: %d\n",
		birthday.Year(), birthday.Month(), birthday.Day())
	fmt.Printf("Hour: %d, Minute: %d, Second: %d\n",
		birthday.Hour(), birthday.Minute(), birthday.Second())
	fmt.Printf("Weekday:      %v\n", birthday.Weekday())

	// ========== Unix timestamps ==========
	fmt.Printf("Unix (sec):   %d\n", now.Unix())
	fmt.Printf("UnixMilli:    %d\n", now.UnixMilli())
	fmt.Printf("UnixMicro:    %d\n", now.UnixMicro())
	fmt.Printf("UnixNano:     %d\n", now.UnixNano())

	// From timestamp back to Time
	fromUnix := time.Unix(1700000000, 0)
	fmt.Printf("From Unix:    %v\n", fromUnix)

	// ========== Format: time → string ==========
	// Go reference time: Mon Jan 2 15:04:05 MST 2006
	fmt.Printf("Date only:    %s\n", now.Format("2006-01-02"))
	fmt.Printf("Time only:    %s\n", now.Format("15:04:05"))
	fmt.Printf("DateTime:     %s\n", now.Format("2006-01-02 15:04:05"))
	fmt.Printf("ISO 8601:     %s\n", now.Format(time.RFC3339))
	fmt.Printf("Custom:       %s\n", now.Format("2006/01/02 03:04 PM"))

	// ========== Parse: string → time ==========
	t1, err := time.Parse("2006-01-02", "2024-06-15")
	if err != nil {
		fmt.Println("Parse error:", err)
	} else {
		fmt.Printf("Parsed date:  %v\n", t1)
	}

	t2, _ := time.Parse(time.RFC3339, "2024-06-15T08:30:00Z")
	fmt.Printf("Parsed RFC:   %v\n", t2)

	// ParseInLocation: parse with timezone
	loc, _ := time.LoadLocation("Asia/Shanghai")
	t3, _ := time.ParseInLocation("2006-01-02 15:04:05", "2024-06-15 08:30:00", loc)
	fmt.Printf("Shanghai:     %v\n", t3)

	locNY, _ := time.LoadLocation("America/New_York")
	fmt.Printf("Same in NY:   %v\n", t3.In(locNY))

	// ========== Duration ==========
	d1 := 2*time.Hour + 30*time.Minute
	fmt.Printf("Duration:     %v\n", d1)
	fmt.Printf("Hours:        %.2f\n", d1.Hours())
	fmt.Printf("Minutes:      %.2f\n", d1.Minutes())
	fmt.Printf("Seconds:      %.2f\n", d1.Seconds())

	// ========== Time arithmetic: Add / Sub ==========
	later := now.Add(24 * time.Hour)
	fmt.Printf("Tomorrow:     %v\n", later.Format("2006-01-02"))

	ago := now.Add(-7 * 24 * time.Hour)
	fmt.Printf("Last week:    %v\n", ago.Format("2006-01-02"))

	diff := later.Sub(now)
	fmt.Printf("Diff:         %v (%.0f hours)\n", diff, diff.Hours())

	// ========== Comparison: Before / After / Equal ==========
	fmt.Printf("Before:       %v\n", now.Before(later))
	fmt.Printf("After:        %v\n", later.After(now))

	// Equal compares both time and location
	tUTC := time.Date(2024, 1, 1, 8, 0, 0, 0, time.UTC)
	tLocal := time.Date(2024, 1, 1, 8, 0, 0, 0, time.Local)
	fmt.Printf("Equal:        %v\n", tUTC.Equal(tLocal)) // may differ by timezone

	// ========== Timer: one-shot ==========
	timer := time.NewTimer(100 * time.Millisecond)
	<-timer.C
	fmt.Println("Timer fired!")

	// Stop a timer
	timer2 := time.NewTimer(5 * time.Second)
	stopped := timer2.Stop()
	fmt.Printf("Timer stopped: %v\n", stopped)

	// ========== Ticker: periodic ==========
	ticker := time.NewTicker(50 * time.Millisecond)
	done := make(chan bool)
	go func() {
		count := 0
		for {
			select {
			case <-ticker.C:
				count++
				if count >= 3 {
					done <- true
					return
				}
			}
		}
	}()
	<-done
	ticker.Stop()
	fmt.Println("Ticker completed 3 ticks")

	// ========== time.After / time.Sleep ==========
	// time.After returns a channel that fires after duration
	select {
	case <-time.After(50 * time.Millisecond):
		fmt.Println("After fired")
	}

	// ========== Performance measurement ==========
	start := time.Now()

	// Simulate work
	sum := 0
	for i := 0; i < 1000000; i++ {
		sum += i
	}

	elapsed := time.Since(start)
	fmt.Printf("Elapsed:      %v\n", elapsed)
	_ = sum

	// ========== Truncate / Round ==========
	t4 := time.Date(2024, 6, 15, 10, 37, 23, 0, time.UTC)
	fmt.Printf("Truncate(1h): %v\n", t4.Truncate(time.Hour).Format("15:04:05"))
	fmt.Printf("Round(30m):   %v\n", t4.Round(30*time.Minute).Format("15:04:05"))

	// ========== Common date operations ==========
	// Get start of today
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	fmt.Printf("Start of day: %v\n", today.Format("2006-01-02 15:04:05"))

	// Get start of month
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	fmt.Printf("Start month:  %v\n", startOfMonth.Format("2006-01-02"))
}
```

### 执行预览

```
Now:          2024-06-15 14:30:45.123456789 +0800 CST
Type:         time.Time
Birthday:     2000-01-15 10:30:00 +0800 CST
Year: 2000, Month: 1, Day: 15
Hour: 10, Minute: 30, Second: 0
Weekday:      Saturday
Unix (sec):   1718433045
UnixMilli:    1718433045123
UnixMicro:    1718433045123456
UnixNano:     1718433045123456789
From Unix:    2023-11-14 22:13:20 +0800 CST
Date only:    2024-06-15
Time only:    14:30:45
DateTime:     2024-06-15 14:30:45
ISO 8601:     2024-06-15T14:30:45+08:00
Custom:       2024/06/15 02:30 PM
Parsed date:  2024-06-15 00:00:00 +0000 UTC
Parsed RFC:   2024-06-15 08:30:00 +0000 UTC
Shanghai:     2024-06-15 08:30:00 +0800 CST
Same in NY:   2024-06-14 20:30:00 -0400 EDT
Duration:     2h30m0s
Hours:        2.50
Minutes:      150.00
Seconds:      9000.00
Tomorrow:     2024-06-16
Last week:    2024-06-08
Diff:         24h0m0s (24 hours)
Before:       true
After:        true
Timer fired!
Timer stopped: true
Ticker completed 3 ticks
After fired
Elapsed:      1.234ms
Truncate(1h): 10:00:00
Round(30m):   10:30:00
Start of day: 2024-06-15 00:00:00
Start month:  2024-06-01
```

---

## 四、注意事项

| 项目 | 说明 |
|------|------|
| 格式化布局不是 `YYYY-MM-DD` | Go 使用参考时间 `2006-01-02 15:04:05` 定义布局 |
| `time.Parse` 默认 UTC | 不指定 Location 时解析结果为 UTC，用 `ParseInLocation` 指定时区 |
| `Month` 是类型不是 int | `time.January` 类型是 `time.Month`，打印时自动转字符串 |
| `Sub` 不是绝对差 | `a.Sub(b)` 可能为负数，用 `.Abs()` (Go 1.22+) 取绝对值 |
| Timer 的 `Stop` 可能返回 false | 如果 timer 已经触发或被 stop 过 |
| Ticker 需要手动 Stop | 否则 goroutine 泄漏 |
| `time.Sleep` 不受 context 取消 | 需要可取消的等待用 `select + time.After` |
| `time.Now()` 单调时钟 | Go 内部使用单调时钟，`Sub` 不受时区跳变影响 |

---

## 五、避坑指南

❌ **用 `YYYY-MM-DD` 格式化**
```go
// Bad: this is NOT how Go formats time
now.Format("YYYY-MM-DD")
// Output: "2024-06-15" only if you're extremely lucky... actually outputs garbage
```

✅ **用 Go 的参考时间布局**
```go
// Good: 2006-01-02 is the reference date
now.Format("2006-01-02")
```

---

❌ **Parse 不带时区得到 UTC，当本地时间用**
```go
t, _ := time.Parse("2006-01-02 15:04:05", "2024-06-15 08:30:00")
// t is UTC, not local! Will cause off-by-8h bugs in China
```

✅ **使用 ParseInLocation**
```go
loc, _ := time.LoadLocation("Asia/Shanghai")
t, _ := time.ParseInLocation("2006-01-02 15:04:05", "2024-06-15 08:30:00", loc)
```

---

❌ **用 `==` 比较时间**
```go
// Bad: == compares both wall clock and monotonic clock, may not work as expected
if t1 == t2 { ... }
```

✅ **用 Equal/Before/After**
```go
if t1.Equal(t2) { ... }
if t1.Before(t2) { ... }
```

---

## 六、练习题

### 🟢 初级
1. 打印当前时间的格式 `2024年06月15日 星期六 14:30:45`
2. 计算 `1990-01-01` 到今天经过了多少天

### 🟡 中级
3. 实现一个函数 `isWorkday(t time.Time) bool`，判断给定时间是否为工作日（周一到周五）
4. 使用 Ticker 每秒打印一次当前时间，5 次后退出

### 🔴 高级
5. 实现一个简易 cron：接受 `@every 5s` 或 `@hourly` 格式，周期性执行函数，支持 context 取消

---

## 七、知识点总结

```
time 包
├── 创建
│   ├── Now()           — 当前时间
│   ├── Date(y,m,d,...) — 构造时间
│   └── Unix(sec, nsec) — 从时间戳创建
├── 格式化
│   ├── Format(layout)  — time → string
│   ├── Parse(layout, s)— string → time (UTC)
│   └── ParseInLocation — 带时区解析
├── 运算
│   ├── Add(d)          — 加 Duration
│   ├── Sub(t)          — 差值 Duration
│   ├── AddDate(y,m,d)  — 加年月日
│   ├── Truncate(d)     — 向下截断
│   └── Round(d)        — 四舍五入
├── 比较
│   ├── Before(t)       — 是否在 t 之前
│   ├── After(t)        — 是否在 t 之后
│   └── Equal(t)        — 是否相等
├── Duration
│   ├── time.Second/Minute/Hour
│   ├── Hours()/Minutes()/Seconds()
│   └── time.Since(t) = Now().Sub(t)
├── 定时
│   ├── NewTimer(d)     — 一次性定时器
│   ├── NewTicker(d)    — 周期定时器
│   ├── After(d)        — 返回 channel
│   └── Sleep(d)        — 阻塞等待
└── 时区
    ├── time.UTC
    ├── time.Local
    ├── LoadLocation(name)
    └── t.In(loc)        — 转换时区显示
```

---

## 八、举一反三

| 场景 | 函数/方法 | 说明 |
|------|-----------|------|
| 接口耗时统计 | `time.Since(start)` | 最常用性能测量 |
| 定时任务 | `NewTicker` + goroutine | 周期性执行 |
| 超时控制 | `select + time.After` | 配合 channel 使用 |
| 日志时间戳 | `Format(time.RFC3339)` | 标准格式 |
| 缓存过期 | `time.Now().Add(ttl)` | 计算过期时间点 |
| 用户友好显示 | `Sub` 计算相对时间 | "3 分钟前" |
| 跨时区业务 | `LoadLocation + In` | 国际化必备 |

---

## 九、参考资料

- [time 官方文档](https://pkg.go.dev/time)
- [Go 时间格式化揭秘](https://go.dev/src/time/format.go)
- [Go 1.9 单调时钟](https://go.dev/design/exp/monotonic-clock)

---

## 十、代码演进

### v1：基础时间获取与格式化
```go
package main

import (
    "fmt"
    "time"
)

func main() {
    now := time.Now()
    fmt.Println(now.Format("2006-01-02 15:04:05"))
}
```

### v2：时间运算与解析
```go
package main

import (
    "fmt"
    "time"
)

func main() {
    now := time.Now()
    tomorrow := now.Add(24 * time.Hour)
    fmt.Println("Tomorrow:", tomorrow.Format("2006-01-02"))

    t, _ := time.Parse("2006-01-02", "2024-12-25")
    days := t.Sub(now).Hours() / 24
    fmt.Printf("Days to Christmas: %.0f\n", days)
}
```

### v3：完整时间工具集（定时器、时区、性能测量）
（即上方完整代码，涵盖创建、解析、格式化、运算、定时器、时区、性能测量）
