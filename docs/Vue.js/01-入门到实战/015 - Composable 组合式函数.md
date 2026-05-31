---
title: "015 - Composable 组合式函数"
slug: "015-composables"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:39:27.586+08:00"
updated_at: "2026-04-29T10:02:46.592+08:00"
reading_time: 14
tags: ["Vue.js", "Vue 3"]
---

# 053-Composable 组合式函数

> **难度标注：** 🟡 中级 | **前置知识：** Vue 3 组合式 API、ref/reactive/computed

---

## 一、概念讲解

Composable 是 Vue 3 中**提取和复用有状态逻辑**的标准方式。它本质上是一个函数，使用了 Vue 的组合式 API（ref、computed、watch 等），返回响应式状态和方法。

```javascript
export function useCounter(initialValue = 0) {
  const count = ref(initialValue)
  const doubled = computed(() => count.value * 2)
  function increment() { count.value++ }
  function decrement() { count.value-- }
  function reset() { count.value = initialValue }
  return { count, doubled, increment, decrement, reset }
}

const { count, doubled, increment } = useCounter(10)
```

---

## 二、脑图（ASCII）

```
Composables 组合式函数
├── 基础模式
│   ├── use 函数命名
│   ├── ref/reactive 管理状态
│   ├── computed 派生状态
│   ├── watch 监听变化
│   └── 返回 { state, methods }
├── 常见类型
│   ├── 状态封装（useCounter）
│   ├── 异步操作（useFetch）
│   ├── DOM 相关（useMouse）
│   ├── 事件监听（useEventListener）
│   └── 表单逻辑（useForm）
├── 最佳实践
│   ├── 接受 ref 作为参数
│   ├── 副作用清理（onUnmounted）
│   └── 返回 ref 方便解构
└── 限制
    ├── 只在 setup 中调用
    └── 不能在普通函数中调用
```

---

## 三、完整代码示例

```javascript
// composables/useFetch.js
import { ref, watchEffect, toValue } from 'vue'

export function useFetch(url) {
  const data = ref(null)
  const error = ref(null)
  const loading = ref(false)

  async function fetchData() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(toValue(url))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      data.value = await res.json()
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  watchEffect(() => { toValue(url) && fetchData() })
  return { data, error, loading, refresh: fetchData }
}
```

```javascript
// composables/useMouse.js
import { ref, onMounted, onUnmounted } from 'vue'

export function useMouse() {
  const x = ref(0)
  const y = ref(0)

  function update(event) {
    x.value = event.pageX
    y.value = event.pageY
  }

  onMounted(() => window.addEventListener('mousemove', update))
  onUnmounted(() => window.removeEventListener('mousemove', update))

  return { x, y }
}
```

```javascript
// composables/useLocalStorage.js
import { ref, watch } from 'vue'

export function useLocalStorage(key, defaultValue) {
  const stored = localStorage.getItem(key)
  const data = ref(stored ? JSON.parse(stored) : defaultValue)

  watch(data, (newVal) => {
    localStorage.setItem(key, JSON.stringify(newVal))
  }, { deep: true })

  return data
}
```

```vue
<!-- App.vue -->
<template>
  <div>
    <h2>Composable Demo</h2>
    <p>Mouse: {{ mouse.x }}, {{ mouse.y }}</p>

    <div v-if="users.loading">Loading...</div>
    <div v-else-if="users.error">Error: {{ users.error }}</div>
    <ul v-else>
      <li v-for="user in users.data" :key="user.id">{{ user.name }}</li>
    </ul>
    <button @click="users.refresh()">Refresh</button>

    <input v-model="note" placeholder="Auto-saved note" />
  </div>
</template>

<script setup>
import { useMouse } from './composables/useMouse'
import { useFetch } from './composables/useFetch'
import { useLocalStorage } from './composables/useLocalStorage'

const mouse = useMouse()
const users = useFetch('https://jsonplaceholder.typicode.com/users')
const note = useLocalStorage('my-note', '')
</script>
```

---

## 四、执行预览

```
Composable Demo

Mouse: 842, 356

• Leanne Graham
• Ervin Howell
• Clementine Bauch
[Refresh]

[Auto-saved note         ]
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 参数类型 | 接受 ref 或 getter 更灵活 | 用 `toValue()` 统一处理 |
| 副作用清理 | onUnmounted 中清理监听/定时器 | 避免内存泄漏 |
| 返回值 | 返回 ref 而非 reactive | 方便解构，保持响应性 |
| 调用位置 | 只在 setup 或 composable 中 | 不在回调中直接调用 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| 在普通函数中调用 ref/watch | 只在 setup 或 composable 中调用 |
| 返回 reactive 对象 | 返回 ref，方便解构保持响应 |
| 忘记清理副作用 | onUnmounted 中 removeEventListener |
| 直接修改传入的 ref | 只读取，修改通过返回的方法 |
| composable 中创建全局变量 | 状态在函数内部创建 |

---

## 七、练习题

### 🟢 基础
1. 创建 `useToggle` composable，管理布尔值切换。
2. 创建 `useWindowSize` composable，返回 window 的宽高。

### 🟡 进阶
3. 创建 `useDebounce` composable，包装任意函数实现防抖。
4. 创建 `useIntersectionObserver` composable，检测元素是否可见。

### 🔴 挑战
5. 创建 `useAsyncQueue` composable，管理异步任务串行队列。

---

## 八、知识点总结

```
Composable
├── 核心原则
│   ├── use 前缀命名
│   ├── 接受 ref/getter 参数
│   ├── 返回 { state, methods }
│   └── 自动清理副作用
├── 常用 API
│   ├── ref / reactive / computed
│   ├── watch / watchEffect
│   ├── onMounted / onUnmounted
│   └── toValue / toRefs
└── VueUse 库
    └── 200+ 实用 composables
```

---

## 九、举一反三

| 场景 | Composable | 核心功能 |
|------|------------|---------|
| 鼠标跟踪 | useMouse | 实时获取鼠标坐标 |
| 数据请求 | useFetch | 自动请求+缓存+重试 |
| 本地存储 | useLocalStorage | ref 双向绑定 localStorage |
| 表单验证 | useForm | 验证规则+错误信息 |
| 分页 | useOffsetPagination | 分页计算+翻页方法 |

---

## 十、参考资料

- [Vue 3 Composables 官方文档](https://vuejs.org/guide/reusability/composables.html)
- [VueUse](https://vueuse.org/)

---

## 十一、代码演进

### v1 - 简单状态封装
```javascript
export function useCounter(init = 0) {
  const count = ref(init)
  return { count, increment: () => count.value++ }
}
```

### v2 - 异步 + 生命周期
```javascript
export function useFetch(url) {
  const data = ref(null)
  const loading = ref(false)
  watchEffect(async () => {
    loading.value = true
    data.value = await fetch(toValue(url)).then(r => r.json())
    loading.value = false
  })
  return { data, loading }
}
```

### v3 - TypeScript + 完整类型
```typescript
interface UseFetchReturn<T> {
  data: Ref<T | null>
  error: Ref<string | null>
  loading: Ref<boolean>
  refresh: () => Promise<void>
}
export function useFetch<T>(url: MaybeRefOrGetter<string>): UseFetchReturn<T>
```
