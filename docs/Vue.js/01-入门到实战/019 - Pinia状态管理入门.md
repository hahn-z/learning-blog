---
title: "019 - Pinia状态管理入门"
slug: "019-pinia-intro"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:38:25.956+08:00"
updated_at: "2026-04-29T10:02:46.641+08:00"
reading_time: 21
tags: ["Vue.js", "Vue 3"]
---

# 057-Pinia状态管理入门

> 📌 **难度标注**：⭐⭐ 入门中级（需要Vue 3 Composition API基础）

## 一、概念讲解

### 什么是状态管理？

当应用变得复杂，多个组件需要**共享和同步数据**时，"父子组件传 props/emits" 和 "跨组件 provide/inject" 的方式会变得混乱。状态管理库提供了一个**全局共享的数据仓库**。

### 为什么选 Pinia？

| 特性 | Vuex | Pinia |
|------|------|-------|
| Vue 3 支持 | 需要 vuex@4 | 原生支持 |
| TypeScript | 支持但复杂 | 完美推断 |
| Composition API | 不支持 | 原生支持 |
| Mutations | 必须 | 去掉了（简化） |
| 模块化 | 嵌套模块 | 多个独立 Store |
| 体积 | ~20KB | ~1.5KB |

Pinia 已成为 Vue 官方推荐的状态管理方案。

### 核心概念

- **Store**：独立的状态仓库
- **State**：存储的数据（类似 data）
- **Getters**：计算属性（类似 computed）
- **Actions**：方法（同步和异步，类似 methods）

### 两种定义风格

```javascript
// Option Store（选项式）
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: (state) => state.count * 2 },
  actions: { increment() { this.count++ } }
})

// Setup Store（组合式）- 推荐！
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)
  function increment() { count.value++ }
  return { count, double, increment }
})
```

## 二、脑图

```
Pinia 状态管理入门
├── 核心概念
│   ├── State    -> 共享数据 (ref/reactive)
│   ├── Getters  -> 计算属性 (computed)
│   └── Actions  -> 方法 (同步/异步)
├── 定义 Store
│   ├── defineStore(id, options)  -- 选项式
│   └── defineStore(id, setup)    -- 组合式(推荐)
├── 使用 Store
│   ├── const store = useXxxStore()
│   ├── store.count  -> 读取 state
│   ├── store.count++ -> 直接修改
│   └── store.increment() -> 调用 action
├── Store 方法
│   ├── $reset()      -> 重置状态
│   ├── $patch()      -> 批量更新
│   ├── $subscribe()  -> 监听变化
│   └── $onAction()   -> 监听 action
└── 插件机制
    ├── 持久化插件
    └── 自定义插件
```

## 三、完整代码

```javascript
// stores/counter.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCounterStore = defineStore('counter', () => {
  // State
  const count = ref(0)
  const history = ref([])

  // Getters
  const doubleCount = computed(() => count.value * 2)
  const isPositive = computed(() => count.value > 0)
  const canUndo = computed(() => history.value.length > 0)

  // Actions
  function increment() {
    history.value.push(count.value)
    count.value++
  }

  function decrement() {
    history.value.push(count.value)
    count.value--
  }

  function reset() {
    history.value.push(count.value)
    count.value = 0
  }

  function undo() {
    if (history.value.length > 0) {
      count.value = history.value.pop()
    }
  }

  async function incrementAsync() {
    return new Promise(resolve => {
      setTimeout(() => {
        increment()
        resolve(count.value)
      }, 1000)
    })
  }

  return {
    count, history,
    doubleCount, isPositive, canUndo,
    increment, decrement, reset, undo, incrementAsync
  }
})
```

```javascript
// stores/user.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const token = ref('')
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => user.value?.name || '游客')

  async function login(email, password) {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 800))
      user.value = { id: 1, name: 'Hahn', email, role: 'admin' }
      token.value = 'fake-jwt-token'
    } finally {
      loading.value = false
    }
  }

  function logout() {
    user.value = null
    token.value = ''
  }

  return { user, token, loading, isLoggedIn, userName, login, logout }
})
```

```vue
<!-- components/CounterDemo.vue -->
<template>
  <div class="counter-demo">
    <h2>计数器 Store</h2>
    <div class="display">
      <p>当前值：<strong>{{ store.count }}</strong></p>
      <p>双倍值：{{ store.doubleCount }}</p>
      <p>是否为正：{{ store.isPositive ? '是' : '否' }}</p>
    </div>
    <div class="actions">
      <button @click="store.increment()">+1</button>
      <button @click="store.decrement()">-1</button>
      <button @click="store.reset()">归零</button>
      <button @click="store.undo()" :disabled="!store.canUndo">撤销</button>
      <button @click="handleAsync">异步+1</button>
    </div>
    <p v-if="asyncLoading">异步操作中...</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useCounterStore } from '../stores/counter'

const store = useCounterStore()
const asyncLoading = ref(false)

const handleAsync = async () => {
  asyncLoading.value = true
  await store.incrementAsync()
  asyncLoading.value = false
}
</script>
```

```vue
<!-- components/UserDemo.vue -->
<template>
  <div class="user-demo">
    <h2>用户 Store</h2>
    <div v-if="store.isLoggedIn">
      <p>欢迎，{{ store.userName }}！</p>
      <button @click="store.logout()">退出登录</button>
    </div>
    <div v-else>
      <input v-model="email" placeholder="邮箱" />
      <button @click="handleLogin" :disabled="store.loading">
        {{ store.loading ? '登录中...' : '登录' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '../stores/user'

const store = useUserStore()
const email = ref('admin@example.com')

const handleLogin = () => {
  store.login(email.value, '123456')
}
</script>
```

## 四、执行预览

```
计数器操作：
  初始值：count=0, doubleCount=0
  点击 +1：count=1, doubleCount=2, history=[0]
  点击 +1：count=2, doubleCount=4, history=[0,1]
  点击 撤销：count=1, history=[0]
  点击 归零：count=0

用户操作：
  未登录 -> 显示登录表单
  点击登录 -> loading -> 显示用户信息
  退出 -> 回到登录表单
```

## 五、注意事项

| 场景 | 注意事项 | 推荐做法 |
|------|---------|---------|
| 解构 Store | 解构会丢失响应式 | 使用 storeToRefs() |
| Store 命名 | use 开头 Store 结尾 | useXxxStore 约定 |
| 多组件共享 | 同一个 useXxxStore 返回同一实例 | Pinia 自动单例 |
| $reset() | Setup Store 不支持 | 手动实现或用插件 |
| SSR | 需要为每个请求创建新实例 | 使用 Pinia SSR 方案 |
| 持久化 | 刷新页面 state 丢失 | pinia-plugin-persistedstate |

## 六、避坑指南

### ❌ 坑1：直接解构丢失响应式

```javascript
// ❌ 解构后变成普通值
const { count, doubleCount } = useCounterStore()

// ✅ 使用 storeToRefs
import { storeToRefs } from 'pinia'
const store = useCounterStore()
const { count, doubleCount } = storeToRefs(store)
// Actions 直接解构即可
const { increment } = store
```

### ❌ 坑2：在 Store 外随意修改 state

```javascript
// ❌ 难以追踪变更来源
store.count = 999

// ✅ 通过 action 修改，方便调试
function setCount(val) { count.value = val }
store.setCount(999)
```

### ❌ 坑3：忘记注册 Pinia

```javascript
// ❌ 直接使用 store，Pinia 未安装
const store = useCounterStore() // Error

// ✅ 先注册
import { createPinia } from 'pinia'
const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

## 七、练习题

### 🟢 入门：待办事项 Store
创建 `useTodoStore`，包含待办列表（state）、未完成数量（getter）、添加/删除/切换完成（actions）。

### 🟡 进阶：购物车 Store
创建购物车 Store，支持添加商品（重复自动增加数量）、删除、计算总价、清空。

### 🔴 挑战：带持久化的主题 Store
创建主题 Store 管理深色/浅色模式，使用持久化插件，并动态修改 document 的 class。

## 八、知识点总结

```
Pinia 入门
├── 安装与配置
│   ├── npm install pinia
│   ├── app.use(createPinia())
│   └── defineStore(id, setup/options)
├── State
│   ├── ref() 定义
│   ├── 直接读写 store.xxx
│   └── $patch() 批量更新
├── Getters
│   ├── computed() 定义
│   └── 可互相引用
├── Actions
│   ├── 普通函数
│   ├── 支持异步
│   └── 可调用其他 store
└── 工具
    ├── storeToRefs()  -> 响应式解构
    ├── $subscribe()   -> 监听变化
    └── $onAction()    -> 监听 action
```

## 九、举一反三

| Pinia 概念 | Vue 类比 | 使用场景 |
|-----------|---------|---------|
| State | ref/reactive | 共享数据 |
| Getters | computed | 派生数据 |
| Actions | methods | 业务逻辑 |
| $patch | 批量 setData | 同时更新多字段 |
| storeToRefs | toRefs | 解构保持响应式 |
| $subscribe | watch | 调试、持久化 |

## 十、参考资料

- [Pinia 官方文档](https://pinia.vuejs.org/zh/)
- [Pinia vs Vuex](https://pinia.vuejs.org/zh/introduction.html#comparison-with-vuex)
- [Vue 3 状态管理](https://vuejs.org/guide/scaling-up/state-management.html)

## 十一、代码演进

### v1：最小 Store
```javascript
export const useCountStore = defineStore('count', () => {
  const count = ref(0)
  function increment() { count.value++ }
  return { count, increment }
})
```

### v2：完整 Counter + Getters
```javascript
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)
  const history = ref([])
  function increment() {
    history.value.push(count.value)
    count.value++
  }
  return { count, double, history, increment }
})
```

### v3：多 Store 协作 + 持久化
```javascript
export const useCartStore = defineStore('cart', () => {
  const items = ref([])
  const total = computed(() => items.value.reduce((s, i) => s + i.price * i.qty, 0))
  function addItem(product) {
    const existing = items.value.find(i => i.id === product.id)
    if (existing) existing.qty++
    else items.value.push({ ...product, qty: 1 })
  }
  return { items, total, addItem }
}, { persist: true })
```

> 💡 **总结**：Pinia 以极简 API 取代了 Vuex。记住 storeToRefs 解构、Action 修改状态、持久化插件这三招，就能覆盖 90% 的场景。
