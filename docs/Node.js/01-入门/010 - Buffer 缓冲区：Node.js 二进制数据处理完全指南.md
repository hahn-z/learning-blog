---
title: "010 - Buffer 缓冲区：Node.js 二进制数据处理完全指南"
slug: "010-buffer"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.616+08:00"
updated_at: "2026-04-29T10:02:47.912+08:00"
reading_time: 32
tags: []
---

# Buffer 缓冲区

> **难度：** ⭐⭐ 中等
> **标签：** Node.js、Buffer、二进制数据
> **适用人群：** 有 JavaScript 基础，想理解 Node.js 底层数据处理的开发者

---

## 一、概念讲解

### 什么是 Buffer？

在浏览器中，我们处理的是字符串、对象、数组。但在 Node.js 的世界里，你要面对的是**二进制数据**——文件内容、网络包、图片像素……这些都不是字符串能搞定的。

**Buffer** 就是 Node.js 提供的「二进制数据容器」，它是一段**固定大小的内存块**，用来存储原始的字节数据。

```
想象一个快递柜：
┌────┬────┬────┬────┬────┬────┬────┬────┐
│ 48 │ 65 │ 6C │ 6C │ 6F │ 00 │ 00 │ 00 │
└────┴────┴────┴────┴────┴────┴────┴────┘
  H    e    l    l    o   (empty slots)

每个格子里放一个字节(byte)，格子总数固定，不能伸缩。
```

### 为什么需要 Buffer？

| 场景 | 不用 Buffer | 用 Buffer |
|------|------------|-----------|
| 读文件 | 字符串编码可能丢数据 | 原始字节，零损失 |
| 网络传输 | 字符串转换开销大 | 直接操作内存，快 |
| 图片/音视频 | 无法表示 | 二进制流，精确控制 |
| 加密运算 | 字符串不适合 | 原始字节，标准操作 |

### 核心特性

1. **固定大小**：创建后长度不变
2. **堆外内存**：不受 V8 堆大小限制（由 C++ 层分配）
3. **类数组**：可以像数组一样用索引访问
4. **UTF-8 默认**：字符串转换默认 UTF-8 编码

---

## 二、知识脑图

```
Buffer 缓冲区
├── 创建方式
│   ├── Buffer.alloc(size)          # 填 0，安全
│   ├── Buffer.allocUnsafe(size)    # 不初始化，快但不安全
│   ├── Buffer.from(data)           # 从字符串/数组/Buffer 创建
│   └── Buffer.concat([buf1, buf2]) # 拼接多个 Buffer
├── 读写操作
│   ├── buf[index]                  # 读/写单个字节
│   ├── buf.write(string, offset)   # 写入字符串
│   ├── buf.toString(encoding)      # 转为字符串
│   ├── buf.slice(start, end)       # 切片（共享内存！）
│   └── buf.subarray(start, end)    # 同 slice
├── 属性与方法
│   ├── buf.length                  # 字节长度
│   ├── Buffer.byteLength(str)      # 字符串的字节长度
│   ├── Buffer.isBuffer(obj)        # 判断是否 Buffer
│   └── buf.compare(other)          # 比较
├── 编码
│   ├── utf8 / utf-8               # 默认
│   ├── ascii
│   ├── hex                         # 十六进制
│   ├── base64
│   └── binary / latin1
└── 典型场景
    ├── 文件读写（fs.readFile）
    ├── 网络数据（net/http）
    ├── 加密（crypto）
    └── 流处理（Stream）
```

---

## 三、完整代码示例

```js
// ============================================
// buffer-demo.js - Buffer Core Operations Demo
// ============================================

const { log } = console;

// ---------- 1. Creating Buffers ----------

// Safe allocation: filled with zeros
const buf1 = Buffer.alloc(8);
log('alloc(8):', buf1);           // <Buffer 00 00 00 00 00 00 00 00>
log('length:', buf1.length);       // 8

// Unsafe allocation: may contain old data
const buf2 = Buffer.allocUnsafe(8);
log('allocUnsafe(8):', buf2);     // <Buffer ...random bytes...>

// From string (UTF-8 by default)
const buf3 = Buffer.from('Hello');
log('from string:', buf3);        // <Buffer 48 65 6c 6c 6f>
log('as hex:', buf3.toString('hex')); // 48656c6c6f

// From hex string
const buf4 = Buffer.from('48656c6c6f', 'hex');
log('from hex:', buf4.toString()); // Hello

// From array of bytes
const buf5 = Buffer.from([72, 101, 108, 108, 111]);
log('from array:', buf5.toString()); // Hello


// ---------- 2. Reading & Writing ----------

const buf = Buffer.alloc(16);

// Write string at offset 0
const written = buf.write('Hello', 0, 'utf8');
log('bytes written:', written);   // 5

// Write more at offset 5
buf.write(' World', 5, 'utf8');

// Read the full content
log('content:', buf.toString('utf8', 0, 11)); // "Hello World"

// Read individual byte
log('byte[0]:', buf[0]);          // 72 (ASCII 'H')
log('byte[0] hex:', buf[0].toString(16)); // "48"

// Write individual byte
buf[11] = 33; // ASCII '!'
log('with exclamation:', buf.toString('utf8', 0, 12)); // "Hello World!"


// ---------- 3. Slicing & Copying ----------

const original = Buffer.from('Hello, World!');

// slice() shares memory with original!
const slice = original.subarray(0, 5);
log('slice:', slice.toString());  // "Hello"

// Modifying slice modifies original too!
slice[0] = 74; // 'J'
log('modified original:', original.toString()); // "Jello, World!"

// copy() creates independent data
const original2 = Buffer.from('Hello, World!');
const copy = Buffer.alloc(5);
original2.copy(copy, 0, 0, 5);
copy[0] = 74; // 'J'
log('original2 after copy mod:', original2.toString()); // "Hello, World!" (unchanged)


// ---------- 4. Concatenation ----------

const part1 = Buffer.from('Hello');
const part2 = Buffer.from(' ');
const part3 = Buffer.from('World');

const combined = Buffer.concat([part1, part2, part3]);
log('concat:', combined.toString()); // "Hello World"

// Concat with total length (pads with zeros if longer)
const padded = Buffer.concat([part1, part3], 20);
log('padded length:', padded.length); // 20


// ---------- 5. Encoding Conversion ----------

const text = '你好，世界！';
log('string length:', text.length);              // 6 (6 characters)
log('byte length:', Buffer.byteLength(text));     // 18 (18 bytes in UTF-8)

const encoded = Buffer.from(text);
log('hex:', encoded.toString('hex'));
// e4bda0e5a5bdefbc8ce4b896e7958cefbc81
log('base64:', encoded.toString('base64'));


// ---------- 6. Comparison ----------

const a = Buffer.from('abc');
const b = Buffer.from('abd');
log('compare:', a.compare(b));    // -1 (a < b)
log('equals:', Buffer.from('abc').equals(Buffer.from('abc'))); // true


// ---------- 7. Iteration ----------

const buf6 = Buffer.from('ABC');
for (const byte of buf6) {
  log('byte:', byte, 'char:', String.fromCharCode(byte));
}
// byte: 65 char: A
// byte: 66 char: B
// byte: 67 char: C


// ---------- 8. JSON Serialization ----------

const buf7 = Buffer.from([1, 2, 3]);
log('JSON:', JSON.stringify(buf7)); // {"type":"Buffer","data":[1,2,3]}
```

---

## 四、执行预览

```bash
$ node buffer-demo.js
alloc(8): <Buffer 00 00 00 00 00 00 00 00>
length: 8
allocUnsafe(8): <Buffer a0 3f 12 00 00 00 00 00>
from string: <Buffer 48 65 6c 6c 6f>
as hex: 48656c6c6f
from hex: Hello
from array: Hello
bytes written: 5
content: Hello World
byte[0]: 72
byte[0] hex: 48
with exclamation: Hello World!
slice: Hello
modified original: Jello, World!
original2 after copy mod: Hello, World!
concat: Hello World
padded length: 20
string length: 6
byte length: 18
hex: e4bda0e5a5bdefbc8ce4b896e7958cefbc81
base64: 5L2g5aW977yM5LiW55WM77yB
compare: -1
equals: true
byte: 65 char: A
byte: 66 char: B
byte: 67 char: C
JSON: {"type":"Buffer","data":[1,2,3]}
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| **大小固定** | Buffer 创建后不能改变大小，需要新 Buffer 就重新创建 |
| **allocUnsafe 陷阱** | 可能包含敏感数据（密码、密钥残留），生产环境慎用 |
| **slice 共享内存** | `subarray()`/`slice()` 返回的 Buffer 与原 Buffer 共享内存，修改会互相影响 |
| **中文字节数** | UTF-8 下一个中文占 3 字节，`'你好'.length` 是 2 但 `Buffer.byteLength('你好')` 是 6 |
| **不要用 + 拼接** | `buf1 + buf2` 会隐式转字符串，用 `Buffer.concat()` |
| **JSON 序列化** | `JSON.stringify(buf)` 得到 `{type:"Buffer",data:[...]}`，不是原始内容 |
| **性能** | 频繁创建小 Buffer 有开销，大文件用 Stream 而非一次性 Buffer |
| **最大大小** | `buffer.constants.MAX_LENGTH`，32 位系统约 1GB，64 位系统更大 |

---

## 六、避坑指南

### ❌ 用字符串长度当 Buffer 长度

```js
const text = '你好';
const buf = Buffer.alloc(text.length); // 只分配了 2 字节！
buf.write(text); // 写入被截断！
```

### ✅ 用 Buffer.byteLength 获取真实字节长度

```js
const text = '你好';
const buf = Buffer.alloc(Buffer.byteLength(text)); // 分配 6 字节
buf.write(text); // 完整写入
```

---

### ❌ slice 后以为修改不影响原 Buffer

```js
const buf = Buffer.from('Hello');
const sub = buf.subarray(0, 3);
sub[0] = 74;
console.log(buf.toString()); // "Jello" — 原数据被改了！
```

### ✅ 需要独立副本时用 copy 或 Buffer.from

```js
const buf = Buffer.from('Hello');
const copy = Buffer.from(buf.subarray(0, 3)); // 独立副本
copy[0] = 74;
console.log(buf.toString()); // "Hello" — 原数据不变
```

---

### ❌ 用 allocUnsafe 处理敏感数据

```js
const password = Buffer.allocUnsafe(32); // 可能包含旧数据！
```

### ✅ 使用 alloc 清零，或手动 fill

```js
const password = Buffer.alloc(32); // 全部填 0，安全
// 使用完后清零
password.fill(0);
```

---

### ❌ Buffer 拼接用 + 运算符

```js
const a = Buffer.from('Hello');
const b = Buffer.from(' World');
console.log(a + b); // "[object Object][object Object]"
```

### ✅ 用 Buffer.concat

```js
const combined = Buffer.concat([a, b]);
console.log(combined.toString()); // "Hello World"
```

---

## 七、练习题

### 🟢 初级

**1. 创建一个 Buffer，写入字符串 "Node.js"，然后以 hex 格式输出。**

<details>
<summary>参考答案</summary>

```js
const buf = Buffer.from('Node.js');
console.log(buf.toString('hex'));
// 4e6f64652e6a73
```

</details>

**2. 创建一个 10 字节的 Buffer，将前 5 字节写 "Hello"，后 5 字节写 "World"，输出完整内容。**

<details>
<summary>参考答案</summary>

```js
const buf = Buffer.alloc(10);
buf.write('Hello', 0);
buf.write('World', 5);
console.log(buf.toString()); // "HelloWorld"
```

</details>

### 🟡 中级

**3. 将 base64 字符串 "SGVsbG8gV29ybGQ=" 解码为普通字符串。**

<details>
<summary>参考答案</summary>

```js
const base64 = 'SGVsbG8gV29ybGQ=';
const buf = Buffer.from(base64, 'base64');
console.log(buf.toString()); // "Hello World"
```

</details>

**4. 实现 `bufferReverse(buf)` 函数，返回一个字节序反转的新 Buffer。**

<details>
<summary>参考答案</summary>

```js
function bufferReverse(buf) {
  const result = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    result[i] = buf[buf.length - 1 - i];
  }
  return result;
}
console.log(bufferReverse(Buffer.from('Hello')).toString()); // "olleH"
```

</details>

### 🔴 高级

**5. 实现一个简单的 XOR 加密/解密函数：`xorCipher(buf, key)`，key 是一个 Buffer，循环使用 key 的每个字节与 buf 异或。**

<details>
<summary>参考答案</summary>

```js
function xorCipher(buf, key) {
  const result = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    result[i] = buf[i] ^ key[i % key.length];
  }
  return result;
}

const message = Buffer.from('Secret Message');
const key = Buffer.from('key');

const encrypted = xorCipher(message, key);
console.log('encrypted (hex):', encrypted.toString('hex'));

const decrypted = xorCipher(encrypted, key);
console.log('decrypted:', decrypted.toString()); // "Secret Message"
```

</details>

---

## 八、知识点总结

```
Buffer 知识体系
├── 创建
│   ├── Buffer.alloc(size[, fill])        → 安全创建，默认填 0
│   ├── Buffer.allocUnsafe(size)          → 高性能，不初始化
│   └── Buffer.from(source[, encoding])   → 从字符串/数组/Buffer
├── 读写
│   ├── buf[index]                        → 读写单个字节
│   ├── buf.write(string[, offset[, len]])→ 写入字符串
│   ├── buf.toString([encoding[, start[, end]]]) → 转字符串
│   └── buf.toJSON()                      → 转为 JSON 对象
├── 操作
│   ├── Buffer.concat(list[, totalLen])   → 拼接
│   ├── buf.slice/subarray(start, end)    → 视图（共享内存）
│   ├── buf.copy(target[, tStart[, sStart[, sEnd]]]) → 复制
│   ├── buf.equals(other)                 → 相等比较
│   ├── buf.compare(other)                → 排序比较
│   ├── buf.fill(value[, start[, end]])   → 填充
│   └── buf.indexOf(value[, byteOffset])  → 查找
├── 属性
│   ├── buf.length                        → 字节长度（固定）
│   └── Buffer.byteLength(string)         → 字符串的字节长度
└── 编码
    ├── utf8 (默认)
    ├── ascii
    ├── base64
    ├── hex
    └── latin1 / binary
```

---

## 九、举一反三

| 场景 | Buffer 方案 | 关键 API |
|------|------------|----------|
| 读取文件为二进制 | `fs.readFile(path)` 返回 Buffer | `fs.readFile` |
| 网络包解析 | 接收 Buffer，按协议解析各字段 | `buf.readUInt32BE()` 等 |
| 图片处理 | 读写像素 Buffer | `buf[offset]` 读写 RGB |
| Base64 编解码 | `Buffer.from(str, 'base64')` | `buf.toString('base64')` |
| 加密哈希 | `crypto.update(buffer)` | `crypto.createHash()` |
| 数据库二进制字段 | BLOB 读写为 Buffer | 驱动文档 |
| Protocol Buffers | 序列化/反序列化为 Buffer | `protobufjs` |
| WebSocket 二进制帧 | `ws` 库接收 Buffer | `ws.on('message')` |
| 文件上传 | multipart 中的 Buffer 处理 | `multer` / `busboy` |
| 流式处理 | `Readable` 流 push Buffer | `stream.Readable` |

---

## 十、参考资料

- [Node.js 官方文档 - Buffer](https://nodejs.org/api/buffer.html)
- [MDN - ArrayBuffer vs Buffer 区别](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)
- [Node.js Design Patterns (Book)](https://www.nodejsdesignpatterns.com/)

---

## 十一、代码演进

### v1：基础 — 创建和读取

```js
const buf = Buffer.from('Hello World');
console.log(buf.toString());
console.log('Bytes:', buf.length);
```

### v2：进阶 — 写入、切片、拼接

```js
const buf = Buffer.alloc(32);
buf.write('Hello', 0);
buf.write(' World', 5);

const part = buf.subarray(0, 11);
console.log(part.toString());

const full = Buffer.concat([
  Buffer.from('Hello'),
  Buffer.from(' '),
  Buffer.from('World')
]);
console.log(full.toString());
```

### v3：实战 — 二进制协议解析器

```js
// Parse a simple binary packet: [4-byte length][1-byte type][payload]
function parsePacket(buffer) {
  if (buffer.length < 5) throw new Error('Packet too short');

  const length = buffer.readUInt32BE(0);
  const type = buffer.readUInt8(4);

  if (buffer.length < 5 + length) {
    throw new Error(`Expected ${5 + length} bytes, got ${buffer.length}`);
  }

  const payload = buffer.subarray(5, 5 + length);
  return { length, type, payload };
}

// Build a packet
function buildPacket(type, payload) {
  const header = Buffer.alloc(5);
  header.writeUInt32BE(payload.length, 0);
  header.writeUInt8(type, 4);
  return Buffer.concat([header, payload]);
}

// Usage
const msg = Buffer.from('Hello, Binary World!');
const packet = buildPacket(1, msg);
console.log('Packet (hex):', packet.toString('hex'));

const parsed = parsePacket(packet);
console.log('Type:', parsed.type);           // 1
console.log('Payload:', parsed.payload.toString()); // Hello, Binary World!
```

---

**总结：** Buffer 是 Node.js 处理二进制数据的基石。掌握创建、读写、切片、拼接、编码转换这五个核心操作，就能应对绝大多数场景。记住：Buffer 大小固定、slice 共享内存、中文占 3 字节——这三条能帮你避开 80% 的坑。
