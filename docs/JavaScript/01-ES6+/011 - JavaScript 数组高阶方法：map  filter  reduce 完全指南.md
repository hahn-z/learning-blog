---
title: "011 - JavaScript 数组高阶方法：map / filter / reduce 完全指南"
slug: "011-js-array-methods"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:32:09.482+08:00"
updated_at: "2026-04-29T10:02:46.125+08:00"
reading_time: 28
tags: []
---

## 难度标注

> 🟡 **中等难度** — 需要理解回调函数、函数式编程思想

## 概念讲解

### 什么是高阶方法？

高阶方法是指**接收函数作为参数**的方法。JavaScript 数组提供了三个核心高阶方法：

- **`map()`** — 映射：把数组中每个元素"变换"成新值，返回新数组
- **`filter()`** — 过滤：根据条件筛选元素，返回满足条件的新数组
- **`reduce()`** — 归约：把数组"压缩"成一个值（可以是数字、对象、数组等）

三者的共同特点：
1. **不修改原数组**（纯函数思想）
2. **返回新结果**
3. **接收回调函数作为参数**

### 为什么不用 for 循环？

```javascript
// for loop: 命令式 — 告诉计算机"怎么做"
const doubled = [];
for (let i = 0; i < arr.length; i++) {
  doubled.push(arr[i] * 2);
}

// map: 声明式 — 告诉计算机"做什么"
const doubled = arr.map(x => x * 2);
```

高阶方法的优势：**代码更短、意图更清晰、更易组合**。

## 脑图

```
                数组高阶方法
                    │
        ┌───────────┼───────────┐
        │           │           │
      map()      filter()    reduce()
        │           │           │
   ┌────┴────┐  ┌──┴──┐   ┌────┴────┐
   │ 变换元素 │  │筛选  │   │ 累积计算 │
   │ 一对一   │  │子集  │   │ 多对一   │
   │ 返回数组 │  │数组  │   │ 返回单值 │
   └─────────┘  └─────┘   └─────────┘
        │           │           │
   回调参数:     回调参数:     回调参数:
   (item,       (item,       (acc, item,
    idx, arr)    idx, arr)    idx, arr)
```

## 完整 JS 代码

### map() — 映射变换

```javascript
// ============ map(): Transform each element ============

const numbers = [1, 2, 3, 4, 5];

// Double each number
const doubled = numbers.map(n => n * 2);
console.log(doubled); // [2, 4, 6, 8, 10]

// Extract a property from objects
const users = [
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30 },
  { name: 'Charlie', age: 35 }
];
const names = users.map(user => user.name);
console.log(names); // ['Alice', 'Bob', 'Charlie']

// Using index parameter
const indexed = ['a', 'b', 'c'].map((item, idx) => `${idx}: ${item}`);
console.log(indexed); // ['0: a', '1: b', '2: c']

// Convert data format
const celsius = [0, 10, 20, 30];
const fahrenheit = celsius.map(c => ({
  celsius: c,
  fahrenheit: c * 9 / 5 + 32
}));
console.log(fahrenheit);
// [{celsius:0, fahrenheit:32}, {celsius:10, fahrenheit:50}, ...]
```

### filter() — 条件过滤

```javascript
// ============ filter(): Keep elements that pass a test ============

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Filter even numbers
const evens = numbers.filter(n => n % 2 === 0);
console.log(evens); // [2, 4, 6, 8, 10]

// Filter objects by property
const products = [
  { name: 'Laptop', price: 999, inStock: true },
  { name: 'Phone', price: 699, inStock: false },
  { name: 'Tablet', price: 499, inStock: true },
  { name: 'Watch', price: 299, inStock: true }
];

const available = products
  .filter(p => p.inStock)
  .filter(p => p.price < 500);
console.log(available); // [{name:'Tablet',...}, {name:'Watch',...}]

// Remove falsy values
const mixed = [0, 1, '', 'hello', null, undefined, false, true];
const truthy = mixed.filter(Boolean);
console.log(truthy); // [1, 'hello', true]
```

### reduce() — 归约累积

```javascript
// ============ reduce(): Accumulate into a single value ============

const numbers = [1, 2, 3, 4, 5];

// Sum all numbers
const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log(sum); // 15

// Find max value
const max = numbers.reduce((a, b) => a > b ? a : b);
console.log(max); // 5

// Count occurrences
const fruits = ['apple', 'banana', 'apple', 'cherry', 'banana', 'apple'];
const count = fruits.reduce((acc, fruit) => {
  acc[fruit] = (acc[fruit] || 0) + 1;
  return acc;
}, {});
console.log(count); // {apple: 3, banana: 2, cherry: 1}

// Group by property
const people = [
  { name: 'Alice', dept: 'Engineering' },
  { name: 'Bob', dept: 'Marketing' },
  { name: 'Charlie', dept: 'Engineering' }
];
const grouped = people.reduce((acc, person) => {
  const key = person.dept;
  if (!acc[key]) acc[key] = [];
  acc[key].push(person);
  return acc;
}, {});
console.log(grouped);
// {Engineering: [{...}, {...}], Marketing: [{...}]}

// Flatten nested arrays
const nested = [[1, 2], [3, 4], [5, 6]];
const flat = nested.reduce((acc, arr) => acc.concat(arr), []);
console.log(flat); // [1, 2, 3, 4, 5, 6]

// Pipe: chain transformations with reduce
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);
const process = pipe(
  x => x + 1,
  x => x * 2,
  x => `Result: ${x}`
);
console.log(process(3)); // 'Result: 8'
```

### 三者组合实战

```javascript
// ============ Real-world: Combined usage ============

const orders = [
  { product: 'Laptop', price: 999, quantity: 1, status: 'completed' },
  { product: 'Mouse', price: 29, quantity: 2, status: 'completed' },
  { product: 'Keyboard', price: 79, quantity: 1, status: 'pending' },
  { product: 'Monitor', price: 499, quantity: 1, status: 'completed' },
  { product: 'Cable', price: 15, quantity: 3, status: 'cancelled' }
];

// Total revenue from completed orders
const totalRevenue = orders
  .filter(order => order.status === 'completed')
  .map(order => order.price * order.quantity)
  .reduce((sum, total) => sum + total, 0);

console.log(totalRevenue); // 1556

// Summary report
const summary = orders
  .filter(o => o.status === 'completed')
  .map(o => ({ product: o.product, total: o.price * o.quantity }))
  .reduce((report, item) => {
    report.items.push(item);
    report.grandTotal += item.total;
    return report;
  }, { items: [], grandTotal: 0 });

console.log(summary);
// {items: [{product:'Laptop',total:999}, ...], grandTotal: 1556}
```

## 执行预览

```
// map
[1,2,3].map(x => x * 2)        → [2, 4, 6]
users.map(u => u.name)          → ['Alice', 'Bob']

// filter
[1,2,3,4,5].filter(n => n > 3) → [4, 5]
mixed.filter(Boolean)           → [1, 'hello', true]

// reduce
[1,2,3,4,5].reduce((a,b) => a+b, 0)       → 15
['a','b','a'].reduce((acc,s) => {...}, {}) → {a:2, b:1}

// Chained
orders → filter → map → reduce → 1556
```

## 注意事项

| 方法 | 回调参数 | 返回值 | 是否修改原数组 | 常见用途 |
|------|---------|--------|--------------|---------|
| `map()` | `(item, idx, arr)` | 新数组（长度不变） | ❌ 否 | 数据转换、格式化 |
| `filter()` | `(item, idx, arr)` | 新数组（长度可能变） | ❌ 否 | 条件筛选、去重 |
| `reduce()` | `(acc, item, idx, arr)` | 累积值（任意类型） | ❌ 否 | 求和、分组、管道 |

| 注意点 | 说明 |
|--------|------|
| **不要忘记 return** | 箭头函数单表达式自动返回，但 `{}` 块体必须手动 return |
| **初始值很重要** | `reduce()` 不传初始值时，第一个元素作为初始值，空数组会报错 |
| **链式调用性能** | 每次调用都创建新数组，超大数据集考虑用 `reduce` 一次遍历 |
| **稀疏数组** | `map/filter` 会跳过空位（`[1,,3]`），但 `forEach` 不跳过 |

## 避坑指南

### ❌ 忘记 return
```javascript
// ❌ Wrong: block body without return
const result = [1, 2, 3].map(n => {
  n * 2;
});
console.log(result); // [undefined, undefined, undefined]

// ✅ Correct: use return or remove braces
const result = [1, 2, 3].map(n => n * 2);
// or
const result = [1, 2, 3].map(n => {
  return n * 2;
});
```

### ❌ 用 map 代替 forEach
```javascript
// ❌ Wrong: map without using return value
users.map(user => console.log(user.name));

// ✅ Correct: use forEach for side effects
users.forEach(user => console.log(user.name));
```

### ❌ reduce 空数组无初始值
```javascript
// ❌ Wrong: empty array without initial value
[].reduce((a, b) => a + b); // TypeError: Reduce of empty array with no initial value

// ✅ Correct: always provide initial value
[].reduce((a, b) => a + b, 0); // 0
```

### ❌ 在 map/filter 里修改原数组
```javascript
// ❌ Wrong: mutating original array
const items = [{ val: 1 }, { val: 2 }];
items.map(item => { item.val *= 2; return item; }); // also mutates original!

// ✅ Correct: create new objects
items.map(item => ({ ...item, val: item.val * 2 }));
```

## 练习题

### 🟢 入门：数组基本操作

```javascript
// 1. Given [10, 20, 30, 40, 50], create array of values > 25
// Expected: [30, 40, 50]

// 2. Given ['hello', 'world'], create array of uppercase versions
// Expected: ['HELLO', 'WORLD']

// 3. Given [1, 2, 3, 4], calculate product (multiply all)
// Expected: 24
```

### 🟡 进阶：组合运用

```javascript
// 4. From students array, find average score of passing students (>= 60)
const students = [
  { name: 'Alice', score: 85 },
  { name: 'Bob', score: 42 },
  { name: 'Charlie', score: 73 },
  { name: 'Diana', score: 91 },
  { name: 'Eve', score: 38 }
];
// Expected: 83 (average of 85, 73, 91)

// 5. Implement array.flat() using reduce
// flatten([[1,2],[3,[4,5]]]) → [1,2,3,[4,5]] (one level)
```

### 🔴 挑战：高级应用

```javascript
// 6. Implement pipe() that composes functions left-to-right
// pipe(x => x+1, x => x*2, x => x**2)(3) → 64

// 7. Use reduce to implement custom map and filter
const myMap = (arr, fn) => arr.reduce((acc, item, i) => { /* ... */ }, []);
const myFilter = (arr, fn) => arr.reduce((acc, item, i) => { /* ... */ }, []);
```

<details>
<summary>📋 参考答案</summary>

```javascript
// 1
const result = [10, 20, 30, 40, 50].filter(n => n > 25);

// 2
const upper = ['hello', 'world'].map(s => s.toUpperCase());

// 3
const product = [1, 2, 3, 4].reduce((a, b) => a * b, 1);

// 4
const avg = students
  .filter(s => s.score >= 60)
  .map(s => s.score)
  .reduce((sum, score, _, arr) => sum + score / arr.length, 0);

// 5
const flatten = arr => arr.reduce((a, b) => a.concat(b), []);

// 6
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

// 7
const myMap = (arr, fn) => arr.reduce((acc, item, i) => {
  acc.push(fn(item, i));
  return acc;
}, []);
const myFilter = (arr, fn) => arr.reduce((acc, item, i) => {
  if (fn(item, i)) acc.push(item);
  return acc;
}, []);
```
</details>

## 知识点总结

```
数组高阶方法
├── map()
│   ├── 一对一映射
│   ├── 返回等长新数组
│   └── 常用：数据转换、提取属性
├── filter()
│   ├── 条件筛选
│   ├── 返回子集新数组
│   └── 常用：条件过滤、Boolean去假值
├── reduce()
│   ├── 多对一归约
│   ├── 返回任意类型
│   ├── 必须提供初始值
│   └── 高级：分组、管道、实现其他方法
├── 链式调用
│   ├── filter → map → reduce 模式
│   └── 注意每步创建新数组的性能开销
└── 对比 for 循环
    ├── 优势：声明式、可组合、不修改原数组
    └── 劣势：无法 break/continue
```

## 举一反三

| 场景 | 方法组合 | 代码示例 |
|------|---------|---------|
| 统计合格人数 | filter → length | `scores.filter(s => s >= 60).length` |
| 提取 ID 列表 | map | `users.map(u => u.id)` |
| 求购物车总价 | map → reduce | `cart.map(i => i.price * i.qty).reduce(sum)` |
| 去重 | filter + indexOf | `arr.filter((v, i) => arr.indexOf(v) === i)` |
| 数组转对象 | reduce | `arr.reduce((a, v) => (a[v.id] = v, a), {})` |
| 管道组合 | reduce | `fns.reduce((v, f) => f(v), input)` |
| 按条件分组 | reduce | `reduce((a, v) => (a[v.key] ??= [], a[v.key].push(v), a), {})` |

## 参考资料

- [MDN: Array.prototype.map()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
- [MDN: Array.prototype.filter()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)
- [MDN: Array.prototype.reduce()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce)
- [JavaScript 函数式编程指南](https://github.com/MostlyAdequate/mostly-adequate-guide)

## 代码演进

### v1 — 命令式 for 循环
```javascript
// Imperative: manual loop, mutable state
const result = [];
for (let i = 0; i < orders.length; i++) {
  if (orders[i].status === 'completed') {
    result.push(orders[i].price * orders[i].quantity);
  }
}
let total = 0;
for (let i = 0; i < result.length; i++) {
  total += result[i];
}
```

### v2 — 高阶方法链式调用
```javascript
// Declarative: method chain
const total = orders
  .filter(o => o.status === 'completed')
  .map(o => o.price * o.quantity)
  .reduce((sum, val) => sum + val, 0);
```

### v3 — 抽象管道 + 可复用函数
```javascript
// Functional: reusable pipeline
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

const completed = o => o.status === 'completed';
const lineTotal = o => o.price * o.quantity;
const sum = (a, b) => a + b;

const calcRevenue = pipe(
  arr => arr.filter(completed),
  arr => arr.map(lineTotal),
  arr => arr.reduce(sum, 0)
);

const total = calcRevenue(orders);
```
