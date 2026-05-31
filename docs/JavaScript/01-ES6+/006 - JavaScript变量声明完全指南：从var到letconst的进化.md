---
title: "006 - JavaScript变量声明完全指南：从var到let/const的进化"
slug: "006-js-let-const"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:27:10.052+08:00"
updated_at: "2026-04-29T10:02:46.079+08:00"
reading_time: 14
tags: []
---


# JavaScript变量声明完全指南：从var到let/const的进化

> **难度标注：** 🟡 中级 | **前置知识：** 基本JS语法、作用域概念
> **阅读时间：** 约15分钟 | **代码量：** 约120行

---

## 一、概念讲解

JavaScript变量声明经历了三个阶段：`var`（ES1）→ `let/const`（ES6）。理解它们的区别，核心在于三个机制：**作用域规则、变量提升、重新赋值约束**。

### 1.1 var：函数作用域 + 变量提升

`var`声明的变量受**函数作用域**约束，且存在**变量提升（hoisting）**——声明会被提升到作用域顶部，但赋值不会。

### 1.2 let：块级作用域 + 暂时性死区

`let`声明的变量受**块级作用域**（`{}`）约束，在声明前访问会触发**暂时性死区（TDZ）**错误。

### 1.3 const：块级作用域 + 不可重新赋值

`const`与`let`行为一致，额外增加一条：**必须在声明时初始化，且不可重新赋值**。注意：const保护的是绑定，不是值——对象和数组的内容仍可修改。

---

## 二、脑图

```
                    变量声明
                   /    |    \
                var   let   const
                 |      |      |
           函数作用域  块作用域  块作用域
           变量提升    TDZ      TDZ
           可重复声明  不可重复  不可重复
           可重新赋值  可重新赋值 不可重新赋值
                              必须初始化
                              对象属性可改
```

---

## 三、完整代码示例

```javascript
// ============================================
// 1. var: function scope & hoisting
// ============================================
function varDemo() {
  console.log(a); // undefined (hoisted, not initialized)
  var a = 10;
  console.log(a); // 10

  if (true) {
    var b = 20; // leaks out of if-block
  }
  console.log(b); // 20

  // re-declaration is allowed
  var a = 30;
  console.log(a); // 30
}

// ============================================
// 2. let: block scope & TDZ
// ============================================
function letDemo() {
  // console.log(x); // ReferenceError: TDZ
  let x = 1;

  if (true) {
    let x = 2; // different scope, shadowing
    console.log(x); // 2
  }
  console.log(x); // 1

  // let x = 3; // SyntaxError: cannot redeclare
  x = 3; // reassignment is OK
  console.log(x); // 3
}

// ============================================
// 3. const: block scope + immutable binding
// ============================================
function constDemo() {
  const PI = 3.14159;
  // PI = 3; // TypeError: assignment to constant

  const obj = { name: "Alice" };
  obj.name = "Bob"; // OK: mutating content, not rebinding
  console.log(obj); // { name: "Bob" }

  const arr = [1, 2, 3];
  arr.push(4); // OK
  console.log(arr); // [1, 2, 3, 4]
}

// ============================================
// 4. Loop gotcha: var vs let
// ============================================
function loopDemo() {
  // var: all callbacks share the same i
  for (var i = 0; i < 3; i++) {
    setTimeout(() => console.log("var:", i), 0); // 3, 3, 3
  }

  // let: each iteration has its own i
  for (let j = 0; j < 3; j++) {
    setTimeout(() => console.log("let:", j), 0); // 0, 1, 2
  }
}

// Run all demos
varDemo();
letDemo();
constDemo();
loopDemo();
```

---

## 四、执行预览

```
undefined
10
20
30
2
1
3
{ name: 'Bob' }
[ 1, 2, 3, 4 ]
var: 3
var: 3
var: 3
let: 0
let: 1
let: 2
```

---

## 五、注意事项

| 特性 | var | let | const | 说明 |
|------|-----|-----|-------|------|
| 作用域 | 函数 | 块 | 块 | 块 = `{}`内的范围 |
| 提升 | ✅ (undefined) | ❌ (TDZ) | ❌ (TDZ) | let/const存在但不可访问 |
| 重复声明 | ✅ | ❌ | ❌ | let/const同名会SyntaxError |
| 重新赋值 | ✅ | ✅ | ❌ | const绑定不可变 |
| 必须初始化 | ❌ | ❌ | ✅ | const必须 `const x = value` |
| 全局属性 | ✅ | ❌ | ❌ | var会挂到window/globalThis |

---

## 六、避坑指南

### ❌ 用var在循环中创建闭包
```javascript
// ❌ Bug: 所有回调打印3
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
```
### ✅ 用let解决循环闭包
```javascript
// ✅ 每次迭代独立作用域
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 0, 1, 2
}
```

### ❌ 以为const对象完全不可变
```javascript
const config = { debug: false };
config.debug = true; // 居然能改！
```
### ✅ 需要真正不可变用Object.freeze
```javascript
const config = Object.freeze({ debug: false });
config.debug = true; // silently fails (strict mode throws)
```

---

## 七、练习题

### 🟢 基础
1. 将以下`var`改为`let`或`const`，说明理由：
```javascript
var API_URL = "https://api.example.com";
var counter = 0;
counter++;
```

### 🟡 进阶
2. 预测输出并解释原因：
```javascript
let x = 1;
{
  let x = 2;
  {
    let x = 3;
    console.log(x);
  }
  console.log(x);
}
console.log(x);
```

### 🔴 挑战
3. 实现一个`createCounter()`函数，用闭包+let实现私有变量，返回`increment`、`decrement`、`getValue`三个方法，且`getValue`返回的值不可被外部修改。

---

## 八、知识点总结

```
变量声明体系
├── var (ES1, 遗留)
│   ├── 函数作用域
│   ├── 变量提升 (undefined)
│   └── 可重复声明
├── let (ES6, 推荐)
│   ├── 块级作用域
│   ├── 暂时性死区 (TDZ)
│   └── 不可重复声明
└── const (ES6, 默认选择)
    ├── 块级作用域
    ├── 暂时性死区 (TDZ)
    ├── 不可重新赋值
    └── 值可变（对象/数组）
```

---

## 九、举一反三

| 场景 | 推荐声明 | 原因 |
|------|----------|------|
| 循环计数器 | `let` | 块作用域避免闭包bug |
| 配置常量 | `const` | 语义明确，防止误改 |
| 函数内中间变量 | `let` | 需要重新赋值 |
| 模块导出引用 | `const` | 引用不变 |
| 解构赋值 | `let`/`const` | 视是否需要重赋值 |
| for...of迭代 | `const` | 每次迭代是新的绑定 |

---

## 十、参考资料

- [MDN: let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let)
- [MDN: const](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const)
- [ES6 In Depth: let and const](https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/)
- [You Don't Know JS: Scope & Closures](https://github.com/getify/You-Dont-Know-JS)

---

## 十一、代码演进

### v1: ES5 — 只能用var
```javascript
// 经典闭包bug，需要IIFE修复
for (var i = 0; i < 3; i++) {
  (function(j) {
    setTimeout(() => console.log(j), 0);
  })(i);
}
```

### v2: ES6 — let解决作用域
```javascript
// let自动创建块作用域，简洁优雅
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
```

### v3: 最佳实践 — const优先
```javascript
// 默认用const，需要重赋值才用let
const delays = [100, 200, 300];
for (const delay of delays) {
  setTimeout(() => console.log(`fired after ${delay}ms`), delay);
}
```

---

## 十二、总结

| 原则 | 说明 |
|------|------|
| **默认用const** | 除非需要重赋值 |
| **需要重赋值用let** | 循环计数器、累加器 |
| **永远别用var** | ES6+没有理由再用 |
| **const ≠ 不可变** | 需要深冻结用`Object.freeze()` |
