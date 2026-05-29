---
title: "014 - Vue 3 依赖注入 Provide/Inject"
slug: "014-provide-inject"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:39:27.573+08:00"
updated_at: "2026-04-29T10:02:46.585+08:00"
reading_time: 13
tags: ["Vue.js", "Vue 3"]
---

# 052-Vue 3 依赖注入 Provide/Inject

> **难度标注：** 🟡 中级 | **前置知识：** Vue 3 组合式 API、Props/Emits

---

## 一、概念讲解

当组件层级很深时，用 Props 逐层传递数据（prop drilling）非常痛苦。**Provide/Inject** 让祖先组件直接向任意后代组件注入数据，跳过中间层级。

```
App (provide: theme)
├── Header (不需要知道 theme)
│   └── Nav
├── Main
│   ├── Sidebar
│   └── Content
│       └── Button (inject: theme) ← 直接获取！
```

### 核心API

- **`provide(key, value)`**——提供数据
- **`inject(key, defaultValue)`**——注入数据
- **InjectionKey<T>**——TypeScript 类型安全的 key

---

## 二、脑图（ASCII）

```
Provide / Inject
├── provide()
│   ├── 字符串 key
│   ├── Symbol key（推荐）
│   ├── InjectionKey<T>（TS）
│   └── 响应式数据
│       ├── ref → 注入 ref
│       ├── reactive → 注入 proxy
│       └── readonly → 只读注入
├── inject()
│   ├── 注入值
│   ├── 默认值
│   └── 工厂函数默认值
├── 使用场景
│   ├── 主题系统
│   ├── 国际化 i18n
│   ├── 表单验证
│   └── 配置项
├── 响应性保持
│   ├── provide ref 保持响应
│   └── readonly 防止子组件修改
└── 与 Pinia 对比
    ├── 局部状态 → P/I
    └── 全局状态 → Pinia
```

---

## 三、完整代码示例

```vue
<!-- ThemeProvider.vue -->
<template>
  <div :class="['app', `theme-${theme}`]">
    <slot />
  </div>
</template>

<script setup>
import { provide, readonly, ref, computed } from 'vue'

const theme = ref('light')

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

// Provide reactive state as readonly
provide('theme', {
  current: readonly(theme),
  toggle: toggleTheme
})

provide('isDark', computed(() => theme.value === 'dark'))
</script>

<style>
.theme-light { background: #fff; color: #333; }
.theme-dark { background: #1a1a2e; color: #e0e0e0; }
</style>
```

```vue
<!-- ThemedButton.vue - Deep child uses inject -->
<template>
  <button :class="['themed-btn', theme.current]" @click="$emit('click')">
    <slot />
  </button>
</template>

<script setup>
import { inject } from 'vue'

// Inject with default value fallback
const theme = inject('theme', {
  current: { value: 'light' },
  toggle: () => {}
})

defineEmits(['click'])
</script>

<style scoped>
.themed-btn { padding: 8px 16px; border-radius: 6px; cursor: pointer; border: none; }
.themed-btn.light { background: #42b883; color: white; }
.themed-btn.dark { background: #35495e; color: white; }
</style>
```

```vue
<!-- ThemeToggle.vue -->
<template>
  <button @click="theme.toggle()">
    {{ theme.current }} mode → Switch to {{ theme.current === 'light' ? 'dark' : 'light' }}
  </button>
</template>

<script setup>
import { inject } from 'vue'
const theme = inject('theme')
</script>
```

```vue
<!-- App.vue -->
<template>
  <ThemeProvider>
    <ThemeToggle />
    <ThemedButton>Click me</ThemedButton>
  </ThemeProvider>
</template>

<script setup>
import ThemeProvider from './ThemeProvider.vue'
import ThemeToggle from './ThemeToggle.vue'
import ThemedButton from './ThemedButton.vue'
</script>
```

---

## 四、执行预览

```
┌──────────────────────────────────────┐
│  [light mode → Switch to dark]       │ ← ThemeToggle
│                                      │
│  [Click me]                          │ ← ThemedButton (green bg)
└──────────────────────────────────────┘

(点击后背景变深色、文字变白)
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 响应性 | provide 的值如果是 ref/reactive 则保持响应 | 需要响应就 provide ref |
| 只读保护 | 子组件可以修改注入的 reactive 对象 | 用 `readonly()` 包装后 provide |
| key 碰撞 | 字符串 key 可能冲突 | 用 Symbol 或 InjectionKey |
| 默认值 | inject 第二参数为默认值 | 始终提供默认值，防止组件独立使用时报错 |
| 调试困难 | 不像 Props 那么直观 | 在 DevTools 中可以查看 provide/inject |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| provide 普通值期望响应 | `provide('x', ref(0))` 提供 ref |
| inject 时不设默认值 | `inject('key', defaultValue)` 始终设默认值 |
| 字符串 key 到处写 | 提取为 Symbol 常量集中管理 |
| 子组件直接修改 inject 的值 | `readonly()` 包装 + 提供修改方法 |
| 用 P/I 替代所有状态管理 | 全局共享状态用 Pinia，局部用 P/I |

---

## 七、练习题

### 🟢 基础
1. 创建 provide/inject 传递用户名，在子组件中显示。
2. 给 inject 添加默认值，确保组件可以独立运行。

### 🟡 进阶
3. 实现一个 `FormProvider`，provide 表单数据和验证规则，深层 `FormField` 组件 inject 使用。
4. 用 Symbol + `InjectionKey<T>` 实现类型安全的 provide/inject。

### 🔴 挑战
5. 实现一个完整的主题系统：支持多主题切换、CSS 变量注入、组件级主题覆盖。

---

## 八、知识点总结

```
Provide / Inject
├── provide(key, value)
│   ├── 值类型
│   ├── ref / reactive（响应式）
│   └── readonly（只读保护）
├── inject(key, default?)
│   ├── 获取 provide 的值
│   ├── 默认值 / 工厂函数
│   └── 保持响应性
├── Key 管理
│   ├── 字符串（简单）
│   ├── Symbol（推荐）
│   └── InjectionKey<T>（TS）
└── 设计模式
    ├── Provider + Consumer
    ├── 作用域状态
    └── 插件配置注入
```

---

## 九、举一反三

| 场景 | provide 内容 | inject 使用 |
|------|-------------|------------|
| 主题 | `{ theme, toggle }` | 组件读取主题、切换 |
| 国际化 | `{ locale, t, setLocale }` | 组件翻译文本 |
| 表单 | `{ values, errors, validate }` | 字段组件读写值 |
| 配置 | `{ apiBase, features }` | 任何组件读取配置 |
| 权限 | `{ user, permissions }` | 组件判断是否显示 |

---

## 十、参考资料

- [Vue 3 Provide/Inject 官方文档](https://vuejs.org/guide/components/provide-inject.html)
- [InjectionKey TypeScript](https://vuejs.org/api/utility-types.html#injectionkey-t)

---

## 十一、代码演进

### v1 - 简单字符串 key
```javascript
provide('username', 'Alice')
const name = inject('username', 'Guest')
```

### v2 - 响应式 + readonly
```javascript
const theme = ref('light')
provide('theme', { current: readonly(theme), toggle: () => { /* ... */ } })
const { current, toggle } = inject('theme')
```

### v3 - TypeScript + Symbol + Composable
```typescript
export const ThemeKey: InjectionKey<{
  current: Readonly<Ref<string>>
  toggle: () => void
}> = Symbol('theme')

export function useTheme() {
  const ctx = inject(ThemeKey)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```