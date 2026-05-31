---
title: "019 - Proxy与Reflect代理"
slug: "019-js-proxy"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T14:15:10.916+08:00"
updated_at: "2026-04-29T10:02:46.224+08:00"
reading_time: 16
tags: []
---

# Proxy与Reflect代理

> **难度：** ⭐⭐⭐⭐ 较难 | **分类：** JavaScript 高级 | **阅读时间：** ~18分钟

## 一、概念讲解

`Proxy` 是 ES6 提供的元编程 API，可以拦截并自定义对象的基本操作（属性读取、赋值、删除、枚举等）。`Reflect` 是配套的静态对象，提供了与 Proxy handlers 一一对应的默认行为方法。

核心思想：
- **Proxy** = 拦截层（代理），包裹目标对象，拦截所有操作
- **Reflect** = 默认行为（反射），将操作转发给原始对象
- **13 种拦截器（traps）**：`get`、`set`、`has`、`deleteProperty`、`ownKeys` 等
- **可撤销代理**：`Proxy.revocable()` 创建可随时销毁的代理

## 二、脑图（ASCII）

```
            Proxy 与 Reflect
          ┌────────┴────────┐
       Proxy             Reflect
     ┌──┴──┐           ┌──┴──┐
   Traps  Revocable   Default  Metadata
   get/set  revoke()  Behavior  Query
   has/delete          get/set
   apply/construct     ownKeys
   13 traps total
```

## 三、完整 JS 代码

```javascript
// ==================== Reactive Object (Vue-style) ====================

function reactive(target, onChange) {
  return new Proxy(target, {
    // Intercept property read
    get(obj, key, receiver) {
      // Use Reflect for default behavior
      const result = Reflect.get(obj, key, receiver);
      // Deep reactive for nested objects
      if (typeof result === 'object' && result !== null) {
        return reactive(result, onChange);
      }
      return result;
    },

    // Intercept property write
    set(obj, key, value, receiver) {
      const oldVal = Reflect.get(obj, key, receiver);
      const changed = Reflect.set(obj, key, value, receiver);
      if (changed && oldVal !== value) {
        onChange(key, oldVal, value);
      }
      return changed;
    },

    // Intercept 'in' operator
    has(obj, key) {
      console.log(`Checking "${key}" in object`);
      return Reflect.has(obj, key);
    },

    // Intercept delete
    deleteProperty(obj, key) {
      const had = Reflect.has(obj, key);
      const deleted = Reflect.deleteProperty(obj, key);
      if (had && deleted) {
        onChange(key, 'deleted', undefined);
      }
      return deleted;
    }
  });
}

// Usage: reactive state
const state = reactive({ name: 'Alice', age: 25, address: { city: 'Beijing' } },
  (key, oldVal, newVal) => {
    console.log(`[Change] ${key}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`);
  }
);

state.name = 'Bob';             // [Change] name: "Alice" → "Bob"
state.address.city = 'Shanghai'; // [Change] city: "Beijing" → "Shanghai"
delete state.age;               // [Change] age: "deleted" → undefined

// ==================== Validation Proxy ====================

function validate(schema) {
  return (target) => new Proxy(target, {
    set(obj, key, value) {
      if (key in schema) {
        const rules = schema[key];
        if (rules.type && typeof value !== rules.type) {
          throw new TypeError(`${key} must be ${rules.type}, got ${typeof value}`);
        }
        if (rules.min !== undefined && value < rules.min) {
          throw new RangeError(`${key} must be >= ${rules.min}`);
        }
      }
      return Reflect.set(obj, key, value);
    }
  });
}

const person = validate({
  name: { type: 'string' },
  age: { type: 'number', min: 0 }
})({ name: 'Alice', age: 25 });

person.age = 30;    // ✅ OK
// person.age = -1;  // ❌ RangeError
// person.name = 42; // ❌ TypeError

// ==================== Revocable Proxy ====================

const sensitive = { password: 'secret123' };
const { proxy, revoke } = Proxy.revocable(sensitive, {
  get(obj, key) {
    if (key === 'password') return '***';
    return Reflect.get(obj, key);
  }
});

console.log(proxy.password); // '***'
revoke(); // Destroy the proxy
// proxy.password; // ❌ TypeError: Cannot perform 'get' on a proxy that has been revoked
```

## 四、执行预览

```
[Change] name: "Alice" → "Bob"
[Change] city: "Beijing" → "Shanghai"
[Change] age: "deleted" → undefined
***
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| Proxy 是浅代理 | 嵌套对象需要递归代理才能深度响应 |
| 性能开销 | 每次操作多一层函数调用，高频场景需评估 |
| 不能代理原始值 | `new Proxy(42, {})` 不行，需用对象包装 |
| `this` 指向问题 | Proxy 内部的 `this` 可能不等于目标对象 |
| Reflect 不是函数 | `Reflect` 不是构造函数，不能 `new Reflect()` |

## 六、避坑指南

❌ **不用 Reflect 直接操作：**
```javascript
new Proxy(target, {
  set(obj, key, value) {
    obj[key] = value; // ❌ May miss edge cases (accessors, frozen)
    return true;
  }
});
```

✅ **使用 Reflect：**
```javascript
new Proxy(target, {
  set(obj, key, value, receiver) {
    return Reflect.set(obj, key, value, receiver); // ✅ Handles all edge cases
  }
});
```

❌ **代理后对象身份改变：**
```javascript
const p = new Proxy(obj, {});
console.log(p === obj); // ❌ false — proxy !== target
```

## 七、练习题

🟢 **初级：** 用 Proxy 实现属性访问日志，记录所有 `get` 和 `set` 操作。

🟡 **中级：** 实现只读代理，所有 `set` 和 `delete` 操作抛出错误。

🔴 **高级：** 实现一个简单的依赖收集系统（类似 Vue 3 reactive），在 `get` 时收集依赖，在 `set` 时触发更新。

## 八、知识点总结（树状）

```
Proxy 与 Reflect
├── Proxy
│   ├── new Proxy(target, handler)
│   ├── 13 Traps
│   │   ├── get / set / has
│   │   ├── deleteProperty
│   │   ├── ownKeys / getOwnPropertyDescriptor
│   │   ├── apply / construct
│   │   ├── getPrototypeOf / setPrototypeOf
│   │   ├── isExtensible / preventExtensions
│   │   └── defineProperty
│   └── Proxy.revocable()
├── Reflect
│   ├── Reflect.get / set / has
│   ├── Reflect.deleteProperty
│   ├── Reflect.apply / construct
│   └── 所有方法与 Proxy traps 一一对应
└── 应用场景
    ├── 响应式系统 (Vue 3)
    ├── 校验 / 类型检查
    ├── 访问控制 (只读/私有)
    └── API 兼容层 / Polyfill
```

## 九、举一反三

| 场景 | 实现方式 | 关键 Trap |
|------|----------|-----------|
| 响应式数据 | 深度 Proxy + 回调 | get / set |
| 只读对象 | 拦截 set/delete 抛异常 | set / deleteProperty |
| 属性默认值 | get 时返回默认值 | get |
| 私有属性 | 以 `_` 开头的属性拒绝访问 | get / set / has / ownKeys |
| 函数节流 | Proxy 包装函数 | apply |
| API 版本兼容 | 属性名映射 | get / set |

## 十、参考资料

- [MDN - Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
- [MDN - Reflect](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect)
- [Vue 3 Reactivity](https://vuejs.org/guide/extras/reactivity-in-depth.html)

## 十一、代码演进

```javascript
// v1: Simple logging proxy
const logged = new Proxy(obj, {
  get(target, key) {
    console.log(`Read: ${key}`);
    return target[key];
  }
});

// v2: With Reflect for correctness
const logged2 = new Proxy(obj, {
  get(target, key, receiver) {
    console.log(`Read: ${key}`);
    return Reflect.get(target, key, receiver);
  }
});

// v3: Deep reactive with change notification
function reactive(target, onChange) {
  return new Proxy(target, {
    get(obj, key, receiver) {
      const val = Reflect.get(obj, key, receiver);
      return (typeof val === 'object' && val !== null)
        ? reactive(val, onChange) : val;
    },
    set(obj, key, val, receiver) {
      const old = Reflect.get(obj, key, receiver);
      Reflect.set(obj, key, val, receiver) && onChange(key, old, val);
      return true;
    }
  });
}
```
