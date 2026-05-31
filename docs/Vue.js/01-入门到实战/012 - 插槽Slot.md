---
title: "012 - 插槽Slot"
slug: "012-slots"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:33:29.295+08:00"
updated_at: "2026-04-29T10:02:46.573+08:00"
reading_time: 16
tags: ["Vue.js", "Vue 3"]
---

# 050-插槽Slot

> **难度标注：** 🟡 中级 | **前置知识：** Vue 3 组件基础、Props

---

## 一、概念讲解

插槽（Slot）是 Vue 的内容分发机制。它让组件成为一个**可以填充内容的容器**，而不是写死内容的黑盒。

### 三种插槽类型

1. **默认插槽（Default Slot）**——最简单，放一段内容进去
2. **具名插槽（Named Slot）**——多个出口，按名字填充
3. **作用域插槽（Scoped Slot）**——子组件向插槽传递数据，父组件决定如何渲染

核心思想：**Props 传递数据，Slot 传递模板。**

---

## 二、脑图（ASCII）

```
Slots 插槽
├── 默认插槽
│   ├── <slot></slot>
│   ├── 后备内容（fallback）
│   └── 简写：无 # 的内容
├── 具名插槽
│   ├── <slot name="header">
│   ├── <template #header>
│   └── v-slot 简写 #
├── 作用域插槽
│   ├── <slot :data="item">
│   ├── #default="slotProps"
│   └── 解构：#default="{ data }"
├── 高级模式
│   ├── 高阶组件（HOC via slots）
│   ├── 无渲染组件
│   └── 插槽作为函数
└── 性能注意
    ├── 插槽在编译时展开
    └── 动态插槽 v-slot:[name]
```

---

## 三、完整代码示例

```vue
<!-- Card.vue - Reusable card with named slots -->
<template>
  <div class="card">
    <div class="card-header">
      <slot name="header"><h3>Default Title</h3></slot>
    </div>
    <div class="card-body"><slot></slot></div>
    <div class="card-footer">
      <slot name="footer"><button>Default Action</button></slot>
    </div>
  </div>
</template>

<style scoped>
.card { border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; max-width: 400px; }
.card-header { background: #f8f9fa; padding: 16px; border-bottom: 1px solid #e0e0e0; }
.card-body { padding: 16px; }
.card-footer { padding: 12px 16px; border-top: 1px solid #e0e0e0; text-align: right; }
</style>
```

```vue
<!-- DataTable.vue - Scoped slot for flexible rendering -->
<template>
  <table class="data-table">
    <thead>
      <tr>
        <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in data" :key="index">
        <td v-for="col in columns" :key="col.key">
          <slot :name="col.key" :row="row" :value="row[col.key]">
            {{ row[col.key] }}
          </slot>
        </td>
        <td>
          <slot name="actions" :row="row" :index="index">
            <button @click="$emit('edit', row)">Edit</button>
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, default: () => [] }
})
defineEmits(['edit', 'delete'])
</script>
```

```vue
<!-- App.vue - Using all slot types -->
<template>
  <div>
    <Card>
      <template #header><h2 style="color: #42b883">Vue Slots Demo</h2></template>
      <p>This is the main content injected via default slot.</p>
      <template #footer>
        <button @click="showTable = !showTable">{{ showTable ? 'Hide' : 'Show' }} Table</button>
      </template>
    </Card>

    <DataTable v-if="showTable" :columns="columns" :data="users" @edit="handleEdit">
      <template #status="{ value }">
        <span :style="{ color: value === 'Active' ? 'green' : 'red' }">● {{ value }}</span>
      </template>
      <template #actions="{ row }">
        <button @click="handleEdit(row)">Edit</button>
        <button @click="handleDelete(row)">Delete</button>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Card from './Card.vue'
import DataTable from './DataTable.vue'

const showTable = ref(true)
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' }
]
const users = ref([
  { name: 'Alice', email: 'alice@test.com', status: 'Active' },
  { name: 'Bob', email: 'bob@test.com', status: 'Inactive' },
  { name: 'Charlie', email: 'charlie@test.com', status: 'Active' }
])

function handleEdit(row) { alert(`Editing: ${row.name}`) }
function handleDelete(row) { users.value = users.value.filter(u => u.name !== row.name) }
</script>
```

---

## 四、执行预览

```
┌──────────────────────────────────────┐
│  Vue Slots Demo (green)              │
├──────────────────────────────────────┤
│  This is the main content injected   │
│  via default slot.                   │
├──────────────────────────────────────┤
│                        [Hide Table]  │
└──────────────────────────────────────┘

| Name    | Email            | Status     | Actions         |
|---------|------------------|------------|-----------------|
| Alice   | alice@test.com   | ● Active   | [Edit] [Delete] |
| Bob     | bob@test.com     | ● Inactive | [Edit] [Delete] |
| Charlie | charlie@test.com | ● Active   | [Edit] [Delete] |
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 后备内容 | `<slot>fallback</slot>` | 始终提供有意义的后备内容 |
| 插槽编译 | 插槽内容在父组件作用域编译 | 无法访问子组件数据（除非作用域插槽） |
| 动态插槽 | `v-slot:[dynamicName]` | 少用，性能有影响 |
| 缩写 | `v-slot:name` → `#name` | 只在模板中使用缩写 |
| 作用域解构 | `#default="{ row, value }"` | 解构后依然是响应式的 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| 具名插槽不用 `<template>` 包裹 | `<template #header>` 包裹内容 |
| 作用域插槽不接收参数 | `#default="slotProps"` 接收子组件数据 |
| 多个默认插槽 | 一个组件只有一个默认插槽 |
| 在子组件中直接渲染插槽内容 | 用 `$slots` 检查是否存在即可 |
| 默认插槽也写 `<template #default>` | 无特殊情况直接写内容即可 |

---

## 七、练习题

### 🟢 基础
1. 创建 `Alert` 组件，用默认插槽显示消息，后备内容为 "No message"。
2. 创建 `PageLayout` 组件，有 `header`、`sidebar`、`main`、`footer` 四个具名插槽。

### 🟡 进阶
3. 创建 `List` 组件，用作用域插槽让父组件自定义每一项的渲染方式。
4. 扩展 `DataTable`，支持 `#header-col="{ column }"` 自定义表头渲染。

### 🔴 挑战
5. 实现 `VirtualScroll` 组件，用作用域插槽只渲染可见区域的列表项。

---

## 八、知识点总结

```
Slot 插槽系统
├── <slot> 出口
│   ├── 默认 <slot></slot>
│   ├── 具名 <slot name="x">
│   └── 作用域 <slot :prop="val">
├── 使用方式
│   ├── 默认：直接写内容
│   ├── 具名：<template #name>
│   └── 作用域：<template #name="props">
├── $slots API
│   ├── 检查插槽是否传入
│   └── 条件渲染优化
└── 设计模式
    ├── Layout 组件
    ├── Renderless 组件
    └── Compound 组件
```

---

## 九、举一反三

| 场景 | 插槽类型 | 示例 |
|------|----------|------|
| 页面布局 | 具名插槽 | header + sidebar + main + footer |
| 列表渲染 | 作用域插槽 | 传入 item + index，父组件自定义渲染 |
| 通用卡片 | 默认+具名 | header + body + footer |
| 表格组件 | 作用域插槽 | 自定义列渲染、操作按钮 |
| 模态框 | 具名+默认 | title + body + actions |

---

## 十、参考资料

- [Vue 3 Slots 官方文档](https://vuejs.org/guide/components/slots.html)
- [Scoped Slots 详解](https://vuejs.org/guide/components/slots.html#scoped-slots)

---

## 十一、代码演进

### v1 - 简单默认插槽
```vue
<template>
  <div class="box"><slot>Empty</slot></div>
</template>
```

### v2 - 具名插槽 + 后备内容
```vue
<template>
  <div class="card">
    <div class="header"><slot name="header">Title</slot></div>
    <div class="body"><slot></slot></div>
    <div class="footer"><slot name="footer"></slot></div>
  </div>
</template>
```

### v3 - 作用域插槽 + 动态列
```vue
<template>
  <table>
    <tr v-for="row in data">
      <td v-for="col in columns">
        <slot :name="col.key" :row="row" :value="row[col.key]">
          {{ row[col.key] }}
        </slot>
      </td>
    </tr>
  </table>
</template>
```