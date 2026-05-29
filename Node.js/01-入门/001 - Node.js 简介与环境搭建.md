---
title: "001 - Node.js 简介与环境搭建"
slug: "001-node-intro"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.568+08:00"
updated_at: "2026-04-29T10:02:47.829+08:00"
reading_time: 17
tags: []
---

# Node.js 简介与环境搭建

> **难度：** ⭐ 入门级 | **预计阅读：** 15 分钟 | **标签：** Node.js, 环境搭建, JavaScript

---

## 一、概念讲解

### 1.1 什么是 Node.js？

Node.js 是一个基于 **Chrome V8 引擎**的 JavaScript 运行时环境。它让 JavaScript 跳出浏览器的牢笼，可以在服务器端运行。

核心特点：
- **事件驱动（Event-Driven）**：通过事件循环处理并发，而非多线程
- **非阻塞 I/O（Non-blocking I/O）**：I/O 操作不会阻塞主线程
- **单线程主循环**：主线程只有一个，但通过事件循环实现高并发
- **npm 生态**：拥有全球最大的开源库生态系统

### 1.2 Node.js vs 浏览器 JavaScript

| 特性 | 浏览器 JS | Node.js |
|------|-----------|---------|
| 运行环境 | 浏览器 | 操作系统 |
| DOM 操作 | ✅ 有 | ❌ 没有 |
| 文件系统 | ❌ 没有 | ✅ 有 |
| 网络服务 | 受限（CORS等） | 完整 TCP/HTTP |
| 模块系统 | ES Modules | CommonJS + ESM |
| 全局对象 | `window` | `global` / `globalThis` |

### 1.3 Node.js 适合做什么？

- ✅ REST API / GraphQL 服务
- ✅ 实时应用（聊天、协作工具）
- ✅ 微服务架构
- ✅ CLI 工具
- ✅ 服务端渲染（SSR）
- ❌ CPU 密集型计算（视频编码、科学计算）

---

## 二、知识脑图

```
Node.js 入门
├── 核心概念
│   ├── V8 引擎（Google Chrome 的 JS 引擎）
│   ├── 事件循环（Event Loop）
│   ├── 非阻塞 I/O
│   └── 单线程 + 异步回调
├── 安装方式
│   ├── 官网安装包（nodejs.org）
│   ├── nvm（推荐）
│   └── 包管理器（apt, brew）
├── 版本策略
│   ├── LTS（长期支持）→ 生产环境用这个
│   └── Current（最新特性）→ 学习尝鲜
├── 基本使用
│   ├── node xxx.js → 运行脚本
│   ├── node -e "code" → 执行一行
│   └── node → 进入 REPL
└── 第一个服务器
    ├── http.createServer()
    └── 监听端口响应请求
```

---

## 三、完整代码示例

### 3.1 基础：Hello World 脚本

```javascript
// hello.js - Your first Node.js script
console.log('Hello, Node.js!');

// Check Node.js version
console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`PID: ${process.pid}`);
```

### 3.2 进阶：HTTP 服务器

```javascript
// server.js - A simple HTTP server
const http = require('http');
const os = require('os');

const PORT = 3000;

const server = http.createServer((req, res) => {
  const { method, url } = req;

  // Simple routing
  if (url === '/' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Welcome to Node.js!',
      uptime: `${(process.uptime()).toFixed(2)}s`,
      hostname: os.hostname(),
      timestamp: new Date().toISOString()
    }));
  } else if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
```

### 3.3 文件操作示例

```javascript
// files.js - Basic file operations
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'demo.txt');

// Write file (async)
fs.writeFile(filePath, 'Hello from Node.js!\n', (err) => {
  if (err) throw err;
  console.log('File written successfully');

  // Read file back
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) throw err;
    console.log('File content:', data.trim());
  });
});

// Check file stats
fs.stat(filePath, (err, stats) => {
  if (err) return;
  console.log(`File size: ${stats.size} bytes`);
  console.log(`Is file: ${stats.isFile()}`);
});
```

---

## 四、执行预览

```bash
# 运行 Hello World
$ node hello.js
Hello, Node.js!
Node version: v20.11.0
Platform: linux
PID: 12345

# 启动 HTTP 服务器
$ node server.js
Server running at http://localhost:3000/

# 另一个终端测试
$ curl http://localhost:3000/
{"message":"Welcome to Node.js!","uptime":"3.21s","hostname":"my-pc","timestamp":"2024-01-15T10:30:00.000Z"}

$ curl http://localhost:3000/health
{"status":"ok","memory":"12.34 MB"}

$ curl http://localhost:3000/unknown
Not Found
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 版本选择 | LTS vs Current | 生产环境必须用 LTS |
| 端口冲突 | 3000 端口可能被占用 | 换端口或杀进程 `lsof -i :3000` |
| 进程退出 | 未捕获异常导致崩溃 | 使用 `process.on('uncaughtException')` |
| 中文乱码 | 终端编码问题 | 设置 `Content-Type: charset=utf-8` |
| 权限问题 | 1024 以下端口需要 root | 使用 1024 以上端口或 `sudo` |
| 热更新 | 修改代码需重启 | 开发用 `nodemon` 自动重启 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 官网下载安装，全局只有一个版本 | 用 **nvm** 管理多版本 |
| 用 Current 版本部署生产 | 用 **LTS** 版本，稳定且有安全更新 |
| `var` 声明变量 | 用 `const` 为主，`let` 辅助，不用 `var` |
| 同步 API 读文件 `fs.readFileSync` | 异步 API `fs.readFile` 或 `fs.promises` |
| 忽略错误回调 `err` 参数 | **始终检查** err 参数 |
| 端口写死在代码里 | 用环境变量 `process.env.PORT || 3000` |

---

## 七、练习题

### 🟢 入门
1. 安装 Node.js，运行 `node -v` 确认安装成功
2. 创建 `hello.js`，输出你的名字和当前时间
3. 用 `node -e "console.log(1+1)"` 在命令行执行一行代码

### 🟡 进阶
4. 修改 server.js，添加一个 `/time` 路由，返回当前服务器时间
5. 用 `fs` 模块创建一个 JSON 文件并读取输出
6. 使用 `process.env` 读取环境变量，让端口可通过 `PORT=4000 node server.js` 指定

### 🔴 挑战
7. 实现一个简单的静态文件服务器，根据 URL 返回对应文件内容
8. 给服务器加上请求日志，记录每个请求的方法、路径、响应时间和状态码

---

## 八、知识点总结

```
Node.js 入门
├── 安装
│   ├── nvm install <version>
│   ├── nvm use <version>
│   └── node -v 验证
├── 核心 API
│   ├── process（进程信息）
│   ├── http（HTTP 服务）
│   ├── fs（文件系统）
│   └── path（路径处理）
├── 运行方式
│   ├── node script.js
│   ├── node -e "code"
│   └── node（REPL）
└── 开发工具
    ├── nodemon（热重载）
    └── package.json（项目配置）
```

---

## 九、举一反三

| 场景 | 你学到的 | 扩展应用 |
|------|---------|---------|
| HTTP 服务器 | `http.createServer()` | Express/Koa 框架 |
| 文件读写 | `fs.readFile/writeFile` | 日志系统、配置管理 |
| 环境变量 | `process.env` | dotenv 配置管理 |
| 路径处理 | `path.join()` | 静态文件服务、模板引擎 |
| 进程信息 | `process.version/uptime` | 健康检查接口、监控 |

---

## 十、参考资料

- [Node.js 官方文档](https://nodejs.org/docs/latest/api/)
- [Node.js 最佳实践](https://github.com/goldbergyoni/nodebestpractices)
- [nvm 仓库](https://github.com/nvm-sh/nvm)
- [The Node.js Handbook — Flavio Copes](https://nodehandbook.com/)

---

## 十一、代码演进

### v1：最小化版本
```javascript
// v1 - Minimal HTTP server
const http = require('http');
http.createServer((req, res) => {
  res.end('Hello World');
}).listen(3000);
```

### v2：添加路由和 JSON 响应
```javascript
// v2 - Add routing and JSON response
const http = require('http');
http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello World', time: new Date() }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(3000);
```

### v3：完整版（提取环境变量 + 健康检查 + 日志）
```javascript
// v3 - Full version with env, health check, and logging
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const start = Date.now();
  const { method, url } = req;

  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Welcome!',
      uptime: `${process.uptime().toFixed(0)}s`
    }));
  } else if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const mem = process.memoryUsage();
    res.end(JSON.stringify({ status: 'ok', heap: `${(mem.heapUsed/1024/1024).toFixed(1)}MB` }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }

  const duration = Date.now() - start;
  console.log(`${method} ${url} → ${res.statusCode} (${duration}ms)`);
});

server.listen(PORT, () => console.log(`Listening on :${PORT}`));
```
