---
title: "016 - Vue Router 入门"
slug: "016-vue-router-intro"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:39:27.6+08:00"
updated_at: "2026-04-29T10:02:46.603+08:00"
reading_time: 13
tags: ["Vue.js", "Vue 3"]
---

# 054-Vue Router 入门

> **难度标注：** 🟢 初级 | **前置知识：** Vue 3 基础、SPA 概念

---

## 一、概念讲解

Vue Router 是 Vue.js 的官方路由管理器。它让单页应用（SPA）能够根据 URL 显示不同的"页面"，而无需刷新浏览器。

核心概念：
- **Router**——路由器实例，管理所有路由规则
- **Route**——当前路由信息对象
- **RouterView**——路由组件的渲染出口
- **RouterLink**——声明式导航组件

---

## 二、脑图（ASCII）

```
Vue Router
├── 基础配置
│   ├── createRouter()
│   ├── createWebHistory()
│   ├── routes 数组
│   └── app.use(router)
├── 路由定义
│   ├── path + component
│   ├── name（命名路由）
│   ├── redirect / alias
│   └── children（嵌套路由）
├── 导航组件
│   ├── <RouterView /> 渲染出口
│   ├── <RouterLink to=""> 导航
│   └── 编程式导航
│       ├── router.push()
│       ├── router.replace()
│       └── router.go()
├── 路由信息
│   ├── useRoute().params
│   ├── useRoute().query
│   └── useRouter()
└── 模式
    ├── History（推荐）
    └── Hash
```

---

## 三、完整代码示例

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const Home = () => import('../views/Home.vue')
const About = () => import('../views/About.vue')
const User = () => import('../views/User.vue')
const NotFound = () => import('../views/NotFound.vue')

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/about', name: 'about', component: About },
  {
    path: '/user/:id',
    name: 'user',
    component: User,
    props: true // Pass route params as component props
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  }
})

export default router
```

```javascript
// main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')
```

```vue
<!-- App.vue -->
<template>
  <div id="app">
    <nav class="navbar">
      <RouterLink to="/" class="brand">My App</RouterLink>
      <div class="nav-links">
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
        <RouterLink :to="{ name: 'user', params: { id: 1 }}">User 1</RouterLink>
      </div>
    </nav>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style>
.navbar { display: flex; gap: 16px; padding: 12px; background: #42b883; }
.navbar a { color: white; text-decoration: none; padding: 8px; border-radius: 4px; }
.navbar a.router-link-active { background: rgba(255,255,255,0.2); }
</style>
```

```vue
<!-- views/User.vue -->
<template>
  <div>
    <h2>User Profile</h2>
    <p>User ID: {{ id }}</p>
    <RouterLink :to="{ name: 'user', params: { id: Number(id) + 1 }}">Next User</RouterLink>
  </div>
</template>

<script setup>
defineProps({ id: String })
</script>
```

---

## 四、执行预览

```
┌─────────────────────────────────────┐
│ My App  [Home] [About] [User 1]     │
├─────────────────────────────────────┤
│  Welcome to Home Page               │
└─────────────────────────────────────┘

(Navigate to /user/1)

┌─────────────────────────────────────┐
│ My App  [Home] [About] [User 1]     │
├─────────────────────────────────────┤
│  User Profile                       │
│  User ID: 1                         │
│  [Next User]                        │
└─────────────────────────────────────┘
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| History 模式 | 需要服务器配置 fallback | Nginx: `try_files $uri $uri/ /index.html` |
| 懒加载 | `() => import()` 代码分割 | 大型应用必须 |
| RouterLink active | 自动添加 active 类 | 可自定义 `active-class` |
| props: true | route.params 传为 props | 解耦路由和组件 |
| 404 路由 | 最后加通配 | `/:pathMatch(.*)*` |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| 用 `<a href>` 内部导航 | `<RouterLink>` 避免刷新 |
| 组件直接读 route.params | `props: true` 解耦 |
| 不配 404 路由 | 通配兜底 |
| History 模式不配服务器 | Nginx try_files |
| 硬编码路径导航 | 命名路由导航 |

---

## 七、练习题

### 🟢 基础
1. 创建 3 页面路由：首页、关于、联系。
2. 用 `router.push()` 编程式导航。

### 🟡 进阶
3. 搜索页 `/search?q=vue` 查询参数。
4. 配置 `scrollBehavior`。

### 🔴 挑战
5. `<Transition>` 包裹 `<RouterView>` 过渡动画。

---

## 八、知识点总结

```
Vue Router 入门
├── createRouter({ history, routes })
├── routes 配置
│   ├── path, name, component
│   ├── redirect, alias, children
│   └── props: true
├── 导航
│   ├── <RouterLink>
│   └── router.push/replace/go
├── 路由信息
│   ├── useRoute().params/.query
│   └── useRouter()
└── 高级
    ├── 懒加载
    └── scrollBehavior
```

---

## 九、举一反三

| 场景 | 配置 | 关键点 |
|------|------|--------|
| 博客 | `/post/:slug` | 动态参数+props |
| 搜索 | `/search?q=keyword` | query 参数 |
| 后台 | `/admin/users` | 嵌套路由 |
| 重定向 | `/old` → `/new` | redirect |

---

## 十、参考资料

- [Vue Router 官方文档](https://router.vuejs.org/)

---

## 十一、代码演进

### v1 - 最简路由
```javascript
createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About }
  ]
})
```

### v2 - 命名+懒加载+props
```javascript
routes: [
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  { path: '/user/:id', name: 'user', component: () => import('./views/User.vue'), props: true },
  { path: '/:pathMatch(.*)*', component: () => import('./views/NotFound.vue') }
]
```

### v3 - 完整配置+TS
```typescript
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: typedRoutes,
  scrollBehavior(to, from, savedPosition) {
    if (to.hash) return { el: to.hash }
    return savedPosition || { top: 0 }
  }
})
```
