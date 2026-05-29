---
title: "001 - Vue 3组合式API核心概念"
slug: "001-vue3-composition-api-basics"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T10:22:36.358+08:00"
updated_at: "2026-04-29T10:02:46.455+08:00"
reading_time: 19
tags: ["前端"]
---

# Vue 3组合式API核心概念

> 📊 **难度：中级** | 🏷️ Vue.js 3.x | ⏱️ 阅读约 25 分钟

---

## 📖 概念讲解

Composition API是Vue 3最重要的新特性，它提供了一种基于函数的API来组织组件逻辑。

**为什么需要Composition API？**

Options API按选项类型组织代码（data、methods、computed分开放），当组件复杂时，一个功能的代码散布在各处。Composition API按功能组织代码，相关逻辑放在一起。

**核心API：**

| API | 用途 | 返回值 |
|-----|------|--------|
| `ref()` | 创建响应式基本值 | `{ value: T }` |
| `reactive()` | 创建响应式对象 | Proxy代理对象 |
| `computed()` | 创建计算属性 | `{ value: T }`（只读ref） |
| `watch()` | 监听特定数据源 | 停止函数 |
| `watchEffect()` | 自动追踪依赖并监听 | 停止函数 |
| `toRef()` | 从reactive对象创建ref | ref |
| `toRefs()` | 将reactive转为refs对象 | `{ key: ref }` |
| `toValue()` | 将ref/getter规范化为值 | 原始值 |

**ref vs reactive：**

| 特性 | ref | reactive |
|------|-----|----------|
| 适用类型 | 任意类型 | 对象/数组 |
| 访问方式 | `.value` | 直接访问 |
| 解构 | 安全（保持响应性） | 失去响应性（需toRefs） |
| 重新赋值 | 可以 | 不可以（丢失代理） |
| 模板中 | 自动解包 | 直接使用 |

**逻辑复用 - Composables：**

Composition API最大的优势是逻辑复用。将相关逻辑提取为独立的composable函数：
```js
// useCounter.js
export function useCounter(initial = 0) {
  const count = ref(initial)
  const increment = () => count.value++
  const decrement = () => count.value--
  const reset = () => count.value = initial
  return { count, increment, decrement, reset }
}
```


## 🧠 知识脑图

```
Composition API
├── 核心API
│   ├── ref() → 基本类型响应式
│   ├── reactive() → 对象响应式
│   ├── computed() → 派生计算
│   ├── watch() → 显式监听
│   └── watchEffect() → 自动追踪
├── ref vs reactive
│   ├── ref: .value, 可重新赋值
│   └── reactive: 直接访问, 不可重新赋值
├── 辅助API
│   ├── toRef() → 单个属性转ref
│   ├── toRefs() → 整个对象转refs
│   ├── isRef() → 判断是否ref
│   ├── unref() → 获取值
│   └── shallowRef() → 浅层响应
├── 生命周期
│   ├── onMounted
│   ├── onUpdated
│   ├── onUnmounted
│   └── ...
└── Composables（逻辑复用）
    ├── use* 命名约定
    ├── 提取可复用逻辑
    └── 返回响应式状态和方法
```

## 💻 完整代码

```vue
<!-- CompositionAPIDemo.vue -->
<template>
  <div class="demo">
    <h2>ref vs reactive</h2>
    <!-- ref: accessed without .value in template -->
    <p>Ref count: {{ count }} <button @click="count++">+1</button></p>
    <!-- reactive: direct access -->
    <p>Reactive user: {{ user.name }}, {{ user.age }} years old</p>
    <button @click="user.age++">Grow older</button>

    <h2>Computed</h2>
    <input v-model.number="radius" type="number" placeholder="Radius" />
    <p>Area = π×r² = {{ area }}</p>
    <p>Circumference = 2πr = {{ circumference }}</p>

    <h2>toRefs - Deconstruct reactive</h2>
    <p>Name: {{ name }}, Age: {{ age }}</p>

    <h2>Composable: useMouse</h2>
    <p>Mouse position: ({{ mouse.x }}, {{ mouse.y }})</p>

    <h2>Composable: useCounter</h2>
    <p>Counter: {{ counter.count }}</p>
    <button @click="counter.increment()">+</button>
    <button @click="counter.decrement()">-</button>
    <button @click="counter.reset()">Reset</button>
    <p>Double: {{ counter.doubleCount }}</p>

    <h2>Lifecycle</h2>
    <p>Mount count: {{ mountCount }}</p>
    <p>Time alive: {{ timeAlive }}s</p>
  </div>
</template>

<script setup>
import { ref, reactive, computed, toRefs, onMounted, onUnmounted } from 'vue'

// === ref vs reactive ===
const count = ref(0)
const user = reactive({ name: 'Alice', age: 25 })

// === Computed ===
const radius = ref(5)
const area = computed(() => Math.PI * radius.value ** 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

// === toRefs: destructure reactive safely ===
const { name, age } = toRefs(user)

// === Composable: useMouse ===
function useMouse() {
  const x = ref(0)
  const y = ref(0)

  function update(event) {
    x.value = event.clientX
    y.value = event.clientY
  }

  onMounted(() => window.addEventListener('mousemove', update))
  onUnmounted(() => window.removeEventListener('mousemove', update))

  return { x, y }
}
const mouse = reactive(useMouse())

// === Composable: useCounter ===
function useCounter(initial = 0) {
  const count = ref(initial)
  const increment = () => count.value++
  const decrement = () => count.value--
  const reset = () => count.value = initial
  const doubleCount = computed(() => count.value * 2)
  return { count, increment, decrement, reset, doubleCount }
}
const counter = reactive(useCounter(10))

// === Lifecycle ===
const mountCount = ref(0)
const timeAlive = ref(0)
let timer

onMounted(() => {
  mountCount.value++
  timer = setInterval(() => timeAlive.value++, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>
```

## 👀 执行预览

**页面渲染效果：**

```
ref vs reactive
Ref count: 5 [+1]
Reactive user: Alice, 25 years old
[Grow older]

Computed
Radius: [5]
Area = π×r² = 78.54
Circumference = 2πr = 31.42

toRefs - Deconstruct reactive
Name: Alice, Age: 25

Composable: useMouse
Mouse position: (420, 380)  ← 随鼠标实时更新

Composable: useCounter
Counter: 10
[+] [-] [Reset]
Double: 20

Lifecycle
Mount count: 1
Time alive: 42s  ← 每秒递增
```


## ⚠️ 注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| ref的.value | script中需要.value，模板中自动解包 | 养成习惯，ref用.value |
| reactive解构 | 解构后失去响应性 | 用toRefs解构 |
| reactive重新赋值 | 整体替换会丢失代理 | 用ref替代或用Object.assign |
| watch监听reactive | 默认深度监听 | 监听getter可以浅层 |
| composable命名 | 以use开头 | 如useMouse、useCounter |
| 异步composable | 可以在setup中使用async/await | 配合Suspense使用 |

## 🚫 避坑指南

### 1. reactive解构丢失响应性
❌ **错误：** `const { name } = reactive({ name: 'Alice' })`
✅ **正确：** `const { name } = toRefs(reactive({ name: 'Alice' }))`

### 2. 直接替换reactive对象
❌ **错误：** `state = newState`（丢失响应式代理）
✅ **正确：** `Object.assign(state, newState)` 或用`ref`

### 3. 在watch中监听reactive的属性
❌ **错误：** `watch(state.count, cb)`（得到的只是当前值）
✅ **正确：** `watch(() => state.count, cb)`（用getter函数）

### 4. 忘记return composable的值
❌ **错误：** composable函数不return需要的值
✅ **正确：** `return { count, increment, ... }` 暴露所有需要的状态

### 5. 在非setup中调用生命周期钩子
❌ **错误：** 在setTimeout里调用onMounted
✅ **正确：** 生命周期钩子必须在setup同步调用

## 🧪 练习题

### 🟢 基础题
1. 用ref创建一个计时器，显示秒数，支持开始/暂停/重置。
2. 用reactive创建一个用户profile对象，用computed计算用户全名。

### 🟡 进阶题
3. 编写一个`useLocalStorage` composable，自动同步ref值到localStorage。
4. 编写一个`useFetch` composable，传入URL返回{data, loading, error}。

### 🔴 挑战题
5. 编写一个`useForm` composable，支持字段验证规则、错误提示、表单提交，并带TypeScript类型。

## 📝 知识点总结

```
Composition API核心
├── 响应式
│   ├── ref → .value访问，任意类型
│   ├── reactive → 直接访问，对象类型
│   └── toRefs → 解构reactive
├── 计算/监听
│   ├── computed → 缓存派生值
│   ├── watch → 显式监听
│   └── watchEffect → 自动追踪
├── 生命周期
│   ├── onMounted / onUnmounted
│   ├── onUpdated
│   └── 必须setup同步调用
├── Composables
│   ├── use*命名约定
│   ├── 封装可复用逻辑
│   └── 返回响应式状态+方法
└── 原则
    ├── 按功能组织代码
    ├── ref优先（推荐）
    └── 单一职责
```


## 🔄 举一反三

| 概念 | 生活类比 | 说明 |
|------|---------|------|
| Composition API | 积木 | 按功能自由组合，而非按颜色分类 |
| Options API | 文件柜 | 按类型分抽屉（data抽屉、methods抽屉） |
| ref | 保鲜盒 | 装任何东西，通过盖子（.value）存取 |
| reactive | 智能容器 | 内部自动保鲜，但不能换容器 |
| composable | 工具箱 | 提炼出来的可复用工具集 |
| toRefs | 分装 | 大罐分装成小瓶，保持新鲜 |

## 📚 参考资料

1. [Vue 3 Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
2. [Vue 3 Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
3. [Vue 3 Composables](https://vuejs.org/guide/reusability/composables.html)
4. [VueUse - Collection of Composables](https://vueuse.org/)

## 🚀 代码演进

### v1 - Options API（Vue 2风格）

```vue
<script>
export default {
  data() { return { count: 0 } },
  computed: { double() { return this.count * 2 } },
  methods: { increment() { this.count++ } },
  mounted() { console.log('mounted') }
}
</script>
```

### v2 - Composition API setup函数

```vue
<script>
import { ref, computed, onMounted } from 'vue'
export default {
  setup() {
    const count = ref(0)
    const double = computed(() => count.value * 2)
    const increment = () => count.value++
    onMounted(() => console.log('mounted'))
    return { count, double, increment }
  }
}
</script>
```

### v3 - script setup + Composables（推荐）

```vue
<script setup>
import { useCounter } from './composables/useCounter'
const { count, doubleCount: double, increment } = useCounter()
</script>
<!-- useCounter.js exported composable, reusable across components -->
```