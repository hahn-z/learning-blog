---
title: "024 - JavaScript性能优化"
slug: "024-js-perf"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T14:21:20.062+08:00"
updated_at: "2026-04-29T10:02:46.295+08:00"
reading_time: 24
tags: []
---

# JavaScript性能优化

> **难度：** ⭐⭐⭐⭐ 较高 | **适合：** 有一定项目经验，想提升性能意识的开发者
> **阅读时间：** 约30分钟 | **代码量：** 200+ 行

---

## 一、概念讲解

### 为什么需要性能优化？

性能直接影响用户体验和商业指标：
- 页面加载时间每增加1秒，转化率下降7%
- Google将页面速度作为搜索排名因素
- 移动端设备性能参差不齐，更需优化

### 性能优化的三个层面

```
┌─────────────────────────────┐
│     加载性能 (Loading)        │  → 用户等多久才能看到页面
├─────────────────────────────┤
│     运行时性能 (Runtime)      │  → 页面操作是否流畅
├─────────────────────────────┤
│     内存性能 (Memory)         │  → 是否泄漏、是否占用过多
└─────────────────────────────┘
```

---

## 二、脑图（ASCII）

```
                JS性能优化
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  加载优化        运行时优化      内存优化
     │              │              │
  ┌──┼──┐      ┌───┼───┐     ┌───┼───┐
  │  │  │      │   │   │     │   │   │
 代码 延迟 DOM  节流 缓存 Web 计算 对象 回收
 分割 加载 回流 防抖 memo Worker 池化 泄漏
```

---

## 三、完整代码示例

### 3.1 防抖与节流（高频场景必备）

```javascript
// Debounce: execute after user stops triggering
function debounce(fn, delay, { leading = false } = {}) {
  let timer = null;
  return function (...args) {
    if (leading && !timer) {
      fn.apply(this, args);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!leading) fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// Throttle: execute at most once per interval
function throttle(fn, interval) {
  let lastTime = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - lastTime);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

// Usage
const searchHandler = debounce((query) => {
  fetchSearchResults(query);
}, 300);

const scrollHandler = throttle(() => {
  loadMoreIfNearBottom();
}, 200);
```

### 3.2 DOM操作优化

```javascript
// BAD: triggers reflow on each iteration
function addItemsBad(container, items) {
  items.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    container.appendChild(li); // reflow each time!
  });
}

// GOOD: batch with DocumentFragment
function addItemsGood(container, items) {
  const fragment = document.createDocumentFragment();
  items.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    fragment.appendChild(li); // no reflow yet
  });
  container.appendChild(fragment); // single reflow
}

// Virtual scrolling for large lists
class VirtualList {
  constructor(container, items, itemHeight = 40) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2;
    this.pool = [];
    this.init();
  }

  init() {
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';

    // Spacer to create scrollbar
    this.spacer = document.createElement('div');
    this.spacer.style.height = this.items.length * this.itemHeight + 'px';
    this.container.appendChild(this.spacer);

    // Create DOM pool
    for (let i = 0; i < this.visibleCount; i++) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.height = this.itemHeight + 'px';
      el.style.width = '100%';
      this.container.appendChild(el);
      this.pool.push(el);
    }

    this.container.addEventListener('scroll', throttle(() => this.render(), 16));
    this.render();
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const startIdx = Math.floor(scrollTop / this.itemHeight);
    const offset = scrollTop % this.itemHeight;

    this.pool.forEach((el, i) => {
      const idx = startIdx + i;
      if (idx < this.items.length) {
        el.textContent = this.items[idx];
        el.style.transform = `translateY(${idx * this.itemHeight}px)`;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    });
  }
}
```

### 3.3 Web Worker 将计算移出主线程

```javascript
// main.js
const worker = new Worker('worker.js');

worker.postMessage({ type: 'HEAVY_CALC', data: largeArray });
worker.onmessage = (e) => {
  if (e.data.type === 'RESULT') {
    console.log('Calculation done:', e.data.result);
  }
};

// worker.js
self.onmessage = (e) => {
  if (e.data.type === 'HEAVY_CALC') {
    const result = heavyComputation(e.data.data);
    self.postMessage({ type: 'RESULT', result });
  }
};

function heavyComputation(data) {
  // Expensive work here - won't block main thread
  return data.reduce((sum, val) => sum + Math.sqrt(val) * Math.log(val), 0);
}
```

### 3.4 内存泄漏检测与预防

```javascript
// Common memory leak patterns and fixes

// LEAK 1: Forgotten timers
// BAD
// setInterval(() => updateWidget(data), 1000);
// GOOD
class Widget {
  constructor() {
    this._timer = setInterval(() => this.update(), 1000);
  }
  destroy() {
    clearInterval(this._timer); // Clean up!
  }
}

// LEAK 2: Detached DOM nodes
// BAD: keeping reference to removed element
// const removed = element.remove();
// globalCache.push(removed); // element can't be GC'd!
// GOOD: null the reference
// removed = null;

// LEAK 3: Event listeners not removed
// BAD
// window.addEventListener('resize', handler);
// GOOD
class ResponsiveHandler {
  constructor() {
    this.handler = this.handler.bind(this);
    window.addEventListener('resize', this.handler);
  }
  destroy() {
    window.removeEventListener('resize', this.handler);
  }
  handler() { /* ... */ }
}

// LEAK 4: Closures capturing large objects
// BAD
function createHandler(largeData) {
  return () => process(largeData.item); // holds ALL of largeData
}
// GOOD
function createHandler(largeData) {
  const item = largeData.item; // only capture what's needed
  return () => process(item);
}

// WeakMap for cache without memory leaks
class Cache {
  #map = new WeakMap();
  set(obj, value) { this.#map.set(obj, value); }
  get(obj) { return this.#map.get(obj); }
}
```

---

## 四、执行预览

```
Performance Optimization Demo
==============================
1. VirtualList: 10000 items, only ~20 DOM nodes rendered
   → Scroll smooth at 60fps

2. Debounce search: typing "JavaScript"
   → Only fires API call after 300ms pause

3. Web Worker: heavy math off main thread
   → UI stays responsive during computation

4. Memory: WeakMap cache auto-releases GC'd objects
   → No manual cleanup needed
```

---

## 五、注意事项

| 优化手段 | 注意点 | 建议 |
|---------|--------|------|
| `DocumentFragment` | 一次性插入仍触发reflow | 比逐个插入好得多 |
| 虚拟滚动 | 项目高度需固定或可计算 | 动态高度需额外处理 |
| Web Worker | 通信有序列化开销 | 小任务不值得开Worker |
| `WeakMap` 缓存 | 不能遍历keys | 需要遍历用Map+手动清理 |
| 防抖节流 | `leading`/`trailing` 行为不同 | 按业务需求选择 |
| `requestIdleCallback` | 浏览器支持有限 | 降级用 `setTimeout` |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 | 原因 |
|------------|-----------|------|
| 循环中读写DOM样式 | 批量读→计算→批量写 | 避免强制同步布局 |
| `innerHTML` 拼接大量HTML | DocumentFragment | 减少HTML解析开销 |
| 全部数据一次渲染 | 虚拟滚动/分页 | 大DOM树 = 卡顿 |
| `setInterval` 做动画 | `requestAnimationFrame` | 与刷新率同步 |
| 闭包中捕获大对象 | 只提取需要的字段 | 减少内存占用 |
| 组件销毁不清理监听器 | `destroy/disconnect` 方法 | 防止内存泄漏 |

---

## 七、练习题

### 🟢 基础
1. 实现 `debounce(fn, 300)` 并测试快速连续调用只执行一次
2. 用 `console.time/timeEnd` 测量循环创建1000个DOM元素的时间
3. 用 `performance.now()` 对比 `for` 和 `forEach` 的性能差异

### 🟡 进阶
4. 实现一个虚拟滚动列表（固定行高），支持10000条数据
5. 使用 `requestIdleCallback` 在空闲时间执行低优先级任务
6. 用 Chrome DevTools Memory 面板检测并修复一个内存泄漏

### 🔴 挑战
7. 实现一个 LRU Cache，支持自动淘汰和大小限制
8. 性能监控SDK：采集 FCP/LCP/CLS 指标并上报

---

## 八、知识点总结

```
JavaScript性能优化
├── 加载性能
│   ├── 代码分割 (Dynamic import)
│   ├── Tree shaking
│   ├── 延迟加载 (lazy load)
│   └── 资源压缩 (minify/gzip)
├── 运行时性能
│   ├── DOM批量操作 (DocumentFragment)
│   ├── 虚拟滚动 (Virtual List)
│   ├── 防抖 (debounce) / 节流 (throttle)
│   ├── Web Worker
│   ├── requestAnimationFrame
│   └── 缓存 (memo/WeakMap)
├── 内存优化
│   ├── 及时清理定时器和监听器
│   ├── 避免闭包捕获大对象
│   ├── WeakMap/WeakSet
│   └── 对象池 (Object Pool)
└── 性能度量
    ├── Performance API
    ├── console.time/timeEnd
    ├── Chrome DevTools
    └── Web Vitals (FCP/LCP/CLS/FID)
```

---

## 九、举一反三

| JS优化 | 其他领域 | 相似思路 |
|--------|---------|---------|
| 虚拟滚动 | 数据库分页 | 按需加载，不全量渲染 |
| Web Worker | 微服务拆分 | 职责分离，并行处理 |
| 防抖节流 | API限流 (Rate Limiting) | 控制频率，防止过载 |
| LRU Cache | Redis缓存策略 | 热点数据缓存，冷数据淘汰 |
| 懒加载 | CDN预热 | 按需 vs 预加载的不同策略 |

---

## 十、参考资料

- [Web.dev - Performance](https://web.dev/performance/)
- [MDN - Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [JavaScript Performance - V8](https://v8.dev/docs/performance)
- [Chrome DevTools - Performance](https://developer.chrome.com/docs/devtools/performance/)

---

## 十一、代码演进

### v1: 直接操作DOM

```javascript
// Naive approach - triggers reflow per item
data.forEach(item => {
  const div = document.createElement('div');
  div.textContent = item.name;
  list.appendChild(div);
});
```

### v2: 批量操作 + 防抖

```javascript
// Batch DOM updates, debounce frequent events
const fragment = document.createDocumentFragment();
data.forEach(item => {
  const div = document.createElement('div');
  div.textContent = item.name;
  fragment.appendChild(div);
});
list.appendChild(fragment);

input.addEventListener('input', debounce(search, 300));
```

### v3: 虚拟滚动 + Worker + 内存管理

```javascript
// Full optimization: virtual scroll + off-thread computation + leak prevention
const vlist = new VirtualList(container, largeData);
const worker = new Worker('heavy-calc.js');
worker.postMessage(data);
// ... see complete implementations above
```

---

## 十二、总结

性能优化的核心是**测量先行**——先用DevTools找到瓶颈，再针对性优化。三大方向：**减少DOM操作**（批量、虚拟滚动）、**减轻主线程**（Worker、RAF）、**控制内存**（及时清理、WeakMap）。记住：过早优化是万恶之源，但性能意识要从第一天培养。
