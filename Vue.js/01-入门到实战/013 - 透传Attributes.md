---
title: "013 - 透传Attributes"
slug: "013-fallthrough-attrs"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:33:29.308+08:00"
updated_at: "2026-04-29T10:02:46.579+08:00"
reading_time: 13
tags: ["Vue.js", "Vue 3"]
---

# 051-透传Attributes

> **难度标注：** 🟢 初级 | **前置知识：** Vue 3 组件基础

---

## 一、概念讲解

"透传 Attributes"是指父组件传递给子组件、但子组件**没有在 props 或 emits 中声明**的属性。这些属性会自动"透传"到子组件的根元素上。

常见场景：`class`、`style`、`id`、`data-*`、`aria-*` 等 HTML 属性。

```vue
<!-- Parent -->
<MyButton class="large" id="submit-btn" aria-label="Submit" />

<!-- MyButton template -->
<button>Click me</button>

<!-- Rendered: attrs fall through to root -->
<button class="large" id="submit-btn" aria-label="Submit">Click me</button>
```

### 核心API

- **`inheritAttrs: false`**——禁止自动透传
- **`$attrs`**——访问所有透传属性
- **`useAttrs()`**——在 `<script setup>` 中使用

---

## 二、脑图（ASCII）

```
透传 Attributes
├── 自动透传（默认）
│   ├── class + style 会合并
│   ├── 其他属性直接覆盖
│   └── 只透传到单根元素
├── inheritAttrs: false
│   ├── 禁止自动透传
│   ├── $attrs 手动绑定
│   └── v-bind="$attrs" 绑定到目标元素
├── 多根节点
│   ├── Vue 3 多根不会自动透传
│   └── 需要手动 v-bind="$attrs"
├── 访问 $attrs
│   ├── 模板：$attrs
│   ├── JS：useAttrs()
│   └── 包含 class + style（Vue 3）
└── 典型场景
    ├── 封装原生元素
    ├── 高阶组件
    └── UI 库组件开发
```

---

## 三、完整代码示例

```vue
<!-- BaseInput.vue - Manual attrs control -->
<template>
  <div class="input-wrapper">
    <label v-if="label">{{ label }}</label>
    <!-- Bind all fallthrough attrs to the actual input -->
    <input v-bind="$attrs" :value="modelValue" @input="onInput" />
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>

<script setup>
// Disable auto-inherit so attrs don't land on wrapper div
defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  error: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

function onInput(e) {
  emit('update:modelValue', e.target.value)
}
</script>

<style scoped>
.input-wrapper { margin-bottom: 16px; }
label { display: block; margin-bottom: 4px; font-weight: bold; }
.error { color: red; font-size: 12px; }
</style>
```

```vue
<!-- App.vue -->
<template>
  <div>
    <h2>Form with BaseInput</h2>
    <form @submit.prevent="submit">
      <!-- These attrs fall through to <input> inside BaseInput -->
      <BaseInput v-model="form.name" label="Name" placeholder="Enter your name" class="name-input" />
      <BaseInput v-model="form.email" label="Email" type="email" placeholder="Enter your email" :error="errors.email" aria-required="true" />
      <BaseInput v-model="form.password" label="Password" type="password" minlength="8" />
      <button type="submit">Submit</button>
    </form>
    <pre>{{ form }}</pre>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import BaseInput from './BaseInput.vue'

const form = reactive({ name: '', email: '', password: '' })
const errors = reactive({ email: '' })

function submit() {
  if (!form.email.includes('@')) {
    errors.email = 'Invalid email'
    return
  }
  errors.email = ''
  alert(JSON.stringify(form, null, 2))
}
</script>
```

---

## 四、执行预览

```
Form with BaseInput

Name
[Enter your name          ]

Email
[Enter your email         ]

Password
[••••••••                 ]

[Submit]

{ "name": "", "email": "", "password": "" }
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| class/style 合并 | 父子 class 会合并而非覆盖 | 利用这个特性做样式扩展 |
| inheritAttrs 默认 true | 自动透传到根元素 | 封装组件时设为 false |
| 多根节点 | 不会自动透传 | 需手动 `v-bind="$attrs"` |
| 事件监听器 | Vue 3 中 `$attrs` 包含事件 | `@click` 会出现在 `$attrs.onClick` |
| $attrs 响应性 | `$attrs` 是只读的响应式对象 | 不要尝试修改它 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| attrs 自动落到 wrapper div | `inheritAttrs: false` + `v-bind="$attrs"` 绑到目标元素 |
| 忘记 `defineOptions({ inheritAttrs: false })` | 封装原生元素时始终设置 |
| 多根组件不处理 attrs | 手动绑定到目标元素 |
| 在 `setup` 中用 `this.$attrs` | 用 `useAttrs()` 代替 |
| `$attrs` 包含 class 以外的东西 | 注意过滤不需要的属性 |

---

## 七、练习题

### 🟢 基础
1. 创建 `MyButton` 组件，让父组件传入的 `class`、`disabled` 等属性自动透传到 `<button>`。
2. 给 `BaseInput` 添加 `autofocus` 属性的支持。

### 🟡 进阶
3. 创建 `Link` 组件封装 `<router-link>`，透传所有属性到 `<a>` 标签。
4. 在多根节点组件中手动分发 `$attrs` 到指定元素。

### 🔴 挑战
5. 创建 `withAttrs` 工具函数，过滤 `$attrs` 中只保留 `data-*` 和 `aria-*` 属性。

---

## 八、知识点总结

```
透传 Attributes
├── 自动透传
│   ├── 单根节点自动继承
│   └── class/style 合并
├── 手动控制
│   ├── inheritAttrs: false
│   ├── v-bind="$attrs"
│   └── useAttrs() composable
├── $attrs 内容
│   ├── 非 prop 的属性
│   ├── class + style
│   └── 事件监听器 (Vue 3)
└── 设计模式
    ├── 透明包装器组件
    └── 属性过滤代理
```

---

## 九、举一反三

| 场景 | 策略 | 示例 |
|------|------|------|
| 封装 input | inheritAttrs: false + v-bind | BaseInput, BaseTextarea |
| 封装 button | 默认透传即可 | MyButton, IconButton |
| UI 库组件 | inheritAttrs: false | 防止 attrs 污染 wrapper |
| 高阶组件 | v-bind="$attrs" 透传 | withLoading, withPermission |
| 多根节点 | 手动绑定到主元素 | List + ListItem |

---

## 十、参考资料

- [Vue 3 Fallthrough Attributes](https://vuejs.org/guide/components/attrs.html)
- [inheritAttrs API](https://vuejs.org/api/options-misc.html#inheritattrs)

---

## 十一、代码演进

### v1 - 默认自动透传
```vue
<template>
  <button class="btn"><slot /></button>
</template>
```

### v2 - inheritAttrs: false 手动控制
```vue
<script setup>
defineOptions({ inheritAttrs: false })
</script>
<template>
  <div class="wrapper">
    <input v-bind="$attrs" :value="modelValue" />
  </div>
</template>
```

### v3 - 属性过滤 + TypeScript
```vue
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const safeAttrs = computed(() => {
  const { class: cls, style, ...rest } = attrs
  return rest
})
</script>
```