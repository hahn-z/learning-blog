---
title: "011 - 文件系统 fs 模块：Node.js 文件操作完全指南"
slug: "011-fs"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.623+08:00"
updated_at: "2026-04-29T10:02:47.919+08:00"
reading_time: 40
tags: []
---

# 文件系统 fs 模块

> **难度：** ⭐⭐⭐ 中高
> **标签：** Node.js、fs、文件操作、异步IO
> **适用人群：** 有 JavaScript 基础，需要掌握 Node.js 文件操作的开发者

---

## 一、概念讲解

### 什么是 fs 模块？

`fs`（File System）是 Node.js 的核心模块，提供了一套完整的文件系统操作 API。它是你与操作系统文件系统交互的桥梁——读写文件、创建目录、管理权限、监听变化，全靠它。

### 同步 vs 异步 vs Promise

Node.js 的 fs 模块为几乎每个操作提供了**三种风格**：

```
fs.readFile(path, callback)        // 异步回调
fs.readFileSync(path)              // 同步阻塞
fs.promises.readFile(path)         // Promise (推荐)
```

| 风格 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 异步回调 | 性能好，不阻塞 | 回调地狱 | 兼容老代码 |
| 同步 | 代码简单 | 阻塞事件循环 | 启动时加载配置 |
| Promise | 性能好 + 可读 | 需要 Node 10+ | **现代项目首选** |

### 文件描述符（File Descriptor）

操作系统用**文件描述符**（fd）来追踪打开的文件。它是一个非负整数：

```
0 → stdin   (标准输入)
1 → stdout  (标准输出)
2 → stderr  (标准错误)
3+ → 你的文件
```

### 文件系统标志（flags）

| 标志 | 说明 |
|------|------|
| `'r'` | 只读（默认） |
| `'r+'` | 读写 |
| `'w'` | 只写，创建或截断 |
| `'w+'` | 读写，创建或截断 |
| `'a'` | 追加写入 |
| `'a+'` | 读写追加 |

---

## 二、知识脑图

```
fs 模块
├── 文件操作
│   ├── 读写
│   │   ├── readFile / writeFile         # 一次性读写
│   │   ├── appendFile                   # 追加内容
│   │   └── open + read + write + close  # 底层操作
│   ├── 信息
│   │   ├── stat / fstat                 # 文件信息
│   │   ├── exists                       # 是否存在
│   │   └── access                       # 权限检查
│   ├── 修改
│   │   ├── rename                       # 重命名/移动
│   │   ├── copyFile                     # 复制
│   │   ├── chmod                        # 修改权限
│   │   └── truncate                     # 截断
│   └── 删除
│       ├── unlink                       # 删除文件
│       └── rm                           # 删除文件/目录 (Node 14.14+)
├── 目录操作
│   ├── mkdir / mkdirp                   # 创建目录
│   ├── rmdir                            # 删除空目录
│   ├── readdir                          # 列出内容
│   └── opendir                          # 流式遍历
├── 监听
│   └── watch / watchFile                # 文件变化监听
├── 流（配合 fs）
│   ├── createReadStream                 # 可读流
│   └── createWriteStream                # 可写流
└── 三种风格
    ├── fs.xxx(cb)                       # 回调
    ├── fs.xxxSync()                     # 同步
    └── fs.promises.xxx()                # Promise
```

---

## 三、完整代码示例

```js
// ============================================
// fs-demo.js - File System Module Demo
// ============================================

const fs = require('fs');
const path = require('path');
const { log } = console;

const DIR = './demo-fs-test';

// Helper: clean up test directory
function cleanup() {
  if (fs.existsSync(DIR)) {
    fs.rmSync(DIR, { recursive: true });
  }
}

// ---------- 1. Basic File Read/Write ----------

async function demoReadWrite() {
  const fsp = fs.promises;
  const filePath = path.join(DIR, 'hello.txt');

  // Write file
  await fsp.writeFile(filePath, 'Hello, FS Module!\n', 'utf8');
  log('Written:', filePath);

  // Read file
  const content = await fsp.readFile(filePath, 'utf8');
  log('Read:', content.trim());

  // Append
  await fsp.appendFile(filePath, 'Appended line.\n');
  const updated = await fsp.readFile(filePath, 'utf8');
  log('After append:', updated.trim());
}


// ---------- 2. File Stats ----------

async function demoStats() {
  const fsp = fs.promises;
  const filePath = path.join(DIR, 'hello.txt');

  const stats = await fsp.stat(filePath);
  log('--- File Stats ---');
  log('isFile:', stats.isFile());           // true
  log('isDirectory:', stats.isDirectory()); // false
  log('Size:', stats.size, 'bytes');
  log('Created:', stats.birthtime.toISOString());
  log('Modified:', stats.mtime.toISOString());
  log('Mode:', stats.mode.toString(8));     // octal permissions
}


// ---------- 3. Directory Operations ----------

async function demoDirectory() {
  const fsp = fs.promises;

  // Create nested directory
  const nested = path.join(DIR, 'a', 'b', 'c');
  await fsp.mkdir(nested, { recursive: true });
  log('Created nested dir:', nested);

  // Create some files
  await fsp.writeFile(path.join(DIR, 'a', 'file1.txt'), 'content1');
  await fsp.writeFile(path.join(DIR, 'a', 'b', 'file2.txt'), 'content2');

  // List directory
  const entries = await fsp.readdir(DIR, { withFileTypes: true });
  log('--- Directory listing ---');
  for (const entry of entries) {
    const type = entry.isDirectory() ? 'DIR ' : 'FILE';
    log(`  [${type}] ${entry.name}`);
  }

  // Recursive listing
  log('--- Recursive listing ---');
  await listAll(DIR, '');
}

async function listAll(dir, indent) {
  const fsp = fs.promises;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    log(`${indent}${entry.name}`);
    if (entry.isDirectory()) {
      await listAll(path.join(dir, entry.name), indent + '  ');
    }
  }
}


// ---------- 4. Copy, Rename, Delete ----------

async function demoCRUD() {
  const fsp = fs.promises;
  const src = path.join(DIR, 'hello.txt');
  const dst = path.join(DIR, 'hello-copy.txt');

  // Copy
  await fsp.copyFile(src, dst);
  log('Copied to:', dst);

  // Rename
  const renamed = path.join(DIR, 'hello-renamed.txt');
  await fsp.rename(dst, renamed);
  log('Renamed to:', renamed);

  // Check existence
  log('Original copy exists:', fs.existsSync(dst));     // false
  log('Renamed exists:', fs.existsSync(renamed));        // true

  // Delete
  await fsp.unlink(renamed);
  log('Deleted:', renamed);
  log('After delete exists:', fs.existsSync(renamed));   // false
}


// ---------- 5. Streaming Read/Write ----------

async function demoStream() {
  const src = path.join(DIR, 'hello.txt');
  const dst = path.join(DIR, 'stream-copy.txt');

  // Pipe: read stream -> write stream
  await new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(src, { highWaterMark: 4 });
    const writeStream = fs.createWriteStream(dst);

    readStream.on('data', (chunk) => {
      log('Chunk:', chunk.toString().trim());
    });

    readStream.pipe(writeStream)
      .on('finish', () => {
        log('Stream copy done!');
        resolve();
      })
      .on('error', reject);
  });
}


// ---------- 6. File Watch ----------

function demoWatch() {
  const filePath = path.join(DIR, 'watch-test.txt');

  // Write initial
  fs.writeFileSync(filePath, 'initial content\n');

  const watcher = fs.watch(filePath, (eventType, filename) => {
    log(`Watch: ${eventType} on ${filename}`);
  });

  // Trigger changes
  setTimeout(() => fs.appendFileSync(filePath, 'change 1\n'), 100);
  setTimeout(() => fs.appendFileSync(filePath, 'change 2\n'), 300);
  setTimeout(() => {
    watcher.close();
    log('Watcher closed.');
  }, 600);
}


// ---------- 7. Sync Style (for startup) ----------

function demoSync() {
  const configPath = path.join(DIR, 'config.json');
  const config = { port: 3000, host: 'localhost' };

  // Sync write + read (OK at startup)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  log('Sync loaded config:', loaded);
}


// ---------- Main ----------

(async () => {
  cleanup();
  fs.mkdirSync(DIR, { recursive: true });

  log('=== 1. Read/Write ===');
  await demoReadWrite();

  log('\n=== 2. Stats ===');
  await demoStats();

  log('\n=== 3. Directory ===');
  await demoDirectory();

  log('\n=== 4. Copy/Rename/Delete ===');
  await demoCRUD();

  log('\n=== 5. Stream ===');
  await demoStream();

  log('\n=== 6. Sync Style ===');
  demoSync();

  log('\n=== 7. Watch ===');
  demoWatch();

  // Cleanup after watch demo
  setTimeout(() => {
    cleanup();
    log('\nCleaned up.');
  }, 800);
})();
```

---

## 四、执行预览

```bash
$ node fs-demo.js
=== 1. Read/Write ===
Written: ./demo-fs-test/hello.txt
Read: Hello, FS Module!
After append: Hello, FS Module!
Appended line.

=== 2. Stats ===
--- File Stats ---
isFile: true
isDirectory: false
Size: 40 bytes
Created: 2026-04-29T00:00:00.000Z
Modified: 2026-04-29T00:00:00.000Z
Mode: 100644

=== 3. Directory ===
Created nested dir: ./demo-fs-test/a/b/c
--- Directory listing ---
  [DIR ] a
--- Recursive listing ---
a
  file1.txt
  b
    file2.txt
    c

=== 4. Copy/Rename/Delete ===
Copied to: ./demo-fs-test/hello-copy.txt
Renamed to: ./demo-fs-test/hello-renamed.txt
Original copy exists: false
Renamed exists: true
Deleted: ./demo-fs-test/hello-renamed.txt
After delete exists: false

=== 5. Stream ===
Chunk: Hell
Chunk: o, F
Chunk: S Mo
Chunk: dule!
Chunk: 
App
Chunk: ende
Chunk: d lin
Chunk: e.

Stream copy done!

=== 6. Sync Style ===
Sync loaded config: { port: 3000, host: 'localhost' }

=== 7. Watch ===
Watch: change on watch-test.txt
Watch: change on watch-test.txt
Watcher closed.

Cleaned up.
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| **路径编码** | Windows 路径用 `\\` 或 `/`，建议用 `path.join()` 拼接 |
| **相对路径** | 相对于 `process.cwd()`，不是文件所在目录 |
| **ENOENT** | 文件不存在，最常见错误，操作前检查或用 try-catch |
| **EACCES** | 权限不足，检查文件权限和运行用户 |
| **EMFILE** | 打开文件过多，确保及时关闭 fd，或用 `graceful-fs` |
| **大文件** | 不要用 `readFile` 一次性加载，用 `createReadStream` 流式处理 |
| **编码** | 不指定编码时 `readFile` 返回 Buffer，指定 `'utf8'` 返回字符串 |
| **mkdir recursive** | Node 10.12+ 支持 `{ recursive: true }`，老版本需 `mkdirp` 包 |
| **watch 不可靠** | `fs.watch` 在某些文件系统/编辑器上行为不一致，生产用 `chokidar` |

---

## 六、避坑指南

### ❌ 同步方法在请求处理中使用

```js
app.get('/data', (req, res) => {
  const data = fs.readFileSync('./data.json'); // 阻塞所有请求！
  res.send(data);
});
```

### ✅ 使用异步方法

```js
app.get('/data', async (req, res) => {
  const data = await fs.promises.readFile('./data.json', 'utf8');
  res.send(data);
});
```

---

### ❌ 拼接路径用字符串 +

```js
const filePath = './data/' + filename; // filename 可能是 '../../etc/passwd'！
```

### ✅ 用 path.join 并校验

```js
const basePath = path.resolve('./data');
const filePath = path.join(basePath, filename);
if (!filePath.startsWith(basePath)) throw new Error('Invalid path');
```

---

### ❌ 不处理文件不存在的错误

```js
const data = await fs.promises.readFile('maybe-exists.txt', 'utf8');
```

### ✅ 检查存在或捕获错误

```js
try {
  const data = await fs.promises.readFile('maybe-exists.txt', 'utf8');
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('File not found, using defaults');
  } else {
    throw err;
  }
}
```

---

### ❌ 大文件用 readFile 一次性加载

```js
const videoBuffer = await fs.promises.readFile('movie.mp4'); // 可能几百 MB！
```

### ✅ 用 Stream 流式处理

```js
const stats = await fs.promises.stat('movie.mp4');
const stream = fs.createReadStream('movie.mp4');
response.setHeader('Content-Length', stats.size);
stream.pipe(response);
```

---

## 七、练习题

### 🟢 初级

**1. 读取一个 JSON 配置文件并打印其中的 `port` 字段。**

<details>
<summary>参考答案</summary>

```js
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
console.log('Port:', config.port);
```

</details>

**2. 创建一个目录 `logs`，如果已存在则忽略。**

<details>
<summary>参考答案</summary>

```js
const fs = require('fs');
fs.mkdirSync('logs', { recursive: true });
```

</details>

### 🟡 中级

**3. 递归列出目录下所有 `.js` 文件的完整路径。**

<details>
<summary>参考答案</summary>

```js
const fs = require('fs');
const path = require('path');

function findJS(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJS(full));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

console.log(findJS('.'));
```

</details>

**4. 用 Stream 实现文件的逐行读取并输出。**

<details>
<summary>参考答案</summary>

```js
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('data.txt'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  console.log('Line:', line);
});
```

</details>

### 🔴 高级

**5. 实现一个简单的文件锁：`lockFile(path)` 返回 Promise，文件不存在时创建锁，已存在则等待重试。**

<details>
<summary>参考答案</summary>

```js
const fs = require('fs').promises;
const path = require('path');
const { setTimeout: sleep } = require('timers/promises');

async function lockFile(filePath, retries = 10, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const fd = await fs.open(filePath, 'wx'); // exclusive create
      await fd.write(Buffer.from(`${process.pid}\n`));
      await fd.close();
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Could not acquire lock: ${filePath}`);
}

async function unlockFile(filePath) {
  await fs.unlink(filePath);
}

// Usage
(async () => {
  await lockFile('/tmp/myapp.lock');
  console.log('Lock acquired!');
  // ... do work ...
  await unlockFile('/tmp/myapp.lock');
  console.log('Lock released!');
})();
```

</details>

---

## 八、知识点总结

```
fs 模块知识体系
├── 三种 API 风格
│   ├── fs.xxx(callback)        # 回调 (最早)
│   ├── fs.xxxSync()            # 同步 (简单但阻塞)
│   └── fs.promises.xxx()       # Promise (现代推荐)
├── 文件操作
│   ├── readFile / writeFile    # 一次性读写
│   ├── appendFile              # 追加
│   ├── stat                    # 元信息
│   ├── rename                  # 重命名/移动
│   ├── copyFile                # 复制
│   ├── unlink                  # 删除文件
│   ├── access                  # 权限检查
│   └── existsSync              # 同步存在检查
├── 目录操作
│   ├── mkdir({recursive})      # 创建
│   ├── readdir                 # 列出
│   ├── rmdir                   # 删除空目录
│   └── rm({recursive})         # 递归删除
├── 流式操作
│   ├── createReadStream        # 可读流
│   └── createWriteStream       # 可写流
├── 监听
│   ├── watch                   # 文件变化
│   └── watchFile               # 轮询检查
└── 文件打开模式
    ├── r / r+ / w / w+ / a / a+
    └── wx / ax (exclusive)
```

---

## 九、举一反三

| 场景 | 推荐方案 | 关键 API |
|------|---------|----------|
| 读取配置文件 | 同步读取启动 | `fs.readFileSync` |
| 日志写入 | 追加模式或流 | `fs.appendFile` / `createWriteStream` |
| 文件上传 | 流式存储 | `createWriteStream` + `pipe` |
| 静态文件服务 | 流式响应 | `createReadStream.pipe(res)` |
| 文件监控 | chokidar 库 | `chokidar.watch()` |
| 临时文件 | `os.tmpdir()` + 随机名 | `fs.mkdtemp` |
| CSV 处理 | 流 + readline | `createReadStream` + `readline` |
| 目录遍历 | 递归 readdir | `fs.promises.readdir` |
| 文件搜索 | `glob` 模式 | `fast-glob` / `globby` |
| 大文件复制 | 流式 pipe | `createReadStream.pipe(createWriteStream)` |

---

## 十、参考资料

- [Node.js 官方文档 - fs](https://nodejs.org/api/fs.html)
- [Node.js File System Best Practices](https://nodejs.org/en/learn/manipulating-files/nodejs-file-module)
- [chokidar - Better file watching](https://github.com/paulmillr/chokidar)

---

## 十一、代码演进

### v1：基础 — 读写文件

```js
const fs = require('fs');

// Read file synchronously
const data = fs.readFileSync('input.txt', 'utf8');
console.log(data);

// Write file synchronously
fs.writeFileSync('output.txt', 'Hello World');
```

### v2：进阶 — 异步 + 目录操作

```js
const fs = require('fs').promises;
const path = require('path');

async function processDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile()) {
      const content = await fs.readFile(fullPath, 'utf8');
      console.log(`${entry.name}: ${content.length} chars`);
    } else if (entry.isDirectory()) {
      await processDir(fullPath); // recursive
    }
  }
}

processDir('./src').catch(console.error);
```

### v3：实战 — 文件变化监控 + 自动处理

```js
const fs = require('fs');
const path = require('path');

const WATCH_DIR = './watch';
const OUTPUT_DIR = './output';

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
  if (!filename) return;

  const srcPath = path.join(WATCH_DIR, filename);
  const dstPath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(srcPath)) return;

  // Read, transform (uppercase), write
  const content = fs.readFileSync(srcPath, 'utf8');
  const transformed = content.toUpperCase();
  fs.writeFileSync(dstPath, transformed);
  console.log(`Processed: ${filename} -> ${dstPath}`);
});

console.log(`Watching ${WATCH_DIR} for changes...`);
```

---

**总结：** fs 模块是 Node.js 的文件系统瑞士军刀。现代项目优先使用 `fs.promises`，启动时可用同步方法，大文件务必用 Stream。记住三个原则：异步优先、路径校验、及时关闭。
