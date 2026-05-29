---
title: "003 - Vue Router与Pinia状态管理"
slug: "003-vue3-router-pinia"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T10:22:36.39+08:00"
updated_at: "2026-04-29T10:02:46.479+08:00"
reading_time: 25
tags: ["前端"]
---

# Vue Router与Pinia状态管理

> 📊 **难度：中级** | 🏷️ Vue.js 3.x | ⏱️ 阅读约 25 分钟

---

## 📖 概念讲解

Vue Router和Pinia是Vue 3生态的两大核心库，分别负责路由管理和状态管理。

**Vue Router 4 核心概念：**

| 概念 | 说明 |
|------|------|
| 路由配置 | `createRouter` + 路由表定义 |
| 动态路由 | `/user/:id` 参数化路径 |
| 嵌套路由 | 子路由在父路由的`<router-view>`中渲染 |
| 导航守卫 | `beforeEach`等钩子控制路由跳转 |
| 懒加载 | `() => import('./View.vue')` 按需加载 |

**Pinia 核心概念：**

Pinia是Vue 3官方推荐的状态管理库，替代Vuex。

| 概念 | 说明 |
|------|------|
| Store | 状态容器，通过`defineStore`定义 |
| State | 存储数据（类似data） |
| Getters | 派生数据（类似computed） |
| Actions | 方法（同步+异步都支持） |
| Plugins | 扩展功能（持久化、日志等） |

**Pinia vs Vuex：**

| 特性 | Pinia | Vuex |
|------|-------|------|
| Mutations | 无（Actions直接改） | 必须通过Mutations |
| TypeScript | 完美支持 | 需要大量类型声明 |
| 模块化 | 天然多Store | 需要modules配置 |
| 体积 | ~1KB | ~6KB |
| Composition API | 原生支持 | 需要额外API |

**路由与状态协作：**

典型场景：路由守卫中检查Pinia store的登录状态，未登录跳转登录页。


## 🧠 知识脑图

```
Vue Router + Pinia
├── Vue Router
│   ├── createRouter / createWebHistory
│   ├── 路由配置 (routes)
│   ├── 动态路由 /user/:id
│   ├── 嵌套路由 children
│   ├── 导航守卫
│   │   ├── beforeEach (全局)
│   │   ├── beforeEnter (路由级)
│   │   └── onBeforeRouteLeave (组件级)
│   ├── 懒加载 () => import()
│   └── useRoute / useRouter
├── Pinia
│   ├── defineStore
│   ├── State → 数据
│   ├── Getters → 派生
│   ├── Actions → 方法
│   ├── storeToRefs → 解构
│   └── 插件 (持久化等)
└── 协作模式
    ├── 守卫检查登录状态
    ├── 路由参数驱动store
    └── action后跳转路由
```

## 💻 完整代码

```vue
<!-- RouterPiniaDemo.vue - Combined demo -->
<template>
  <div class="demo">
    <!-- Navigation -->
    <nav>
      <router-link to="/">Home</router-link>
      <router-link to="/about">About</router-link>
      <router-link to="/users">Users</router-link>
      <router-link to="/admin">Admin</router-link>
      <button @click="authStore.toggleLogin()">
        {{ authStore.isLoggedIn ? 'Logout' : 'Login' }}
      </button>
    </nav>

    <!-- Route view -->
    <router-view />
  </div>
</template>

<!--
  === router.js - Route Configuration ===
  import { createRouter, createWebHistory } from 'vue-router'

  // Lazy-loaded route components
  const routes = [
    { path: '/', name: 'Home', component: () => import('./views/Home.vue') },
    { path: '/about', name: 'About', component: () => import('./views/About.vue') },
    {
      path: '/users',
      name: 'Users',
      component: () => import('./views/Users.vue'),
      children: [
        // Nested route with dynamic param
        { path: ':id', name: 'UserDetail', component: () => import('./views/UserDetail.vue') }
      ]
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('./views/Admin.vue'),
      // Route-level guard: check auth
      beforeEnter: (to, from, next) => {
        const auth = useAuthStore()
        auth.isLoggedIn ? next() : next('/?redirect=admin')
      }
    }
  ]

  const router = createRouter({
    history: createWebHistory(),
    routes
  })

  // Global navigation guard
  router.beforeEach((to, from) => {
    const auth = useAuthStore()
    if (to.meta.requiresAuth && !auth.isLoggedIn) {
      return { path: '/', query: { redirect: to.fullPath } }
    }
  })

  export default router
-->

<!--
  === stores/auth.js - Auth Store ===
  import { defineStore } from 'pinia'
  import { ref, computed } from 'vue'

  export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref(null)
    const token = ref('')

    // Getters
    const isLoggedIn = computed(() => !!token.value)
    const userName = computed(() => user.value?.name || 'Guest')

    // Actions
    function login(userData, userToken) {
      user.value = userData
      token.value = userToken
      localStorage.setItem('token', userToken)
    }

    function logout() {
      user.value = null
      token.value = ''
      localStorage.removeItem('token')
    }

    function toggleLogin() {
      if (isLoggedIn.value) {
        logout()
      } else {
        login({ id: 1, name: 'Admin', role: 'admin' }, 'mock-jwt-token')
      }
    }

    return { user, token, isLoggedIn, userName, login, logout, toggleLogin }
  })
-->

<!--
  === stores/user.js - User Store ===
  import { defineStore } from 'pinia'
  import { ref, computed } from 'vue'

  export const useUserStore = defineStore('users', () => {
    const users = ref([
      { id: 1, name: 'Alice', email: 'alice@demo.com', role: 'admin' },
      { id: 2, name: 'Bob', email: 'bob@demo.com', role: 'user' },
      { id: 3, name: 'Charlie', email: 'charlie@demo.com', role: 'user' }
    ])

    const userCount = computed(() => users.value.length)
    const admins = computed(() => users.value.filter(u => u.role === 'admin'))

    function getUserById(id) {
      return users.value.find(u => u.id === Number(id))
    }

    function addUser(user) {
      users.value.push({ ...user, id: Date.now() })
    }

    function removeUser(id) {
      users.value = users.value.filter(u => u.id !== id)
    }

    return { users, userCount, admins, getUserById, addUser, removeUser }
  })
-->

<!--
  === views/Home.vue ===
  <template>
    <h1>Home</h1>
    <p>Welcome! Logged in: {{ authStore.isLoggedIn ? authStore.userName : 'No' }}</p>
    <p>Total users in store: {{ userStore.userCount }}</p>
  </template>
  <script setup>
  import { useAuthStore } from '../stores/auth'
  import { useUserStore } from '../stores/user'
  const authStore = useAuthStore()
  const userStore = useUserStore()
  </script>
-->

<!--
  === views/UserDetail.vue - Dynamic route ===
  <template>
    <div v-if="user">
      <h2>{{ user.name }}</h2>
      <p>Email: {{ user.email }}</p>
      <p>Role: {{ user.role }}</p>
    </div>
    <p v-else>User not found</p>
    <router-link to="/users">Back to Users</router-link>
  </template>
  <script setup>
  import { useRoute } from 'vue-router'
  import { useUserStore } from '../stores/user'
  import { computed } from 'vue'

  const route = useRoute()
  const userStore = useUserStore()
  const user = computed(() => userStore.getUserById(route.params.id))
  </script>
-->

<script setup>
// Simplified inline demo of Pinia store pattern
import { ref, computed, reactive } from 'vue'

// Simulated auth store
const authStore = reactive({
  user: ref(null),
  token: ref(''),
  isLoggedIn: computed(() => false),
  toggleLogin() {
    this.token = this.token ? '' : 'mock-jwt'
    this.user = this.token ? { name: 'Admin' } : null
  }
})
</script>
```

## 👀 执行预览

**页面渲染效果：**

```
[Home] [About] [Users] [Admin]  [Login]

--- Home Page ---
Welcome! Logged in: No
Total users in store: 3

--- 点击Login后 ---
[Home] [About] [Users] [Admin]  [Logout]

--- Users Page ---
• Alice (alice@demo.com) - admin  [View]
• Bob (bob@demo.com) - user       [View]
• Charlie (charlie@demo.com) - user [View]

--- /users/1 (动态路由) ---
Alice
Email: alice@demo.com
Role: admin
[Back to Users]

--- 未登录访问Admin ---
自动跳转到首页，URL: /?redirect=/admin
```


## ⚠️ 注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| History模式 | 需要服务器配置回退 | 开发用history，部署配置fallback |
| 懒加载 | 大型应用必须按路由拆分 | `() => import('./View.vue')` |
| Pinia解构 | 直接解构失去响应性 | 用`storeToRefs(store)`解构 |
| 守卫异步 | beforeEach支持async | 适合检查远程登录状态 |
| 路由meta | 携带路由元信息 | 用于权限判断、页面标题等 |
| Store命名 | defineStore第一个参数唯一 | 推荐文件名即store名 |

## 🚫 避坑指南

### 1. 解构Pinia Store失去响应性
❌ **错误：** `const { users, userCount } = useUserStore()`
✅ **正确：** `const { users, userCount } = storeToRefs(useUserStore())`

### 2. 路由404
❌ **错误：** History模式部署后刷新页面404
✅ **正确：** 服务器配置所有路径回退到index.html

### 3. 在Pinia Action中忘记异步
❌ **错误：** `async function fetchUsers()` 但调用时不await
✅ **正确：** `await userStore.fetchUsers()` 或`.then()`

### 4. 路由守卫死循环
❌ **错误：** beforeEach中`next('/login')`又触发守卫
✅ **正确：** 判断目标路由避免循环：`if (to.path !== '/login') next('/login')`

### 5. v-for中用router-link
❌ **错误：** `<div v-for="item in list"><router-link :to="item.path"></router-link></div>`
✅ **正确：** `<router-link>`可以作为li的父元素或用programmatic navigation

## 🧪 练习题

### 🟢 基础题
1. 配置3个路由（Home/About/Contact），实现导航和页面切换。
2. 创建一个Pinia store管理购物车（items数组、addItem、removeItem、total）。

### 🟡 进阶题
3. 实现带权限的路由守卫：未登录访问/admin跳转/login，登录后跳回原页面。
4. 创建一个`useProductStore`，包含从API获取产品列表的异步action，配合loading状态。

### 🔴 挑战题
5. 实现一个完整的用户管理系统：列表页、详情页、编辑页，路由+Pinia联动，支持增删改查。

## 📝 知识点总结

```
Vue Router + Pinia
├── Vue Router
│   ├── routes配置
│   ├── 动态参数 /:id
│   ├── 嵌套路由 children
│   ├── 导航守卫 beforeEach
│   ├── 懒加载 () => import()
│   └── useRoute / useRouter
├── Pinia
│   ├── defineStore('name', setup)
│   ├── State → ref/reactive
│   ├── Getters → computed
│   ├── Actions → function
│   ├── storeToRefs解构
│   └── Plugins持久化
└── 协作
    ├── 守卫查登录
    ├── 参数驱动store
    └── action后跳转
```


## 🔄 举一反三

| 概念 | 生活类比 | 说明 |
|------|---------|------|
| Vue Router | 地图导航 | URL是地址，路由是路线 |
| 路由守卫 | 保安检查 | 到达目的地前先检查权限 |
| 动态路由 | 快递单号 | 同一模板，不同数据 |
| 懒加载 | 即时配送 | 需要时才发货 |
| Pinia Store | 仓库 | 所有组件共享的数据中心 |
| Getters | 仓库管理员 | 按需取货、整理归类 |
| Actions | 采购员 | 去外部(API)进货 |

## 📚 参考资料

1. [Vue Router 4 文档](https://router.vuejs.org/)
2. [Pinia 文档](https://pinia.vuejs.org/)
3. [Vue 3 路由懒加载](https://router.vuejs.org/guide/advanced/lazy-loading.html)
4. [Pinia 持久化插件](https://prazdevs.github.io/pinia-plugin-persistedstate/)

## 🚀 代码演进

### v1 - 基础路由配置

```js
import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About }
  ]
})
```

### v2 - 动态路由 + 守卫

```js
const routes = [
  { path: '/user/:id', component: UserDetail, beforeEnter: checkAuth }
]
router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  auth.isLoggedIn ? next() : next('/login')
})
```

### v3 - 完整Router + Pinia架构

```js
// router.js - lazy load + guards
const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/admin', component: () => import('./views/Admin.vue'),
    meta: { requiresAuth: true } }
]

// stores/auth.js - Pinia setup syntax
export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token'))
  const isLoggedIn = computed(() => !!token.value)
  async function login(credentials) {
    const { data } = await api.post('/login', credentials)
    token.value = data.token
    localStorage.setItem('token', data.token)
  }
  return { token, isLoggedIn, login }
})
```