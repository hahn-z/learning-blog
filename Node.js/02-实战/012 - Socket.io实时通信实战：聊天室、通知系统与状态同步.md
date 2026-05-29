---
title: "012 - Socket.io实时通信实战：聊天室、通知系统与状态同步"
slug: "012-socket-io"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.73+08:00"
updated_at: "2026-04-29T10:02:48.11+08:00"
reading_time: 48
tags: []
---

## ⚡ 难度标注

**难度：⭐⭐⭐⭐ 中高级** | 预计学习时间：55分钟 | 前置知识：Node.js、Express基础、HTTP协议

---

## 📖 概念讲解

### WebSocket vs HTTP

HTTP是请求-响应模式，服务器无法主动推送。WebSocket是全双工协议，建立一次连接后双方可随时互发消息：

```
HTTP:     Client → Request → Server → Response → Client (结束)
WebSocket: Client → Upgrade → Server ←→ 双向通信 ←→ (持续)
```

### Socket.io = WebSocket + 降级 + 房间 + 更多

Socket.io不仅仅是WebSocket的封装，它提供：

| 特性 | 原生WebSocket | Socket.io |
|------|---------------|-----------|
| 传输协议 | 仅WebSocket | WebSocket + HTTP长轮询降级 |
| 自动重连 | 需手动实现 | 内置，可配置 |
| 命名空间 | 无 | 支持（多逻辑通道） |
| 房间 | 无 | 支持（分组广播） |
| 消息确认 | 需手动实现 | 内置ack回调 |
| 二进制支持 | ✅ | ✅ |
| 集群扩展 | 需自行实现 | Redis Adapter |

### 核心概念

- **Namespace**：逻辑隔离通道（如 `/chat`、`/notifications`），默认 `/`
- **Room**：在Namespace内分组，支持join/leave和定向广播
- **Event**：自定义事件名替代HTTP路由，`emit`发送、`on`监听
- **Adapter**：集群模式下同步状态的适配器（Redis/MongoDB等）

---

## 🧠 知识脑图

```
Socket.io
├── Server Setup
│   ├── new Server(httpServer)
│   ├── CORS configuration
│   └── Options (pingInterval, pingTimeout)
├── Connection Lifecycle
│   ├── connection event
│   ├── disconnect event
│   └── Error handling
├── Events
│   ├── emit (send)
│   ├── on (receive)
│   └── ack (callback/confirmation)
├── Namespace
│   ├── io.of('/namespace')
│   ├── Authorization middleware
│   └── Isolated event handling
├── Rooms
│   ├── socket.join(room)
│   ├── socket.leave(room)
│   ├── io.to(room).emit()
│   └── socket.rooms (current rooms)
├── Authentication
│   ├── JWT token verification
│   ├── Middleware on connection
│   └── Token refresh
├── Scaling
│   ├── Redis Adapter
│   ├── Sticky sessions
│   └── Multiple nodes
└── Best Practices
    ├── Error handling
    ├── Memory leak prevention
    ├── Rate limiting
    └── Heartbeat tuning
```

---

## 💻 完整代码：实时聊天 + 通知 + 在线状态系统

### 项目结构

```
project/
├── src/
│   ├── server.js
│   ├── socket/
│   │   ├── index.js
│   │   ├── chat.js
│   │   ├── notification.js
│   │   └── presence.js
│   ├── middleware/
│   │   └── auth.js
│   └── utils/
│       └── rateLimit.js
├── public/
│   └── index.html
├── package.json
└── .env
```

### v1 基础聊天室（连接 + 事件 + 房间）

```javascript
// src/server.js - Express + Socket.io setup
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.io server with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  },
  pingInterval: 25000, // Send ping every 25s
  pingTimeout: 20000   // Disconnect if no pong in 20s
});

// Serve static files
app.use(express.static('public'));

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connections: io.engine.clientsCount });
});

module.exports = { app, server, io };
```

```javascript
// src/socket/index.js - Socket.io event handler
const { io } = require('../server');
const { verifyToken } = require('../middleware/auth');

// Connected users tracking
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  const { userId, username } = socket.handshake.auth;

  // Track connected user
  connectedUsers.set(socket.id, { userId, username, joinedAt: new Date() });

  // Broadcast online users count
  io.emit('users:count', connectedUsers.size);

  // ===== ROOM MANAGEMENT =====

  // Join a chat room
  socket.on('room:join', (roomId) => {
    socket.join(roomId);
    console.log(`${username} joined room: ${roomId}`);

    // Notify others in the room
    socket.to(roomId).emit('user:joined', {
      userId, username, timestamp: new Date()
    });

    // Send current room members to the joiner
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets) {
      const members = [...roomSockets]
        .map(id => connectedUsers.get(id))
        .filter(Boolean);
      socket.emit('room:members', members);
    }
  });

  // Leave a chat room
  socket.on('room:leave', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user:left', {
      userId, username, timestamp: new Date()
    });
  });

  // ===== CHAT MESSAGES =====

  // Send message to a room
  socket.on('message:send', (data, ack) => {
    const { roomId, content, type = 'text' } = data;

    // Validate message
    if (!content || !content.trim()) {
      return ack?.({ error: 'Message cannot be empty' });
    }
    if (content.length > 2000) {
      return ack?.({ error: 'Message too long (max 2000 chars)' });
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      sender: { userId, username },
      content: content.trim(),
      type,
      timestamp: new Date()
    };

    // Broadcast to everyone in the room (including sender for confirmation)
    io.to(roomId).emit('message:new', message);

    // Acknowledge with message ID
    ack?.({ success: true, messageId: message.id });
  });

  // ===== TYPING INDICATOR =====

  socket.on('typing:start', (roomId) => {
    socket.to(roomId).emit('typing:update', {
      userId, username, roomId, isTyping: true
    });
  });

  socket.on('typing:stop', (roomId) => {
    socket.to(roomId).emit('typing:update', {
      userId, username, roomId, isTyping: false
    });
  });

  // ===== DISCONNECT =====

  socket.on('disconnect', (reason) => {
    console.log(`Disconnected: ${socket.id} (${reason})`);
    connectedUsers.delete(socket.id);
    io.emit('users:count', connectedUsers.size);

    // Notify all rooms this user was in
    const rooms = [...socket.rooms].filter(r => r !== socket.id);
    rooms.forEach(roomId => {
      socket.to(roomId).emit('user:left', {
        userId, username, timestamp: new Date()
      });
    });
  });
});
```

```html
<!-- public/index.html - Simple chat client -->
<!DOCTYPE html>
<html>
<head>
  <title>Socket.io Chat</title>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <div id="chat">
    <div id="messages"></div>
    <input id="msgInput" placeholder="Type a message..." autocomplete="off">
    <button id="sendBtn">Send</button>
    <p>Online: <span id="userCount">0</span></p>
  </div>
  <script>
    const socket = io({ auth: { userId: 'user1', username: 'TestUser' } });
    const ROOM = 'general';

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
      socket.emit('room:join', ROOM);
    });

    socket.on('message:new', (msg) => {
      const el = document.createElement('div');
      el.textContent = `${msg.sender.username}: ${msg.content}`;
      document.getElementById('messages').appendChild(el);
    });

    socket.on('users:count', (count) => {
      document.getElementById('userCount').textContent = count;
    });

    document.getElementById('sendBtn').onclick = () => {
      const input = document.getElementById('msgInput');
      const content = input.value.trim();
      if (!content) return;
      socket.emit('message:send', { roomId: ROOM, content }, (ack) => {
        if (ack?.success) input.value = '';
      });
    };
  </script>
</body>
</html>
```

### v2 命名空间 + JWT认证 + 实时通知

```javascript
// src/middleware/auth.js - JWT authentication for Socket.io
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Socket.io authentication middleware
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('Authentication required'));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('Invalid or expired token'));
  }

  // Attach user info to socket
  socket.user = {
    userId: decoded.userId,
    username: decoded.username,
    role: decoded.role || 'user'
  };

  next();
}

module.exports = { verifyToken, socketAuthMiddleware };
```

```javascript
// src/socket/notification.js - Notification namespace
const { io } = require('../server');
const { socketAuthMiddleware } = require('../middleware/auth');

// Create /notifications namespace with auth
const notifNs = io.of('/notifications');
notifNs.use(socketAuthMiddleware);

// Track user -> socket mapping for targeted notifications
const userSockets = new Map();

notifNs.on('connection', (socket) => {
  const { userId } = socket.user;

  // Map user to socket (support multiple devices)
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  // Join user's personal notification room
  socket.join(`user:${userId}`);

  console.log(`Notification connected: ${socket.user.username}`);

  // Send unread notifications on connect
  socket.emit('notifications:unread', {
    count: Math.floor(Math.random() * 10), // Placeholder
    notifications: []
  });

  // Mark notification as read
  socket.on('notification:read', async (notifId, ack) => {
    // In production: update database
    console.log(`Notification ${notifId} read by ${userId}`);
    ack?.({ success: true });
  });

  socket.on('disconnect', () => {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) userSockets.delete(userId);
    }
  });
});

// Export function to send notification to specific user
function sendNotification(userId, notification) {
  notifNs.to(`user:${userId}`).emit('notification:new', {
    ...notification,
    timestamp: new Date()
  });
}

module.exports = { sendNotification };
```

```javascript
// src/socket/chat.js - Chat namespace with auth and rate limiting
const { io } = require('../server');
const { socketAuthMiddleware } = require('../middleware/auth');

const chatNs = io.of('/chat');
chatNs.use(socketAuthMiddleware);

// Simple rate limiter (per socket)
const messageTimestamps = new Map();

function checkRateLimit(socketId, limit = 20, windowMs = 10000) {
  const now = Date.now();
  if (!messageTimestamps.has(socketId)) {
    messageTimestamps.set(socketId, []);
  }
  const timestamps = messageTimestamps.get(socketId);

  // Remove old timestamps outside window
  while (timestamps.length && timestamps[0] < now - windowMs) {
    timestamps.shift();
  }

  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  return true;
}

chatNs.on('connection', (socket) => {
  const { userId, username } = socket.user;

  socket.on('room:join', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user:joined', { userId, username });
  });

  socket.on('message:send', (data, ack) => {
    // Rate limiting
    if (!checkRateLimit(socket.id)) {
      return ack?.({ error: 'Rate limited. Slow down!' });
    }

    const { roomId, content } = data;
    if (!content?.trim() || content.length > 2000) {
      return ack?.({ error: 'Invalid message' });
    }

    const message = {
      id: `msg_${Date.now()}`,
      roomId, content,
      sender: { userId, username },
      timestamp: new Date()
    };

    chatNs.to(roomId).emit('message:new', message);
    ack?.({ success: true, messageId: message.id });
  });

  socket.on('disconnect', () => {
    messageTimestamps.delete(socket.id);
  });
});
```

### v3 Redis Adapter集群扩展 + 在线状态 + 生产配置

```javascript
// src/socket/presence.js - Online presence with Redis
const { io } = require('../server');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
const PRESENCE_KEY = 'presence:online';
const USER_TTL = 60; // seconds

class PresenceService {
  constructor() {
    this.redis = redis;
  }

  // Mark user online
  async goOnline(userId, meta = {}) {
    const key = `${PRESENCE_KEY}:${userId}`;
    await this.redis.setex(key, USER_TTL, JSON.stringify({
      ...meta,
      lastSeen: new Date().toISOString()
    }));
  }

  // Refresh presence (called periodically)
  async heartbeat(userId) {
    const key = `${PRESENCE_KEY}:${userId}`;
    await this.redis.expire(key, USER_TTL);
  }

  // Mark user offline
  async goOffline(userId) {
    await this.redis.del(`${PRESENCE_KEY}:${userId}`);
  }

  // Check if user is online
  async isOnline(userId) {
    return await this.redis.exists(`${PRESENCE_KEY}:${userId}`);
  }

  // Get all online users
  async getOnlineUsers() {
    const keys = await this.redis.keys(`${PRESENCE_KEY}:*`);
    if (keys.length === 0) return [];

    const values = await this.redis.mget(...keys);
    return keys.map((key, i) => {
      const userId = key.replace(`${PRESENCE_KEY}:`, '');
      return { userId, ...JSON.parse(values[i] || '{}') };
    });
  }
}

module.exports = new PresenceService();
```

```javascript
// src/server.js - Full production setup with Redis Adapter
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_URL || 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6, // 1MB max message size
  connectTimeout: 10000
});

// Redis Adapter for cluster scaling
const pubClient = new Redis(process.env.REDIS_URL);
const subClient = new Redis(process.env.REDIS_URL);
io.adapter(createAdapter(pubClient, subClient));

// Register all socket modules
require('./socket/chat');
require('./socket/notification');
const presence = require('./socket/presence');

// Presence heartbeat every 30s
const heartbeatInterval = setInterval(() => {
  io.emit('presence:heartbeat');
}, 30000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  clearInterval(heartbeatInterval);
  io.disconnectSockets(true);
  server.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});

module.exports = { app, server, io };
```

```javascript
// Production client connection example
// const socket = io('https://your-server.com/chat', {
//   auth: { token: jwtToken },
//   transports: ['websocket'],       // Force WebSocket only in production
//   reconnection: true,
//   reconnectionAttempts: 10,
//   reconnectionDelay: 1000,
//   reconnectionDelayMax: 10000,
//   timeout: 10000
// });
//
// socket.on('connect_error', (err) => {
//   if (err.message === 'Authentication required') {
//     // Redirect to login
//   }
// });
```

---

## ▶️ 执行预览

```bash
$ npm install socket.io express jsonwebtoken ioredis @socket.io/redis-adapter
$ node src/server.js

Socket.io server running on port 3001
Connected: abc123
Notification connected: zhangsan
Chat connected: zhangsan

# In browser console:
# socket.emit('message:send', { roomId: 'general', content: 'Hello!' }, console.log)
# { success: true, messageId: 'msg_1745894400000' }
```

---

## ⚠️ 注意事项

| 类别 | 要点 | 说明 |
|------|------|------|
| 连接 | CORS配置 | 生产环境精确指定origin，不用`*` |
| 连接 | transports | 生产环境可强制websocket，开发保留polling |
| 认证 | middleware | 在namespace级别验证JWT，不信任客户端数据 |
| 消息 | 大小限制 | maxHttpBufferSize控制，默认1MB |
| 消息 | 速率限制 | 必须实现，防止消息洪水攻击 |
| 房间 | 内存 | 单机百万房间以上考虑性能，集群用Adapter |
| 扩展 | Redis Adapter | 多节点必须用Adapter同步房间/事件 |
| 扩展 | Sticky Session | 多节点部署时需要（Nginx ip_hash或cookie） |
| 内存 | 房间清理 | 用户断开自动离开房间，但自定义Map需手动清理 |
| 安全 | 输入验证 | 不信任客户端发来的任何数据 |

---

## 🚫 避坑指南

❌ **不做认证，任何人可连接**
```javascript
// BAD: No authentication
io.on('connection', (socket) => {
  // Anyone can connect!
});
```
✅ **使用中间件验证身份**
```javascript
// GOOD: Verify JWT on connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    socket.user = jwt.verify(token, SECRET);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});
```

❌ **向所有人广播**
```javascript
// BAD: Broadcasts to ALL connected sockets globally
io.emit('message', data);
```
✅ **定向发送到房间或用户**
```javascript
// GOOD: Send to specific room
io.to(roomId).emit('message', data);
// GOOD: Send to specific user
io.to(`user:${userId}`).emit('notification', data);
```

❌ **在socket.id上存储业务状态**
```javascript
// BAD: socket.id changes on reconnect
const userSocket = socket.id;
// After reconnect, this is stale!
```
✅ **用userId映射，处理重连**
```javascript
// GOOD: Map userId to socket, handle multiple devices
userSockets.set(userId, socket.id);
// On reconnect, update the mapping
```

❌ **不处理断线重连后的状态恢复**
```javascript
// BAD: User misses messages during disconnect
socket.on('connect', () => {
  socket.emit('room:join', 'general');
  // Missed messages during offline period!
});
```
✅ **重连时同步缺失消息**
```javascript
// GOOD: Fetch missed messages on reconnect
socket.on('connect', () => {
  socket.emit('room:join', 'general');
  socket.emit('messages:sync', { lastMessageId, roomId }, (missed) => {
    renderMessages(missed);
  });
});
```

---

## 🏋️ 练习题

### 🟢 入门级

1. 创建一个基础Socket.io服务器和客户端，实现：连接时显示"用户加入"、发送消息、断开时显示"用户离开"。

2. 实现一个房间功能：用户可以输入房间名加入，消息只在同房间内可见。支持列出当前房间内的在线用户。

### 🟡 进阶级

3. 实现JWT认证的Socket.io聊天系统：未登录用户无法连接，登录后才能发送消息。支持私聊（指定userId发送）。

4. 实现在线状态系统：用Redis存储用户在线状态，支持查看好友列表中谁在线、谁离线，支持多设备同时在线。

### 🔴 挑战级

5. 实现一个完整的协作白板系统：多用户实时绘图，使用操作转换（OT）或CRDT解决并发冲突，支持撤销/重做、光标位置同步。

6. 设计一个支持10万并发连接的Socket.io架构：包括负载均衡策略、Redis Adapter配置、连接数监控、优雅扩缩容、消息持久化方案。

---

## 📚 知识点总结

```
Socket.io 实时通信
├── 基础
│   ├── Server: new Server(httpServer, options)
│   ├── Client: io(url, options)
│   ├── Events: emit / on / ack
│   └── Lifecycle: connect / disconnect / reconnect
├── 组织方式
│   ├── Namespace: io.of('/path')
│   ├── Room: join / leave / to().emit()
│   └── 适配器: Redis / MongoDB
├── 认证
│   ├── Middleware: io.use(fn)
│   ├── JWT: handshake.auth.token
│   └── 错误处理: next(new Error())
├── 生产配置
│   ├── CORS精确配置
│   ├── 心跳参数调优
│   ├── 速率限制
│   └── 消息大小限制
├── 扩展
│   ├── Redis Adapter集群
│   ├── Sticky Session
│   └── 负载均衡
└── 常见应用
    ├── 聊天室 (Room + Message)
    ├── 实时通知 (Namespace + userId)
    ├── 在线状态 (Redis + Heartbeat)
    └── 协作编辑 (OT/CRDT)
```

---

## 🔗 举一反三

| 本文学到的 | 延伸场景 | 关键差异 |
|------------|----------|----------|
| Socket.io聊天 | WebSocket原生 | 原生更轻量，无降级和房间，需自建 |
| 单机Socket.io | 集群部署 | 需Redis Adapter + Sticky Session |
| 文本消息 | 音视频通话 | 用WebRTC + Socket.io做信令 |
| 实时通知 | Server-Sent Events | SSE单向推送、更简单、HTTP协议 |
| 聊天室 | 协作编辑 | 需OT/CRDT算法处理并发冲突 |
| Redis Adapter | Kafka Adapter | Kafka适合更高吞吐、持久化消息 |
| Web聊天 | 移动端推送 | 需集成APNs/FCM，Socket.io不适合后台推送 |

---

## 📖 参考资料

- [Socket.io官方文档](https://socket.io/docs/v4/)
- [Socket.io Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [WebSocket API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Socket.io认证最佳实践](https://socket.io/how-to/use-with-jwt)
- [横向扩展Socket.io](https://socket.io/docs/v4/using-multiple-nodes/)

---

## 🔄 代码演进总结

| 版本 | 主题 | 核心能力 |
|------|------|----------|
| v1 | 基础聊天室 | 连接管理、自定义事件、房间join/leave、消息广播 |
| v2 | 认证 + 通知 | JWT认证中间件、Namespace隔离、速率限制、定向通知 |
| v3 | 集群 + 生产 | Redis Adapter多节点、在线状态(Redis)、生产配置、优雅关闭 |

> 💡 **学习路径**：v1理解Socket.io基本模型 → v2学会安全和多通道 → v3掌握生产级集群部署。实时系统的核心挑战是：可靠性（重连+消息补发）、安全性（认证+限流）、可扩展性（Adapter+负载均衡）。
