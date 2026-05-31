---
title: "018 - Set与Map数据结构"
slug: "018-js-set-map"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T14:15:10.905+08:00"
updated_at: "2026-04-29T10:02:46.21+08:00"
reading_time: 13
tags: []
---

# Set与Map数据结构

> **难度：** ⭐⭐ 中等偏易 | **分类：** JavaScript 核心 | **阅读时间：** ~12分钟

## 一、概念讲解

ES6 引入了 `Set` 和 `Map` 两种新的集合类型，解决了传统对象和数组的痛点：

- **Set**：值唯一的集合，自动去重，适合成员检测
- **Map**：键值对集合，键可以是任意类型（不限于字符串），适合高频增删查
- **WeakSet / WeakMap**：弱引用版本，键必须是对象，适合内存敏感场景

## 二、脑图（ASCII）

```
            Set 与 Map
         ┌─────┴─────┐
       Set           Map
     ┌─┴─┐        ┌─┴──┐
   Set  WeakSet  Map  WeakMap
    │      │      │      │
  去重  弱引用  任意键  弱引用键
  has   对象值  get/set  私有数据
  交并差  GC友好  size   GC友好
```

## 三、完整 JS 代码

```javascript
// ==================== Set: Unique Collection ====================

// Remove duplicates from array
const nums = [1, 2, 2, 3, 3, 3];
const unique = [...new Set(nums)];
console.log(unique); // [1, 2, 3]

// Set operations
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

// Union
const union = new Set([...a, ...b]);
console.log(union); // Set {1, 2, 3, 4}

// Intersection
const intersect = new Set([...a].filter(x => b.has(x)));
console.log(intersect); // Set {2, 3}

// Difference
const diff = new Set([...a].filter(x => !b.has(x)));
console.log(diff); // Set {1}

// ==================== Map: Key-Value with Any Key ====================

// Object keys are strings; Map keys can be anything
const m = new Map();
const objKey = { id: 1 };
const funcKey = () => 'hello';

m.set(objKey, 'value for object');
m.set(funcKey, 'value for function');
m.set(42, 'number key'); // Map distinguishes 42 vs '42'

console.log(m.get(objKey));  // 'value for object'
console.log(m.get(42));      // 'number key'
console.log(m.size);         // 3

// Iterate — preserves insertion order
for (const [key, val] of m) {
  console.log(`${typeof key}: ${val}`);
}

// Convert Map to Object and vice versa
const obj = Object.fromEntries(m);
const map2 = new Map(Object.entries({ a: 1, b: 2 }));

// ==================== WeakMap: Private Data ====================

const privateData = new WeakMap();

class User {
  constructor(name, secret) {
    this.name = name;
    privateData.set(this, { secret });
  }

  getSecret() {
    return privateData.get(this)?.secret;
  }
}

const u = new User('Alice', 'password123');
console.log(u.getSecret()); // 'password123'
// When u is garbage collected, privateData entry is auto-cleaned

// ==================== WeakSet: Track Objects ====================

const activeElements = new WeakSet();

function activate(el) {
  activeElements.add(el);
  el.classList.add('active');
}

function isActive(el) {
  return activeElements.has(el);
}
```

## 四、执行预览

```
[ 1, 2, 3 ]
Set { 1, 2, 3, 4 }
Set { 2, 3 }
Set { 1 }
value for object
number key
3
object: value for object
function: value for function
number: number key
password123
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| Set 判断相等用 `===` | `NaN` 是特例：`Set` 认为 `NaN === NaN` |
| Map 键有序 | 按插入顺序迭代 |
| `delete` 返回 boolean | `map.delete(key)` 和 `set.delete(val)` 返回是否删除成功 |
| WeakMap/WeakSet 不可迭代 | 没有 `size`、`keys()`、`forEach` 等方法 |
| WeakMap 键必须是对象 | `weakMap.set(1, 'x')` 会 TypeError |

## 六、避坑指南

❌ **用对象模拟 Map：**
```javascript
const cache = {};
cache['__proto__']; // ❌ Prototype pollution risk!
```

✅ **使用 Map：**
```javascript
const cache = new Map();
cache.set('__proto__', 'safe'); // ✅ No prototype issues
```

❌ **遍历时修改 Set/Map：**
```javascript
for (const item of mySet) {
  mySet.delete(item); // ❌ Unpredictable behavior
}
```

✅ **先收集再操作：**
```javascript
const toDelete = [...mySet].filter(x => x > 10);
toDelete.forEach(x => mySet.delete(x)); // ✅
```

## 七、练习题

🟢 **初级：** 用 Set 实现数组去重，保留插入顺序。

🟡 **中级：** 实现 `LRUCache` 类，用 Map 的有序性实现最近最少使用缓存（`get`/`put`，容量限制）。

🔴 **高级：** 用 WeakMap 实现深拷贝中的循环引用检测，处理对象互相引用的情况。

## 八、知识点总结（树状）

```
Set 与 Map
├── Set
│   ├── new Set(iterable)
│   ├── add / has / delete / clear
│   ├── size
│   ├── keys() == values()
│   └── 集合运算 (并/交/差/对称差)
├── Map
│   ├── new Map(entries)
│   ├── set / get / has / delete / clear
│   ├── size / forEach / entries()
│   └── Object.fromEntries / Object.entries
├── WeakSet
│   ├── add / has / delete
│   └── 不可迭代、无 size
└── WeakMap
    ├── set / get / has / delete
    ├── 不可迭代、无 size
    └── 用途: 私有数据、缓存、关联元数据
```

## 九、举一反三

| 场景 | 推荐结构 | 原因 |
|------|----------|------|
| 数组去重 | Set | 自动去重，一行搞定 |
| 字典/缓存 | Map | 任意类型键，有序，性能优 |
| 对象私有数据 | WeakMap | 不阻止 GC，实例销毁即清理 |
| 标记活跃对象 | WeakSet | 轻量标记，不影响对象生命周期 |
| 频率计数 | Map | 灵活键类型，遍历方便 |
| 配对数据 | Map | 比对象更安全的键值存储 |

## 十、参考资料

- [MDN - Set](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Set)
- [MDN - Map](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Map)
- [MDN - WeakMap](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)

## 十一、代码演进

```javascript
// v1: Object as map (limited)
const cache = {};
cache['key'] = 'value';
// Problem: keys are coerced to strings, __proto__ risk

// v2: Map — any key, safe, ordered
const cache = new Map();
cache.set({}, 'value');
cache.set(42, 'number key');

// v3: Map + factory pattern for type-safe access
class TypedMap {
  #map = new Map();
  #keyType;
  #valType;

  constructor(keyType, valType, entries = []) {
    this.#keyType = keyType;
    this.#valType = valType;
    for (const [k, v] of entries) this.set(k, v);
  }

  set(key, val) {
    if (typeof key !== this.#keyType) throw new TypeError(`Key must be ${this.#keyType}`);
    if (typeof val !== this.#valType) throw new TypeError(`Value must be ${this.#valType}`);
    this.#map.set(key, val);
    return this;
  }

  get(key) { return this.#map.get(key); }
  get size() { return this.#map.size; }
}
```
