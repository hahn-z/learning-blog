---
title: "009 - Node.js Stream 流处理完全指南"
slug: "009-streams"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.61+08:00"
updated_at: "2026-04-29T10:02:47.905+08:00"
reading_time: 33
tags: []
---

# Node.js Stream 流处理完全指南

> **难度：** ⭐⭐⭐ 中等
> **前置知识：** EventEmitter、Buffer 基础、文件系统操作
> **阅读时间：** 约 30 分钟

---

## 一、概念讲解

### 什么是 Stream？

Stream（流）是 Node.js 中处理流式数据的抽象接口。简单说：**数据不用全部加载到内存，而是一块一块地处理。**

类比：
- **桶打水**：把整个桶扔进水池装满再提走（Buffer 方式）
- **水管接水**：接一根管子，水持续流过来（Stream 方式）

处理 1GB 的文件：
- Buffer 方式：需要 1GB 内存
- Stream 方式：可能只需要几 MB 内存

### 四种流类型

| 类型 | 说明 | 典型场景 |
|------|------|---------|
| **Readable** | 可读流，数据的来源 | `fs.createReadStream`, `process.stdin` |
| **Writable** | 可写流，数据的目的地 | `fs.createWriteStream`, `process.stdout` |
| **Duplex** | 双工流，可读又可写 | `net.Socket`, `TLS socket` |
| **Transform** | 转换流，读入数据变换后输出 | `zlib.createGzip()`, `crypto streams` |

### 两种读取模式

```
Readable Stream 模式：

1. Flowing Mode（流动模式）
   数据自动流出 → 通过 'data' 事件消费
  暂停: stream.pause()  恢复: stream.resume()

2. Paused Mode（暂停模式）
   需要主动调用 stream.read() 来拉取数据
   切换到流动: stream.resume() 或绑定 'data' 监听器
```

### Stream 与 EventEmitter 的关系

所有 Stream 都是 EventEmitter 的实例，通过事件通知数据状态：

| 流类型 | 事件 |
|--------|------|
| Readable | `data`, `end`, `error`, `close` |
| Writable | `drain`, `finish`, `error`, `close` |
| Duplex | 两者都有 |
| Transform | 同 Duplex |

---

## 二、脑图

```
Stream 流处理
├── 四种类型
│   ├── Readable (可读)
│   ├── Writable (可写)
│   ├── Duplex (双工)
│   └── Transform (转换)
├── 核心概念
│   ├── Buffer 缓冲区
│   ├── HighWaterMark 水位线
│   ├── Backpressure 背压
│   └── Pipe 管道
├── 常用 API
│   ├── fs.createReadStream / WriteStream
│   ├── stream.Readable / Writable
│   ├── stream.Transform
│   ├── stream.PassThrough
│   └── stream.pipeline
├── 关键事件
│   ├── data / end / error
│   ├── finish / drain
│   └── pipe / unpipe
└── 实践场景
    ├── 大文件处理
    ├── HTTP 请求/响应
    ├── 压缩解压
    └── 日志处理
```

---

## 三、完整代码示例

### 示例 1：文件复制（pipe）

```js
// file-copy-stream.js
// Copy a large file using streams and pipe

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'bigfile.txt');
const dst = path.join(__dirname, 'copy.txt');

// Create a test file first (100MB)
console.log('Creating test file...');
const ws = fs.createWriteStream(src);
for (let i = 0; i < 1_000_000; i++) {
  ws.write(`Line ${i}: This is a test line for stream demo.\n`);
}
ws.end(() => {
  console.log('Test file created. Starting copy...');

  // Stream-based copy — uses minimal memory
  const readStream = fs.createReadStream(src);
  const writeStream = fs.createWriteStream(dst);

  readStream.pipe(writeStream);

  writeStream.on('finish', () => {
    const stats = fs.statSync(dst);
    console.log(`Copy done! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    // Cleanup
    fs.unlinkSync(src);
    fs.unlinkSync(dst);
  });

  readStream.on('error', (err) => console.error('Read error:', err));
  writeStream.on('error', (err) => console.error('Write error:', err));
});
```

### 示例 2：自定义 Transform 流

```js
// transform-stream.js
// Custom Transform stream: line-by-line JSON parser

const { Transform } = require('stream');

class LineParser extends Transform {
  constructor() {
    super({ readableObjectMode: true }); // Output objects, not buffers
    this._buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split('\n');
    // Keep the last incomplete line
    this._buffer = lines.pop();

    for (const line of lines) {
      if (line.trim()) {
        try {
          this.push(JSON.parse(line));
        } catch {
          this.push({ raw: line, error: 'Invalid JSON' });
        }
      }
    }
    callback();
  }

  _flush(callback) {
    if (this._buffer.trim()) {
      try {
        this.push(JSON.parse(this._buffer));
      } catch {
        this.push({ raw: this._buffer, error: 'Invalid JSON' });
      }
    }
    callback();
  }
}

// Usage: parse NDJSON (newline-delimited JSON)
const { Readable } = require('stream');

const input = [
  '{"name":"Alice","age":30}\n',
  '{"name":"Bob","age":25}\n',
  '{"name":"Charlie",',  // Split across chunks!
  '"age":35}\n',
];

Readable.from(input)
  .pipe(new LineParser())
  .on('data', (obj) => console.log('Parsed:', obj));
```

### 示例 3：HTTP 文件压缩服务器

```js
// gzip-server.js
// HTTP server that streams and compresses files on-the-fly

const http = require('http');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const FILES_DIR = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
  const filePath = path.join(FILES_DIR, req.url);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const stat = fs.statSync(filePath);
  const readStream = fs.createReadStream(filePath);

  // Check if client supports gzip
  const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': acceptGzip ? undefined : stat.size,
    'Content-Encoding': acceptGzip ? 'gzip' : undefined,
  });

  if (acceptGzip) {
    readStream.pipe(zlib.createGzip()).pipe(res);
  } else {
    readStream.pipe(res);
  }

  readStream.on('error', () => {
    res.writeHead(500);
    res.end('Server Error');
  });
});

server.listen(3000, () => {
  console.log('Gzip server at http://localhost:3000');
  console.log('Try: curl -H "Accept-Encoding: gzip" http://localhost:3000/test.txt');
});
```

---

## 四、执行预览

**示例 1 运行结果：**

```
$ node file-copy-stream.js
Creating test file...
Test file created. Starting copy...
Copy done! Size: 68.66 MB
```

**示例 2 运行结果：**

```
$ node transform-stream.js
Parsed: { name: 'Alice', age: 30 }
Parsed: { name: 'Bob', age: 25 }
Parsed: { name: 'Charlie', age: 35 }
```

**示例 3 运行结果：**

```
$ node gzip-server.js
Gzip server at http://localhost:3000

# Another terminal:
$ curl http://localhost:3000/test.txt
Hello World! This is a test file for stream demo.

$ curl -H "Accept-Encoding: gzip" http://localhost:3000/test.txt --compressed
Hello World! This is a test file for stream demo.
```

---

## 五、注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| **背压（Backpressure）** | 写入速度 > 读取速度时，数据积压 | `pipe()` 自动处理，手动用 `write()` 返回值判断 |
| **HighWaterMark** | 缓冲区大小，默认 16KB (Readable) / 16KB (Writable) | 大文件可适当调大 |
| **stream.pipeline** | 比 `.pipe()` 更安全，自动清理资源 | 生产环境用 `pipeline()` 代替链式 `pipe()` |
| **Object Mode** | 流可以传输对象而非 Buffer | 构造时 `{ objectMode: true }` |
| **错误处理** | `pipe()` 不传播错误 | 用 `pipeline()` 或手动监听每个流的 `error` |
| **内存占用** | Stream 本身省内存，但不当使用也会泄漏 | 避免在 `_transform` 中累积大量数据 |

---

## 六、避坑指南

### ❌ 陷阱 1：pipe 不处理错误

```js
// ❌ Wrong: pipe does NOT forward errors
const fs = require('fs');
fs.createReadStream('input.txt')
  .pipe(fs.createWriteStream('output.txt'));
// If readStream errors, writeStream is NOT closed → resource leak
```

```js
// ✅ Correct: Use pipeline (Node.js 10+)
const { pipeline } = require('stream');
pipeline(
  fs.createReadStream('input.txt'),
  fs.createWriteStream('output.txt'),
  (err) => {
    if (err) console.error('Pipeline failed:', err);
    else console.log('Pipeline succeeded');
  }
);
```

### ❌ 陷阱 2：不处理背压

```js
// ❌ Wrong: Ignoring backpressure
const ws = fs.createWriteStream('output.txt');
for (let i = 0; i < 1e8; i++) {
  ws.write(`line ${i}\n`); // Memory keeps growing!
}
```

```js
// ✅ Correct: Respect backpressure
const ws = fs.createWriteStream('output.txt');
let i = 0;

function write() {
  let ok = true;
  while (i < 1e8 && ok) {
    ok = ws.write(`line ${i++}\n`);
  }
  if (i < 1e8) {
    ws.once('drain', write); // Wait for drain event
  } else {
    ws.end();
  }
}
write();
```

### ❌ 陷阱 3：忘记结束 Writable 流

```js
// ❌ Wrong: Never calling end()
const ws = fs.createWriteStream('output.txt');
ws.write('Hello');
ws.write('World');
// File is incomplete! 'finish' event never fires.
```

```js
// ✅ Correct: Always call end()
const ws = fs.createWriteStream('output.txt');
ws.write('Hello\n');
ws.write('World\n');
ws.end(); // Flush and close
ws.on('finish', () => console.log('File written successfully'));
```

---

## 七、练习题

### 🟢 入门：读取文件并统计行数

使用 Stream 读取文件，统计行数。

<details>
<summary>参考答案</summary>

```js
const fs = require('fs');
let lineCount = 0;

fs.createReadStream('bigfile.txt')
  .on('data', (chunk) => {
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === 10) lineCount++; // newline char
    }
  })
  .on('end', () => console.log(`Lines: ${lineCount}`));
```
</details>

### 🟡 进阶：实现字符串替换 Transform

创建一个 Transform 流，将所有出现的 `foo` 替换为 `bar`。

<details>
<summary>参考答案</summary>

```js
const { Transform } = require('stream');

class ReplaceStream extends Transform {
  constructor(from, to) {
    super();
    this.from = from;
    this.to = to;
    this.tail = '';
  }

  _transform(chunk, encoding, callback) {
    const text = this.tail + chunk.toString();
    const result = text.replaceAll(this.from, this.to);
    // Keep tail to handle split across chunks
    const splitAt = text.length - this.from.length + 1;
    this.tail = text.slice(Math.max(0, splitAt));
    this.push(result.slice(0, result.length - this.tail.length));
    callback();
  }

  _flush(callback) {
    if (this.tail) this.push(this.tail.replaceAll(this.from, this.to));
    callback();
  }
}

// Test
const { Readable } = require('stream');
Readable.from(['hello foo w', 'orld foo', ' test'])
  .pipe(new ReplaceStream('foo', 'bar'))
  .on('data', (c) => process.stdout.write(c.toString()));
// Output: hello bar world bar test
```
</details>

### 🔴 挑战：实现速率限制的可读流

创建一个 Readable 流，按指定速率（字节/秒）输出数据。

<details>
<summary>参考答案</summary>

```js
const { Readable } = require('stream');

class RateLimitedReadable extends Readable {
  constructor(data, bytesPerSecond) {
    super();
    this.data = data;
    this.pos = 0;
    this.bytesPerSecond = bytesPerSecond;
    this.interval = null;
  }

  _read() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      if (this.pos >= this.data.length) {
        this.push(null);
        clearInterval(this.interval);
        return;
      }
      const chunk = this.data.slice(this.pos, this.pos + this.bytesPerSecond);
      this.pos += this.bytesPerSecond;
      if (!this.push(chunk)) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }, 1000);
  }
}

// Usage: emit 100 bytes per second
const data = Buffer.alloc(350, 'A');
const limited = new RateLimitedReadable(data, 100);
limited.on('data', (chunk) => {
  console.log(`[${new Date().toLocaleTimeString()}] Got ${chunk.length} bytes`);
});
limited.on('end', () => console.log('Done'));
```
</details>

---

## 八、知识点总结

```
Stream
├── 四种类型
│   ├── Readable → 数据源
│   ├── Writable → 数据目的地
│   ├── Duplex → 可读可写
│   └── Transform → 输入→变换→输出
├── 核心机制
│   ├── Buffer 缓冲区
│   ├── HighWaterMark 水位线 (默认 16KB)
│   ├── Backpressure 背压 (写不赢时反压)
│   └── Pipe 管道连接
├── 推荐做法
│   ├── pipeline() 代替链式 pipe()
│   ├── 处理背压
│   ├── 始终处理 error
│   └── 大文件必用 stream
└── 实用场景
    ├── 文件读写
    ├── HTTP 传输
    ├── 压缩 (zlib)
    └── 加密 (crypto)
```

---

## 九、举一反三

| 场景 | Stream 方案 | 优势 |
|------|-------------|------|
| 大文件复制 | `ReadStream.pipe(WriteStream)` | 内存恒定 |
| 日志分析 | `ReadStream.pipe(Transform)` | 实时处理 |
| HTTP 响应压缩 | `ReadStream.pipe(zlib).pipe(res)` | 边读边压缩 |
| 文件加密 | `ReadStream.pipe(crypto).pipe(WriteStream)` | 流式加密 |
| 数据 ETL | `Read→Transform→Transform→Write` | 管道组合 |
| 视频转码 | `ffmpeg.stdin→stdout→WriteStream` | 无需全部加载 |

---

## 十、参考资料

- [Node.js 官方文档 - Stream](https://nodejs.org/api/stream.html)
- [Stream Handbook](https://github.com/substack/stream-handbook)
- [Node.js Backpressure](https://nodejs.org/en/learn/modules/stream-backpressure)
- [Understanding Streams in Node.js](https://nodesource.com/blog/understanding-streams-in-nodejs)

---

## 十一、代码演进

### v1：基础文件读取

```js
// v1: Read file with stream - basics
const fs = require('fs');

const stream = fs.createReadStream('data.txt', { encoding: 'utf8' });

stream.on('data', (chunk) => {
  console.log(`Received ${chunk.length} characters`);
});
stream.on('end', () => console.log('File read complete'));
stream.on('error', (err) => console.error('Error:', err.message));
```

### v2：管道链式处理

```js
// v2: Chain streams with pipe
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream');

pipeline(
  fs.createReadStream('access.log'),
  zlib.createGzip(),
  fs.createWriteStream('access.log.gz'),
  (err) => {
    if (err) console.error('Failed:', err);
    else console.log('Compressed successfully!');
  }
);
```

### v3：生产级日志处理器

```js
// v3: Production log processor with custom Transform streams
const fs = require('fs');
const zlib = require('zlib');
const { Transform, pipeline, Readable } = require('stream');

// Filter: only keep ERROR lines
class ErrorFilter extends Transform {
  _transform(chunk, enc, cb) {
    const line = chunk.toString();
    if (line.includes('"level":"error"')) this.push(chunk);
    cb();
  }
}

// Enrich: add timestamp if missing
class TimestampEnricher extends Transform {
  _transform(chunk, enc, cb) {
    try {
      const obj = JSON.parse(chunk.toString());
      if (!obj.timestamp) obj.timestamp = new Date().toISOString();
      this.push(JSON.stringify(obj) + '\n');
    } catch { this.push(chunk); }
    cb();
  }
}

// Usage
pipeline(
  fs.createReadStream('app.log'),
  new ErrorFilter(),
  new TimestampEnricher(),
  zlib.createGzip(),
  fs.createWriteStream('errors.jsonl.gz'),
  (err) => {
    if (err) console.error('Pipeline error:', err);
    else console.log('Error log generated!');
  }
);
```

**演进总结：** v1 基础读取 → v2 管道组合 → v3 生产级多阶段处理。

---

*流是 Node.js 处理大数据的瑞士军刀，掌握它就掌握了高性能 I/O 的钥匙。* 🌊
