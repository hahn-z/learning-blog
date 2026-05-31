---
title: "022 - BOM与浏览器API"
slug: "022-js-bom"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T14:21:20.042+08:00"
updated_at: "2026-04-29T10:02:46.263+08:00"
reading_time: 22
tags: []
---

# BOM与浏览器API

> **难度：** ⭐⭐⭐ 中等 | **适合：** 需要与浏览器环境交互的开发者
> **阅读时间：** 约25分钟 | **代码量：** 180+ 行

---

## 一、概念讲解

### 什么是BOM？

BOM（Browser Object Model）是浏览器提供的JavaScript API集合，它让JS能够与浏览器窗口、导航、存储、定时器等进行交互。与DOM操作HTML不同，BOM操作的是**浏览器环境本身**。

```
window (全局对象)
  ├── document (DOM入口)
  ├── navigator (浏览器信息)
  ├── location (URL信息)
  ├── history (浏览历史)
  ├── screen (屏幕信息)
  ├── localStorage / sessionStorage
  ├── fetch / XMLHttpRequest
  ├── setTimeout / setInterval
  └── postMessage
```

---

## 二、脑图（ASCII）

```
                    BOM与浏览器API
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    核心对象           存储            网络通信
        │                │                │
   ┌────┼────┐     ┌────┼────┐     ┌────┼────┐
   │    │    │     │    │    │     │    │    │
  loc  nav hist  local session cookie fetch  XHR
  ation igtor ory  Stge  Stge           postMsg
```

---

## 三、完整代码示例

### 3.1 Location & URL操作

```javascript
// Parse and manipulate URLs
const url = new URL('https://example.com/path?name=js&page=1#section');

console.log(url.protocol); // 'https:'
console.log(url.hostname); // 'example.com'
console.log(url.pathname); // '/path'
console.log(url.searchParams.get('name')); // 'js'
console.log(url.hash); // '#section'

// Modify URL without reload
history.pushState({ page: 2 }, '', '/page/2');
history.replaceState({ page: 2 }, '', '/page/2');

// Listen for popstate (back/forward button)
window.addEventListener('popstate', (e) => {
  console.log('State:', e.state);
});

// Redirect
// location.href = 'https://example.com';  // full redirect
// location.reload();  // reload current page
```

### 3.2 Navigator & 设备信息

```javascript
// Browser and device info
console.log('Language:', navigator.language);      // 'zh-CN'
console.log('Platform:', navigator.userAgent);
console.log('Online:', navigator.onLine);

// Network information
const conn = navigator.connection;
if (conn) {
  console.log('Effective type:', conn.effectiveType); // '4g'
  console.log('Downlink:', conn.downlink, 'Mbps');
}

// Clipboard API
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Copied!');
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// Geolocation
navigator.geolocation.getCurrentPosition(
  (pos) => console.log(`Lat: ${pos.coords.latitude}, Lng: ${pos.coords.longitude}`),
  (err) => console.error('Geolocation error:', err.message),
  { enableHighAccuracy: true, timeout: 5000 }
);
```

### 3.3 Storage 封装

```javascript
// Type-safe storage wrapper with expiry
class StorageWrapper {
  constructor(storage = localStorage) {
    this.storage = storage;
  }

  set(key, value, ttlMs = null) {
    const item = {
      value,
      timestamp: Date.now(),
      ttl: ttlMs,
    };
    this.storage.setItem(key, JSON.stringify(item));
  }

  get(key, defaultValue = null) {
    const raw = this.storage.getItem(key);
    if (!raw) return defaultValue;
    try {
      const item = JSON.parse(raw);
      // Check TTL expiration
      if (item.ttl && Date.now() - item.timestamp > item.ttl) {
        this.remove(key);
        return defaultValue;
      }
      return item.value;
    } catch {
      return defaultValue;
    }
  }

  remove(key) {
    this.storage.removeItem(key);
  }

  clear() {
    this.storage.clear();
  }

  // Get all keys with optional prefix filter
  keys(prefix = '') {
    return Object.keys(this.storage)
      .filter(k => k.startsWith(prefix));
  }

  // Get storage usage in bytes
  getSize() {
    let size = 0;
    for (const key of Object.keys(this.storage)) {
      size += key.length + this.storage.getItem(key).length;
    }
    return size * 2; // UTF-16 = 2 bytes per char
  }
}

const ls = new StorageWrapper(localStorage);
ls.set('user', { name: 'Hahn' }, 3600000); // 1 hour TTL
ls.set('theme', 'dark');
console.log(ls.get('user')); // { name: 'Hahn' }
console.log(ls.getSize(), 'bytes used');
```

### 3.4 定时器与动画帧

```javascript
// Precise timing with requestAnimationFrame
function animate(element, property, from, to, duration) {
  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    element.style[property] = current + 'px';

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

// Debounce and throttle using timers
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function throttle(fn, interval) {
  let lastTime = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn(...args);
    }
  };
}

// Usage
window.addEventListener('resize', debounce(() => {
  console.log('Resized:', window.innerWidth, window.innerHeight);
}, 300));

window.addEventListener('scroll', throttle(() => {
  console.log('Scroll position:', window.scrollY);
}, 100));
```

---

## 四、执行预览

```
BOM API Demo
=============
1. URL parsed: https://example.com/path?name=js&page=1#section
2. Navigator: zh-CN, online=true, 4g
3. Storage: user={name:Hahn} (TTL: 1h), theme=dark
4. Animation: opacity 0→1 over 500ms (ease-out)
5. Resize debounced (300ms), Scroll throttled (100ms)
```

---

## 五、注意事项

| API | 注意点 | 建议 |
|-----|--------|------|
| `localStorage` | 同源限制，约5MB | 大数据用 IndexedDB |
| `sessionStorage` | 标签页关闭即清除 | 适合临时会话数据 |
| `navigator.geolocation` | 需要用户授权 | HTTPS环境下才能使用 |
| `history.pushState` | 不触发页面加载 | 需要自行管理路由状态 |
| `fetch` | 默认不发送cookies | 设置 `credentials: 'include'` |
| `postMessage` | 需验证 `event.origin` | 安全性考虑 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 | 原因 |
|------------|-----------|------|
| `setInterval` 做动画 | `requestAnimationFrame` | 与屏幕刷新同步，不卡顿 |
| `localStorage` 存大文件 | 用 IndexedDB | localStorage有5MB限制 |
| 直接 `location.href` 跳转 | `history.pushState` + 路由 | SPA不需要整页刷新 |
| `navigator.userAgent` 判断特性 | 特性检测 `if ('geolocation' in navigator)` | UA可伪造，不可靠 |
| `new Date().getTime()` | `Date.now()` 或 `performance.now()` | 更简洁，performance更精确 |
| 定时器不清理 | 组件卸载时 `clearTimeout/clearInterval` | 防止内存泄漏 |

---

## 七、练习题

### 🟢 基础
1. 解析当前页面URL，输出所有查询参数
2. 实现页面主题切换，状态保存到 `localStorage`
3. 使用 `setTimeout` 实现一个简单的倒计时

### 🟡 进阶
4. 封装 `debounce` 和 `throttle`，支持取消防抖
5. 使用 `IntersectionObserver` 实现图片懒加载
6. 实现 `BroadcastChannel` 跨标签页通信

### 🔴 挑战
7. 用 `history API` 实现一个迷你SPA路由
8. 封装 IndexedDB 操作库，支持事务和索引查询

---

## 八、知识点总结

```
BOM与浏览器API
├── 核心对象
│   ├── window: 全局对象、尺寸、滚动
│   ├── location: URL解析与跳转
│   ├── navigator: 浏览器/设备信息
│   ├── history: 路由与导航
│   └── screen: 屏幕信息
├── 存储
│   ├── localStorage: 持久化KV存储
│   ├── sessionStorage: 会话级KV存储
│   ├── Cookie: 小型文本存储
│   └── IndexedDB: 大型结构化存储
├── 定时与动画
│   ├── setTimeout / setInterval
│   ├── requestAnimationFrame
│   └── performance.now()
├── 网络
│   ├── fetch API
│   ├── WebSocket
│   └── postMessage / BroadcastChannel
└── 设备API
    ├── Geolocation
    ├── Clipboard
    ├── Notification
    └── Media (Camera/Mic)
```

---

## 九、举一反三

| BOM API | 类似技术 | 迁移思路 |
|---------|---------|---------|
| localStorage | Redis / Memcached | 同为KV存储，注意容量差异 |
| fetch | axios / jQuery.ajax | 底层都是XMLHttpRequest/Fetch |
| history API | React Router / Vue Router | 框架路由是对history的封装 |
| requestAnimationFrame | CSS transition/animation | JS适合复杂逻辑，CSS适合简单动画 |
| IndexedDB | SQLite | 同为本地数据库，IndexedDB是异步的 |

---

## 十、参考资料

- [MDN - Web APIs](https://developer.mozilla.org/zh-CN/docs/Web/API)
- [MDN - Window](https://developer.mozilla.org/zh-CN/docs/Web/API/Window)
- [JavaScript.info - BOM](https://javascript.info/onload-ondomcontentloaded)

---

## 十一、代码演进

### v1: 直接使用BOM API

```javascript
// Raw BOM calls, no abstraction
localStorage.setItem('theme', 'dark');
const theme = localStorage.getItem('theme');
window.addEventListener('scroll', () => console.log(window.scrollY));
```

### v2: 封装工具函数

```javascript
// Utility functions with error handling
const store = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
};
```

### v3: 完整StorageWrapper类 + TTL

```javascript
// Full-featured storage with TTL, size tracking, prefix filtering
// See section 3.3 above for complete implementation
```

---

## 十二、总结

BOM是JS与浏览器交互的桥梁。掌握**location/history**实现路由，**Storage API**做本地持久化，**定时器与RAF**控制动画节奏，**navigator**获取设备能力——这些让你从"操作DOM"进化到"掌控浏览器环境"。
