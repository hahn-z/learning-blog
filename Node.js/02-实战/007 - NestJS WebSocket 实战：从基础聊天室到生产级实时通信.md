---
title: "007 - NestJS WebSocket 实战：从基础聊天室到生产级实时通信"
slug: "007-nestjs-websocket"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.704+08:00"
updated_at: "2026-04-29T10:02:48.072+08:00"
reading_time: 37
tags: []
---

## 难度标注

> ⭐⭐⭐☆☆ 中等偏上 | 适合有 NestJS 基础的开发者

## 概念讲解

### 什么是 WebSocket？

WebSocket 是一种在单个 TCP 连接上进行全双工通信的协议。与 HTTP 的请求-响应模式不同，WebSocket 允许服务器主动向客户端推送数据，非常适合实时应用场景。

### NestJS 中的 WebSocket

NestJS 对 WebSocket 提供了一流的支持，内置了 Socket.IO 和原生 WebSocket 两种适配器。通过装饰器和网关（Gateway）的模式，让 WebSocket 开发变得优雅且模块化。

**核心概念：**
- **Gateway（网关）**：类似 Controller，但处理 WebSocket 连接和消息
- **Adapter（适配器）**：抽象底层 WebSocket 实现（Socket.IO / ws）
- **装饰器**：`@WebSocketGateway`、`@SubscribeMessage`、`@ConnectedSocket` 等
- **Namespace & Room**：逻辑分组，实现定向推送

### 适用场景

| 场景 | 说明 |
|------|------|
| 即时聊天 | 多人实时消息收发 |
| 实时通知 | 系统公告、订单状态推送 |
| 协作编辑 | 多人文档协同 |
| 实时数据面板 | 股票行情、监控大屏 |
| 游戏同步 | 多人游戏状态同步 |

## 脑图

```
NestJS WebSocket
├── 基础概念
│   ├── WebSocket 协议 (RFC 6455)
│   ├── 全双工通信
│   └── 与 HTTP 轮询对比
├── NestJS 实现
│   ├── @WebSocketGateway 装饰器
│   ├── Socket.IO Adapter (默认)
│   ├── WsAdapter (原生 ws)
│   └── 自定义 Adapter
├── 核心组件
│   ├── Gateway 类
│   ├── @SubscribeMessage()
│   ├── @ConnectedSocket()
│   └── WebSocketServer 实例
├── 高级特性
│   ├── Namespace 命名空间
│   ├── Room 房间
│   ├── 认证 (JWT)
│   └── 拦截器 & 守卫
└── 最佳实践
    ├── 异常处理
    ├── 日志记录
    ├── 水平扩展 (Redis Adapter)
    └── 心跳与重连
```

## 完整代码

### 项目初始化

```bash
nest new websocket-demo
cd websocket-demo
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

### v1：基础聊天室

```typescript
// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' }, // Allow cross-origin in development
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track online users: socketId -> username
  private users: Map<string, string> = new Map();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    // Notify others about new connection
    client.broadcast.emit('user-joined', {
      message: 'A new user has joined the chat',
      onlineCount: this.users.size + 1,
    });
  }

  handleDisconnect(client: Socket) {
    const username = this.users.get(client.id);
    this.users.delete(client.id);
    console.log(`Client disconnected: ${client.id} (${username})`);
    // Notify others about disconnection
    this.server.emit('user-left', {
      username,
      onlineCount: this.users.size,
    });
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() username: string,
  ) {
    this.users.set(client.id, username);
    // Send welcome message to the joining user
    client.emit('message', {
      from: 'System',
      text: `Welcome, ${username}!`,
      timestamp: new Date().toISOString(),
    });
    // Broadcast to others
    client.broadcast.emit('message', {
      from: 'System',
      text: `${username} has joined the chat`,
      timestamp: new Date().toISOString(),
    });
    // Send current online count
    this.server.emit('online-count', this.users.size);
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text: string },
  ) {
    const username = this.users.get(client.id) || 'Anonymous';
    const message = {
      from: username,
      text: data.text,
      timestamp: new Date().toISOString(),
    };
    // Broadcast to all clients including sender
    this.server.emit('message', message);
  }
}
```

```typescript
// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

@Module({
  providers: [ChatGateway],
})
export class ChatModule {}
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [ChatModule],
})
export class AppModule {}
```

### v2：加入 Room 和 JWT 认证

```typescript
// src/chat/chat.gateway.ts (v2)
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

interface ChatMessage {
  from: string;
  text: string;
  room: string;
  timestamp: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat', // Use custom namespace
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private users: Map<string, { username: string; rooms: string[] }> = new Map();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake auth
      const token = client.handshake.auth.token;
      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token);
      const username = payload.username || payload.sub;

      this.users.set(client.id, { username, rooms: [] });
      console.log(`User authenticated: ${username} (${client.id})`);
    } catch (err) {
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.users.get(client.id);
    if (user) {
      // Leave all rooms
      user.rooms.forEach((room) => {
        client.leave(room);
        this.server.to(room).emit('user-left', {
          username: user.username,
          room,
          onlineCount: this.getRoomUserCount(room),
        });
      });
      this.users.delete(client.id);
    }
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ) {
    const user = this.users.get(client.id);
    if (!user) return;

    client.join(room);
    user.rooms.push(room);

    // Notify room members
    this.server.to(room).emit('user-joined', {
      username: user.username,
      room,
      onlineCount: this.getRoomUserCount(room),
    });

    // Send room history (in production, load from DB)
    client.emit('room-ready', { room });
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ) {
    const user = this.users.get(client.id);
    if (!user) return;

    client.leave(room);
    user.rooms = user.rooms.filter((r) => r !== room);

    this.server.to(room).emit('user-left', {
      username: user.username,
      room,
      onlineCount: this.getRoomUserCount(room),
    });
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text: string; room: string },
  ) {
    const user = this.users.get(client.id);
    if (!user) return;

    const message: ChatMessage = {
      from: user.username,
      text: data.text,
      room: data.room,
      timestamp: new Date().toISOString(),
    };

    // Only broadcast to users in the same room
    this.server.to(data.room).emit('message', message);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ) {
    const user = this.users.get(client.id);
    if (!user) return;
    // Broadcast typing indicator to others in the room
    client.to(room).emit('typing', { username: user.username });
  }

  /** Count unique users in a room */
  private getRoomUserCount(room: string): number {
    const sockets = this.server.sockets.adapter.rooms.get(room);
    return sockets ? sockets.size : 0;
  }
}
```

### v3：生产级 — 守卫、拦截器、Redis 适配器

```typescript
// src/auth/ws-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const token = client.handshake.auth.token;
    if (!token) return false;

    try {
      const payload = await this.jwtService.verifyAsync(token);
      // Attach user info to client for later use
      client.data.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
```

```typescript
// src/common/ws-logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class WsLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const client = context.switchToWs().getClient();
    const event = context.switchToWs().getPattern();
    console.log(`[WS] ${client.id} -> ${event}`);
    return next.handle().pipe(
      tap(() => console.log(`[WS] ${client.id} <- ${event} (completed)`)),
    );
  }
}
```

```typescript
// src/redis-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis() {
    const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

```typescript
// src/main.ts (v3 - with Redis adapter for scaling)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Redis adapter for horizontal scaling
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  await app.listen(3000);
  console.log('Application running on http://localhost:3000');
}
bootstrap();
```

### 客户端代码（浏览器端）

```html
<!-- index.html - Simple chat client -->
<!DOCTYPE html>
<html>
<head>
  <title>NestJS WebSocket Chat</title>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
</head>
<body>
  <div id="messages"></div>
  <input id="input" placeholder="Type a message..." />
  <button onclick="send()">Send</button>
  <script>
    const socket = io('http://localhost:3000/chat', {
      auth: { token: 'your-jwt-token-here' }
    });

    socket.on('connect', () => console.log('Connected:', socket.id));
    socket.on('message', (msg) => {
      const div = document.createElement('div');
      div.textContent = `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.from}: ${msg.text}`;
      document.getElementById('messages').appendChild(div);
    });

    function send() {
      const input = document.getElementById('input');
      socket.emit('message', { text: input.value, room: 'general' });
      input.value = '';
    }
  </script>
</body>
</html>
```

## 执行预览

```bash
# 启动服务
$ npm run start:dev

[Nest] 12345  - 04/29/2026     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 04/29/2026     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 04/29/2026     LOG [InstanceLoader] ChatModule dependencies initialized
[Nest] 12345  - 04/29/2026     LOG [NestApplication] Nest application successfully started
Application running on http://localhost:3000

# 用户连接
User authenticated: alice (socket-abc123)
User authenticated: bob (socket-def456)

# 消息交互
[WS] socket-abc123 -> message
[WS] socket-abc123 <- message (completed)
[WS] socket-def456 -> typing
```

## 注意事项

| 项目 | 说明 |
|------|------|
| CORS | 开发环境用 `*`，生产环境必须限定域名 |
| 认证 | 连接时验证 JWT，断开时清理状态 |
| 内存 | users Map 存在内存中，多实例需用 Redis 共享 |
| 心跳 | Socket.IO 默认每 25 秒发 ping，超时 20 秒断开 |
| 房间上限 | 单个 Socket.IO 实例建议不超过 10000 并发连接 |
| 消息大小 | Socket.IO 默认消息限制 1MB，可配置 |
| 错误处理 | Gateway 中必须 try-catch，未捕获异常会断开连接 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 在 Gateway 构造函数中注入 Request | Gateway 是单例，用 `@ConnectedSocket` 获取客户端信息 |
| 直接使用 `io.emit()` 广播所有消息 | 用 Room 做定向推送，避免消息泛滥 |
| 在 `handleConnection` 中不做认证 | 连接时验证身份，非法连接立即断开 |
| 用内存 Map 存用户状态做多实例部署 | 多实例必须用 Redis Adapter 共享状态 |
| 忽略 `handleDisconnect` 的清理 | 断开时必须清理用户数据、离开房间 |
| 在 `@SubscribeMessage` 中返回 void | 应返回数据或使用 `event.emit()` 确保响应 |
| 生产环境使用默认 cors `*` | 配置具体允许的 origin 列表 |

## 练习题

### 🟢 初级

1. 创建一个简单的 WebSocket Gateway，实现客户端连接时发送欢迎消息
2. 实现 `@SubscribeMessage('ping')` 处理器，返回 `{ status: 'pong', timestamp: Date.now() }`
3. 在 Gateway 中追踪在线人数，每次连接/断开时广播更新

### 🟡 中级

4. 实现 Room 功能：用户可以加入/离开房间，消息只在房间内广播
5. 添加 JWT 认证，连接时验证 token，失败则拒绝连接
6. 实现"正在输入"提示（typing indicator），只在当前房间内广播

### 🔴 高级

7. 配置 Redis Adapter，实现多实例水平扩展
8. 编写 WebSocket 守卫（Guard），对特定消息事件做权限检查
9. 实现消息持久化：将聊天消息存储到数据库，新用户加入时加载历史记录

## 知识点总结

```
NestJS WebSocket 知识树
├── 基础
│   ├── WebSocketGateway 装饰器
│   ├── SubscribeMessage 装饰器
│   ├── OnGatewayConnection 接口
│   └── OnGatewayDisconnect 接口
├── 核心 API
│   ├── client.emit() - 发给当前客户端
│   ├── client.broadcast.emit() - 发给其他客户端
│   ├── server.emit() - 发给所有客户端
│   └── server.to(room).emit() - 发给房间内客户端
├── Room 管理
│   ├── client.join(room)
│   ├── client.leave(room)
│   └── server.sockets.adapter.rooms
├── 认证
│   ├── handshake.auth.token
│   ├── WsAuthGuard
│   └── 异步 handleConnection 验证
├── 扩展
│   ├── Redis IoAdapter
│   ├── 自定义 Adapter
│   └── Namespace 隔离
└── 生产部署
    ├── 心跳配置
    ├── 消息大小限制
    └── 连接数优化
```

## 举一反三

| 技术点 | 本文实现 | 类似场景 | 迁移方案 |
|--------|---------|---------|---------|
| 实时消息 | 聊天室 | 协作白板 | 用 Canvas 同步 drawing 事件 |
| 房间机制 | 聊天分组 | 直播弹幕 | 每个直播间一个 Room |
| JWT 认证 | 连接验证 | 在线游戏 | 加入 token 中的角色信息做权限 |
| Redis Adapter | 多实例 | 分布式通知 | 替换为 Kafka/RabbitMQ 适配器 |
| Typing 指示 | 聊天输入 | 文档协作 | 同步光标位置和选区 |
| 历史消息 | Room 加入时 | 历史回放 | 用游标分页从 DB 加载 |

## 参考资料

- [NestJS WebSockets 官方文档](https://docs.nestjs.com/websockets/gateways)
- [Socket.IO 官方文档](https://socket.io/docs/v4/)
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [NestJS Guards 文档](https://docs.nestjs.com/guards)

## 代码演进

```
v1 (基础聊天室)
├── 单 Gateway 实现
├── 全局广播消息
├── 内存存储用户
└── 无认证

       ↓ 加入 Room + JWT

v2 (多房间 + 认证)
├── Room 加入/离开
├── JWT 连接认证
├── Namespace 隔离
├── Typing 指示
└── 定向消息推送

       ↓ 生产化

v3 (生产级)
├── WsAuthGuard 守卫
├── 拦截器日志
├── Redis Adapter 水平扩展
├── 异常过滤器
└── 可观测性
```
