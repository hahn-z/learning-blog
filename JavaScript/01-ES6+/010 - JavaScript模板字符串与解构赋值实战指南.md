---
title: "010 - JavaScript模板字符串与解构赋值实战指南"
slug: "010-js-template-destructure"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:27:10.09+08:00"
updated_at: "2026-04-29T10:02:46.115+08:00"
reading_time: 15
tags: []
---


# JavaScript模板字符串与解构赋值实战指南

> **难度标注：** 🟢 初级 | **前置知识：** 基本JS语法、对象和数组
> **阅读时间：** 约14分钟 | **代码量：** 约120行

---

## 一、概念讲解

### 1.1 模板字符串

用反引号`` ` ``包裹的字符串，支持：**多行、插值`${}`、标签模板**。

### 1.2 解构赋值

从数组或对象中提取值，按模式匹配赋给变量。支持：**默认值、重命名、嵌套、剩余模式**。

---

## 二、脑图

```
            ES6语法糖
           /         \
     模板字符串      解构赋值
      / | \          /    \
   多行 插值 标签   数组    对象
                解构    解构
                 \     /
               默认值/重命名/嵌套/剩余
```

---

## 三、完整代码示例

```javascript
// ============================================
// 1. Template literals
// ============================================
const name = "Alice";
const age = 25;

// String interpolation
console.log(`${name} is ${age} years old.`);

// Multi-line strings
const html = `
  <div class="card">
    <h2>${name}</h2>
    <p>Age: ${age}</p>
  </div>
`;
console.log(html.trim());

// Expressions inside ${}
console.log(`2 + 2 = ${2 + 2}`);
console.log(`Upper: ${name.toUpperCase()}`);
console.log(`Ternary: ${age >= 18 ? "adult" : "minor"}`);

// Nested template literals
const items = ["apple", "banana", "cherry"];
const list = `<ul>${items.map(i => `<li>${i}</li>`).join("\n  ")}</ul>`;
console.log(list);

// Tagged template
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const val = values[i] ? `<mark>${values[i]}</mark>` : "";
    return result + str + val;
  }, "");
}
console.log(highlight`Hello ${name}, you are ${age}!`);

// ============================================
// 2. Array destructuring
// ============================================
const numbers = [1, 2, 3, 4, 5];

const [first, second, ...rest] = numbers;
console.log(first, second, rest); // 1 2 [3, 4, 5]

// Skip elements
const [, , third] = numbers;
console.log(third); // 3

// Default values
const [a, b, c, d, e, f = 10] = numbers;
console.log(f); // 10 (no 6th element, uses default)

// Swap variables
let x = 1, y = 2;
[x, y] = [y, x];
console.log(x, y); // 2 1

// Function return destructuring
function getMinMax(arr) {
  return [Math.min(...arr), Math.max(...arr)];
}
const [min, max] = getMinMax(numbers);
console.log(min, max); // 1 5

// ============================================
// 3. Object destructuring
// ============================================
const user = {
  name: "Alice",
  age: 25,
  address: {
    city: "Beijing",
    zip: "100000",
  },
};

// Basic destructuring
const { name: userName, age: userAge } = user;
console.log(userName, userAge); // Alice 25

// Default values
const { role = "user" } = user;
console.log(role); // "user"

// Nested destructuring
const { address: { city, zip } } = user;
console.log(city, zip); // Beijing 100000

// Rest in object destructuring
const { name: n, ...otherInfo } = user;
console.log(n);       // Alice
console.log(otherInfo); // { age: 25, address: {...} }

// Function parameter destructuring
function createUserCard({ name, age, role = "member" }) {
  return `${name} (${age}) - ${role}`;
}
console.log(createUserCard({ name: "Bob", age: 30 }));

// Mixed array + object destructuring
const data = { results: [10, 20, 30], total: 3 };
const { results: [firstResult, ...otherResults], total } = data;
console.log(firstResult, otherResults, total); // 10 [20, 30] 3
```

---

## 四、执行预览

```
Alice is 25 years old.
<div class="card">
    <h2>Alice</h2>
    <p>Age: 25</p>
  </div>
2 + 2 = 4
Upper: ALICE
Ternary: adult
<ul><li>apple</li>
  <li>banana</li>
  <li>cherry</li></ul>
Hello <mark>Alice</mark>, you are <mark>25</mark>!
1 2 [ 3, 4, 5 ]
3
10
2 1
1 5
Alice 25
user
Beijing 100000
Alice
{ age: 25, address: { city: 'Beijing', zip: '100000' } }
Bob (30) - member
10 [ 20, 30 ] 3
```

---

## 五、注意事项

| 特性 | 说明 | 注意 |
|------|------|------|
| 标签模板 | `fn\`str\`` | strings参数始终是数组 |
| 嵌套解构 | 多层对象/数组 | 可读性vs便利性 |
| 默认值 | 仅当值为`undefined`时生效 | `null`不触发默认值 |
| 重命名 | `{ prop: alias }` | 注意顺序：先属性名后变量名 |
| 剩余模式 | 必须是最后一个 | `...rest`后面不能有其他 |

---

## 六、避坑指南

### ❌ 解构null/undefined
```javascript
const { name } = null; // TypeError: cannot destructure
```
### ✅ 提供默认值
```javascript
const { name } = null || {}; // name = undefined
const { name = "unknown" } = null || {}; // "unknown"
```

### ❌ 对象解构赋值没有括号
```javascript
let a, b;
{ a, b } = { a: 1, b: 2 }; // SyntaxError: block statement
```
### ✅ 加括号
```javascript
let a, b;
({ a, b } = { a: 1, b: 2 }); // OK
```

---

## 七、练习题

### 🟢 基础
1. 用解构从`const arr = [1, 2, [3, 4], 5]`中提取3和5。

### 🟡 进阶
2. 实现一个标签模板函数`sql`，自动转义SQL注入：
```javascript
const table = "users";
const input = "'; DROP TABLE users; --";
console.log(sql`SELECT * FROM ${table} WHERE name = '${input}'`);
```

### 🔴 挑战
3. 实现深度解构工具函数`deepDestruct(obj, pattern)`，支持模式匹配提取嵌套值。

---

## 八、知识点总结

```
模板字符串与解构
├── 模板字符串
│   ├── 基础插值 ${expr}
│   ├── 多行字符串
│   ├── 嵌套模板
│   └── 标签模板
├── 数组解构
│   ├── 位置匹配
│   ├── 跳过元素
│   ├── 默认值
│   └── 剩余模式 ...rest
└── 对象解构
    ├── 属性名匹配
    ├── 重命名 { prop: alias }
    ├── 默认值
    ├── 嵌套解构
    └── 剩余模式 ...rest
```

---

## 九、举一反三

| 场景 | 用法 | 好处 |
|------|------|------|
| 函数参数 | `{ a, b, c = 1 }` | 自文档、可选、有序无关 |
| 模块导入 | `import { useState, useEffect }` | 按需引入 |
| React Props | `{ title, children }` | 解构props |
| API响应 | `{ data: { users } }` | 直接提取嵌套数据 |
| 交换变量 | `[a, b] = [b, a]` | 无需临时变量 |
| 配置合并 | `{ ...defaults, ...userConfig }` | 覆盖默认值 |

---

## 十、参考资料

- [MDN: 模板字符串](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Template_literals)
- [MDN: 解构赋值](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)

---

## 十一、代码演进

### v1: 字符串拼接
```javascript
var greeting = "Hello, " + name + "! You are " + age + " years old.";
var city = user.address && user.address.city ? user.address.city : "unknown";
```

### v2: 模板字符串 + 解构
```javascript
const { address: { city = "unknown" } = {} } = user;
const greeting = `Hello, ${name}! You are ${age} years old.`;
```

### v3: 标签模板 + 深解构
```javascript
const html = sanitize`<p>${rawInput}</p>`;
const { data: { results: [first, ...rest], total } } = response;
```

---

## 十二、总结

| 核心要点 | 说明 |
|----------|------|
| **模板字符串** | 多行+插值，替代字符串拼接 |
| **标签模板** | 自定义字符串处理（i18n、SQL转义等） |
| **数组解构** | 按位置匹配，适合有序数据 |
| **对象解构** | 按属性名匹配，适合配置和参数 |
| **默认值** | 仅`undefined`触发，`null`不触发 |
