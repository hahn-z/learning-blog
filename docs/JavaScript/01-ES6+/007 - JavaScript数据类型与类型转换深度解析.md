---
title: "007 - JavaScript数据类型与类型转换深度解析"
slug: "007-js-types"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:27:10.063+08:00"
updated_at: "2026-04-29T10:02:46.087+08:00"
reading_time: 17
tags: []
---


# JavaScript数据类型与类型转换深度解析

> **难度标注：** 🟡 中级 | **前置知识：** 基本JS语法
> **阅读时间：** 约18分钟 | **代码量：** 约150行

---

## 一、概念讲解

JavaScript有**8种数据类型**：7种原始类型（`undefined`、`null`、`boolean`、`number`、`bigint`、`string`、`symbol`）+ 1种引用类型（`object`）。

### 1.1 原始类型 vs 引用类型

**原始类型**存储在栈上，比较的是值；**引用类型**存储在堆上，比较的是引用地址。

### 1.2 类型转换三剑客

- **显式转换：** `Number()`、`String()`、`Boolean()`
- **隐式转换：** `+`运算符、`==`松散比较
- **对象转原始：** `valueOf()` → `toString()` → `Symbol.toPrimitive`

---

## 二、脑图

```
                      JS数据类型
                     /           \
                原始类型(7)      引用类型(1)
               /  |  |  \  \  \    \
          undef null bool num bigint str sym  Object
                                       /    |    \
                                    Array  Function  Map/Set
```

---

## 三、完整代码示例

```javascript
// ============================================
// 1. typeof operator
// ============================================
console.log(typeof undefined);  // "undefined"
console.log(typeof null);       // "object" (historic bug!)
console.log(typeof 42);         // "number"
console.log(typeof "hello");    // "string"
console.log(typeof true);       // "boolean"
console.log(typeof 10n);        // "bigint"
console.log(typeof Symbol());   // "symbol"
console.log(typeof {});         // "object"
console.log(typeof function(){}); // "function"

// ============================================
// 2. Explicit conversion
// ============================================
// To Number
console.log(Number("42"));      // 42
console.log(Number(""));        // 0
console.log(Number("hello"));   // NaN
console.log(Number(true));      // 1
console.log(Number(null));      // 0
console.log(Number(undefined)); // NaN
console.log(parseInt("42px"));  // 42
console.log(parseFloat("3.14"));// 3.14

// To String
console.log(String(42));        // "42"
console.log(String(true));      // "true"
console.log(String(null));      // "null"
console.log(String(undefined)); // "undefined"
console.log(String([1,2,3]));   // "1,2,3"

// To Boolean (falsy values)
console.log(Boolean(0));        // false
console.log(Boolean(""));       // false
console.log(Boolean(null));     // false
console.log(Boolean(undefined));// false
console.log(Boolean(NaN));      // false
console.log(Boolean("0"));      // true (non-empty string!)
console.log(Boolean([]));       // true (empty array is truthy!)

// ============================================
// 3. Implicit conversion pitfalls
// ============================================
console.log(1 + "2");           // "12" (string concat)
console.log("3" - 1);          // 2 (numeric subtraction)
console.log(true + true);      // 2 (boolean to number)
console.log([] + []);           // "" (both convert to "")
console.log([] + {});           // "[object Object]"
console.log({} + []);           // 0 or "[object Object]" (depends on context)
console.log("1" == 1);         // true (loose equality)
console.log(null == undefined); // true
console.log(null === undefined);// false

// ============================================
// 4. BigInt
// ============================================
const big = 9007199254740993n; // beyond Number.MAX_SAFE_INTEGER
console.log(big);               // 9007199254740993n
console.log(9007199254740993n === 9007199254740993n); // true
// console.log(big + 1);        // TypeError: can't mix BigInt and Number

// ============================================
// 5. Symbol — unique identifiers
// ============================================
const s1 = Symbol("id");
const s2 = Symbol("id");
console.log(s1 === s2);         // false (always unique)
const obj = {};
obj[s1] = "secret";
console.log(obj[s1]);           // "secret"
console.log(Object.keys(obj));  // [] (symbols are non-enumerable)
```

---

## 四、执行预览

```
undefined
object
number
string
boolean
bigint
symbol
object
function
42
0
NaN
1
0
NaN
42
3.14
42
true
null
undefined
1,2,3
false
false
false
false
false
true
true
12
2
2

[object Object]
0
true
true
false
9007199254740993n
true
false
secret
[]
```

---

## 五、注意事项

| 转换规则 | 结果 | 注意 |
|----------|------|------|
| `Number("")` | `0` | 空字符串转0 |
| `Number("  ")` | `0` | 纯空格也是0 |
| `Number(null)` | `0` | null转0 |
| `Number(undefined)` | `NaN` | undefined转NaN |
| `Boolean([])` | `true` | 空数组是truthy！ |
| `Boolean("0")` | `true` | 非空字符串都是truthy |
| `typeof null` | `"object"` | 历史遗留bug |

---

## 六、避坑指南

### ❌ 用 == 比较不同类型
```javascript
[] == false    // true
"" == false    // true
null == 0      // false (surprise!)
```
### ✅ 始终用 === 严格比较
```javascript
[] === false   // false
"" === false   // false
null === 0     // false
```

### ❌ 用 + 做加法却触发字符串拼接
```javascript
function add(a, b) { return a + b; }
add(1, "2") // "12" not 3
```
### ✅ 显式转换参数
```javascript
function add(a, b) { return Number(a) + Number(b); }
add(1, "2") // 3
```

---

## 七、练习题

### 🟢 基础
1. 写出以下表达式的值和类型：
```javascript
typeof typeof 42
typeof (1 + "2")
Boolean("false")  // 注意！
```

### 🟡 进阶
2. 实现一个`typeOf(value)`函数，正确区分所有8种类型（包括`null`返回`"null"`）。

### 🔴 挑战
3. 解释并预测以下输出：
```javascript
console.log(+[]);
console.log(+[""]);
console.log(+["1"]);
console.log(+["1","2"]);
console.log(+{});
console.log([] == ![]);
```

---

## 八、知识点总结

```
数据类型体系
├── 原始类型（栈存储，值比较）
│   ├── undefined（未定义）
│   ├── null（空值，typeof为object的bug）
│   ├── boolean（true/false）
│   ├── number（64位浮点，IEEE 754）
│   ├── bigint（任意精度整数，ES2020）
│   ├── string（UTF-16，不可变）
│   └── symbol（唯一标识符，ES6）
├── 引用类型（堆存储，引用比较）
│   └── Object（Array/Function/Map/Set/Date...）
└── 类型转换
    ├── 显式：Number()/String()/Boolean()
    ├── 隐式：+/== 等运算符触发
    └── 对象转原始：valueOf → toString → toPrimitive
```

---

## 九、举一反三

| 场景 | 推荐方法 | 原因 |
|------|----------|------|
| 字符串转整数 | `parseInt(str, 10)` | 指定进制，安全 |
| 任意值转布尔 | `Boolean(val)` 或 `!!val` | 显式优于隐式 |
| 检查NaN | `Number.isNaN(val)` | 全局`isNaN()`会先转换 |
| 安全整数运算 | `BigInt` | 超过MAX_SAFE_INTEGER时必须 |
| 对象深比较 | 自定义或lodash | `===`只比较引用 |
| 类型守卫 | `typeof` + `===` | 函数用typeof，null用`=== null` |

---

## 十、参考资料

- [MDN: JavaScript数据类型和数据结构](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Data_structures)
- [MDN: 类型转换](https://developer.mozilla.org/en-US/docs/Glossary/Type_coercion)
- [ECMAScript规范: ToPrimitive](https://tc39.es/ecma262/#sec-toprimitive)

---

## 十一、代码演进

### v1: 隐式转换（易出bug）
```javascript
function multiply(a, b) {
  return a * b; // "2" * "3" => 6, but what about "2" * "abc"?
}
```

### v2: 显式转换
```javascript
function multiply(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new TypeError("Arguments must be numbers");
  }
  return x * y;
}
```

### v3: TypeScript（编译时检查）
```typescript
function multiply(a: number, b: number): number {
  return a * b; // TypeScript prevents non-number input
}
```

---

## 十二、总结

| 核心要点 | 说明 |
|----------|------|
| **8种类型** | 7原始 + 1引用（object） |
| **typeof null** | 返回"object"，是历史bug |
| **=== 优先** | 永远用严格相等 |
| **显式转换** | 比隐式更安全可读 |
| **falsy值** | 只有6个：`0 "" null undefined NaN false` |
