---
title: "011 - 组件Props与自定义事件"
slug: "011-props-emits"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:33:29.284+08:00"
updated_at: "2026-04-29T10:02:46.566+08:00"
reading_time: 20
tags: ["Vue.js", "Vue 3"]
---

# 049-组件Props与自定义事件

> **难度标注：** 🟡 中级 | **前置知识：** Vue 3 基础、组合式 API

---

## 一、概念讲解

组件通信是 Vue 应用的核心。Props 和 Emits 构成了父子组件通信的基石：**Props 让数据从父组件流向子组件，Emits 让子组件通知父组件发生了事情。**

### Props（属性）

Props 是父组件向子组件传递数据的方式。它遵循**单向数据流**原则——父组件可以修改 prop，子组件不能。

```javascript
// Child component defines props
const props = defineProps({
  title: String,        // Simple type declaration
  count: {
    type: Number,
    default: 0,         // Default value
    required: false     // Optional
  },
  items: {
    type: Array,
    default: () => []   // Object/Array defaults must be factory functions
  }
})
```

### Emits（自定义事件）

子组件通过 `emit` 向父组件发送事件，父组件通过 `@event-name` 监听。

```javascript
// Child component declares and emits events
const emit = defineEmits(['update', 'delete', 'change'])

// Emit with payload
emit('update', { id: 1, name: 'Vue' })
```

---

## 二、脑图（ASCII）

```
Props & Emits
├── Props（父→子）
│   ├── 基础类型声明
│   │   ├── String
│   │   ├── Number
│   │   ├── Boolean
│   │   ├── Array
│   │   └── Object
│   ├── 高级配置
│   │   ├── type（类型校验）
│   │   ├── default（默认值）
│   │   ├── required（必填）
│   │   └── validator（自定义校验）
│   └── 单向数据流
│       ├── 父可改，子只读
│       └── 需要修改→emit 通知父
├── Emits（子→父）
│   ├── defineEmits 声明
│   ├── emit() 触发
│   ├── 携带载荷（payload）
│   └── v-model 本质
│       ├── :modelValue + @update:modelValue
│       └── 自定义 v-model 参数
└── 最佳实践
    ├── Props 验证必做
    ├── Emits 显式声明
    └── 避免 Props 变异
```

---

## 三、完整代码示例

```vue
<!-- ParentComponent.vue -->
<template>
  <div class="parent">
    <h2>User Manager</h2>
    <p>Total users: {{ users.length }}</p>

    <!-- Pass props and listen to emits -->
    <UserCard
      v-for="user in users"
      :key="user.id"
      :name="user.name"
      :email="user.email"
      :role="user.role"
      :is-active="user.active"
      @toggle-active="toggleUserActive(user.id)"
      @delete="deleteUser(user.id)"
    />

    <!-- v-model with custom component -->
    <SearchInput v-model="searchQuery" />
    <p>Searching: {{ searchQuery }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import UserCard from './UserCard.vue'
import SearchInput from './SearchInput.vue'

const searchQuery = ref('')

const users = ref([
  { id: 1, name: 'Alice', email: 'alice@vue.js', role: 'admin', active: true },
  { id: 2, name: 'Bob', email: 'bob@vue.js', role: 'user', active: false },
  { id: 3, name: 'Charlie', email: 'charlie@vue.js', role: 'user', active: true }
])

function toggleUserActive(id) {
  const user = users.value.find(u => u.id === id)
  if (user) user.active = !user.active
}

function deleteUser(id) {
  users.value = users.value.filter(u => u.id !== id)
}
</script>
```

```vue
<!-- UserCard.vue -->
<template>
  <div class="user-card" :class="{ inactive: !isActive }">
    <h3>{{ name }}</h3>
    <p>{{ email }} · {{ role }}</p>
    <span>Status: {{ isActive ? 'Active' : 'Inactive' }}</span>
    <div class="actions">
      <button @click="emit('toggleActive')">
        {{ isActive ? 'Deactivate' : 'Activate' }}
      </button>
      <button @click="handleDelete">Delete</button>
    </div>
  </div>
</template>

<script setup>
// Define props with validation
const props = defineProps({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'user',
    validator: (value) => ['admin', 'user', 'guest'].includes(value)
  },
  isActive: {
    type: Boolean,
    default: false
  }
})

// Explicitly declare emitted events
const emit = defineEmits(['toggleActive', 'delete'])

function handleDelete() {
  if (confirm(`Delete ${props.name}?`)) {
    emit('delete')
  }
}
</script>

<style scoped>
.user-card {
  border: 1px solid #ddd;
  padding: 12px;
  margin: 8px 0;
  border-radius: 8px;
}
.inactive {
  opacity: 0.5;
  background: #f5f5f5;
}
</style>
```

```vue
<!-- SearchInput.vue - Custom v-model component -->
<template>
  <input
    :value="modelValue"
    @input="emit('update:modelValue', $event.target.value)"
    placeholder="Search users..."
  />
</template>

<script setup>
// v-model in Vue 3 uses modelValue + update:modelValue
defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])
</script>
```

---

## 四、执行预览

```
┌─────────────────────────────────────┐
│  User Manager                       │
│  Total users: 3                     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Alice                       │    │
│  │ alice@vue.js · admin        │    │
│  │ Status: Active              │    │
│  │ [Deactivate] [Delete]       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Bob          (grayed out)   │    │
│  │ bob@vue.js · user           │    │
│  │ Status: Inactive            │    │
│  │ [Activate] [Delete]         │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Search users...         ]         │
│  Searching: vue                     │
└─────────────────────────────────────┘
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 单向数据流 | 子组件不能直接修改 props | 需要修改时用 emit 通知父组件 |
| 引用类型 | Object/Array 是引用传递 | 子组件修改会影响父组件，务必避免 |
| 默认值 | Object/Array 必须用工厂函数 | `default: () => []` 而非 `default: []` |
| 命名转换 | HTML 中 kebab-case，JS 中 camelCase | `<UserCard :user-name="...">` → `userName` |
| Boolean 类型 | `:disabled="false"` vs `disabled` | 空 prop 默认为 `true` |
| emit 声明 | 建议始终用 defineEmits 声明 | 未声明的 emit 会产生警告 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| `props.name = 'new name'` 直接修改 prop | `emit('update', newName)` 通知父组件 |
| `default: []` 对象默认值简写 | `default: () => []` 工厂函数返回 |
| 不声明 emits，直接 emit | `defineEmits(['change'])` 显式声明 |
| `this.$emit()` 在 setup 中使用 | `const emit = defineEmits()` 组合式写法 |
| props 用 `v-model` 直接绑定 | 通过 emit 实现 v-model 模式 |
| v-for 中把 index 当 key | 用唯一 id 作为 key |

---

## 七、练习题

### 🟢 基础

1. 创建一个 `CounterDisplay` 组件，接收 `count` (Number) 和 `color` (String) 两个 props，显示计数和颜色。

2. 创建一个 `Button` 组件，通过 emit 发送 `click` 事件，并携带当前时间戳作为载荷。

### 🟡 进阶

3. 实现一个支持 `v-model` 的 `TextInput` 组件，要求支持 `placeholder` prop 和 `focus` 事件。

4. 给 `UserCard` 添加 props 验证：`age` 必须在 0-150 之间，`email` 必须包含 `@`。

### 🔴 挑战

5. 实现一个 `v-model:title` + `v-model:content` 的双 v-model 组件（Vue 3.4+ 的 `defineModel` 写法）。

---

## 八、知识点总结

```
Props & Emits
├── defineProps()
│   ├── 类型声明 (String, Number, Boolean...)
│   ├── 默认值 (default)
│   ├── 必填 (required)
│   └── 自定义校验 (validator)
├── defineEmits()
│   ├── 数组语法 ['event1', 'event2']
│   └── 对象语法 (类型校验)
├── v-model 原理
│   ├── :modelValue + @update:modelValue
│   ├── 自定义参数 v-model:title
│   └── defineModel() (Vue 3.4+)
└── TypeScript 增强
    ├── defineProps<T>()
    └── withDefaults()
```

---

## 九、举一反三

| 场景 | Props | Emits |
|------|-------|-------|
| 表单组件 | value, placeholder, disabled | input, change, blur |
| 列表组件 | items, loading, pageSize | page-change, item-click |
| 模态框 | visible, title, width | close, confirm, cancel |
| 标签页 | tabs, activeTab | update:activeTab |
| 分页器 | total, pageSize, currentPage | page-change |

---

## 十、参考资料

- [Vue 3 Props 官方文档](https://vuejs.org/guide/components/props.html)
- [Vue 3 Component Events](https://vuejs.org/guide/components/events.html)
- [Vue 3 v-model on Components](https://vuejs.org/guide/components/v-model.html)
- [defineModel RFC](https://github.com/vuejs/rfcs/discussions/503)

---

## 十一、代码演进

### v1 - 基础 Props 传递
```vue
<script setup>
const props = defineProps(['name', 'email'])
// No validation, no defaults
</script>
```

### v2 - 完整 Props 验证 + Emits
```vue
<script setup>
const props = defineProps({
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: {
    type: String,
    default: 'user',
    validator: (v) => ['admin', 'user', 'guest'].includes(v)
  }
})
const emit = defineEmits(['toggleActive', 'delete'])
</script>
```

### v3 - TypeScript + defineModel（Vue 3.4+）
```vue
<script setup lang="ts">
interface Props {
  name: string
  email: string
  role?: 'admin' | 'user' | 'guest'
}
const props = withDefaults(defineProps<Props>(), {
  role: 'user'
})

// Vue 3.4+ defineModel
const modelValue = defineModel<string>({ required: true })
const title = defineModel<string>('title')
</script>
```