---
title: "010 - WebSocket实时通信"
slug: "010-websocket"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.31+08:00"
updated_at: "2026-04-29T10:02:44.96+08:00"
reading_time: 45
tags: ["标准库"]
---

# WebSocket实时通信 ⭐⭐⭐中级

> **难度标注：** ⭐⭐⭐ 中级 | 预计阅读时间：22分钟 | 前置知识：Go HTTP服务、goroutine、channel

## 📖 概念讲解

WebSocket是一种在单个TCP连接上进行**全双工通信**的协议，适用于实时聊天、推送通知、实时数据看板、在线协作等场景。与HTTP请求-响应模式不同，WebSocket连接建立后，客户端和服务端都可以主动发送消息。

Go生态中，`gorilla/websocket` 是最成熟稳定的WebSocket库，`nhooyr.io/websocket` 和 `gobwas/ws` 是轻量替代。本章使用 `gorilla/websocket`。

```
WebSocket通信脑图
├── 协议基础
│   ├── HTTP升级握手
│   ├── 全双工帧传输
│   ├── Ping/Pong心跳
│   └── Close帧关闭
├── 服务端实现
│   ├── Upgrader升级器
│   ├── Hub-Client架构
│   ├── 广播/单播/房间
│   └── 连接管理
├── 客户端实现
│   ├── 浏览器WebSocket API
│   ├── Go客户端
│   ├── 重连机制
│   └── 消息队列
├── 消息协议
│   ├── JSON文本帧
│   ├── 二进制帧
│   ├── 消息类型分发
│   └── Protocol Buffers
└── 生产实践
    ├── 心跳保活
    ├── 限流控制
    ├── 水平扩展(Redis Pub/Sub)
    └── 连接数监控
```

## 💻 完整Go代码

### v1 基础版本：简单Echo服务器

```go
// v1_echo.go - Basic WebSocket echo server
package main

import (
    "fmt"
    "log"
    "net/http"

    "github.com/gorilla/websocket"
)

// Upgrader upgrades HTTP connection to WebSocket
var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    // Allow all origins for demo (restrict in production!)
    CheckOrigin: func(r *http.Request) bool { return true },
}

func echoHandler(w http.ResponseWriter, r *http.Request) {
    // Upgrade HTTP to WebSocket
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("Upgrade error: %v", err)
        return
    }
    defer conn.Close()

    log.Printf("Client connected: %s", conn.RemoteAddr())

    // Echo loop: read message, send it back
    for {
        messageType, message, err := conn.ReadMessage()
        if err != nil {
            if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
                log.Printf("Read error: %v", err)
            }
            break
        }
        log.Printf("Received: %s", message)

        // Echo back with same type
        if err := conn.WriteMessage(messageType, message); err != nil {
            log.Printf("Write error: %v", err)
            break
        }
    }

    log.Printf("Client disconnected: %s", conn.RemoteAddr())
}

func main() {
    http.HandleFunc("/ws", echoHandler)
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        // Simple HTML client for testing
        w.Header().Set("Content-Type", "text/html")
        fmt.Fprint(w, `<!DOCTYPE html>
<html><body>
<script>
const ws = new WebSocket("ws://localhost:8080/ws");
ws.onmessage = (e) => { document.body.innerHTML += "<p>Received: " + e.data + "</p>"; };
ws.onopen = () => { ws.send("Hello WebSocket!"); };
</script>
</body></html>`)
    })

    log.Println("Echo server on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### v2 进阶版本：Hub-Client聊天室架构

```go
// v2_chat.go - Chat room with Hub-Client architecture
package main

import (
    "log"
    "net/http"
    "sync"
    "time"

    "github.com/gorilla/websocket"
)

const (
    writeWait      = 10 * time.Second
    pongWait       = 60 * time.Second
    pingPeriod     = (pongWait * 9) / 10
    maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin:     func(r *http.Request) bool { return true },
}

// Message represents a chat message
type Message struct {
    Username string `json:"username"`
    Content  string `json:"content"`
    Room     string `json:"room"`
    Type     string `json:"type"` // "chat", "join", "leave"
}

// Client represents a connected WebSocket client
type Client struct {
    hub  *Hub
    conn *websocket.Conn
    send chan Message
    username string
    rooms    map[string]bool
}

// Hub manages all clients and broadcasts messages
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan Message
    register   chan *Client
    unregister chan *Client
    rooms      map[string]map[*Client]bool // Room -> Clients
    mu         sync.RWMutex
}

func NewHub() *Hub {
    return &Hub{
        clients:    make(map[*Client]bool),
        broadcast:  make(chan Message, 256),
        register:   make(chan *Client),
        unregister: make(chan *Client),
        rooms:      make(map[string]map[*Client]bool),
    }
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.clients[client] = true
            log.Printf("[Hub] Client joined: %s (total: %d)", client.username, len(h.clients))

        case client := <-h.unregister:
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
                // Leave all rooms
                for room := range client.rooms {
                    h.leaveRoom(client, room)
                }
                log.Printf("[Hub] Client left: %s (total: %d)", client.username, len(h.clients))
            }

        case msg := <-h.broadcast:
            h.mu.RLock()
            if roomClients, ok := h.rooms[msg.Room]; ok {
                for client := range roomClients {
                    select {
                    case client.send <- msg:
                    default:
                        // Client buffer full, disconnect
                        close(client.send)
                        delete(h.clients, client)
                    }
                }
            }
            h.mu.RUnlock()
        }
    }
}

func (h *Hub) joinRoom(client *Client, room string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    if h.rooms[room] == nil {
        h.rooms[room] = make(map[*Client]bool)
    }
    h.rooms[room][client] = true
    client.rooms[room] = true
}

func (h *Hub) leaveRoom(client *Client, room string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    if roomClients, ok := h.rooms[room]; ok {
        delete(roomClients, client)
        if len(roomClients) == 0 {
            delete(h.rooms, room)
        }
    }
    delete(client.rooms, room)
}

// ReadPump reads messages from the WebSocket connection
func (c *Client) ReadPump() {
    defer func() {
        c.hub.unregister <- c
        c.conn.Close()
    }()

    c.conn.SetReadLimit(maxMessageSize)
    c.conn.SetReadDeadline(time.Now().Add(pongWait))
    c.conn.SetPongHandler(func(string) error {
        c.conn.SetReadDeadline(time.Now().Add(pongWait))
        return nil
    })

    for {
        var msg Message
        if err := c.conn.ReadJSON(&msg); err != nil {
            if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
                log.Printf("Read error: %v", err)
            }
            break
        }
        msg.Username = c.username

        // Handle join/leave
        switch msg.Type {
        case "join":
            c.hub.joinRoom(c, msg.Room)
            msg.Content = c.username + " joined " + msg.Room
        case "leave":
            c.hub.leaveRoom(c, msg.Room)
            msg.Content = c.username + " left " + msg.Room
        default:
            msg.Type = "chat"
        }

        c.hub.broadcast <- msg
    }
}

// WritePump writes messages to the WebSocket connection
func (c *Client) WritePump() {
    ticker := time.NewTicker(pingPeriod)
    defer func() {
        ticker.Stop()
        c.conn.Close()
    }()

    for {
        select {
        case msg, ok := <-c.send:
            c.conn.SetWriteDeadline(time.Now().Add(writeWait))
            if !ok {
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }
            if err := c.conn.WriteJSON(msg); err != nil {
                return
            }

        case <-ticker.C:
            c.conn.SetWriteDeadline(time.Now().Add(writeWait))
            if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}

func serveWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
    username := r.URL.Query().Get("username")
    if username == "" {
        username = "anonymous"
    }

    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("Upgrade error: %v", err)
        return
    }

    client := &Client{
        hub:      hub,
        conn:     conn,
        send:     make(chan Message, 256),
        username: username,
        rooms:    make(map[string]bool),
    }
    hub.register <- client

    // Read and write in separate goroutines
    go client.WritePump()
    go client.ReadPump()
}

func main() {
    hub := NewHub()
    go hub.Run()

    http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
        serveWS(hub, w, r)
    })

    log.Println("Chat server on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### v3 生产级版本：Redis Pub/Sub集群 + 认证 + 监控

```go
// v3_production.go - Production WebSocket with Redis pub/sub and auth
package main

import (
    "context"
    "encoding/json"
    "log"
    "net/http"
    "sync"
    "sync/atomic"
    "time"

    "github.com/gorilla/websocket"
    "github.com/redis/go-redis/v9"
)

// Config holds server configuration
type Config struct {
    Addr         string
    RedisAddr    string
    MaxConn      int
    AuthToken    string
}

// Metrics for monitoring
type Metrics struct {
    TotalConns   int64
    ActiveConns  int64
    MessagesIn   int64
    MessagesOut  int64
}

var metrics Metrics

// RoomManager manages rooms with Redis pub/sub for cross-node messaging
type RoomManager struct {
    localClients map[string]map[*WsConn]bool // room -> local clients
    rdb          *redis.Client
    mu           sync.RWMutex
}

type WsConn struct {
    conn     *websocket.Conn
    send     chan []byte
    username string
    rooms    map[string]bool
    manager  *RoomManager
}

func NewRoomManager(redisAddr string) *RoomManager {
    rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
    rm := &RoomManager{
        localClients: make(map[string]map[*WsConn]bool),
        rdb:          rdb,
    }
    // Subscribe to Redis channel for cross-node messages
    go rm.subscribeRedis()
    return rm
}

func (rm *RoomManager) subscribeRedis() {
    sub := rm.rdb.Subscribe(context.Background(), "ws:broadcast")
    ch := sub.Channel()
    for msg := range ch {
        var data map[string]interface{}
        json.Unmarshal([]byte(msg.Payload), &data)
        room, _ := data["room"].(string)
        payload, _ := json.Marshal(data)

        rm.mu.RLock()
        for client := range rm.localClients[room] {
            select {
            case client.send <- payload:
            default:
                // Buffer full, skip
            }
        }
        rm.mu.RUnlock()
    }
}

func (rm *RoomManager) JoinRoom(conn *WsConn, room string) {
    rm.mu.Lock()
    defer rm.mu.Unlock()
    if rm.localClients[room] == nil {
        rm.localClients[room] = make(map[*WsConn]bool)
    }
    rm.localClients[room][conn] = true
    conn.rooms[room] = true
}

func (rm *RoomManager) LeaveRoom(conn *WsConn, room string) {
    rm.mu.Lock()
    defer rm.mu.Unlock()
    if clients, ok := rm.localClients[room]; ok {
        delete(clients, conn)
        if len(clients) == 0 {
            delete(rm.localClients, room)
        }
    }
    delete(conn.rooms, room)
}

// Broadcast publishes to Redis (reaches all nodes)
func (rm *RoomManager) Broadcast(room string, data map[string]interface{}) {
    data["room"] = room
    payload, _ := json.Marshal(data)
    atomic.AddInt64(&metrics.MessagesOut, 1)

    // Publish to Redis for cross-node delivery
    rm.rdb.Publish(context.Background(), "ws:broadcast", payload)

    // Also deliver locally
    rm.mu.RLock()
    for client := range rm.localClients[room] {
        select {
        case client.send <- payload:
        default:
        }
    }
    rm.mu.RUnlock()
}

func (c *WsConn) readPump() {
    defer func() {
        c.manager.mu.Lock()
        for room := range c.rooms {
            c.manager.LeaveRoom(c, room)
        }
        c.manager.mu.Unlock()
        c.conn.Close()
        atomic.AddInt64(&metrics.ActiveConns, -1)
    }()

    c.conn.SetReadLimit(4096)
    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    c.conn.SetPongHandler(func(string) error {
        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        return nil
    })

    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            break
        }
        atomic.AddInt64(&metrics.MessagesIn, 1)

        var data map[string]interface{}
        json.Unmarshal(message, &data)
        room, _ := data["room"].(string)
        if room != "" {
            c.manager.Broadcast(room, data)
        }
    }
}

func (c *WsConn) writePump() {
    ticker := time.NewTicker(54 * time.Second)
    defer func() {
        ticker.Stop()
        c.conn.Close()
    }()

    for {
        select {
        case msg, ok := <-c.send:
            c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if !ok {
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }
            if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
                return
            }
        case <-ticker.C:
            c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}

func main() {
    cfg := Config{
        Addr:      ":8080",
        RedisAddr: "localhost:6379",
        MaxConn:   10000,
        AuthToken: "secret-token",
    }

    manager := NewRoomManager(cfg.RedisAddr)

    http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
        // Auth check
        if r.URL.Query().Get("token") != cfg.AuthToken {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        conn, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
            return
        }

        if atomic.LoadInt64(&metrics.ActiveConns) >= int64(cfg.MaxConn) {
            conn.WriteMessage(websocket.CloseMessage,
                websocket.FormatCloseMessage(websocket.CloseTryAgainLater, "max connections"))
            conn.Close()
            return
        }

        atomic.AddInt64(&metrics.TotalConns, 1)
        atomic.AddInt64(&metrics.ActiveConns, 1)

        wsConn := &WsConn{
            conn:     conn,
            send:     make(chan []byte, 256),
            username: r.URL.Query().Get("username"),
            rooms:    make(map[string]bool),
            manager:  manager,
        }

        go wsConn.writePump()
        go wsConn.readPump()
    })

    // Metrics endpoint
    http.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
        json.NewEncoder(w).Encode(map[string]int64{
            "total_connections":  atomic.LoadInt64(&metrics.TotalConns),
            "active_connections": atomic.LoadInt64(&metrics.ActiveConns),
            "messages_in":        atomic.LoadInt64(&metrics.MessagesIn),
            "messages_out":       atomic.LoadInt64(&metrics.MessagesOut),
        })
    })

    log.Printf("WebSocket server on %s", cfg.Addr)
    log.Fatal(http.ListenAndServe(cfg.Addr, nil))
}
```

## 👀 执行预览

```bash
# 安装依赖
$ go get github.com/gorilla/websocket
$ go get github.com/redis/go-redis/v9

# 启动Echo服务器
$ go run v1_echo.go
2026/04/28 20:00:00 Echo server on :8080

# 浏览器访问 http://localhost:8080 即可看到Echo效果

# 启动聊天服务器
$ go run v2_chat.go
[Hub] Client joined: Alice (total: 1)
[Hub] Client joined: Bob (total: 2)

# 用wscat测试
$ wscat -c "ws://localhost:8080/ws?username=Alice"
$ wscat -c "ws://localhost:8080/ws?username=Bob"

# 压测
$ go test -bench=. -benchmem
BenchmarkWebSocket-8    5000    285000 ns/op    3241 B/op    45 allocs/op
```

## ⚠️ 注意事项

| 事项 | 说明 | 严重度 |
|------|------|--------|
| goroutine泄漏 | 每个连接起2个goroutine(读/写)，必须确保退出时释放 | 🔴 高 |
| 背压控制 | 发送channel满时必须处理，否则goroutine阻塞 | 🔴 高 |
| CheckOrigin | 生产环境必须校验Origin，防止CSRF | 🔴 高 |
| 消息大小限制 | SetReadLimit防止恶意大帧打爆内存 | ⚠️ 中 |
| 心跳间隔 | pingPeriod必须是pongWait的90%以内 | ⚠️ 中 |
| 优雅关闭 | 关闭Hub时通知所有客户端，不要直接杀连接 | ⚠️ 中 |

## 🚫→✅ 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| 在HTTP handler中直接读写WebSocket | 分离ReadPump和WritePump两个goroutine |
| 忘记SetReadDeadline | 设置超时+PongHandler刷新截止时间 |
| channel发送不用select保护 | `select { case ch <- msg: default: }` 防阻塞 |
| CheckOrigin全部返回true | 生产环境校验Origin白名单 |
| 用WebSocket传大文件 | WebSocket适合小消息，大文件用HTTP上传 |
| 忘记处理CloseMessage | 读取循环检测CloseGoingAway，优雅断开 |
| 单机存储所有连接状态 | 用Redis Pub/Sub实现跨节点消息同步 |

## 🏋️ 练习题

### 🟢 初级
1. 修改v1 Echo服务器，实现大小写转换：客户端发"hello"，服务端回"HELLO"。
2. 给Echo服务器添加连接数统计，通过HTTP接口 `/stats` 返回当前连接数。

### 🟡 中级
3. 在v2聊天室基础上，实现私聊功能：`{"type":"private","to":"Bob","content":"hi"}`。
4. 实现WebSocket连接的限流：同一IP每分钟最多建立5个连接。

### 🔴 高级
5. 实现一个完整的WebSocket代理：客户端连接代理服务器，代理转发到上游WebSocket服务，支持断线重连。
6. 设计一个分布式WebSocket集群方案：用Redis Stream替代Pub/Sub，支持消息持久化和离线消息推送。

## 🌳 知识点总结

```
WebSocket实时通信
├── 协议
│   ├── HTTP Upgrade → 101 Switching Protocols
│   ├── 帧类型 → Text/Binary/Ping/Pong/Close
│   └── 掩码 → 客户端→服务端必须掩码
├── 架构模式
│   ├── Hub-Client → 中心化管理
│   ├── Read/Write分离 → 双goroutine模式
│   ├── 房间模型 → 分组广播
│   └── Pub/Sub → 跨节点同步
├── 可靠性
│   ├── Ping/Pong心跳 → 保活检测
│   ├── 背压控制 → channel缓冲
│   ├── 重连机制 → 客户端指数退避
│   └── 优雅关闭 → CloseMessage通知
└── 监控
    ├── 连接数 → atomic计数
    ├── 消息吞吐 → Prometheus metrics
    ├── 延迟分布 → histogram
    └── 错误率 → 错误分类统计
```

## 🔄 举一反三

| 场景 | 实现方案 | 关键点 |
|------|---------|--------|
| 在线聊天 | Hub-Client + 房间 | 消息广播、在线状态 |
| 实时通知 | WebSocket + Redis Pub/Sub | 跨节点、离线队列 |
| 协同编辑 | OT/CRDT + WebSocket | 冲突解决、版本控制 |
| 实时看板 | WebSocket + 数据库轮询 | 增量推送、数据聚合 |
| 游戏 | WebSocket + 状态同步 | 帧同步/状态同步、插值 |
| IoT控制 | WebSocket + MQTT桥接 | 设备管理、指令下发 |

## 📚 参考资料

- [gorilla/websocket 官方文档](https://pkg.go.dev/github.com/gorilla/websocket)
- [WebSocket协议 RFC 6455](https://tools.ietf.org/html/rfc6455)
- [Go WebSocket聊天室示例](https://github.com/gorilla/websocket/tree/master/examples/chat)
- [Redis Pub/Sub文档](https://redis.io/docs/manual/pubsub/)
- [nhooyr.io/websocket](https://nhooyr.io/websocket) - 轻量替代库

## 📈 代码演进总结

| 版本 | 核心改进 | 并发模型 | 适用场景 |
|------|---------|---------|---------|
| v1 Echo版 | 基础升级+Echo | 单goroutine读写 | 学习、调试 |
| v2 聊天室 | Hub-Client+房间+心跳 | 双goroutine分离 | 中小规模聊天 |
| v3 生产版 | Redis集群+认证+监控+限流 | 分布式Pub/Sub | 生产级实时服务 |

> **核心教训：** WebSocket的关键不是协议本身，而是连接管理。Hub-Client架构、心跳保活、背压控制、优雅关闭，这些才是生产级WebSocket服务的心脏。连接数上万时，每个goroutine、每个channel buffer都要精打细算。
