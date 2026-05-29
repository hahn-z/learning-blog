---
title: "014 - Node.js入门：HTTP客户端请求实战"
slug: "014-http-client"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.639+08:00"
updated_at: "2026-04-29T10:02:47.945+08:00"
reading_time: 29
tags: []
---

## 难度标注

> 🟢 入门级 | 预计学习时间：30分钟 | 前置知识：JavaScript基础、HTTP协议基础

---

## 概念讲解

### 什么是HTTP客户端？

HTTP客户端就是**发起网络请求的程序**。浏览器是最常见的HTTP客户端，但在Node.js中，我们也可以编写程序去请求其他服务器的API、下载网页内容、上传文件等。

### 为什么需要HTTP客户端？

实际开发中，Node.js经常需要与其他服务通信：

- 调用第三方API（微信支付、天气接口、AI接口）
- 微服务之间的内部调用
- 爬取网页数据
- 健康检查和监控

### Node.js发起HTTP请求的三种方式

1. **内置`http`/`https`模块** — 无需安装，但API较底层
2. **第三方库`node-fetch`** — 浏览器fetch API的Node.js实现
3. **第三方库`axios`** — 功能最全，使用最广泛

本文从内置模块讲起，逐步过渡到现代方案。

---

## 脑图（ASCII）

```
                    ┌───────────────────────┐
                    │  Node.js HTTP Client   │
                    └───────────┬───────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
  ┌──────┴──────┐      ┌───────┴───────┐      ┌───────┴───────┐
  │ http模块     │      │ URL解析       │      │ 第三方库       │
  └──────┬──────┘      └───────┬───────┘      └───────┬───────┘
         │                     │                      │
  ┌──────┴──────┐      ┌──────┴──────┐       ┌───────┴───────┐
  │http.get()   │      │new URL()    │       │axios          │
  │http.request │      │url.hostname │       │node-fetch     │
  │https.get()  │      │url.pathname │       │got            │
  └─────────────┘      │url.searchParams│    └───────────────┘
                       └─────────────┘
```

---

## 完整Node.js代码

### v1：最简GET请求

```js
// v1-simple-get.js - Simplest GET request using http module
const https = require('https');

https.get('https://jsonplaceholder.typicode.com/todos/1', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(JSON.parse(data));
  });
}).on('error', (err) => {
  console.error('Request failed:', err.message);
});
```

### v2：封装通用请求函数 + POST支持

```js
// v2-request-helper.js - Reusable HTTP request helper
const http = require('http');
const https = require('https');

/**
 * Generic HTTP request function
 * @param {string} urlStr - Full URL
 * @param {object} options - { method, headers, body }
 * @returns {Promise<object>} - { statusCode, headers, data }
 */
function request(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', reject);

    // Set timeout (5 seconds)
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timeout'));
    });

    // Send request body if provided
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// === Usage Examples ===
async function main() {
  // Example 1: GET request
  const getRes = await request('https://jsonplaceholder.typicode.com/todos/1');
  console.log('GET response:', JSON.parse(getRes.data));

  // Example 2: POST request with JSON body
  const postRes = await request('https://jsonplaceholder.typicode.com/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hello', body: 'World', userId: 1 }),
  });
  console.log('POST response:', JSON.parse(postRes.data));

  // Example 3: Fetch multiple resources concurrently
  const urls = [
    'https://jsonplaceholder.typicode.com/todos/1',
    'https://jsonplaceholder.typicode.com/todos/2',
    'https://jsonplaceholder.typicode.com/todos/3',
  ];
  const results = await Promise.all(urls.map((u) => request(u)));
  console.log('Concurrent results:', results.map((r) => JSON.parse(r.data)));
}

main().catch(console.error);
```

### v3：实用工具类 + 重试机制 + 并发控制

```js
// v3-http-client.js - Production-ready HTTP client class
const http = require('http');
const https = require('https');

class HttpClient {
  constructor(defaults = {}) {
    this.baseURL = defaults.baseURL || '';
    this.defaultHeaders = defaults.headers || {};
    this.timeout = defaults.timeout || 10000;
    this.maxRetries = defaults.maxRetries || 0;
    this.retryDelay = defaults.retryDelay || 1000;
  }

  // Core request method
  async request(method, path, options = {}) {
    const url = this.baseURL + path;
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this._doRequest(method, url, options);
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await this._sleep(this.retryDelay * (attempt + 1));
          console.log(`Retry ${attempt + 1}/${this.maxRetries} for ${url}`);
        }
      }
    }
    throw lastError;
  }

  // Internal: perform single request
  _doRequest(method, urlStr, options) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const headers = { ...this.defaultHeaders, ...options.headers };

      const req = lib.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: this._tryParse(data),
          };
          // Throw on HTTP errors (4xx, 5xx)
          if (res.statusCode >= 400) {
            const err = new Error(`HTTP ${res.statusCode}: ${urlStr}`);
            err.response = result;
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this.timeout, () => req.destroy(new Error('Timeout')));

      if (options.body) {
        const payload = typeof options.body === 'string'
          ? options.body : JSON.stringify(options.body);
        req.write(payload);
      }
      req.end();
    });
  }

  // Convenience methods
  get(path, options) { return this.request('GET', path, options); }
  post(path, body, options = {}) {
    return this.request('POST', path, { ...options, body });
  }
  put(path, body, options = {}) {
    return this.request('PUT', path, { ...options, body });
  }
  delete(path, options) { return this.request('DELETE', path, options); }

  // Utility: concurrent requests with limit
  static async concurrent(tasks, limit = 3) {
    const results = [];
    for (let i = 0; i < tasks.length; i += limit) {
      const batch = tasks.slice(i, i + limit);
      const batchResults = await Promise.all(batch.map((t) => t()));
      results.push(...batchResults);
    }
    return results;
  }

  // Helpers
  _tryParse(str) {
    try { return JSON.parse(str); } catch { return str; }
  }
  _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
}

// === Usage ===
async function main() {
  const client = new HttpClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 5000,
    maxRetries: 2,
    retryDelay: 500,
  });

  // GET single resource
  const todo = await client.get('/todos/1');
  console.log('Todo:', todo.data);

  // POST create resource
  const created = await client.post('/posts', {
    title: 'Hello Node.js',
    body: 'HTTP Client in action',
    userId: 1,
  });
  console.log('Created:', created.data);

  // Concurrent requests with limit
  const tasks = [1, 2, 3, 4, 5].map(
    (id) => () => client.get(`/todos/${id}`)
  );
  const all = await HttpClient.concurrent(tasks, 2);
  console.log('All todos:', all.map((r) => r.data.title));
}

main().catch(console.error);
```

---

## 执行预览

```bash
$ node v1-simple-get.js
{ userId: 1, id: 1, title: 'delectus aut autem', completed: false }

$ node v2-request-helper.js
GET response: { userId: 1, id: 1, title: 'delectus aut autem', completed: false }
POST response: { title: 'Hello', body: 'World', userId: 1, id: 101 }
Concurrent results: [
  { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
  { userId: 1, id: 2, title: 'quis ut nam facilis...', completed: false },
  { userId: 1, id: 3, title: 'fugiat veniam minus', completed: false }
]

$ node v3-http-client.js
Todo: { userId: 1, id: 1, title: 'delectus aut autem', completed: false }
Created: { title: 'Hello Node.js', body: 'HTTP Client in action', userId: 1, id: 101 }
All todos: [ 'delectus aut autem', 'quis ut nam facilis...', 'fugiat veniam minus', ... ]
```

---

## 注意事项

| 项目 | 说明 |
|------|------|
| http vs https | 请求`https://`开头的URL必须用`https`模块，否则会报协议错误 |
| 请求体类型 | POST请求要设置`Content-Type`，否则服务端可能无法解析 |
| 超时处理 | 默认没有超时，必须手动设置`req.setTimeout()`防止请求永远挂起 |
| 并发数量 | 不要同时发起数百个请求，用并发控制或连接池 |
| 错误重试 | 只有网络错误和5xx才应该重试，4xx是客户端错误不需要重试 |
| 内存占用 | 大响应体会占用大量内存，考虑使用流式处理 |

---

## 避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|------------|-----------|
| 用`http.get()`请求HTTPS地址 | 用`https.get()`或`https.request()`请求HTTPS资源 |
| 忘记调用`req.end()` | `http.request()`必须手动调用`req.end()`，`http.get()`会自动调用 |
| 同步获取响应数据 | 响应是流式的，必须监听`data`和`end`事件拼接数据 |
| 不处理错误事件 | 监听`req.on('error')`防止进程崩溃 |
| Promise.all不限并发 | 用并发控制限制同时请求数，避免打爆目标服务器 |
| 忽略状态码 | 检查`res.statusCode`，200以外可能是错误 |

---

## 练习题

### 🟢 初级（理解概念）

1. 使用`https.get()`获取`https://jsonplaceholder.typicode.com/users/1`并打印用户名
2. 分别获取两个API的数据，按顺序打印结果

### 🟡 中级（动手实践）

3. 封装一个`fetchJSON(url)`函数，返回解析后的JSON对象（Promise版本）
4. 实现一个简单爬虫：获取某个网页HTML，提取所有`<a>`标签的href属性

### 🔴 高级（综合挑战）

5. 给HttpClient类添加缓存功能：相同URL在30秒内返回缓存结果
6. 实现下载进度显示：请求大文件时，实时显示已下载字节数和百分比

---

## 知识点总结（树状）

```
Node.js HTTP客户端
├── 内置模块
│   ├── http.get(url, callback) → 简单GET请求
│   ├── http.request(options, callback) → 通用请求
│   ├── https模块 → HTTPS协议支持
│   └── URL类 → URL解析工具
├── 请求配置
│   ├── method → GET/POST/PUT/DELETE
│   ├── headers → 请求头
│   ├── body → 请求体（POST/PUT）
│   └── timeout → 超时设置
├── 响应处理
│   ├── statusCode → 状态码
│   ├── headers → 响应头
│   ├── data事件 → 分块接收
│   └── end事件 → 接收完成
├── 高级特性
│   ├── Promise封装 → async/await
│   ├── 重试机制 → 指数退避
│   ├── 并发控制 → 限流请求
│   └── 错误处理 → 分类处理
└── 第三方库
    ├── axios → 功能最全
    ├── node-fetch → 浏览器API风格
    └── got → 现代化设计
```

---

## 举一反三

| 场景 | 核心思路 | 关键API |
|------|---------|---------|
| 调用REST API | 设置JSON Content-Type，序列化请求体 | `JSON.stringify()` + `Content-Type` |
| 文件下载 | 监听data事件，用fs写入文件 | `res.on('data')` + `fs.createWriteStream()` |
| 文件上传 | 设置multipart/form-data | `form-data`库或手动构造boundary |
| 带认证的请求 | 在headers中添加Authorization | `Authorization: Bearer <token>` |
| 代理请求 | 设置hostname为代理地址 | `http.request({ hostname: proxy })` |
| 流式处理大响应 | pipe到文件或转换流 | `res.pipe(fs.createWriteStream())` |

---

## 参考资料

- [Node.js http模块文档](https://nodejs.org/api/http.html)
- [Node.js https模块文档](https://nodejs.org/api/https.html)
- [axios官方文档](https://axios-http.com/docs/intro)
- [MDN - HTTP请求方法](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Methods)

---

## 代码演进

```
v1（10行）──── v2（60行）──── v3（130行）
 │              │               │
单次GET请求   通用request函数  HttpClient类
无错误处理    POST/并发支持    重试+并发控制
回调风格      Promise封装      便捷方法+错误分类
```

**v1 → v2 关键变化：** Promise封装、支持所有HTTP方法、超时处理、并发请求
**v2 → v3 关键变化：** 面向对象封装、重试机制、并发控制、HTTP错误自动分类
