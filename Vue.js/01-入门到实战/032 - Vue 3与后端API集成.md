---
title: "032 - Vue 3与后端API集成"
slug: "032-api-integration"
category: "Vue.js入门到实战"
tech_stack: "Vue.js"
created_at: "2026-04-26T17:59:14.99+08:00"
updated_at: "2026-04-29T10:02:46.77+08:00"
reading_time: 26
tags: ["Vue.js", "Vue 3"]
---


## 难度标注
> **难度：🟡 中高级** | **前置知识：Vue 3、Composition API、HTTP 基础** | **预计学习时间：50 分钟**

## 概念讲解

### Vue 与后端 API 通信架构

前端应用与后端通信是全栈开发的核心环节。Vue 3 的 API 集成通常包含以下层次：

1. **HTTP 客户端层**：Axios 或 Fetch 封装
2. **API 模块层**：按业务划分的接口函数
3. **Composable 层**：封装请求状态（loading、error、data）
4. **组件层**：调用 Composable 获取数据

### 核心概念对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| Axios | 拦截器强大、取消请求、自动JSON | 额外依赖 | 大多数项目 |
| Fetch | 原生、无依赖 | 无拦截器、错误处理繁琐 | 简单场景 |
| Vue Query / SWR | 缓存、重试、自动刷新 | 学习曲线 | 数据密集型应用 |

## 脑图

```
API 集成
├── HTTP 客户端
│   ├── Axios 封装
│   ├── Fetch 封装
│   └── 拦截器
│       ├── Request (token注入)
│       └── Response (错误处理)
├── API 模块化
│   ├── 按业务拆分
│   ├── TypeScript 类型
│   └── RESTful 规范
├── 状态管理
│   ├── Loading 状态
│   ├── Error 处理
│   └── 数据缓存
├── 高级特性
│   ├── 请求取消
│   ├── 请求重试
│   ├── 并发请求
│   └── 文件上传
└── Composable 封装
    ├── useFetch()
    ├── usePagination()
    └── useFormSubmit()
```

## 完整代码

### Axios 封装

```ts
// src/utils/http.ts
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { useAuthStore } from '@/stores/auth'

// Create axios instance with base config
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor: inject auth token
http.interceptors.request.use(
  (config) => {
    const auth = useAuthStore()
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: unified error handling
http.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore()
      auth.logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Typed request helpers
export function get<T>(url: string, params?: object): Promise<T> {
  return http.get(url, { params })
}

export function post<T>(url: string, data?: object): Promise<T> {
  return http.post(url, data)
}

export function put<T>(url: string, data?: object): Promise<T> {
  return http.put(url, data)
}

export function del<T>(url: string): Promise<T> {
  return http.delete(url)
}

export default http
```

### API 模块

```ts
// src/api/user.ts
import { get, post, put, del } from '@/utils/http'

// Type definitions
export interface User {
  id: number
  name: string
  email: string
  avatar: string
  role: 'admin' | 'user'
  createdAt: string
}

export interface UserListParams {
  page: number
  pageSize: number
  keyword?: string
  role?: string
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// API functions
export const userApi = {
  getList: (params: UserListParams) =>
    get<PaginatedResponse<User>>('/users', params),

  getById: (id: number) =>
    get<User>(`/users/${id}`),

  create: (data: Partial<User>) =>
    post<User>('/users', data),

  update: (id: number, data: Partial<User>) =>
    put<User>(`/users/${id}`, data),

  delete: (id: number) =>
    del<void>(`/users/${id}`)
}
```

### 通用 Composable

```ts
// src/composables/useRequest.ts
import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

interface UseRequestOptions<T> {
  immediate?: boolean
  initialData?: T
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export function useRequest<T>(
  requestFn: () => Promise<T>,
  options: UseRequestOptions<T> = {}
) {
  const { immediate = false, initialData, onSuccess, onError } = options

  const data: Ref<T | undefined> = ref(initialData)
  const loading = ref(false)
  const error: Ref<Error | null> = ref(null)

  async function execute() {
    loading.value = true
    error.value = null
    try {
      data.value = await requestFn()
      onSuccess?.(data.value)
    } catch (err: any) {
      error.value = err
      onError?.(err)
      ElMessage.error(err.response?.data?.message || 'Request failed')
    } finally {
      loading.value = false
    }
  }

  if (immediate) execute()

  return { data, loading, error, execute, refresh: execute }
}
```

### 分页 Composable

```ts
// src/composables/usePagination.ts
import { ref, computed } from 'vue'
import { useRequest } from './useRequest'

interface PaginationParams {
  page: number
  pageSize: number
  [key: string]: any
}

export function usePagination<T>(
  fetchFn: (params: PaginationParams) => Promise<{ list: T[]; total: number }>,
  defaultPageSize = 10
) {
  const page = ref(1)
  const pageSize = ref(defaultPageSize)
  const total = ref(0)
  const filters = ref<Record<string, any>>({})

  // Computed params combining pagination and filters
  const params = computed(() => ({
    page: page.value,
    pageSize: pageSize.value,
    ...filters.value
  }))

  const { data, loading, execute } = useRequest(() =>
    fetchFn(params.value).then((res) => {
      total.value = res.total
      return res.list
    })
  )

  function changePage(p: number) {
    page.value = p
    execute()
  }

  function changeSize(size: number) {
    pageSize.value = size
    page.value = 1
    execute()
  }

  function setFilters(newFilters: Record<string, any>) {
    filters.value = newFilters
    page.value = 1
    execute()
  }

  return {
    data, loading, total, page, pageSize,
    changePage, changeSize, setFilters, refresh: execute
  }
}
```

### 组件中使用

```vue
<!-- src/views/UserList.vue -->
<template>
  <div class="user-list">
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="Search users..."
        @keyup.enter="handleSearch"
        style="width: 300px"
      />
      <el-button type="primary" @click="showCreateDialog = true">
        Add User
      </el-button>
    </div>

    <el-table :data="data" v-loading="loading" stripe>
      <el-table-column prop="name" label="Name" />
      <el-table-column prop="email" label="Email" />
      <el-table-column prop="role" label="Role">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : 'info'">
            {{ row.role }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="handleEdit(row)">Edit</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.id)">
            Delete
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      @current-change="changePage"
      @size-change="changeSize"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePagination } from '@/composables/usePagination'
import { userApi } from '@/api/user'
import { ElMessageBox } from 'element-plus'

const keyword = ref('')

const {
  data, loading, total, page, pageSize,
  changePage, changeSize, setFilters, refresh
} = usePagination(userApi.getList)

function handleSearch() {
  setFilters({ keyword: keyword.value })
}

async function handleDelete(id: number) {
  await ElMessageBox.confirm('Confirm delete this user?', 'Warning')
  await userApi.delete(id)
  refresh()
}

function handleEdit(user: any) {
  // Open edit dialog
}
</script>
```

## 执行预览

```
页面加载 → GET /api/users?page=1&pageSize=10
         → Response: { list: [...10 users], total: 42 }
         → 表格渲染 10 条数据 + 分页器显示 total=42

搜索 "alice" → GET /api/users?page=1&pageSize=10&keyword=alice
             → Response: { list: [...3 users], total: 3 }
             → 表格更新为 3 条

翻页到第2页 → GET /api/users?page=2&pageSize=10
            → Response: { list: [...10 users], total: 42 }

删除用户 → DELETE /api/users/5 → 200 OK → 自动 refresh
```

## 注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| Token 过期 | 401 自动跳转登录 | 拦截器统一处理 |
| 并发请求 | 多组件同时请求 | `Promise.all()` + loading 状态 |
| 请求取消 | 路由切换时 | `AbortController` 取消未完成请求 |
| 数据缓存 | 重复请求浪费 | 短期缓存或 Vue Query |
| CSRF | 跨站请求伪造 | Axios 自动携带 xsrf token |
| 文件上传 | Content-Type 不同 | `FormData` + `multipart/form-data` |
| 超时设置 | 默认可能太短 | 根据接口响应时间调整 |

## 避坑指南

- ❌ 每个组件都 `import axios` 直接调用 → ✅ 封装统一的 `http` 模块
- ❌ 在 `onMounted` 里直接写请求逻辑 → ✅ 封装 `useRequest` composable
- ❌ `loading` 和 `error` 状态手动管理 → ✅ composable 统一管理
- ❌ 分页参数散落在各处 → ✅ `usePagination` 集中管理
- ❌ 忽略错误提示 → ✅ 拦截器统一 Toast
- ❌ 路由切换不取消请求 → ✅ `onUnmounted` 取消 `AbortController`

## 练习题

### 🟢 基础
1. 封装一个 Axios 实例，添加请求和响应拦截器
2. 编写一个 `useRequest` composable，支持 loading/error 状态

### 🟡 进阶
3. 实现 `usePagination`，支持翻页、改页大小、筛选条件变化时重置到第1页
4. 实现请求取消：路由切换时自动取消未完成的 API 请求

### 🔴 挑战
5. 实现请求重试机制：网络错误自动重试 3 次，指数退避
6. 封装文件上传 composable：支持进度条、多文件、拖拽上传

## 知识点总结

```
API 集成知识树
├── HTTP 客户端
│   ├── Axios 实例化
│   ├── 请求拦截器 (token注入)
│   ├── 响应拦截器 (错误处理)
│   └── 类型化封装
├── API 模块化
│   ├── 按业务拆分文件
│   ├── 接口类型定义
│   └── RESTful 风格
├── Composable
│   ├── useRequest (基础)
│   ├── usePagination (分页)
│   └── useFormSubmit (表单)
├── 高级
│   ├── AbortController 取消
│   ├── 并发请求 Promise.all
│   └── 文件上传 FormData
└── 错误处理
    ├── 统一拦截
    ├── 业务错误码
    └── 网络错误重试
```

## 举一反三

| 场景 | 方案 | 关键代码 |
|------|------|----------|
| 列表页 | `usePagination` | page + pageSize + filters |
| 详情页 | `useRequest` + immediate | route.params.id 请求 |
| 表单提交 | `useRequest` + async | 提交后 refresh 列表 |
| 搜索 | `setFilters` + debounce | 防抖 300ms 后请求 |
| 无限滚动 | `useInfiniteScroll` | Intersection Observer + 追加数据 |
| 骨架屏 | `loading` 控制 | v-loading 或 Skeleton 组件 |
| 乐观更新 | 先更新 UI 再请求 | 失败时回滚 |

## 参考资料

- [Axios 官方文档](https://axios-http.com/)
- [Vue 3 数据获取指南](https://vuejs.org/guide/scaling-up/testing.html)
- [Vue Query (TanStack Query)](https://tanstack.com/query/)

## 代码演进

### v1 — 直接在组件中调用
```ts
// Raw axios call in component
onMounted(async () => {
  loading.value = true
  try {
    const { data } = await axios.get('/api/users')
    users.value = data
  } catch (err) {
    error.value = err
  } finally {
    loading.value = false
  }
})
```

### v2 — Composable 封装
```ts
// Reusable composable
const { data, loading, execute } = useRequest(() => userApi.getList(params))
```

### v3 — 生产级方案
```ts
// Pagination + filters + auto-cancel + cache
const { data, loading, total, changePage, setFilters } = usePagination(
  userApi.getList,
  { defaultPageSize: 20 }
)
// Auto-cancel on unmount via AbortController
// Cache with stale-while-revalidate pattern
```
