---
title: "024 - Teleport与Suspense"
slug: "024-teleport-suspense"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:45:39.901+08:00"
updated_at: "2026-04-29T10:02:46.692+08:00"
reading_time: 19
tags: ["Vue.js", "Vue 3"]
---

## 难度标注

> 🟡 **中级** — 需要 Vue 3 基础、异步组件、Composition API

## 概念讲解

### Teleport

`<Teleport>` 允许将组件的内容**渲染到 DOM 中的其他位置**，而不影响组件的逻辑关系。典型场景：模态框、通知、全屏遮罩。

```html
<Teleport to="body">
  <div class="modal">...</div>
</Teleport>
<!-- modal 实际渲染到 <body> 下，而非组件内部 -->
```

### Suspense

`<Suspense>` 用于协调异步依赖，在异步组件加载或异步 setup 完成前显示 fallback 内容。

### 核心概念对比

| 组件 | 作用 | 场景 |
|------|------|------|
| Teleport | DOM 传送 | 模态框、通知、全屏层 |
| Suspense | 异步等待 | 异步组件、数据加载 |

## 脑图

```
Teleport 与 Suspense
├── Teleport
│   ├── to="body" — 目标选择器
│   ├── disabled — 条件禁用
│   ├── 多个 Teleport 追加到同一目标
│   └── 应用: Modal / Toast / Drawer
├── Suspense
│   ├── #default — 异步内容
│   ├── #fallback — 加载中显示
│   ├── timeout — 超时时间
│   └── 事件: @pending / @resolve
└── 组合使用
    ├── Teleport + Suspense
    └── 模态框异步加载
```

## 完整代码

```vue
<!-- components/Modal.vue — Teleport-based modal -->
<script setup>
import { watch } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: 'Modal' }
})

const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}

// Lock body scroll when modal is open
watch(() => props.modelValue, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})
</script>

<template>
  <!-- Teleport modal to body to avoid z-index/overflow issues -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ title }}</h3>
            <button class="close-btn" @click="close">&times;</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  min-width: 400px;
  max-width: 90vw;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}
.modal-enter-active, .modal-leave-active { transition: opacity 0.3s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
```

```vue
<!-- components/ToastStack.vue — Multiple teleports for notifications -->
<script setup>
import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

function addToast(message, type = 'info') {
  const id = toastId++
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, 3000)
}

// Expose for parent usage
defineExpose({ addToast })
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
        >
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toast {
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
}
.toast-info { background: #42b883; }
.toast-error { background: #e74c3c; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s; }
.toast-enter-from { opacity: 0; transform: translateX(50px); }
.toast-leave-to { opacity: 0; transform: translateX(50px); }
</style>
```

```vue
<!-- components/AsyncChart.vue — Async component for Suspense -->
<script setup>
// Simulate async setup (e.g., loading heavy chart library)
const data = await new Promise(resolve => {
  setTimeout(() => {
    resolve([
      { label: 'Jan', value: 65 },
      { label: 'Feb', value: 59 },
      { label: 'Mar', value: 80 }
    ])
  }, 2000)
})
</script>

<template>
  <div class="chart">
    <h4>Chart Data (loaded async)</h4>
    <div v-for="item in data" :key="item.label" class="bar-row">
      <span>{{ item.label }}</span>
      <div class="bar" :style="{ width: item.value * 3 + 'px' }">
        {{ item.value }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart { padding: 16px; background: #f9f9f9; border-radius: 8px; }
.bar-row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.bar { height: 24px; background: #42b883; border-radius: 4px; padding: 0 8px; color: white; display: flex; align-items: center; }
</style>
```

```vue
<!-- App.vue — Combining Teleport + Suspense -->
<script setup>
import { ref, defineAsyncComponent } from 'vue'
import Modal from './components/Modal.vue'
import ToastStack from './components/ToastStack.vue'

const AsyncChart = defineAsyncComponent(() =>
  import('./components/AsyncChart.vue')
)

const showModal = ref(false)
const toastRef = ref(null)

function showToast() {
  toastRef.value?.addToast('Operation successful!', 'info')
}
</script>

<template>
  <div>
    <button @click="showModal = true">Open Modal</button>
    <button @click="showToast">Show Toast</button>

    <Modal v-model="showModal" title="Async Chart">
      <Suspense>
        <template #default>
          <AsyncChart />
        </template>
        <template #fallback>
          <div class="loading">Loading chart data...</div>
        </template>
      </Suspense>
    </Modal>

    <ToastStack ref="toastRef" />
  </div>
</template>

<style scoped>
.loading { padding: 40px; text-align: center; color: #666; }
</style>
```

## 执行预览

```
点击 "Open Modal":
  → 遮罩层和弹窗渲染到 <body> 下（不受父级 overflow 影响）
  → body.style.overflow = 'hidden'（禁止背景滚动）

Modal 内的 AsyncChart:
  → Suspense 显示 fallback: "Loading chart data..."
  → 2秒后数据加载完成
  → 显示图表内容

点击 "Show Toast":
  → 通知从右侧滑入，渲染到 <body>
  → 3秒后自动消失

关闭 Modal:
  → 动画淡出
  → body.style.overflow 恢复
```

## 注意事项

| 注意点 | 说明 |
|--------|------|
| Teleport to | 目标必须存在，否则报错 |
| disabled 属性 | `<Teleport :disabled="isMobile">` 条件禁用传送 |
| Suspense 稳定性 | Suspense 在 Vue 3 仍标记为实验性功能 |
| 异步 setup | 组件 setup 中使用 `await` 会触发 Suspense |
| 多 Teleport | 多个 Teleport 到同一目标按渲染顺序追加 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 弹窗放在组件内部，被 overflow:hidden 裁切 | 用 Teleport to="body" 传送到根层 |
| 不锁定 body 滚动 | Modal 打开时 `body.overflow = 'hidden'` |
| Suspense 不提供 fallback | 始终提供 fallback 提升用户体验 |
| Teleport 目标选择器不存在 | 确保目标元素在 DOM 中存在 |
| 忘记关闭 Modal 清理副作用 | watch modelValue 在关闭时恢复状态 |

## 练习题

### 🟢 基础
1. 使用 Teleport 实现一个简单的模态框
2. 使用 Suspense 包裹一个异步组件，显示加载中状态

### 🟡 进阶
3. 实现一个通知系统：多个通知堆叠显示，3秒后自动消失
4. 实现一个 Drawer（抽屉）组件，从右侧滑入，使用 Teleport

### 🔴 挑战
5. 实现一个完整的异步页面加载方案：路由切换时显示骨架屏，加载完成后淡入内容

## 知识点总结

```
Teleport 与 Suspense
├── Teleport
│   ├── to="body" — CSS 选择器
│   ├── :disabled — 条件禁用
│   └── 用途: Modal / Toast / Drawer
├── Suspense
│   ├── #default — 异步内容
│   ├── #fallback — 加载占位
│   ├── 支持: async setup / defineAsyncComponent
│   └── 事件: @pending @resolve @fallback
└── 最佳实践
    ├── Modal → Teleport to body
    ├── 异步内容 → Suspense 包裹
    └── Transition + Teleport 组合
```

## 举一反三

| 场景 | 方案 | 组件 |
|------|------|------|
| 模态框 | Teleport to body | Modal |
| 全局通知 | Teleport + TransitionGroup | Toast |
| 抽屉菜单 | Teleport + slide transition | Drawer |
| 异步数据加载 | Suspense + fallback | AsyncData |
| 图片预览 | Teleport to body | Lightbox |

## 参考资料

- [Vue 3 官方文档 - Teleport](https://vuejs.org/guide/built-ins/teleport.html)
- [Vue 3 官方文档 - Suspense](https://vuejs.org/guide/built-ins/suspense.html)

## 代码演进

### v1 — 基础 Teleport
```vue
<Teleport to="body">
  <div class="modal">...</div>
</Teleport>
```

### v2 — 加 Suspense
```vue
<Suspense>
  <AsyncComponent />
  <template #fallback>Loading...</template>
</Suspense>
```

### v3 — 完整方案（本文代码）
- Modal + Teleport + Transition
- Toast 通知系统
- Suspense + 异步 setup
- body 滚动锁定
