---
title: "004 - Vue 3实战：构建完整Todo应用"
slug: "004-vue3-todo-app-tutorial"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T10:22:36.408+08:00"
updated_at: "2026-04-29T10:02:46.492+08:00"
reading_time: 32
tags: ["前端", "TodoList"]
---

# Vue 3实战：构建完整Todo应用

> 📊 **难度：中级** | 🏷️ Vue.js 3.x | ⏱️ 阅读约 25 分钟

---

## 📖 概念讲解

通过构建Todo应用，我们将综合运用前面学到的所有Vue 3知识，构建一个完整的应用。

**功能需求：**

- ✅ 添加待办事项
- ✅ 标记完成/未完成
- ✅ 删除待办事项
- ✅ 编辑待办事项
- ✅ 过滤显示（全部/未完成/已完成）
- ✅ 统计信息
- ✅ 本地持久化（localStorage）
- ✅ 批量操作（全部完成/清除已完成）

**技术方案：**

| 技术 | 用途 |
|------|------|
| Composition API | 逻辑组织 |
| `<script setup>` | 组件语法 |
| ref / reactive | 状态管理 |
| computed | 派生数据（过滤、统计） |
| watch | 持久化到localStorage |
| 组件拆分 | TodoInput / TodoItem / TodoFilter |
| Props + Events | 组件通信 |
| CSS过渡 | 动画效果 |

**应用架构：**

```
App.vue (根组件 - 状态管理中心)
├── TodoInput.vue (输入组件 - 添加待办)
├── TodoFilter.vue (过滤组件 - 切换显示)
├── TodoItem.vue (单项组件 - 展示/编辑/删除) × N
└── TodoStats.vue (统计组件 - 数量/进度)
```

这个应用是学习Vue 3的最佳实战项目——麻雀虽小五脏俱全，涵盖了所有核心概念。


## 🧠 知识脑图

```
Todo应用架构
├── 功能
│   ├── CRUD（增删改查）
│   ├── 过滤（全部/活跃/完成）
│   ├── 统计（数量/进度）
│   ├── 持久化（localStorage）
│   └── 批量操作
├── 状态设计
│   ├── todos: [{id, text, done, createdAt}]
│   ├── filter: 'all' | 'active' | 'done'
│   ├── editingId: number | null
│   └── nextId: number
├── 组件拆分
│   ├── App.vue (状态中心)
│   ├── TodoInput (输入+添加)
│   ├── TodoFilter (过滤按钮)
│   ├── TodoItem (单项CRUD)
│   └── TodoStats (统计信息)
├── 涉及知识点
│   ├── ref / reactive
│   ├── computed (过滤/统计)
│   ├── watch (持久化)
│   ├── Props + Events
│   └── CSS transitions
└── 扩展方向
    ├── 拖拽排序
    ├── 分类/标签
    └── 后端API
```

## 💻 完整代码

```vue
<!-- TodoApp.vue - Complete Todo Application -->
<template>
  <div class="todo-app">
    <h1>📝 Vue 3 Todo App</h1>

    <!-- Input Component -->
    <div class="input-section">
      <input
        v-model.trim="newTodo"
        @keyup.enter="addTodo"
        placeholder="What needs to be done?"
        class="todo-input"
      />
      <button @click="addTodo" :disabled="!newTodo" class="btn-add">
        Add
      </button>
    </div>

    <!-- Filter Component -->
    <div class="filter-section">
      <button
        v-for="f in filters"
        :key="f.value"
        @click="currentFilter = f.value"
        :class="['btn-filter', { active: currentFilter === f.value }]"
      >
        {{ f.label }}
      </button>
      <span class="count">{{ leftCount }} items left</span>
    </div>

    <!-- Todo List -->
    <transition-group name="list" tag="ul" class="todo-list">
      <li v-for="todo in filteredTodos" :key="todo.id" class="todo-item">
        <!-- Display mode -->
        <template v-if="editingId !== todo.id">
          <input type="checkbox" v-model="todo.done" class="checkbox" />
          <span
            :class="{ done: todo.done, 'todo-text': true }"
            @dblclick="startEdit(todo)"
          >
            {{ todo.text }}
          </span>
          <button @click="removeTodo(todo.id)" class="btn-delete">✕</button>
        </template>
        <!-- Edit mode -->
        <template v-else>
          <input
            v-model="editText"
            @keyup.enter="saveEdit(todo)"
            @keyup.esc="cancelEdit"
            @blur="saveEdit(todo)"
            class="edit-input"
            ref="editInput"
          />
        </template>
      </li>
    </transition-group>

    <!-- Empty state -->
    <p v-if="filteredTodos.length === 0" class="empty">
      {{ currentFilter === 'all' ? 'No todos yet!' : `No ${currentFilter} todos` }}
    </p>

    <!-- Stats Component -->
    <div class="stats-section">
      <div class="progress-bar">
        <div class="progress" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p>{{ doneCount }} / {{ totalCount }} completed ({{ progressPercent }}%)</p>
      <div class="batch-actions">
        <button @click="markAllDone" :disabled="leftCount === 0">
          Mark all done
        </button>
        <button @click="clearDone" :disabled="doneCount === 0">
          Clear completed ({{ doneCount }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

// === State ===
const newTodo = ref('')
const currentFilter = ref('all')
const editingId = ref(null)
const editText = ref('')
let nextId = 1

// Load from localStorage
const savedTodos = localStorage.getItem('vue3-todos')
const todos = ref(savedTodos ? JSON.parse(savedTodos) : [
  { id: nextId++, text: 'Learn Vue 3 basics', done: true, createdAt: Date.now() },
  { id: nextId++, text: 'Build Todo app', done: false, createdAt: Date.now() },
  { id: nextId++, text: 'Deploy to production', done: false, createdAt: Date.now() }
])

// Ensure nextId is higher than existing IDs
if (todos.value.length) {
  nextId = Math.max(...todos.value.map(t => t.id)) + 1
}

// === Computed ===
const filters = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Completed' }
]

const filteredTodos = computed(() => {
  switch (currentFilter.value) {
    case 'active': return todos.value.filter(t => !t.done)
    case 'done': return todos.value.filter(t => t.done)
    default: return todos.value
  }
})

const totalCount = computed(() => todos.value.length)
const doneCount = computed(() => todos.value.filter(t => t.done).length)
const leftCount = computed(() => totalCount.value - doneCount.value)
const progressPercent = computed(() =>
  totalCount.value ? Math.round((doneCount.value / totalCount.value) * 100) : 0
)

// === Persistence ===
watch(todos, (newVal) => {
  localStorage.setItem('vue3-todos', JSON.stringify(newVal))
}, { deep: true })

// === Actions ===
function addTodo() {
  if (!newTodo.value) return
  todos.value.push({
    id: nextId++,
    text: newTodo.value,
    done: false,
    createdAt: Date.now()
  })
  newTodo.value = ''
}

function removeTodo(id) {
  todos.value = todos.value.filter(t => t.id !== id)
}

function startEdit(todo) {
  editingId.value = todo.id
  editText.value = todo.text
  nextTick(() => {
    // Focus the edit input
    const inputs = document.querySelectorAll('.edit-input')
    if (inputs.length) inputs[inputs.length - 1].focus()
  })
}

function saveEdit(todo) {
  const text = editText.value.trim()
  if (text) {
    todo.text = text
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function markAllDone() {
  todos.value.forEach(t => { t.done = true })
}

function clearDone() {
  todos.value = todos.value.filter(t => !t.done)
}
</script>

<style scoped>
.todo-app {
  max-width: 500px;
  margin: 2rem auto;
  font-family: sans-serif;
}

.input-section {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.todo-input {
  flex: 1;
  padding: 0.5rem;
  font-size: 1rem;
  border: 2px solid #ddd;
  border-radius: 4px;
}
.todo-input:focus { border-color: #42b883; outline: none; }

.btn-add {
  padding: 0.5rem 1rem;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.btn-add:disabled { background: #ccc; cursor: not-allowed; }

.filter-section {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
}

.btn-filter {
  padding: 0.3rem 0.8rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}
.btn-filter.active {
  background: #42b883;
  color: white;
  border-color: #42b883;
}

.count { margin-left: auto; color: #999; font-size: 0.9rem; }

.todo-list { list-style: none; padding: 0; }

.todo-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

.checkbox { cursor: pointer; }

.todo-text { flex: 1; cursor: pointer; }
.todo-text.done { text-decoration: line-through; color: #999; }

.btn-delete {
  opacity: 0;
  background: none;
  border: none;
  color: #e74c3c;
  cursor: pointer;
  font-size: 1rem;
}
.todo-item:hover .btn-delete { opacity: 1; }

.edit-input {
  flex: 1;
  padding: 0.3rem;
  border: 2px solid #42b883;
  border-radius: 4px;
}

.empty { text-align: center; color: #999; padding: 2rem; }

.stats-section { margin-top: 1rem; }

.progress-bar {
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
}
.progress {
  height: 100%;
  background: #42b883;
  transition: width 0.3s ease;
}

.batch-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.batch-actions button {
  padding: 0.3rem 0.8rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
.batch-actions button:disabled { color: #ccc; cursor: not-allowed; }

/* Transition animations */
.list-enter-active, .list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from { opacity: 0; transform: translateX(-20px); }
.list-leave-to { opacity: 0; transform: translateX(20px); }
</style>
```

## 👀 执行预览

**页面渲染效果：**

```
📝 Vue 3 Todo App

[What needs to be done?__________] [Add]

[All] [Active] [Completed]    2 items left

☑ Learn Vue 3 basics          (划线灰色)
☐ Build Todo app
☐ Deploy to production
                                    ✕ (hover显示)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
进度条: ████████░░░░░░░░ 33%
1 / 3 completed (33%)
[Mark all done]  [Clear completed (1)]
```

**操作演示：**
- 输入文字按Enter或点击Add添加
- 双击文字进入编辑模式，Enter保存，Esc取消
- 勾选checkbox标记完成
- 点击✕删除
- 切换过滤器查看不同状态
- 数据自动保存到localStorage


## ⚠️ 注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| localStorage大小 | ~5MB限制 | 大数据用IndexedDB |
| ID生成 | 使用递增数字或Date.now() | 生产环境用UUID |
| 编辑模式 | 双击进入编辑 | 添加blur事件自动保存 |
| transition-group | 需要key属性 | 列表动画必需 |
| computed缓存 | 过滤操作用computed | 避免每次渲染都过滤 |
| watch deep | 监听todos需要deep:true | 数组内对象变化也要触发 |

## 🚫 避坑指南

### 1. nextTick时机
❌ **错误：** `editingId = id; document.querySelector('.edit-input').focus()` → DOM还没更新
✅ **正确：** `editingId = id; nextTick(() => inputRef.value.focus())`

### 2. v-for中使用ref
❌ **错误：** `ref="editInput"` 在v-for中只获取最后一个
✅ **正确：** 使用函数ref或模板引用数组

### 3. 直接修改数组元素
❌ **错误：** 担心响应性，用splice替换整个数组
✅ **正确：** Vue 3的Proxy可以直接修改数组元素属性

### 4. 忘记trim
❌ **错误：** 用户输入空格也能添加todo
✅ **正确：** `v-model.trim` + `if (!text.trim()) return`

### 5. 进度条NaN
❌ **错误：** `totalCount`为0时 `0/0 = NaN`
✅ **正确：** `totalCount ? Math.round(done/total*100) : 0`

## 🧪 练习题

### 🟢 基础题
1. 给TodoItem添加创建时间显示（如"3分钟前"），用computed格式化。
2. 添加一个"撤销删除"功能，删除后显示3秒的撤销按钮。

### 🟡 进阶题
3. 将TodoApp拆分为子组件：TodoInput、TodoItem、TodoFilter、TodoStats，用Props和Events通信。
4. 实现拖拽排序功能（提示：使用SortableJS或原生drag API）。

### 🔴 挑战题
5. 将Todo应用升级为全栈：用Pinia管理状态，添加Node.js后端API（Express + SQLite），实现真正的持久化存储。

## 📝 知识点总结

```
Todo应用知识点
├── 状态管理
│   ├── todos数组 (ref)
│   ├── filter状态
│   └── editingId编辑状态
├── Computed派生
│   ├── filteredTodos (过滤)
│   ├── doneCount/leftCount (统计)
│   └── progressPercent (进度)
├── 事件处理
│   ├── addTodo (Enter/button)
│   ├── removeTodo (✕ button)
│   ├── startEdit (dblclick)
│   └── saveEdit/cancelEdit
├── 持久化
│   ├── watch deep监听
│   └── localStorage存取
├── 动画
│   ├── transition-group
│   └── list-enter/leave
└── 组件拆分
    ├── TodoInput
    ├── TodoItem
    ├── TodoFilter
    └── TodoStats
```


## 🔄 举一反三

| 概念 | 生活类比 | 说明 |
|------|---------|------|
| Todo应用 | 便签板 | 最小的完整应用，五脏俱全 |
| computed过滤 | 筛选器 | 不同视角看同一份数据 |
| localStorage | 抽屉 | 关掉页面数据还在 |
| nextTick | 等墨水干 | DOM更新完成后再操作 |
| transition | 动画特效 | 列表项进出的视觉反馈 |
| 双击编辑 | 双击重命名 | 桌面操作系统的经典交互 |
| 组件拆分 | 乐高拆解 | 大块拆小块，各自独立 |

## 📚 参考资料

1. [Vue 3 官方示例 - TodoMVC](https://vuejs.org/examples/#todomvc)
2. [Vue 3 Transition](https://vuejs.org/guide/built-ins/transition.html)
3. [localStorage MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
4. [TodoMVC](https://todomvc.com/)

## 🚀 代码演进

### v1 - 最简Todo（单组件，无持久化）

```vue
<template>
  <input v-model="text" @keyup.enter="add" />
  <ul><li v-for="t in todos" :key="t.id">{{ t.text }}</li></ul>
</template>
<script setup>
import { ref } from 'vue'
const text = ref('')
const todos = ref([])
let id = 0
function add() {
  if (!text.value) return
  todos.value.push({ id: id++, text: text.value })
  text.value = ''
}
</script>
```

### v2 - 完整功能（过滤/编辑/统计）

```vue
<!-- 添加done状态、过滤、双击编辑、统计 -->
<script setup>
import { ref, computed, watch } from 'vue'
const todos = ref(JSON.parse(localStorage.getItem('todos') || '[]'))
const filter = ref('all')
const filtered = computed(() => {
  if (filter.value === 'active') return todos.value.filter(t => !t.done)
  if (filter.value === 'done') return todos.value.filter(t => t.done)
  return todos.value
})
watch(todos, v => localStorage.setItem('todos', JSON.stringify(v)), { deep: true })
</script>
```

### v3 - 组件化 + Composables（推荐）

```vue
<!-- App.vue -->
<template>
  <TodoInput @add="todoStore.add" />
  <TodoFilter v-model="filter" />
  <TodoList :todos="filtered" @toggle="todoStore.toggle" @remove="todoStore.remove" />
  <TodoStats :total="total" :done="doneCount" />
</template>

<!-- composables/useTodoStore.js -->
export function useTodoStore() {
  const todos = ref(JSON.parse(localStorage.getItem('todos') || '[]'))
  watch(todos, v => localStorage.setItem('todos', JSON.stringify(v)), { deep: true })
  function add(text) { todos.value.push({ id: Date.now(), text, done: false }) }
  function remove(id) { todos.value = todos.value.filter(t => t.id !== id) }
  function toggle(id) { const t = todos.value.find(t => t.id === id); if (t) t.done = !t.done }
  return { todos, add, remove, toggle }
}
```