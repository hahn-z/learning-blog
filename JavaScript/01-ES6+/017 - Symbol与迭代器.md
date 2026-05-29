---
title: "017 - Symbol与迭代器"
slug: "017-js-symbol-iterator"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T14:15:10.896+08:00"
updated_at: "2026-04-29T10:02:46.199+08:00"
reading_time: 14
tags: []
---

# Symbol与迭代器

> **难度：** ⭐⭐⭐ 中等 | **分类：** JavaScript 核心 | **阅读时间：** ~15分钟

## 一、概念讲解

`Symbol` 是 ES6 引入的第七种基本类型，表示唯一的标识符。每次调用 `Symbol()` 都会创建一个全新的、唯一的值，即使描述相同也不相等。

迭代器（Iterator）是实现了 `[Symbol.iterator]()` 方法的对象，返回 `{ next(), done, value }` 协议。可迭代对象（Iterable）可以被 `for...of`、展开运算符、解构等消费。

核心概念：
- **Symbol()** — 创建唯一值，防止属性名冲突
- **Symbol.for() / Symbol.keyFor()** — 全局 Symbol 注册表
- **Well-known Symbols** — `Symbol.iterator`、`Symbol.toStringTag` 等
- **迭代协议** — `[Symbol.iterator]()` 返回 `{ next() }` 对象
- **生成器函数** — `function*` 是创建迭代器的语法糖

## 二、脑图（ASCII）

```
              Symbol 与迭代器
          ┌────────┴────────┐
      Symbol              Iterator
     ┌──┴──┐          ┌────┴────┐
  Unique  Global    Protocol   Generator
  Symbol() Symbol.for() next()  function*
  描述符   keyFor()  done/value yield
     │                    │
  Well-known          for...of
  iterator            展开运算符
  toStringTag         解构赋值
  toPrimitive
```

## 三、完整 JS 代码

```javascript
// ==================== Symbol Basics ====================

// Each Symbol is unique
const s1 = Symbol('desc');
const s2 = Symbol('desc');
console.log(s1 === s2); // false

// Global registry
const g1 = Symbol.for('app.key');
const g2 = Symbol.for('app.key');
console.log(g1 === g2);              // true
console.log(Symbol.keyFor(g1));      // 'app.key'

// Use as object keys — no collision
const SECRET = Symbol('secret');
const user = {
  name: 'Alice',
  [SECRET]: 'hidden data',
};
console.log(Object.keys(user));       // ['name'] — Symbol keys hidden
console.log(user[SECRET]);            // 'hidden data'

// ==================== Custom Iterator ====================

class NumberRange {
  constructor(start, end, step = 1) {
    this.start = start;
    this.end = end;
    this.step = step;
  }

  // Implement the iteration protocol
  [Symbol.iterator]() {
    let current = this.start;
    const { end, step } = this;

    return {
      next() {
        if (current < end) {
          const value = current;
          current += step;
          return { value, done: false };
        }
        return { value: undefined, done: true };
      },
      // Optional: return() for early exit (break/throw)
      return() {
        console.log('Iterator cleaned up');
        return { value: undefined, done: true };
      }
    };
  }
}

const range = new NumberRange(1, 6, 2);
for (const num of range) {
  console.log(num); // 1, 3, 5
}

// ==================== Generator Function ====================

function* fibonacci(limit) {
  let [a, b] = [0, 1];
  while (a < limit) {
    yield a;
    [a, b] = [b, a + b];
  }
}

const fib = fibonacci(20);
console.log([...fib]); // [0, 1, 1, 2, 3, 5, 8, 13]

// Generator with delegation (yield*)
function* letters() {
  yield* ['a', 'b', 'c'];
  yield* 'XYZ';
}
console.log([...letters()]); // ['a','b','c','X','Y','Z']
```

## 四、执行预览

```
false
true
app.key
[ 'name' ]
hidden data
1
3
5
[ 0, 1, 1, 2, 3, 5, 8, 13 ]
[ 'a', 'b', 'c', 'X', 'Y', 'Z' ]
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| Symbol 不可隐式转换 | `Symbol() + ''` 会 TypeError，需用 `.description` 或 `String(sym)` |
| JSON.stringify 忽略 Symbol | Symbol 作为 key 的属性不会被序列化 |
| `Object.keys()` 不含 Symbol | 用 `Object.getOwnPropertySymbols()` 获取 |
| 迭代器是一次性的 | 展开或 `for...of` 消费后，迭代器耗尽，需重新创建 |
| Generator 是惰性的 | `yield` 暂停执行，只有调用 `next()` 才继续 |

## 六、避坑指南

❌ **错误：用 new 创建 Symbol**
```javascript
const s = new Symbol(); // ❌ TypeError: Symbol is not a constructor
```

✅ **正确：直接调用函数**
```javascript
const s = Symbol('my desc'); // ✅
```

❌ **错误：复用耗尽的迭代器**
```javascript
const gen = fibonacci(10);
console.log([...gen]); // [0, 1, 1, 2, 3, 8]
console.log([...gen]); // ❌ [] — already exhausted!
```

✅ **正确：每次创建新的**
```javascript
console.log([...fibonacci(10)]); // ✅ Fresh iterator each time
```

## 七、练习题

🟢 **初级：** 创建一个 `repeat(item, n)` 生成器函数，yield 同一个值 n 次。

🟡 **中级：** 实现一个 `Tree` 类，支持 `for...of` 遍历所有节点（深度优先）。

🔴 **高级：** 实现一个 `asyncGenerator`，用 `for await...of` 逐行读取模拟的异步数据流。

## 八、知识点总结（树状）

```
Symbol 与迭代器
├── Symbol
│   ├── Symbol('desc') — 唯一值
│   ├── Symbol.for() — 全局注册
│   ├── Symbol.keyFor() — 查询描述
│   └── Well-known Symbols
│       ├── Symbol.iterator
│       ├── Symbol.toStringTag
│       ├── Symbol.toPrimitive
│       └── Symbol.hasInstance
├── Iterator Protocol
│   ├── [Symbol.iterator]()
│   ├── next() → { value, done }
│   ├── return() — 提前终止
│   └── throw() — 错误传递
└── Generator
    ├── function* / yield
    ├── yield* — 委托
    ├── next(args) — 双向通信
    └── async function* / for await
```

## 九、举一反三

| 场景 | 实现方式 | 关键点 |
|------|----------|--------|
| 枚举常量 | `const Color = { RED: Symbol(), BLUE: Symbol() }` | 防止值冲突 |
| 私有属性 | `const _key = Symbol('private')` | 简单私有（非安全） |
| 自定义迭代 | `[Symbol.iterator]()` | 让对象支持 `for...of` |
| 惰性序列 | `function*` 生成器 | 无限序列按需取值 |
| 数据管道 | Generator 链式组合 | 函数式流处理 |

## 十、参考资料

- [MDN - Symbol](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- [MDN - Iteration protocols](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Iteration_protocols)
- [JavaScript.info - Generators](https://javascript.info/generators)

## 十一、代码演进

```javascript
// v1: Manual iterator object
const iterable = {
  [Symbol.iterator]() {
    let i = 0;
    return {
      next() { return i < 3 ? { value: i++, done: false } : { done: true }; }
    };
  }
};

// v2: Generator function — cleaner
function* rangeGen(start, end) {
  for (let i = start; i < end; i++) yield i;
}

// v3: Class with full iterator + generator combined
class PaginatedList {
  #items;
  #pageSize;
  constructor(items, pageSize = 10) {
    this.#items = items;
    this.#pageSize = pageSize;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.#items.length; i += this.#pageSize) {
      yield this.#items.slice(i, i + this.#pageSize);
    }
  }
}

const pages = new PaginatedList([1,2,3,4,5], 2);
for (const page of pages) console.log(page);
// [1,2], [3,4], [5]
```
