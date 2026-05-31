---
title: "020 - Pinia进阶：Getters与Actions"
slug: "020-pinia-advanced"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:44:16.813+08:00"
updated_at: "2026-04-29T10:02:46.654+08:00"
reading_time: 28
tags: ["Vue.js", "Vue 3"]
---

# 058-Pinia进阶：Getters与Actions

> 📌 **难度标注**：⭐⭐⭐ 中高级（需要掌握 Pinia 基础用法）

## 一、概念讲解

### Getters 进阶

- **接受参数**：通过返回函数实现（注意：不被缓存）
- **引用其他 Getter**：通过 `this` 访问同一 Store 的其他 Getter
- **引用其他 Store**：在 Getter 中使用另一个 Store 的数据

### Actions 进阶

- **统一入口**：同步和异步都在 Actions 中处理
- **组合调用**：一个 Action 可以调用另一个 Action
- **错误处理**：在 Action 中 try/catch，或通过 `$onAction` 全局捕获
- **Store 间协作**：直接在 Action 中调用其他 Store

### 插件机制

Pinia 插件是一个函数，在每个 Store 创建时执行，可以添加新功能、监听变化、实现持久化等。

## 二、脑图

```
Pinia 进阶
├── Getters 进阶
│   ├── 参数化 Getter (返回函数)
│   ├── 引用其他 Getter (this.xxx)
│   ├── 引用其他 Store
│   └── 缓存机制
├── Actions 进阶
│   ├── async/await 异步
│   ├── 调用其他 Action
│   ├── 调用其他 Store
│   ├── $onAction 全局监听
│   └── 错误处理策略
├── Store 组合模式
│   ├── 扁平 Store (各自独立)
│   ├── 组合函数 (Composables)
│   └── Store 内引用 Store
├── 插件系统
│   ├── PiniaPlugin 函数
│   ├── $subscribe 监听 state
│   ├── $onAction 监听 action
│   └── 常用插件: 持久化/日志
└── 性能优化
    ├── storeToRefs 避免多余渲染
    ├── $patch 批量更新
    └── computed 缓存
```

## 三、完整代码

```javascript
// stores/products.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useProductStore = defineStore('products', () => {
  const products = ref([
    { id: 1, name: 'Vue 实战', price: 89, category: '前端', stock: 10 },
    { id: 2, name: 'Node.js 指南', price: 69, category: '后端', stock: 5 },
    { id: 3, name: 'TypeScript 入门', price: 59, category: '前端', stock: 0 },
    { id: 4, name: 'Docker 实践', price: 79, category: '运维', stock: 8 },
    { id: 5, name: 'React 精讲', price: 99, category: '前端', stock: 3 }
  ])
  const searchQuery = ref('')
  const selectedCategory = ref('all')
  const loading = ref(false)
  const error = ref(null)

  // Basic getters
  const inStockProducts = computed(() =>
    products.value.filter(p => p.stock > 0)
  )
  
  const categories = computed(() =>
    [...new Set(products.value.map(p => p.category))]
  )

  // Parameterized getter (NOT cached)
  const getProductById = computed(() => {
    return (id) => products.value.find(p => p.id === id)
  })

  // Chained getters
  const filteredProducts = computed(() => {
    let result = inStockProducts.value
    if (selectedCategory.value !== 'all') {
      result = result.filter(p => p.category === selectedCategory.value)
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q))
    }
    return result
  })

  const averagePrice = computed(() => {
    const list = filteredProducts.value
    if (!list.length) return 0
    return Math.round(list.reduce((s, p) => s + p.price, 0) / list.length)
  })

  async function fetchProducts() {
    loading.value = true
    error.value = null
    try {
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  function setSearch(query) { searchQuery.value = query }
  function setCategory(category) { selectedCategory.value = category }

  return {
    products, searchQuery, selectedCategory, loading, error,
    inStockProducts, categories, getProductById,
    filteredProducts, averagePrice,
    fetchProducts, setSearch, setCategory
  }
})
```

```javascript
// stores/cart.js - Cross-store collaboration
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useProductStore } from './products'

export const useCartStore = defineStore('cart', () => {
  const items = ref([]) // { productId, quantity }

  const productStore = useProductStore()

  const cartItems = computed(() =>
    items.value.map(item => {
      const product = productStore.getProductById(item.productId)
      return { ...product, quantity: item.quantity }
    }).filter(item => item.name)
  )

  const totalCount = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  const totalPrice = computed(() =>
    cartItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  const isEmpty = computed(() => items.value.length === 0)

  function addToCart(productId) {
    const existing = items.value.find(i => i.productId === productId)
    if (existing) existing.quantity++
    else items.value.push({ productId, quantity: 1 })
  }

  function removeFromCart(productId) {
    items.value = items.value.filter(i => i.productId !== productId)
  }

  function updateQuantity(productId, quantity) {
    const item = items.value.find(i => i.productId === productId)
    if (item) {
      if (quantity <= 0) removeFromCart(productId)
      else item.quantity = quantity
    }
  }

  async function checkout() {
    if (isEmpty.value) return false
    try {
      await new Promise(r => setTimeout(r, 1000))
      items.value = []
      return true
    } catch (e) {
      console.error('Checkout failed:', e)
      return false
    }
  }

  return {
    items, cartItems, totalCount, totalPrice, isEmpty,
    addToCart, removeFromCart, updateQuantity, checkout
  }
})
```

```javascript
// plugins/pinia-logger.js - Custom plugin
export function piniaLogger({ store }) {
  store.$onAction(({ name, args, after, onError }) => {
    const startTime = Date.now()
    console.log(`[${store.$id}] Action "${name}" started`)

    after((result) => {
      console.log(`[${store.$id}] Action "${name}" finished in ${Date.now() - startTime}ms`)
    })

    onError((error) => {
      console.error(`[${store.$id}] Action "${name}" failed:`, error)
    })
  })

  store.$subscribe((mutation, state) => {
    console.log(`[${store.$id}] State changed:`, mutation.type)
  })
}
```

```vue
<!-- components/ProductList.vue -->
<template>
  <div>
    <h2>商品列表</h2>
    <div class="filters">
      <input v-model="productStore.searchQuery" placeholder="搜索商品..." />
      <select v-model="productStore.selectedCategory">
        <option value="all">全部分类</option>
        <option v-for="cat in productStore.categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
    </div>
    <p>共 {{ productStore.filteredProducts.length }} 件，均价 ¥{{ productStore.averagePrice }}</p>
    <div class="grid">
      <div v-for="product in productStore.filteredProducts" :key="product.id" class="card">
        <h3>{{ product.name }}</h3>
        <p>¥{{ product.price }} | 库存：{{ product.stock }}</p>
        <button @click="cartStore.addToCart(product.id)" :disabled="product.stock === 0">
          加入购物车
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useProductStore } from '../stores/products'
import { useCartStore } from '../stores/cart'
const productStore = useProductStore()
const cartStore = useCartStore()
</script>
```

```vue
<!-- components/ShoppingCart.vue -->
<template>
  <div>
    <h2>购物车 ({{ cartStore.totalCount }}件)</h2>
    <div v-if="cartStore.isEmpty">购物车是空的</div>
    <div v-else>
      <div v-for="item in cartStore.cartItems" :key="item.productId">
        <span>{{ item.name }}</span>
        <span>¥{{ item.price }} x {{ item.quantity }}</span>
        <button @click="cartStore.updateQuantity(item.productId, item.quantity + 1)">+</button>
        <button @click="cartStore.updateQuantity(item.productId, item.quantity - 1)">-</button>
        <button @click="cartStore.removeFromCart(item.productId)">删除</button>
      </div>
      <p><strong>总计：¥{{ cartStore.totalPrice }}</strong></p>
      <button @click="handleCheckout">结算</button>
    </div>
  </div>
</template>

<script setup>
import { useCartStore } from '../stores/cart'
const cartStore = useCartStore()
const handleCheckout = async () => {
  const ok = await cartStore.checkout()
  alert(ok ? '下单成功！' : '下单失败')
}
</script>
```

## 四、执行预览

```
商品列表：
  搜索 "Vue" -> 显示 Vue 实战
  分类 "前端" -> 显示 Vue实战, TypeScript入门, React精讲
  点击 "加入购物车" -> 购物车数量 +1

购物车：
  显示商品名、单价x数量
  +/- 调整数量
  总计实时计算
  结算 -> 异步操作 -> 清空购物车

控制台（插件日志）：
  [cart] Action "addToCart" started
  [cart] State changed: direct
  [cart] Action "addToCart" finished in 2ms
```

## 五、注意事项

| 场景 | 注意事项 | 推荐做法 |
|------|---------|---------|
| 参数化 Getter | 每次返回新函数，无缓存 | 仅动态参数时使用 |
| 跨 Store 引用 | 避免循环依赖 | A依赖B可以，不要A<->B |
| Action 错误 | 未捕获会静默失败 | 使用 $onAction 全局监听 |
| 插件注册 | 必须在 app.use(pinia) 之前 | pinia.use(plugin) -> app.use(pinia) |
| $subscribe | 默认组件卸载后停止 | { detached: true } 保持监听 |
| 大列表过滤 | computed 缓存但大数据仍需注意 | 虚拟滚动 + 分页 |

## 六、避坑指南

### ❌ 坑1：参数化 Getter 滥用

```javascript
// ❌ 每次访问创建新函数，无缓存
const getProductsByCategory = computed(() => 
  (category) => products.value.filter(p => p.category === category)
)

// ✅ 用 state 存筛选条件
const filterCategory = ref('all')
const filteredProducts = computed(() => 
  filterCategory.value === 'all' 
    ? products.value 
    : products.value.filter(p => p.category === filterCategory.value)
)
```

### ❌ 坑2：Store 循环依赖

```javascript
// ❌ storeA 和 storeB 互相引用
// storeA.js - top level
const b = useStoreB() // Error if B also imports A

// ✅ 在 action 中延迟获取
function doSomething() {
  const b = useStoreB()
  b.someAction()
}
```

### ❌ 坑3：$patch 浅合并

```javascript
// ❌ $patch 对象是浅合并
store.$patch({ user: { name: 'New' } }) // Replaces entire user!

// ✅ 使用函数式 $patch
store.$patch((state) => { state.user.name = 'New' })
```

## 七、练习题

### 🟢 入门：带搜索的用户列表
创建 UserStore，实现按姓名搜索、按角色过滤、添加/删除用户。

### 🟡 进阶：跨 Store 权限系统
创建 AuthStore + PermissionStore，登录后获取可访问路由列表。

### 🔴 挑战：实现持久化插件
不使用第三方库，实现 Pinia 插件将指定 Store 的 state 保存到 localStorage。

## 八、知识点总结

```
Pinia 进阶
├── Getters
│   ├── 基础 computed -> 缓存
│   ├── 参数化 -> 返回函数(不缓存)
│   ├── 链式 -> 引用其他 getter
│   └── 跨 Store -> useOtherStore()
├── Actions
│   ├── 同步/异步统一
│   ├── this 访问 state/getters
│   ├── 跨 Store 调用
│   └── 错误处理
├── 插件
│   ├── pinia.use(pluginFn)
│   ├── store.$onAction()
│   └── store.$subscribe()
└── 模式
    ├── 扁平 Store
    ├── 组合函数封装
    └── Store->Store 引用(避免循环)
```

## 九、举一反三

| 模式 | 适用场景 | 优势 |
|------|---------|------|
| 参数化 Getter | 按ID查找、动态过滤 | 灵活传参 |
| 跨 Store 引用 | 购物车依赖商品数据 | 数据单一来源 |
| 插件 | 日志、持久化、权限 | 一次编写全局受益 |
| $subscribe | 自动保存、WebSocket同步 | 响应式监听 |
| $patch批量更新 | 表单一次修改多字段 | 减少渲染次数 |
| $onAction | API统计、错误上报 | 集中式监控 |

## 十、参考资料

- [Pinia 官方文档 - Getters](https://pinia.vuejs.org/zh/core-concepts/getters.html)
- [Pinia 官方文档 - Actions](https://pinia.vuejs.org/zh/core-concepts/actions.html)
- [Pinia 官方文档 - 插件](https://pinia.vuejs.org/zh/core-concepts/plugins.html)

## 十一、代码演进

### v1：基础 Store + Getter
```javascript
export const useProductStore = defineStore('products', () => {
  const products = ref([])
  const inStock = computed(() => products.value.filter(p => p.stock > 0))
  return { products, inStock }
})
```

### v2：搜索 + 跨 Store
```javascript
export const useProductStore = defineStore('products', () => {
  const getById = computed(() => (id) => products.value.find(p => p.id === id))
  return { products, getById }
})

export const useCartStore = defineStore('cart', () => {
  const products = useProductStore()
  const cartItems = computed(() => 
    items.value.map(i => ({ ...products.getById(i.productId), qty: i.qty }))
  )
  return { cartItems }
})
```

### v3：插件 + 持久化
```javascript
const pinia = createPinia()
pinia.use(({ store }) => {
  const saved = localStorage.getItem(store.$id)
  if (saved) store.$patch(JSON.parse(saved))
  store.$subscribe((_, state) => {
    localStorage.setItem(store.$id, JSON.stringify(state))
  })
})
app.use(pinia)
```

> 💡 **总结**：Pinia 进阶核心是理解 Getter 缓存机制、Action 异步处理与跨 Store 协作。善用插件系统可将横切关注点从业务代码中抽离。
