---
title: "027 - Vue 3 与 TypeScript 完全指南：类型安全的组件开发"
slug: "027-vue-typescript"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:51:05.402+08:00"
updated_at: "2026-04-29T10:02:46.726+08:00"
reading_time: 7
tags: ["Vue.js", "Vue 3"]
---

## 难度标注

> **难度：⭐⭐⭐⭐（中高级）**
> 前置知识：TypeScript基础、Vue 3 Composition API
> 适合人群：想在Vue项目中引入TypeScript、提升代码质量的开发者

---

## 概念讲解

### 为什么Vue 3 + TypeScript？

Vue 3的源码本身就是用TypeScript重写的，从底层提供了完整的类型支持。与Vue 2 + `vue-class-component` 的"外挂"方式不同，Vue 3的TS集成是**原生级别**的。

### 核心类型工具

| 工具 | 用途 |
|------|------|
| `defineProps<T>()` | Props类型定义 |
| `defineEmits<T>()` | Emits类型定义 |
| `ref<T>()` | 指定ref的值类型 |
| `computed<T>()` | 指定计算属性返回类型 |
| `PropType<T>` | 复杂Props类型 |

---

## 脑图

```
Vue 3 + TypeScript
├── 组件类型
│   ├── defineProps<{}>()
│   ├── defineEmits<{}>()
│   └── withDefaults()
├── 响应式类型
│   ├── Ref<T>
│   ├── reactive() 自动推导
│   └── computed<T>()
└── 常见类型
    ├── PropType<T> 复杂props
    └── ComponentPublicInstance
```

---

## 完整代码示例

```vue
<!-- TypeScriptDemo.vue -->
<template>
  <div class="ts-demo">
    <h2>Vue 3 + TypeScript 类型演示</h2>

    <section>
      <h3>1. Props 类型系统</h3>
      <p>用户: {{ user.name }} ({{ user.role }})</p>
    </section>

    <section>
      <h3>2. Emits 类型约束</h3>
      <button @click="handleUpdate">触发更新</button>
      <p>{{ emitLog }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface User {
  name: string
  age: number
  role: 'admin' | 'editor' | 'viewer'
}

const props = withDefaults(defineProps<{
  user: User
  tags?: string[]
}>(), {
  tags: () => ['Vue', 'TypeScript']
})

const emit = defineEmits<{
  update: [id: number, data: Partial<User>]
  delete: [id: number]
}>()

const emitLog = ref('等待操作...')

function handleUpdate() {
  emit('update', 1, { name: 'Updated' })
  emitLog.value = '已触发 update 事件'
}
</script>
```

---

## 执行预览

```
页面加载后，显示用户信息
```

---

## 注意事项

| 场景 | 注意点 | 解决方案 |
|------|--------|---------|
| reactive类型 | 自动推导可能不够精确 | 显式标注 `reactive<User>(...)` |
| ref初始null | `ref(null)` 类型为 `Ref<null>` | 用 `ref<HTMLInputElement \| null>(null)` |
| Props默认值 | `defineProps` 泛型形式无默认值 | 用 `withDefaults()` 包装 |

---

## 避坑指南

### ❌ Props 不用 withDefaults
```typescript
// ❌ 泛型props没有默认值
defineProps<{ count?: number }>()
```
```typescript
// ✅ 用 withDefaults 设置默认值
withDefaults(defineProps<{ count?: number }>(), {
  count: 0
})
```

---

## 练习题

### 🟢 初级
1. **选择题**：`<script setup>` 中声明Props类型用什么？
   - A. `props: { ... }`
   - B. `defineProps<{}>()`
   - C. `interface Props`

   <details><summary>答案</summary>B</details>

---

## 知识点总结

```
Vue 3 + TS 知识树
├── 组件类型
│   ├── defineProps<T>()
│   ├── defineEmits<T>()
│   └── withDefaults()
├── 响应式类型
│   ├── Ref<T> / ref<T>()
│   └── reactive (自动推导)
└── 工具类型
    └── PropType<T>
```

---

## 举一反三

| 场景 | TS方案 |
|------|--------|
| Props定义 | `defineProps<T>()` |
| API响应类型 | 泛型fetch封装 |

---

## 参考资料

- [Vue 3 官方文档 - TypeScript支持](https://cn.vuejs.org/guide/typescript/overview.html)

---

## 代码演进

### v1：运行时Props声明
```javascript
defineProps({
  count: { type: Number, default: 0 }
})
```

### v2：泛型Props + withDefaults
```typescript
withDefaults(defineProps<{
  count?: number
}>(), { count: 0 })
```
