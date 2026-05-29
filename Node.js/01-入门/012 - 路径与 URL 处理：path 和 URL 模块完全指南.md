---
title: "012 - 路径与 URL 处理：path 和 URL 模块完全指南"
slug: "012-path-url"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.628+08:00"
updated_at: "2026-04-29T10:02:47.929+08:00"
reading_time: 47
tags: []
---

# 路径与 URL 处理

> **难度：** ⭐⭐ 中等
> **标签：** Node.js、path、URL、路径处理
> **适用人群：** 有 JavaScript 基础，需要正确处理文件路径和 URL 的开发者

---

## 一、概念讲解

### 为什么要认真对待路径？

路径看起来简单——不就是字符串吗？**错！** 路径是坑最多的地方之一：

```
Windows: C:\Users\hahn\project\file.txt
Linux:   /home/hahn/project/file.txt

相对路径:  ./src/index.js
绝对路径:  /home/hahn/project/src/index.js

你写的:    '/data/file.txt'
实际运行:  取决于 process.cwd()，不取决于文件位置！
```

**跨平台兼容性**是最大的挑战。硬编码 `\` 或 `/` 在不同操作系统上会出问题。

### path 模块 vs URL 模块

| 模块 | 处理对象 | 示例 |
|------|---------|------|
| `path` | **文件系统路径** | `./src/index.js`、`/home/user/file.txt` |
| `url` (URL) | **网络 URL** | `https://example.com/api?q=hello` |

两者看起来像（都有 `/` 分隔），但规则完全不同。**不要混用！**

### URL 的全局构造函数

Node.js 10+ 全局可用 `URL` 构造函数（和浏览器一样），不需要 `require`。

---

## 二、知识脑图

```
路径与 URL 处理
├── path 模块（文件路径）
│   ├── 拼接
│   │   ├── path.join([...paths])          # 拼接路径片段
│   │   └── path.resolve([...paths])       # 解析为绝对路径
│   ├── 解析
│   │   ├── path.parse(filepath)           # 拆分为 root/dir/base/ext/name
│   │   ├── path.basename(filepath)        # 文件名（含扩展名）
│   │   ├── path.dirname(filepath)         # 目录部分
│   │   └── path.extname(filepath)         # 扩展名
│   ├── 规范化
│   │   └── path.normalize(filepath)       # 处理 . 和 ..
│   ├── 跨平台
│   │   ├── path.sep                       # 路径分隔符 (/ 或 \)
│   │   ├── path.delimiter                 # 环境变量分隔符 (: 或 ;)
│   │   ├── path.posix                     # 强制用 /
│   │   └── path.win32                     # 强制用 \
│   └── 判断
│       ├── path.isAbsolute(filepath)      # 是否绝对路径
│       └── path.relative(from, to)        # 计算相对路径
├── URL 类（网络地址）
│   ├── new URL(input[, base])             # 解析 URL
│   ├── 属性
│   │   ├── url.href / url.origin          # 完整URL / 协议+域名
│   │   ├── url.protocol / url.host        # 协议 / 主机:端口
│   │   ├── url.hostname / url.port        # 主机名 / 端口
│   │   ├── url.pathname                   # 路径
│   │   ├── url.search / url.searchParams  # 查询字符串
│   │   └── url.hash                       # 哈希/锚点
│   └── URLSearchParams                    # 查询参数操作
│       ├── .get(key) / .set(key, value)
│       ├── .has(key) / .delete(key)
│       ├── .append(key, value)
│       └── .toString()
└── file URL
    ├── url.pathToFileURL(path)            # 文件路径 → file:// URL
    └── url.fileURLToPath(url)             # file:// URL → 文件路径
```

---

## 三、完整代码示例

```js
// ============================================
// path-url-demo.js - Path & URL Module Demo
// ============================================

const path = require('path');
const { log } = console;

// ==========================================
// PART 1: PATH MODULE
// ==========================================

// ---------- 1. path.join vs path.resolve ----------

log('=== path.join vs path.resolve ===');

// join: simply concatenates and normalizes
log('join:', path.join('/home', 'user', 'docs', 'file.txt'));
// Linux: /home/user/docs/file.txt
// Windows: \home\user\docs\file.txt

log('join with ..:', path.join('/home/user', '..', 'other'));
// /home/other

// resolve: resolves to absolute path from cwd
log('resolve:', path.resolve('src', 'index.js'));
// /home/hahn/project/src/index.js (depends on cwd)

log('resolve absolute:', path.resolve('/etc', 'config', 'app.conf'));
// /etc/config/app.conf (starts from /)

log('resolve chain:', path.resolve('/a', '/b', 'c'));
// /b/c (last absolute wins, then relative)


// ---------- 2. Path Parsing ----------

log('\n=== Path Parsing ===');

const filePath = '/home/user/docs/report.pdf';

log('basename:', path.basename(filePath));      // report.pdf
log('basename no ext:', path.basename(filePath, '.pdf')); // report
log('dirname:', path.dirname(filePath));         // /home/user/docs
log('extname:', path.extname(filePath));         // .pdf

const parsed = path.parse(filePath);
log('parse:', parsed);
// {
//   root: '/',
//   dir: '/home/user/docs',
//   base: 'report.pdf',
//   ext: '.pdf',
//   name: 'report'
// }

// Format back
log('format:', path.format(parsed)); // /home/user/docs/report.pdf


// ---------- 3. Normalize & Relative ----------

log('\n=== Normalize & Relative ===');

log('normalize:', path.normalize('/home/user/../user/./docs'));
// /home/user/docs

log('isAbsolute:', path.isAbsolute('/etc/config')); // true
log('isAbsolute:', path.isAbsolute('./config'));     // false

log('relative:', path.relative('/home/user/docs', '/home/user/photos'));
// ../photos

log('relative cross:', path.relative('/a/b/c', '/x/y/z'));
// ../../../x/y/z


// ---------- 4. Cross-Platform Properties ----------

log('\n=== Cross-Platform ===');

log('sep:', JSON.stringify(path.sep));        // "/" on Linux, "\\" on Windows
log('delimiter:', JSON.stringify(path.delimiter)); // ":" on Linux, ";" on Windows

// Force POSIX style even on Windows
log('posix join:', path.posix.join('/home', 'user')); // /home/user

// Force Windows style even on Linux
log('win32 join:', path.win32.join('C:\\', 'Users')); // C:\Users


// ==========================================
// PART 2: URL MODULE
// ==========================================

log('\n\n=== URL MODULE ===');

// ---------- 5. URL Parsing ----------

log('--- URL Parsing ---');

const url = new URL('https://user:pass@example.com:8080/api/users?page=1&limit=10#section');

log('href:', url.href);         // full URL
log('origin:', url.origin);     // https://example.com:8080
log('protocol:', url.protocol); // https:
log('username:', url.username); // user
log('password:', url.password); // pass
log('hostname:', url.hostname); // example.com
log('port:', url.port);         // 8080
log('host:', url.host);         // example.com:8080
log('pathname:', url.pathname); // /api/users
log('search:', url.search);     // ?page=1&limit=10
log('hash:', url.hash);         // #section


// ---------- 6. URLSearchParams ----------

log('\n--- URLSearchParams ---');

const params = url.searchParams;

log('get page:', params.get('page'));      // "1"
log('get limit:', params.get('limit'));    // "10"
log('has sort:', params.has('sort'));      // false

// Modify params
params.set('sort', 'name');
params.append('filter', 'active');
params.append('filter', 'pending'); // multiple values
log('modified search:', url.search);
// ?page=1&limit=10&sort=name&filter=active&filter=pending

log('getAll filter:', params.getAll('filter')); // ['active', 'pending']
params.delete('filter');
log('after delete:', params.toString());
// page=1&limit=10&sort=name


// ---------- 7. Building URLs ----------

log('\n--- Building URLs ---');

const base = 'https://api.example.com';
const endpoint = new URL('/v1/users/123', base);
endpoint.searchParams.set('fields', 'name,email');
endpoint.searchParams.set('verbose', 'true');
log('built URL:', endpoint.href);
// https://api.example.com/v1/users/123?fields=name%2Cemail&verbose=true

// Another base
const relative = new URL('../orders', endpoint);
log('relative URL:', relative.href);
// https://api.example.com/v1/users/orders


// ---------- 8. URL encoding/decoding ----------

log('\n--- Encoding ---');

log('encodeURI:', encodeURI('https://example.com/path with spaces'));
// https://example.com/path%20with%20spaces

log('encodeURIComponent:', encodeURIComponent('a=1&b=2'));
// a%3D1%26b%3D2

log('decodeURIComponent:', decodeURIComponent('a%3D1%26b%3D2'));
// a=1&b=2


// ---------- 9. File URL ----------

log('\n--- File URL ---');

const { pathToFileURL, fileURLToPath } = require('url');

const fileUrl = pathToFileURL('/home/user/doc.html');
log('path to URL:', fileUrl.href);  // file:///home/user/doc.html

const backToPath = fileURLToPath(fileUrl);
log('URL to path:', backToPath);     // /home/user/doc.html


// ---------- 10. Practical: Safe Path Resolution ----------

log('\n--- Safe Path Resolution ---');

function safePath(baseDir, userInput) {
  const resolved = path.resolve(baseDir, userInput);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error(`Path traversal detected: ${userInput}`);
  }
  return resolved;
}

const base = '/var/www/uploads';

log('safe:', safePath(base, 'images/photo.jpg'));
// /var/www/uploads/images/photo.jpg

try {
  safePath(base, '../../etc/passwd');
} catch (err) {
  log('blocked:', err.message);
  // Path traversal detected: ../../etc/passwd
}
```

---

## 四、执行预览

```bash
$ node path-url-demo.js
=== path.join vs path.resolve ===
join: /home/user/docs/file.txt
join with ..: /home/other
resolve: /home/hahn/project/src/index.js
resolve absolute: /etc/config/app.conf
resolve chain: /b/c

=== Path Parsing ===
basename: report.pdf
basename no ext: report
dirname: /home/user/docs
extname: .pdf
parse: { root: '/', dir: '/home/user/docs', base: 'report.pdf', ext: '.pdf', name: 'report' }
format: /home/user/docs/report.pdf

=== Normalize & Relative ===
normalize: /home/user/docs
isAbsolute: true
isAbsolute: false
relative: ../photos
relative cross: ../../../x/y/z

=== Cross-Platform ===
sep: "/"
delimiter: ":"
posix join: /home/user
win32 join: C:\Users

=== URL MODULE ===

--- URL Parsing ---
href: https://user:pass@example.com:8080/api/users?page=1&limit=10#section
origin: https://example.com:8080
protocol: https:
username: user
password: pass
hostname: example.com
port: 8080
host: example.com:8080
pathname: /api/users
search: ?page=1&limit=10
hash: #section

--- URLSearchParams ---
get page: 1
get limit: 10
has sort: false
modified search: ?page=1&limit=10&sort=name&filter=active&filter=pending
getAll filter: [ 'active', 'pending' ]
after delete: page=1&limit=10&sort=name

--- Building URLs ---
built URL: https://api.example.com/v1/users/123?fields=name%2Cemail&verbose=true
relative URL: https://api.example.com/v1/users/orders

--- Encoding ---
encodeURI: https://example.com/path%20with%20spaces
encodeURIComponent: a%3D1%26b%3D2
decodeURIComponent: a=1&b=2

--- File URL ---
path to URL: file:///home/user/doc.html
URL to path: /home/user/doc.html

--- Safe Path Resolution ---
safe: /var/www/uploads/images/photo.jpg
blocked: Path traversal detected: ../../etc/passwd
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| **join vs resolve** | `join` 只拼接不解析，`resolve` 从 cwd 开始解析为绝对路径 |
| **路径遍历攻击** | 用户输入的路径要校验，防止 `../../etc/passwd` |
| **路径分隔符** | Windows 用 `\`，Linux 用 `/`，永远用 `path.join()` 拼接 |
| **扩展名边界** | `.gitignore` 的 extname 是 `''`（空），basename 是 `.gitignore` |
| **URL 编码** | URL 构造函数自动编码特殊字符，不需要手动 `encodeURIComponent` |
| **searchParams** | 同一个 key 可以有多个值，用 `getAll()` 获取全部 |
| **path.resolve 无参数** | 返回当前工作目录 `process.cwd()` |
| **Windows 盘符** | `C:` 不是绝对路径，`C:\` 才是 |

---

## 六、避坑指南

### ❌ 手动拼接路径字符串

```js
const filePath = dir + '/' + filename; // Windows 上可能出错！
const filePath = `${dir}/${filename}`; // 同样有问题
```

### ✅ 使用 path.join

```js
const filePath = path.join(dir, filename); // 跨平台安全
```

---

### ❌ 混淆 join 和 resolve

```js
// You want /home/user/data/file.txt relative to __dirname
path.join('data', 'file.txt');           // Just "data/file.txt"
path.resolve('data', 'file.txt');        // /cwd/data/file.txt (depends on cwd!)
```

### ✅ 用 resolve + __dirname 获取文件旁边的路径

```js
// Get path relative to current script file
const filePath = path.resolve(__dirname, 'data', 'file.txt');
// /home/user/project/src/data/file.txt
```

---

### ❌ 不校验用户输入的路径

```js
app.get('/download', (req, res) => {
  const file = path.join('/uploads', req.query.file);
  res.sendFile(file); // req.query.file could be "../../etc/passwd"!
});
```

### ✅ 校验路径在安全范围内

```js
app.get('/download', (req, res) => {
  const uploadDir = path.resolve('/uploads');
  const filePath = path.resolve(uploadDir, req.query.file);
  if (!filePath.startsWith(uploadDir + path.sep)) {
    return res.status(403).send('Forbidden');
  }
  res.sendFile(filePath);
});
```

---

### ❌ 手动解析 URL 查询字符串

```js
const params = {};
url.search.slice(1).split('&').forEach(pair => {
  const [key, val] = pair.split('=');
  params[key] = val; // doesn't handle encoding, dup keys, etc.
});
```

### ✅ 使用 URLSearchParams

```js
const url = new URL(requestUrl);
const page = url.searchParams.get('page');     // handles encoding
const filters = url.searchParams.getAll('f');  // handles duplicates
```

---

## 七、练习题

### 🟢 初级

**1. 给定文件路径 `/home/user/docs/report.2024.pdf`，提取文件名（无扩展名）和扩展名。**

<details>
<summary>参考答案</summary>

```js
const path = require('path');
const filePath = '/home/user/docs/report.2024.pdf';

console.log('name:', path.basename(filePath, path.extname(filePath))); // report.2024
console.log('ext:', path.extname(filePath)); // .pdf
```

</details>

**2. 解析 URL `https://shop.com/search?q=node.js&sort=price&page=2`，提取所有查询参数。**

<details>
<summary>参考答案</summary>

```js
const url = new URL('https://shop.com/search?q=node.js&sort=price&page=2');
console.log('q:', url.searchParams.get('q'));     // node.js
console.log('sort:', url.searchParams.get('sort')); // price
console.log('page:', url.searchParams.get('page')); // 2
```

</details>

### 🟡 中级

**3. 实现一个函数 `ensureExt(filePath, ext)`，确保路径以指定扩展名结尾（没有则添加）。**

<details>
<summary>参考答案</summary>

```js
function ensureExt(filePath, ext) {
  const current = path.extname(filePath);
  if (current === ext) return filePath;
  return filePath + ext;
}

console.log(ensureExt('./config', '.json'));    // ./config.json
console.log(ensureExt('./data.json', '.json')); // ./data.json
console.log(ensureExt('./data.txt', '.json'));  // ./data.txt.json
```

</details>

**4. 构建一个 URL：基础 `https://api.example.com/v2`，路径 `/search`，查询参数 `keyword="hello world"`，`limit=20`。**

<details>
<summary>参考答案</summary>

```js
const url = new URL('/search', 'https://api.example.com/v2');
url.searchParams.set('keyword', 'hello world');
url.searchParams.set('limit', '20');
console.log(url.href);
// https://api.example.com/search?keyword=hello+world&limit=20
```

</details>

### 🔴 高级

**5. 实现路径的「公共前缀」函数：`commonPrefix(paths[])` 返回所有路径的公共目录前缀。**

<details>
<summary>参考答案</summary>

```js
function commonPrefix(paths) {
  if (paths.length === 0) return '';

  const split = paths.map(p => p.split(path.sep));
  const minLen = Math.min(...split.map(s => s.length));

  const result = [];
  for (let i = 0; i < minLen; i++) {
    const segment = split[0][i];
    if (split.every(s => s[i] === segment)) {
      result.push(segment);
    } else {
      break;
    }
  }

  return result.length === 0 ? '' : result.join(path.sep);
}

console.log(commonPrefix([
  '/home/user/docs/a.txt',
  '/home/user/docs/b.txt',
  '/home/user/docs/sub/c.txt'
])); // /home/user/docs
```

</details>

---

## 八、知识点总结

```
路径与URL知识体系
├── path 模块
│   ├── 路径拼接
│   │   ├── join(...parts)        → 相对拼接
│   │   └── resolve(...parts)     → 解析为绝对路径
│   ├── 路径解析
│   │   ├── parse(path)           → { root, dir, base, ext, name }
│   │   ├── basename / dirname / extname
│   │   └── format(obj)           → 反向组装
│   ├── 路径工具
│   │   ├── normalize(p)          → 处理 . 和 ..
│   │   ├── relative(from, to)    → 计算相对路径
│   │   └── isAbsolute(p)         → 判断是否绝对路径
│   └── 跨平台
│       ├── path.sep / delimiter
│       └── path.posix / path.win32
├── URL 类
│   ├── 解析
│   │   ├── new URL(str)          → 解析完整 URL
│   │   └── new URL(path, base)   → 基于 base 解析
│   ├── 属性
│   │   ├── protocol / host / port / hostname
│   │   ├── pathname / search / hash
│   │   ├── username / password
│   │   └── origin / href
│   └── URLSearchParams
│       ├── get / set / has / delete
│       ├── append / getAll
│       ├── sort / toString
│       └── forEach / entries / keys / values
├── 工具函数
│   ├── encodeURI / encodeURIComponent
│   ├── decodeURI / decodeURIComponent
│   └── url.pathToFileURL / url.fileURLToPath
└── 安全实践
    ├── 路径遍历防护
    ├── 用户输入校验
    └── path.resolve + startsWith 检查
```

---

## 九、举一反三

| 场景 | 推荐方案 | 关键点 |
|------|---------|--------|
| 静态文件服务 | `path.resolve(__dirname, 'public')` | 用 `__dirname` 定位 |
| 文件上传路径 | `path.join(uploadDir, sanitized)` | 校验 + sanitize 文件名 |
| API 路由解析 | `new URL(req.url, base)` | 提取 pathname 和 params |
| 构建工具路径 | `path.posix` 统一 | 确保输出一致 |
| 环境变量 PATH | `process.env.PATH.split(path.delimiter)` | 跨平台分割 |
| 配置文件定位 | `path.resolve(__dirname, '..', 'config')` | 相对脚本位置 |
| URL 路由匹配 | `url.pathname` + 正则 | 不含查询参数 |
| 重定向 URL | `new URL(redirect, base)` + 校验 origin | 防开放重定向 |
| 多语言文件 | `path.join(localeDir, lang, 'messages.json')` | 动态拼接 |
| import.meta.url | `fileURLToPath(import.meta.url)` | ESM 中获取 `__dirname` |

---

## 十、参考资料

- [Node.js 官方文档 - path](https://nodejs.org/api/path.html)
- [Node.js 官方文档 - url](https://nodejs.org/api/url.html)
- [MDN - URL API](https://developer.mozilla.org/en-US/docs/Web/API/URL)

---

## 十一、代码演进

### v1：基础 — 路径拼接和解析

```js
const path = require('path');

// Basic join
const filePath = path.join(__dirname, 'data', 'config.json');
console.log('File:', filePath);

// Parse
const parsed = path.parse(filePath);
console.log('Name:', parsed.name); // config
console.log('Ext:', parsed.ext);   // .json
```

### v2：进阶 — URL 构建与查询参数

```js
// Build API URL with params
function buildApiUrl(base, endpoint, params = {}) {
  const url = new URL(endpoint, base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

const apiUrl = buildApiUrl('https://api.example.com', '/v1/users', {
  page: 1,
  limit: 20,
  sort: 'name'
});
console.log(apiUrl);
// https://api.example.com/v1/users?page=1&limit=20&sort=name
```

### v3：实战 — 安全文件路由器

```js
const path = require('path');
const fs = require('fs');

class SafeFileRouter {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir);
  }

  // Resolve and validate a user-provided path
  resolve(userPath) {
    const resolved = path.resolve(this.baseDir, userPath);
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new Error(`Access denied: path escapes base directory`);
    }
    return resolved;
  }

  // Read file safely
  readFile(userPath, encoding = 'utf8') {
    const safe = this.resolve(userPath);
    return fs.promises.readFile(safe, encoding);
  }

  // List directory safely
  async listDir(userPath = '.') {
    const safe = this.resolve(userPath);
    const entries = await fs.promises.readdir(safe, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      ext: path.extname(e.name) || null
    }));
  }

  // Get file info safely
  async stat(userPath) {
    const safe = this.resolve(userPath);
    const stats = await fs.promises.stat(safe);
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDir: stats.isDirectory(),
      modified: stats.mtime,
      name: path.basename(safe),
      ext: path.extname(safe)
    };
  }
}

// Usage
const router = new SafeFileRouter('./public');

(async () => {
  // List files
  const files = await router.listDir('.');
  console.log('Files:', files);

  // Read a file
  const content = await router.readFile('index.html');
  console.log('Content length:', content.length);

  // Block path traversal
  try {
    await router.readFile('../../etc/passwd');
  } catch (err) {
    console.log('Blocked:', err.message);
  }
})();
```

---

**总结：** 路径和 URL 处理看似简单，实则是安全问题和跨平台 Bug 的高发区。记住三个原则：**永远用 `path.join()` 拼接**、**永远校验用户输入的路径**、**用 `URL` 和 `URLSearchParams` 处理网络地址**。掌握这些，你就能避开 90% 的路径相关 Bug。
