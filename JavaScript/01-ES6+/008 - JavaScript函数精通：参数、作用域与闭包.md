---
title: "008 - JavaScript函数精通：参数、作用域与闭包"
slug: "008-js-functions"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:27:10.072+08:00"
updated_at: "2026-04-29T10:02:46.096+08:00"
reading_time: 16
tags: []
---


# JavaScript函数精通：参数、作用域与闭包

> **难度标注：** 🔴 高级 | **前置知识：** 变量声明、基本函数语法
> **阅读时间：** 约20分钟 | **代码量：** 约160行

---

## 一、概念讲解

函数是JavaScript的**一等公民**——可以赋值给变量、作为参数传递、作为返回值。理解函数需要掌握三个核心概念：**参数机制、作用域链、闭包**。

### 1.1 参数机制

- **默认参数（ES6）：** `function f(x = 10) {}`
- **剩余参数：** `function f(...args) {}`
- **arguments对象：** 类数组，箭头函数中没有

### 1.2 词法作用域

JavaScript使用**词法（静态）作用域**——函数的作用域在定义时确定，不是调用时。

### 1.3 闭包

闭包 = 函数 + 其定义时的词法环境。内部函数持有外部函数变量的引用，即使外部函数已返回。

---

## 二、脑图

```
                      函数
                   /   |   \
              参数   作用域  闭包
             / | \     |      |
         默认 剩余 arguments  词法   函数+词法环境
                               链    持有外部变量引用
                                    |
                               应用场景
                              /   |   \
                          数据私有  柯里化  回调/事件
```

---

## 三、完整代码示例

```javascript
// ============================================
// 1. Parameter mechanisms
// ============================================
// Default parameters
function greet(name = "World") {
  return `Hello, ${name}!`;
}
console.log(greet());       // "Hello, World!"
console.log(greet("Alice")); // "Hello, Alice!"

// Rest parameters
function sum(...numbers) {
  return numbers.reduce((acc, n) => acc + n, 0);
}
console.log(sum(1, 2, 3, 4)); // 10

// arguments object (not available in arrow functions)
function showArgs() {
  console.log(arguments); // [Arguments] { 0: 'a', 1: 'b' }
  console.log(Array.from(arguments)); // ['a', 'b']
}
showArgs("a", "b");

// ============================================
// 2. Lexical scope & scope chain
// ============================================
const global = "global";

function outer() {
  const outerVar = "outer";

  function inner() {
    const innerVar = "inner";
    // Scope chain: inner -> outer -> global
    console.log(innerVar); // "inner"
    console.log(outerVar); // "outer"
    console.log(global);   // "global"
  }

  inner();
  // console.log(innerVar); // ReferenceError
}
outer();

// ============================================
// 3. Closures in action
// ============================================
// 3a. Data privacy
function createCounter(initial = 0) {
  let count = initial; // private variable
  return {
    increment: () => ++count,
    decrement: () => --count,
    getValue: () => count,
  };
}

const counter = createCounter(10);
console.log(counter.getValue());  // 10
counter.increment();
counter.increment();
console.log(counter.getValue());  // 12
// counter.count; // undefined — truly private

// 3b. Currying
function multiply(a) {
  return function(b) {
    return a * b;
  };
}
const double = multiply(2);
const triple = multiply(3);
console.log(double(5));  // 10
console.log(triple(5));  // 15

// 3c. Memoization
function memoize(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = memoize((n) => {
  console.log(`Computing for ${n}...`);
  return n * n;
});
console.log(expensiveCalc(5)); // Computing for 5... → 25
console.log(expensiveCalc(5)); // 25 (cached, no recomputation)
console.log(expensiveCalc(3)); // Computing for 3... → 9

// ============================================
// 4. Common closure pitfall (loop)
// ============================================
function createFunctions() {
  const funcs = [];
  for (let i = 0; i < 3; i++) {
    funcs.push(() => i); // let creates new binding per iteration
  }
  return funcs;
}
createFunctions().forEach(fn => console.log(fn())); // 0, 1, 2
```

---

## 四、执行预览

```
Hello, World!
Hello, Alice!
10
[Arguments] { '0': 'a', '1': 'b' }
[ 'a', 'b' ]
inner
outer
global
10
12
10
15
Computing for 5...
25
25
Computing for 3...
9
0
1
2
```

---

## 五、注意事项

| 特性 | 说明 | 注意 |
|------|------|------|
| 默认参数 | 每次调用重新求值 | 默认值可以是表达式 |
| 剩余参数 | 必须是最后一个参数 | `...args`收集为数组 |
| arguments | 类数组非真数组 | 箭头函数中不可用 |
| 闭包内存 | 外部变量不会被GC | 注意内存泄漏风险 |
| this | 箭头函数继承外层this | 普通函数取决于调用方式 |

---

## 六、避坑指南

### ❌ 闭包引用循环变量（var）
```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 3, 3, 3
}
```
### ✅ 使用let或IIFE
```javascript
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 0, 1, 2
}
```

### ❌ 闭包导致的内存泄漏
```javascript
function leak() {
  const hugeData = new Array(1000000);
  return () => hugeData.length; // hugeData无法被GC
}
```
### ✅ 只保留需要的值
```javascript
function noLeak() {
  const hugeData = new Array(1000000);
  const len = hugeData.length; // extract what we need
  return () => len; // hugeData can be GC'd
}
```

---

## 七、练习题

### 🟢 基础
1. 写一个`makeAdder(x)`函数，返回一个函数，调用返回值时加上`x`。

### 🟡 进阶
2. 实现一个`once(fn)`函数，确保`fn`只被执行一次，后续调用返回第一次的结果。

### 🔴 挑战
3. 实现`compose(...fns)`，将多个函数组合成管道：`compose(f, g, h)(x) === f(g(h(x)))`，并处理异常情况。

---

## 八、知识点总结

```
函数体系
├── 参数机制
│   ├── 默认参数（ES6）
│   ├── 剩余参数（...args）
│   └── arguments对象（legacy）
├── 作用域
│   ├── 全局作用域
│   ├── 函数作用域
│   ├── 块级作用域（let/const）
│   └── 词法作用域链
└── 闭包
    ├── 原理：函数 + 词法环境
    ├── 应用：数据私有
    ├── 应用：柯里化/偏应用
    ├── 应用：记忆化
    └── 风险：内存泄漏
```

---

## 九、举一反三

| 设计模式 | 闭包角色 | 示例 |
|----------|----------|------|
| 模块模式 | 封装私有状态 | `createCounter()` |
| 工厂模式 | 生成定制函数 | `multiply(a)(b)` |
| 观察者模式 | 维护监听器列表 | `eventEmitter` |
| 策略模式 | 保存策略引用 | 缓存策略选择 |
| 装饰器模式 | 增强原函数 | `memoize(fn)` |

---

## 十、参考资料

- [MDN: 闭包](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Closures)
- [You Don't Know JS: Scope & Closures](https://github.com/getify/You-Dont-Know-JS)
- [JavaScript: The Good Parts (Douglas Crockford)](https://www.oreilly.com/library/view/javascript-the-good/9780596517748/)

---

## 十一、代码演进

### v1: 全局变量（不封装）
```javascript
let count = 0;
function increment() { return ++count; }
function decrement() { return --count; }
// count is exposed — anyone can modify it
```

### v2: IIFE模块（ES5）
```javascript
const counter = (function() {
  let count = 0;
  return {
    increment: () => ++count,
    decrement: () => --count,
  };
})();
```

### v3: 工厂函数 + 闭包（ES6+）
```javascript
function createCounter(initial = 0) {
  let count = initial;
  return {
    increment: () => ++count,
    decrement: () => --count,
    getValue: () => count,
    [Symbol.toPrimitive]: () => count,
  };
}
```

---

## 十二、总结

| 核心要点 | 说明 |
|----------|------|
| **一等公民** | 函数可赋值、传参、返回 |
| **词法作用域** | 定义时确定，非调用时 |
| **闭包** | 函数 + 定义时的词法环境 |
| **默认参数** | 优雅替代`x = x || default` |
| **剩余参数** | 替代`arguments`的现代方案 |
