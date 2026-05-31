---
title: "016 - JSON处理深入"
slug: "016-json"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.117+08:00"
updated_at: "2026-04-29T10:02:44.784+08:00"
reading_time: 18
tags: ["标准库"]
---

# 046 - JSON处理深入

> 难度：⭐⭐⭐ | 预计学习时间：30分钟

## 一、概念讲解

JSON（JavaScript Object Notation）是现代Web开发中最通用的数据交换格式。Go的 `encoding/json` 包提供了完整的JSON编解码支持，包括结构体标签映射、自定义编解码、流式处理等能力。

核心类型与函数：
- `json.Marshal(v)` / `json.Unmarshal(data, v)` — 一次性编解码
- `json.NewEncoder(w)` / `json.NewDecoder(r)` — 流式编解码
- `json.RawMessage` — 延迟解码的原始JSON字节
- 结构体标签 `json:"name,omitempty"` — 字段映射与空值控制

## 二、脑图

```
JSON处理
├── 基础编解码
│   ├── Marshal → []byte
│   ├── Unmarshal → struct/map
│   └── 缩进输出 MarshalIndent
├── 结构体标签
│   ├── json:"fieldName"
│   ├── json:",omitempty"
│   ├── json:"-" (忽略)
│   └── json:"-," (字段名为"-")
├── 自定义编解码
│   ├── json.Marshaler 接口
│   ├── json.Unmarshaler 接口
│   └── time.Time 示例
├── 动态JSON
│   ├── json.RawMessage
│   ├── map[string]any
│   └── any 处理未知结构
└── 流式编解码
    ├── Encoder (写入 io.Writer)
    ├── Decoder (读取 io.Reader)
    └── 大文件/网络流处理
```

## 三、完整Go代码

### v1: 基础Marshal/Unmarshal

```go
package main

import (
	"encoding/json"
	"fmt"
)

// User represents a basic user struct
type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email,omitempty"` // omit when empty
	Age   int    `json:"age"`
}

func main() {
	// Marshal struct to JSON
	user := User{ID: 1, Name: "Alice", Age: 30}
	data, err := json.MarshalIndent(user, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println("Marshal result:")
	fmt.Println(string(data))

	// Unmarshal JSON to struct
	jsonStr := `{"id":2,"name":"Bob","email":"bob@test.com","age":25}`
	var user2 User
	if err := json.Unmarshal([]byte(jsonStr), &user2); err != nil {
		panic(err)
	}
	fmt.Printf("\nUnmarshal result: %+v\n", user2)

	// omitempty: email is empty, so it won't appear
	user3 := User{ID: 3, Name: "Charlie", Age: 28}
	data3, _ := json.Marshal(user3)
	fmt.Printf("\nOmitEmpty demo: %s\n", string(data3))
}
```

**执行预览：**
```
Marshal result:
{
  "id": 1,
  "name": "Alice",
  "age": 30
}

Unmarshal result: {ID:2 Name:Bob Email:bob@test.com Age:25}

OmitEmpty demo: {"id":3,"name":"Charlie","age":28}
```

### v2: 自定义MarshalJSON + RawMessage

```go
package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Event with custom JSON marshaling
type Event struct {
	Name      string          `json:"name"`
	Timestamp time.Time       `json:"timestamp"`
	Details   json.RawMessage `json:"details"` // raw JSON payload
}

// Custom output: uppercase name, formatted time
func (e Event) MarshalJSON() ([]byte, error) {
	type Alias Event // prevent recursion
	return json.Marshal(&struct {
		*Alias
		Name      string `json:"name"`
		Timestamp string `json:"timestamp"`
	}{
		Alias:     (*Alias)(&e),
		Name:      strings.ToUpper(e.Name),
		Timestamp: e.Timestamp.Format("2006-01-02 15:04:05"),
	})
}

func main() {
	now := time.Date(2024, 6, 15, 10, 30, 0, 0, time.UTC)
	raw := json.RawMessage(`{"type":"click","x":100,"y":200}`)

	event := Event{Name: "userAction", Timestamp: now, Details: raw}
	data, _ := json.MarshalIndent(event, "", "  ")
	fmt.Println("Custom Marshal:")
	fmt.Println(string(data))

	// Unmarshal RawMessage - decode details later
	var event2 Event
	json.Unmarshal(data, &event2)
	fmt.Printf("\nRawMessage still raw: %s\n", string(event2.Details))

	// Now decode the details
	var details map[string]any
	json.Unmarshal(event2.Details, &details)
	fmt.Printf("Decoded details: %v\n", details)
}
```

**执行预览：**
```
Custom Marshal:
{
  "name": "USERACTION",
  "timestamp": "2024-06-15 10:30:00",
  "details": {"type":"click","x":100,"y":200}
}

RawMessage still raw: {"type":"click","x":100,"y":200}
Decoded details: map[type:click x:100 y:200]
```

### v3: 流式Encoder/Decoder + any处理

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

func main() {
	// Stream encoding: multiple objects to one writer
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	records := []map[string]any{
		{"name": "Alice", "score": 95.5},
		{"name": "Bob", "score": "A+"},
		{"name": "Charlie", "score": []int{88, 92, 100}},
	}
	for _, r := range records {
		if err := enc.Encode(r); err != nil {
			panic(err)
		}
	}
	fmt.Println("Stream encoded:")
	fmt.Println(buf.String())

	// Stream decoding: read objects one by one
	dec := json.NewDecoder(&buf)
	for {
		var result map[string]any
		if err := dec.Decode(&result); err == io.EOF {
			break
		} else if err != nil {
			panic(err)
		}
		fmt.Printf("Decoded: name=%v, score=%v (type: %T)\n",
			result["name"], result["score"], result["score"])
	}

	// Handle completely unknown JSON structure
	unknown := `{"anything":"goes","nested":{"deep":true},"list":[1,2,3]}`
	dec2 := json.NewDecoder(strings.NewReader(unknown))
	dec2.UseNumber() // keep numbers as json.Number instead of float64
	var parsed any
	dec2.Decode(&parsed)
	fmt.Printf("\nUnknown structure: %+v\n", parsed)
}
```

**执行预览：**
```
Stream encoded:
{"name":"Alice","score":95.5}
{"name":"Bob","score":"A+"}
{"name":"Charlie","score":[88,92,100]}

Decoded: name=Alice, score=95.5 (type: float64)
Decoded: name=Bob, score=A+ (type: string)
Decoded: name=Charlie, score=[88 92 100] (type: []interface {})

Unknown structure: map[anything:goes list:[1 2 3] nested:map[deep:true]]
```

## 四、注意事项

| 要点 | 说明 |
|------|------|
| 字段必须导出 | 未导出字段（小写）不会被json处理 |
| 指针vs值 | nil指针输出null，零值会正常输出 |
| omitempty判断 | 0、""、nil、false、空slice/map均视为空 |
| float64精度 | 默认Unmarshal到any时数字是float64，用UseNumber避免 |
| 嵌入结构体 | 匿名嵌入的字段会被"提升"到外层 |
| 循环引用 | 互相引用的结构体Marshal会无限递归导致panic |

## 五、避坑指南

❌ 小写字段期望被序列化：
```go
type Bad struct { name string } // json看不到！
```
✅ 必须大写导出：
```go
type Good struct { Name string `json:"name"` }
```

❌ Unmarshal传值不传指针：
```go
json.Unmarshal(data, user) // 修改的是副本！
```
✅ 传指针：
```go
json.Unmarshal(data, &user)
```

❌ 忽略数字精度问题：
```go
var v any; json.Unmarshal([]byte("9999999999999999"), &v)
// v = 1e+16 (float64精度丢失)
```
✅ 使用 UseNumber：
```go
dec := json.NewDecoder(r); dec.UseNumber()
```

❌ time.Time直接用默认格式：
```go
// 默认输出 "2024-06-15T10:30:00Z" (RFC3339)
```
✅ 自定义MarshalJSON控制格式

## 六、练习题

🟢 **基础题：** 定义一个Config结构体，包含Hostname(IP默认"localhost")、Port(默认8080)、Debug(bool默认false)，实现JSON反序列化后打印配置。

🟡 **进阶题：** 实现一个通用的JSON消息路由：接收 `{"type":"xxx","data":{...}}` 格式，根据type字段将data解码到不同的结构体。

🔴 **挑战题：** 实现一个JSON流式处理器，从stdin逐行读取JSON，过滤出score>80的记录，写入stdout（每行一个JSON）。

## 七、知识点总结

```
JSON处理知识树
├── 编码(Marshal)
│   ├── 基本类型 → JSON对应类型
│   ├── struct → object (按标签映射)
│   ├── slice/array → array
│   ├── map → object
│   ├── nil → null
│   └── MarshalIndent 美化输出
├── 解码(Unmarshal)
│   ├── 目标必须是指针
│   ├── 类型自动转换(数字→string等)
│   ├── 未知字段默认忽略
│   └── DisallowUnknownFields() 严格模式
├── 高级特性
│   ├── RawMessage 延迟解码
│   ├── 自定义 Marshaler/Unmarshaler
│   ├── Encoder/Decoder 流式处理
│   └── UseNumber() 精确数字
└── 实战模式
    ├── 部分解码(先RawMessage再按需)
    ├── 多态消息(type字段分发)
    └── 大文件流式处理
```

## 八、举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| 配置文件读取 | json.Unmarshal + 默认值合并 | 先设默认再合并 |
| API响应解析 | 定义Response结构体 + RawMessage | data字段延迟解码 |
| 日志JSON化 | json.Marshal或自定义Marshaler | 控制时间格式 |
| 前后端通信 | json.NewEncoder(w).Encode(v) | 流式输出到http response |
| 消息队列 | type字段 + RawMessage路由 | 按类型分发到不同handler |

## 九、参考资料

- [Go官方文档：encoding/json](https://pkg.go.dev/encoding/json)
- [Go by Example: JSON](https://gobyexample.com/json)
- [Effective Go: JSON](https://go.dev/doc/effective_go#json)

## 十、代码演进总结

| 版本 | 重点 | 适用场景 |
|------|------|----------|
| v1 | 基础Marshal/Unmarshal + 标签 | 简单配置、API交互 |
| v2 | 自定义编解码 + RawMessage | 需要特殊格式、多态消息 |
| v3 | 流式Encoder/Decoder + any | 大文件、网络流、未知结构 |
