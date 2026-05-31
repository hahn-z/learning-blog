---
title: "017 - Gin WebSocket 实时通信"
slug: "017-gin-websocket"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:13:29.367+08:00"
updated_at: "2026-04-29T10:02:45.709+08:00"
reading_time: 28
tags: []
---

# 017 - Gin WebSocket 实时通信

> **难度：⭐⭐⭐⭐** | **预计阅读：20 分钟**
>
> 使用 gorilla/websocket 在 Gin 中实现 WebSocket 实时通信，包括连接管理、广播、房间模式和聊天室实战。

---

## 一、概念讲解

WebSocket 是一种在单个 TCP 连接上实现全双工通信的协议。与 HTTP 的请求-响应模式不同，WebSocket 允许服务端主动推送数据。

**HTTP vs WebSocket：**

```
HTTP:       Client → Request → Server → Response → Client（每次都要重新连接）
WebSocket:  Client → Handshake → Server ⇄ 双向通信 ⇄（一次连接，持续通信）
```

**核心概念：**
- **升级握手**：HTTP 请求带上 `Upgrade: websocket` 头，服务端返回 101 状态码
- **消息帧**：文本帧（string）和二进制帧（[]byte）
- **Ping/Pong**：心跳机制，保持连接活跃
- **房间模式**：将连接分组，实现定向广播

---

## 二、脑图

```
WebSocket 实时通信
├── 基础
│   ├── HTTP 升级 WebSocket
│   ├── Upgrader 配置
│   └── 消息读写 (ReadJSON/WriteJSON)
├── 连接管理
│   ├── 注册/注销
│   ├── 心跳检测 (Ping/Pong)
│   └── 断线重连
├── 消息模式
│   ├── 广播 (Broadcast)
│   ├── 单播 (Unicast)
│   └── 房间 (Room/Group)
└── 实战
    ├── 聊天室
    ├── 在线状态
    └── 消息持久化
```

---

## 三、完整代码

### v1：基础 WebSocket 连接

```go
package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for development
	CheckOrigin: func(r *http.Request) bool { return true },
}

func handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Upgrade error: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("Client connected: %s", c.ClientIP())

	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v", err)
			break
		}
		log.Printf("Received: %s", msg)

		// Echo back
		if err := conn.WriteMessage(messageType, msg); err != nil {
			log.Printf("Write error: %v", err)
			break
		}
	}
}

func main() {
	r := gin.Default()
	r.GET("/ws", handleWebSocket)
	log.Println("Server on :8080")
	r.Run(":8080")
}
```

### v2：聊天室 + 广播 + 连接管理

```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// Message represents a chat message
type Message struct {
	Type    string `json:"type"`    // "join", "leave", "chat", "system"
	User    string `json:"user"`
	Content string `json:"content"`
	Time    string `json:"time"`
}

// Client wraps a websocket connection
type Client struct {
	Conn *websocket.Conn
	User string
	Send chan Message
}

// Hub manages all connected clients
type Hub struct {
	clients map[*Client]bool
	mu      sync.RWMutex
}

var hub = &Hub{clients: make(map[*Client]bool)}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	h.clients[client] = true
	count := len(h.clients)
	h.mu.Unlock()

	h.Broadcast(Message{
		Type:    "system",
		Content: client.User + " joined (" + intToStr(count) + " online)",
		Time:    time.Now().Format("15:04:05"),
	})
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.Send)
	}
	count := len(h.clients)
	h.mu.Unlock()

	h.Broadcast(Message{
		Type:    "system",
		Content: client.User + " left (" + intToStr(count) + " online)",
		Time:    time.Now().Format("15:04:05"),
	})
}

func (h *Hub) Broadcast(msg Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		select {
		case client.Send <- msg:
		default:
			// Buffer full, skip
		}
	}
}

func intToStr(n int) string {
	return json.Number(json.Number(string(rune('0' + n)))).String()
}

// writePump pumps messages from hub to websocket
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteJSON(msg); err != nil {
				return
			}
		case <-ticker.C:
			// Send ping for heartbeat
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads messages from websocket and broadcasts
func (c *Client) readPump() {
	defer func() {
		hub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, msgBytes, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var msg Message
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			msg = Message{Type: "chat", Content: string(msgBytes)}
		}
		msg.User = c.User
		msg.Time = time.Now().Format("15:04:05")
		hub.Broadcast(msg)
	}
}

func handleChat(c *gin.Context) {
	user := c.Query("user")
	if user == "" {
		user = "anonymous"
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &Client{Conn: conn, User: user, Send: make(chan Message, 256)}
	hub.Register(client)

	go client.writePump()
	go client.readPump()
}

func main() {
	r := gin.Default()
	r.GET("/ws/chat", handleChat)
	r.StaticFile("/", "./index.html")
	log.Println("Chat server on :8080")
	r.Run(":8080")
}
```

### v3：多房间聊天室

```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type Message struct {
	Type    string `json:"type"`
	Room    string `json:"room"`
	User    string `json:"user"`
	Content string `json:"content"`
	Time    string `json:"time"`
}

type Client struct {
	Conn *websocket.Conn
	User string
	Room string
	Send chan Message
}

// Room manages clients in a single room
type Room struct {
	Name    string
	clients map[*Client]bool
	mu      sync.RWMutex
}

// RoomHub manages all rooms
type RoomHub struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

var roomHub = &RoomHub{rooms: make(map[string]*Room)}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (rh *RoomHub) GetOrCreate(name string) *Room {
	rh.mu.Lock()
	defer rh.mu.Unlock()
	if r, ok := rh.rooms[name]; ok {
		return r
	}
	r := &Room{Name: name, clients: make(map[*Client]bool)}
	rh.rooms[name] = r
	return r
}

func (r *Room) Join(c *Client) {
	r.mu.Lock()
	r.clients[c] = true
	count := len(r.clients)
	r.mu.Unlock()
	r.broadcast(Message{
		Type:    "system",
		Room:    r.Name,
		Content: c.User + " joined (" + itoa(count) + " in room)",
		Time:    time.Now().Format("15:04:05"),
	})
}

func (r *Room) Leave(c *Client) {
	r.mu.Lock()
	delete(r.clients, c)
	r.mu.Unlock()
	close(c.Send)
	r.broadcast(Message{
		Type:    "system",
		Room:    r.Name,
		Content: c.User + " left",
		Time:    time.Now().Format("15:04:05"),
	})
}

func (r *Room) broadcast(msg Message) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for c := range r.clients {
		select {
		case c.Send <- msg:
		default:
		}
	}
}

func handleRoomChat(c *gin.Context) {
	room := c.Param("room")
	user := c.Query("user")
	if user == "" {
		user = "anonymous"
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	r := roomHub.GetOrCreate(room)
	client := &Client{Conn: conn, User: user, Room: room, Send: make(chan Message, 256)}
	r.Join(client)

	go writePump(client, r)
	go readPump(client, r)
}

func writePump(c *Client, room *Room) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() { ticker.Stop(); c.Conn.Close() }()

	for {
		select {
		case msg, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, nil)
				return
			}
			c.Conn.WriteJSON(msg)
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func readPump(c *Client, room *Room) {
	defer func() { room.Leave(c); c.Conn.Close() }()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, data, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		room.broadcast(Message{
			Type:    "chat",
			Room:    c.Room,
			User:    c.User,
			Content: string(data),
			Time:    time.Now().Format("15:04:05"),
		})
	}
}

// List rooms API
func listRooms(c *gin.Context) {
	roomHub.mu.RLock()
	defer roomHub.mu.RUnlock()
	rooms := make(map[string]int)
	for name, r := range roomHub.rooms {
		r.mu.RLock()
		rooms[name] = len(r.clients)
		r.mu.RUnlock()
	}
	c.JSON(200, rooms)
}

func itoa(n int) string {
	return json.Number(string(rune('0' + n))).String()
}

func main() {
	r := gin.Default()
	r.GET("/ws/:room", handleRoomChat)
	r.GET("/api/rooms", listRooms)
	log.Println("Room chat server on :8080")
	r.Run(":8080")
}
```

---

## 四、执行预览

```bash
# 连接 WebSocket（使用 wscat 工具）
wscat -c "ws://localhost:8080/ws/chat?user=Alice"

# 另一个终端
wscat -c "ws://localhost:8080/ws/chat?user=Bob"

# Alice 发送消息
> {"type":"chat","content":"Hello Bob!"}
# Bob 收到: {"type":"chat","user":"Alice","content":"Hello Bob!","time":"14:30:00"}

# 房间聊天
wscat -c "ws://localhost:8080/ws/general?user=Alice"
wscat -c "ws://localhost:8080/ws/general?user=Bob"

# 查看房间列表
curl http://localhost:8080/api/rooms
# → {"general":2}
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| `CheckOrigin` | 生产环境必须校验 Origin，防止跨站 WebSocket 劫持 |
| 并发写入 | `websocket.Conn` 非线程安全，同一 conn 只能一个 goroutine 写 |
| 缓冲区大小 | `Send` channel 建议 256，避免慢客户端阻塞 |
| 心跳间隔 | 建议 30s ping，60s 超时断开 |
| 内存泄漏 | 客户端断开必须从 Hub 中移除并关闭 channel |
| 优雅关闭 | 服务端关闭时发送 CloseMessage 并等待确认 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| 多个 goroutine 同时写同一个 conn | 只用一个 goroutine 负责写（writePump） |
| 不设 ReadDeadline，连接永不超时 | 设置心跳 + ReadDeadline 自动断开死连接 |
| `CheckOrigin: return true` 上线 | 校验 Origin 白名单 |
| 客户端断开不清理 map | defer 中移除 + close channel |
| 用 `c.JSON()` 返回 WebSocket 错误 | 升级失败已自动返回 HTTP 错误，不需额外处理 |

---

## 七、练习题

### 🟢 入门
1. 实现一个 Echo WebSocket 服务，收到的消息原样返回
2. 连接时发送欢迎消息

### 🟡 进阶
3. 实现广播聊天室，支持用户名显示
4. 添加心跳检测，60秒无响应断开

### 🔴 挑战
5. 实现多房间聊天室 + 私聊功能
6. 将聊天记录持久化到 Redis，支持离线消息

---

## 八、知识点总结

```
WebSocket 知识树
├── 协议基础
│   ├── HTTP Upgrade 握手
│   ├── 文本/二进制帧
│   └── Ping/Pong 心跳
├── gorilla/websocket
│   ├── Upgrader 配置
│   ├── ReadMessage / WriteMessage
│   └── ReadJSON / WriteJSON
├── 架构模式
│   ├── Hub-Client 模型
│   ├── 读/写分离 goroutine
│   └── Channel 缓冲通信
└── 生产化
    ├── 心跳 + 超时
    ├── 房间管理
    └── 消息持久化
```

---

## 九、举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| 实时通知 | WebSocket + Redis Pub/Sub | 多实例消息同步 |
| 协同编辑 | OT/CRDT + WebSocket | 冲突解决算法 |
| 实时看板 | 定时推送数据变更 | 增量更新减少带宽 |
| 游戏同步 | 二进制帧 + Protobuf | 低延迟序列化 |
| 直播弹幕 | WebSocket + 扇出优化 | 消息聚合减少写入 |

---

## 十、参考资料

- [gorilla/websocket 官方文档](https://pkg.go.dev/github.com/gorilla/websocket)
- [WebSocket 协议 RFC 6455](https://tools.ietf.org/html/rfc6455)
- [Gorilla Chat Example](https://github.com/gorilla/websocket/tree/master/examples/chat)

---

## 十一、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| **v1** | Echo 服务，基础连接 | 学习、调试 |
| **v2** | 广播聊天室 + 连接管理 | 小型应用 |
| **v3** | 多房间 + REST API + 心跳 | 生产环境 |
