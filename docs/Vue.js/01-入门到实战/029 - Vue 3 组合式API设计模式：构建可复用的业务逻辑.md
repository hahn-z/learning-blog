---
title: "029 - Vue 3 组合式API设计模式：构建可复用的业务逻辑"
slug: "029-composition-patterns"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:53:43.412+08:00"
updated_at: "2026-04-29T10:02:46.746+08:00"
reading_time: 9
tags: ["Vue.js", "Vue 3"]
---

## 难度标注

> **难度：⭐⭐⭐⭐（中高级）**
> 前置知识：Composition API精通、TypeScript基础、响应式原理
> 适合人群：想设计高质量组合函数、构建企业级Vue应用的架构师和高级开发者

---

## 概念讲解

### 什么是Composable（组合函数）？

Composable是一个以 `use` 开头的函数，封装了可复用的**有状态逻辑**。

### 设计原则

1. **单一职责** — 一个组合函数只做一件事
2. **输入输出清晰** — 参数和返回值类型明确
3. **副作用自理** — 自己注册的钩子和监听器自己清理
4. **无副作用的返回值** — 返回的响应式数据可以被解构而不丢失响应性

---

## 脑图

```
Composable 设计模式
├── 基础模式
│   ├── 状态封装 (useState)
│   └── 方法定义
├── 异步模式
│   ├── useFetch (请求+状态)
│   └── 竞态处理 (AbortController)
├── 生命周期模式
│   ├── 自动注册+清理
│   └── 共享实例 (单例)
└── 高级模式
    ├── 泛型Composable
    └── Composable组合
```

---

## 完整代码示例

```javascript
// composables/useCounter.js
import { ref, computed } from 'vue'

export function useCounter(initialValue = 0, { min, max } = {}) {
  const count = ref(initialValue)

  const isMin = computed(() => min !== undefined && count.value <= min)
  const isMax = computed(() => max !== undefined && count.value >= max)

  function increment() {
    if (!isMax.value) count.value++
  }
  function decrement() {
    if (!isMin.value) count.value--
  }
  function reset() {
    count.value = initialValue
  }

  return { count, isMin, isMax, increment, decrement, reset }
}

// composables/useFetch.js
import { ref, shallowRef, toValue, onScopeDispose } from 'vue'

export function useFetch(url, options = {}) {
  const data = shallowRef(null)
  const error = ref(null)
  const loading = ref(false)

  let controller = null

  async function execute() {
    if (controller) controller.abort()
    controller = new AbortController()

    error.value = null
    loading.value = true

    try {
      const response = await fetch(toValue(url), {
        ...options,
        signal: controller.signal
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      data.value = await response.json()
    } catch (err) {
      if (err.name !== 'AbortError') {
        error.value = err.message
      }
    } finally {
      loading.value = false
    }
  }

  execute()
  onScopeDispose(() => {
    if (controller) controller.abort()
  })

  return { data, error, loading, refresh: execute }
}
```

---

## 执行预览

```
使用组合函数简化组件逻辑
```

---

## 注意事项

| 原则 | 说明 | 违反后果 |
|------|------|---------|
| 输入用ref/getter | 支持 `ref`、`computed`、`getter函数`、`原始值` | 限制灵活性 |
| 返回值用ref | 返回 `ref` 而非 `reactive`，支持解构 | 解构丢失响应性 |

---

## 避坑指南

### ❌ 返回reactive对象
```javascript
// ❌ 解构后丢失响应性
export function useBad() {
  const state = reactive({ count: 0 })
  return state
}
```

---

## 练习题

### 🟢 初级
1. **选择题**：组合函数的命名约定是？
   - A. `get` 前缀
   - B. `create` 前缀
   - C. `use` 前缀

   <details><summary>答案</summary>C</details>

---

## 知识点总结

```
Composable 设计知识树
├── 设计原则
│   ├── use前缀命名
│   ├── 输入：ref/getter/value
│   ├── 输出：ref/readonly
│   └── 副作用自清理
├── 常见模式
│   ├── 状态封装 (useCounter)
│   ├── 异步操作 (useFetch)
│   └── 工厂 (createStore)
└── 反模式
    └── 返回reactive
```

---

## 举一反三

| 场景 | Composable | 核心机制 |
|------|-----------|---------|
| 表单管理 | `useForm` | reactive + validate |
| 分页 | `usePagination` | computed + ref |

---

## 参考资料

- [Vue 3 官方文档 - 组合式函数](https://cn.vuejs.org/guide/reusability/composables.html)
- [VueUse - Vue组合函数集合](https://vueuse.org/)

---

## 代码演进

### v1：简单组合函数
```javascript
export function useCounter() {
  const count = ref(0)
  const increment = () => count.value++
  return { count, increment }
}
```

### v2：带配置和类型
```typescript
export function useCounter(initial = 0, options: { min?: number; max?: number } = {}) {
  const count = ref(initial)
  const increment = () => { if (!options.max || count.value < options.max) count.value++ }
  return { count, increment }
}
```
