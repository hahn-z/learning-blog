---
title: "023 - Transition动画"
slug: "023-transitions"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:45:39.886+08:00"
updated_at: "2026-04-29T10:02:46.683+08:00"
reading_time: 19
tags: ["Vue.js", "Vue 3"]
---

## 难度标注

> 🟡 **中级** — 需要 CSS 动画基础和 Vue 3 条件渲染知识

## 概念讲解

### 什么是 Transition？

Vue 的 `<Transition>` 组件为**单个元素/组件**在插入、更新或移除 DOM 时提供过渡动画效果。它会在元素的不同阶段自动添加 CSS 类名。

### 核心类名

| 类名 | 时机 |
|------|------|
| `v-enter-from` | 进入动画起始状态 |
| `v-enter-active` | 进入动画生效期间 |
| `v-enter-to` | 进入动画结束状态 |
| `v-leave-from` | 离开动画起始状态 |
| `v-leave-active` | 离开动画生效期间 |
| `v-leave-to` | 离开动画结束状态 |

### TransitionGroup

`<TransitionGroup>` 用于给 **v-for 列表**添加过渡动画，支持 FLIP 动画（移动过渡）。

## 脑图

```
Transition 动画
├── <Transition> — 单元素
│   ├── v-if / v-show 触发
│   ├── CSS 过渡类名 (6个)
│   ├── name 属性自定义前缀
│   ├── mode: out-in / in-out
│   └── appear 首次渲染动画
├── <TransitionGroup> — 列表
│   ├── v-for 动画
│   ├── FLIP 移动动画
│   └── move-class 自定义
├── JavaScript 钩子
│   ├── @before-enter / @enter / @after-enter
│   └── @before-leave / @leave / @after-leave
└── 动画库集成
    ├── Animate.css
    ├── GSAP
    └── 自定义 CSS
```

## 完整代码

```vue
<!-- components/FadeTransition.vue — Basic fade transition -->
<script setup>
import { ref } from 'vue'

const show = ref(true)
</script>

<template>
  <div>
    <button @click="show = !show">Toggle</button>
    <!-- Transition wraps a single element -->
    <Transition name="fade">
      <p v-if="show" class="box">Hello Transition!</p>
    </Transition>
  </div>
</template>

<style scoped>
.box {
  padding: 20px;
  background: #42b883;
  color: white;
  border-radius: 8px;
}

/* Fade transition classes */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

```vue
<!-- components/SlideTransition.vue — Slide + fade with mode -->
<script setup>
import { ref } from 'vue'

const currentView = ref('A')
</script>

<template>
  <div>
    <button @click="currentView = 'A'">View A</button>
    <button @click="currentView = 'B'">View B</button>
    <!-- mode="out-in": leave first, then enter -->
    <Transition name="slide" mode="out-in">
      <div v-if="currentView === 'A'" key="a" class="panel">
        Panel A Content
      </div>
      <div v-else key="b" class="panel">
        Panel B Content
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.panel { padding: 20px; background: #f0f0f0; border-radius: 8px; }

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from {
  transform: translateX(30px);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}
</style>
```

```vue
<!-- components/ListTransition.vue — TransitionGroup with FLIP -->
<script setup>
import { ref } from 'vue'

const items = ref([
  { id: 1, text: 'Item One' },
  { id: 2, text: 'Item Two' },
  { id: 3, text: 'Item Three' },
  { id: 4, text: 'Item Four' }
])
let nextId = 5

function add() {
  items.value.push({ id: nextId++, text: `Item ${nextId - 1}` })
}

function remove(index) {
  items.value.splice(index, 1)
}

function shuffle() {
  items.value.sort(() => Math.random() - 0.5)
}
</script>

<template>
  <div>
    <button @click="add">Add</button>
    <button @click="shuffle">Shuffle</button>

    <!-- TransitionGroup for list animations -->
    <TransitionGroup name="list" tag="ul">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        @click="remove(index)"
      >
        {{ item.text }} (click to remove)
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
ul { list-style: none; padding: 0; position: relative; }
li {
  padding: 10px 15px;
  margin: 5px 0;
  background: #42b883;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

/* Enter/leave */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(50px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(-50px);
}

/* FLIP move animation */
.list-move {
  transition: transform 0.4s ease;
}

/* Ensure leaving items don't take space */
.list-leave-active {
  position: absolute;
}
</style>
```

```vue
<!-- components/JsTransition.vue — JavaScript hook transition (GSAP-like) -->
<script setup>
import { ref } from 'vue'

const show = ref(true)

// JavaScript animation hooks
function onEnter(el, done) {
  // Simple animation without GSAP
  let opacity = 0
  el.style.opacity = opacity
  const interval = setInterval(() => {
    opacity += 0.05
    el.style.opacity = opacity
    if (opacity >= 1) {
      clearInterval(interval)
      el.style.opacity = 1
      done()
    }
  }, 16)
}

function onLeave(el, done) {
  let opacity = 1
  const interval = setInterval(() => {
    opacity -= 0.05
    el.style.opacity = opacity
    if (opacity <= 0) {
      clearInterval(interval)
      el.style.opacity = 0
      done()
    }
  }, 16)
}
</script>

<template>
  <div>
    <button @click="show = !show">Toggle JS Transition</button>
    <Transition :css="false" @enter="onEnter" @leave="onLeave">
      <p v-if="show" class="box">JS Animated!</p>
    </Transition>
  </div>
</template>

<style scoped>
.box { padding: 20px; background: #35495e; color: white; border-radius: 8px; }
</style>
```

## 执行预览

```
点击 Toggle（fade）:
  → show: true → false
  → fade-leave-active + fade-leave-to (opacity 1→0)
  → 300ms 后元素移除

  → show: false → true
  → fade-enter-active + fade-enter-from (opacity 0→1)
  → 300ms 后动画完成

切换 View A → View B（slide + out-in）:
  → Panel A 先执行离开动画（向左滑出）
  → Panel A 离开完成后，Panel B 执行进入动画（从右滑入）

列表操作:
  → Add: 新项从右侧滑入
  → Remove: 项向左滑出，其他项平滑移动到新位置（FLIP）
  → Shuffle: 所有项平滑移动到新位置
```

## 注意事项

| 注意点 | 说明 |
|--------|------|
| 单子元素 | `<Transition>` 只能包含一个直接子元素 |
| key 必需 | 多元素切换时每个元素必须有唯一的 `key` |
| mode | `out-in`（推荐）先出后进，`in-out` 先进后出 |
| TransitionGroup tag | 默认不渲染包裹元素，需指定 `tag="ul"` 等 |
| FLIP 需要 key | TransitionGroup 的移动动画依赖稳定的 key |
| v-show 兼容 | Transition 同时支持 v-if 和 v-show |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| Transition 内放多个根元素 | 只放一个，用 v-if/v-else-if/v-else 切换 |
| 忘记加 `key` | 多元素切换必须加唯一 key |
| 不用 mode 导致同时渲染 | 设 `mode="out-in"` 避免两个元素同时存在 |
| TransitionGroup 不设 tag | 加 `tag="ul"` 等指定容器元素 |
| FLIP 动画不生效 | 确保离开项 `position: absolute` + 有 `.list-move` 类 |

## 练习题

### 🟢 基础
1. 实现一个简单的 fade 过渡效果
2. 给过渡加 `appear` 属性，让首次渲染也有动画

### 🟡 进阶
3. 实现一个 Tab 切换组件，使用 `mode="out-in"` 和滑动动画
4. 使用 TransitionGroup 实现一个可拖拽排序的列表，带 FLIP 动画

### 🔴 挑战
5. 实现一个通用的动画系统：支持配置动画类型（fade/slide/zoom），封装为可复用的 Transition 组件

## 知识点总结

```
Transition 动画
├── <Transition>
│   ├── name="xxx" → .xxx-enter-from 等
│   ├── mode="out-in" | "in-out"
│   ├── appear — 首次渲染
│   └── :css="false" + JS hooks
├── <TransitionGroup>
│   ├── tag="ul" — 渲染容器
│   ├── FLIP — .xxx-move
│   └── 离开项 position: absolute
├── CSS 类名 (6个)
│   ├── xxx-enter-from / active / to
│   └── xxx-leave-from / active / to
└── JS 钩子
    ├── @enter(el, done)
    ├── @leave(el, done)
    └── 必须调用 done()
```

## 举一反三

| 场景 | 组件 | 技巧 |
|------|------|------|
| 模态框 | Transition | fade + scale 组合 |
| Tab 切换 | Transition + mode | slide out-in |
| 列表增删 | TransitionGroup | FLIP 动画 |
| 路由切换 | Transition + router-view | 包裹 router-view |
| 通知提示 | TransitionGroup | 从右侧滑入滑出 |
| 复杂动画 | JS hooks | GSAP/手写动画 |

## 参考资料

- [Vue 3 官方文档 - Transition](https://vuejs.org/guide/built-ins/transition.html)
- [Vue 3 官方文档 - TransitionGroup](https://vuejs.org/guide/built-ins/transition-group.html)

## 代码演进

### v1 — 基础 fade
```css
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
```

### v2 — mode + 列表动画
```vue
<Transition name="slide" mode="out-in">...</Transition>
<TransitionGroup name="list" tag="ul">...</TransitionGroup>
```

### v3 — 完整方案（本文代码）
- 自定义动画类名
- JS 钩子动画
- FLIP 列表动画
- appear 首次渲染
