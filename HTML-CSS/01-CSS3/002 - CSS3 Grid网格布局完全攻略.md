---
title: "002 - CSS3 Grid网格布局完全攻略"
slug: "002-css3-grid-guide"
category: "CSS3"
tech_stack: "HTML-CSS"
created_at: "2026-04-26T10:21:12.745+08:00"
updated_at: "2026-04-29T10:02:45.948+08:00"
reading_time: 26
tags: ["前端"]
---

## 难度标注

> **难度等级：** ⭐⭐⭐（中级）
> **前置知识：** HTML基础、CSS选择器、Flexbox基础
> **预计学习时间：** 90-120分钟
> **适用场景：** 仪表盘、图片画廊、杂志排版、复杂二维页面布局

---

## 概念讲解

### 什么是CSS Grid？

CSS Grid Layout是CSS3引入的**二维布局系统**，可以**同时控制行和列**。如果说Flexbox是一维布局的最佳选择，那么Grid就是二维布局的王者。

**Grid vs Flexbox 核心区别：**

| 特性 | Flexbox | Grid |
|------|---------|------|
| 维度 | 一维（行或列） | 二维（行+列） |
| 内容驱动 | 项目大小由内容决定 | 布局由网格定义 |
| 适用场景 | 导航栏、工具栏、单行/列排列 | 复杂页面、仪表盘、图片墙 |
| 对齐方式 | 主轴/交叉轴 | 行轴/列轴 + 区域命名 |

### 核心概念

```
┌──── Grid Container ──────────────────┐
│  ┌─────┬─────┬─────┬─────┐          │
│  │ 1,1 │ 1,2 │ 1,3 │ 1,4 │ ← Row 1 │
│  ├─────┼─────┼─────┼─────┤          │
│  │ 2,1 │ 2,2 │ 2,3 │ 2,4 │ ← Row 2 │
│  └─────┴─────┴─────┴─────┘          │
│  ↑ Col1  ↑Col2  ↑Col3  ↑Col4        │
└──────────────────────────────────────┘
  Grid Line: 网格线（从1开始编号）
  Grid Track: 两条相邻网格线之间的空间（行轨道/列轨道）
  Grid Cell: 最小单元（行×列的交叉区域）
  Grid Area: 多个Cell组成的矩形区域
```

---

## 脑图（ASCII）

```
CSS Grid 网格布局
├── 容器属性
│   ├── grid-template-columns: 定义列
│   ├── grid-template-rows: 定义行
│   ├── grid-template-areas: 命名区域
│   ├── gap / row-gap / column-gap: 间距
│   ├── justify-items: 水平对齐(单元格)
│   ├── align-items: 垂直对齐(单元格)
│   ├── justify-content: 水平分布(整体)
│   ├── align-content: 垂直分布(整体)
│   └── grid-auto-flow: 排列方向 row | column | dense
├── 项目属性
│   ├── grid-column: start / end
│   ├── grid-row: start / end
│   ├── grid-area: 命名区域或简写
│   ├── justify-self: 单元格水平对齐
│   └── align-self: 单元格垂直对齐
├── 单位与函数
│   ├── fr: 弹性分数单位
│   ├── repeat(): 重复轨道定义
│   ├── minmax(): 最小最大值
│   ├── auto-fill / auto-fit: 自动填充
│   └── fit-content(): 内容适配
└── 经典布局
    ├── 响应式多列
    ├── 仪表盘
    ├── 杂志排版
    └── 全页布局(命名区域)
```

---

## 完整CSS代码

### 基础示例：定义网格

```html
<!-- Basic grid with 3 equal columns -->
<div class="grid-basic">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
  <div class="item">4</div>
  <div class="item">5</div>
  <div class="item">6</div>
</div>
```

```css
/* Define a 3-column grid */
.grid-basic {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* 3 equal columns */
  gap: 16px;                               /* space between cells */
  padding: 24px;
  background: #f8fafc;
  border-radius: 8px;
}

.grid-basic .item {
  padding: 32px;
  background: #3b82f6;
  color: white;
  text-align: center;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1.25rem;
}
```

### 实战案例1：响应式自适应列数

```css
/* Auto-fit columns: responsive without media queries! */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  padding: 24px;
}

.auto-grid .card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.auto-grid .card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}

.auto-grid .card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.auto-grid .card-body {
  padding: 16px;
}
```

### 实战案例2：命名区域全页布局

```css
/* Named grid areas for semantic layout */
.page-grid {
  display: grid;
  grid-template-areas:
    "header header header"
    "nav    main   aside"
    "nav    main   aside"
    "footer footer footer";
  grid-template-columns: 220px 1fr 180px;
  grid-template-rows: auto 1fr 1fr auto;
  min-height: 100vh;
  gap: 0;
}

/* Assign elements to grid areas */
.page-header  { grid-area: header; background: #1e293b; color: white; padding: 16px; }
.page-nav     { grid-area: nav;    background: #f1f5f9; padding: 20px; }
.page-main    { grid-area: main;   padding: 24px; }
.page-aside   { grid-area: aside;  background: #f1f5f9; padding: 20px; }
.page-footer  { grid-area: footer; background: #1e293b; color: white; padding: 16px; }

/* Mobile: single column */
@media (max-width: 768px) {
  .page-grid {
    grid-template-areas:
      "header"
      "nav"
      "main"
      "aside"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
}
```

### 实战案例3：仪表盘布局

```css
/* Dashboard with varied cell sizes */
.dashboard {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto repeat(3, 200px);
  gap: 16px;
  padding: 24px;
}

/* Stats row spans full width */
.dashboard .stats {
  grid-column: 1 / -1;              /* span all columns */
  display: flex;
  gap: 16px;
}

/* Chart takes 2 columns, 2 rows */
.dashboard .chart-main {
  grid-column: span 2;
  grid-row: span 2;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
}

/* Regular cells */
.dashboard .cell {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
}

/* Sidebar takes 1 column, 3 rows */
.dashboard .sidebar {
  grid-row: 2 / 5;
  background: #f8fafc;
  border-radius: 8px;
  padding: 20px;
}
```

---

## 执行预览

### repeat() 与 fr 效果

```
repeat(3, 1fr) →  3等分列
┌──────┬──────┬──────┐
│  1fr │  1fr │  1fr │
└──────┴──────┴──────┘

repeat(auto-fit, minmax(200px, 1fr)) → 自适应列数
宽屏(800px): ┌───┬───┬───┬───┐
             │   │   │   │   │
             └───┴───┴───┴───┘
窄屏(500px): ┌─────┬─────┐
             │     │     │
             └─────┴─────┘
```

### 命名区域可视化

```
┌──────────────────────────────────┐
│           header                 │
├──────┬───────────────────┬───────┤
│      │                   │       │
│ nav  │       main        │ aside │
│      │                   │       │
├──────┴───────────────────┴───────┤
│           footer                 │
└──────────────────────────────────┘
```

---

## 注意事项

| 属性/函数 | 注意点 | 建议 |
|-----------|--------|------|
| `fr` 单位 | 不能与 `auto` 混用在同一列中 | `auto` 列不参与fr分配 |
| `minmax()` | `min` 值不能大于 `max` | 浏览器会忽略无效的minmax |
| `auto-fill` vs `auto-fit` | fill保留空轨道，fit折叠空轨道 | 卡片布局用 `auto-fit` |
| `grid-column: span N` | 跨度不能超出网格定义 | 会隐式创建轨道 |
| `gap` | 可与margin共存 | gap是轨道间距，margin是项目外边距 |
| 嵌套网格 | 子网格不会继承父网格 | 子元素需重新设置 `display: grid` |
| `subgrid` | 现代浏览器支持 | 对齐子网格到父网格的轨道 |
| 隐式网格 | 超出定义的项目自动生成 | 用 `grid-auto-rows/columns` 控制 |

---

## 避坑指南

### ❌ 用固定px定义所有列

```css
/* ❌ Bad: not responsive */
grid-template-columns: 200px 200px 200px;
```

```css
/* ✅ Good: use fr for flexible layout */
grid-template-columns: repeat(3, 1fr);
```

### ❌ 用媒体查询控制列数

```css
/* ❌ Bad: manual breakpoints for every screen size */
@media (min-width: 768px)  { grid-template-columns: repeat(2, 1fr); }
@media (min-width: 1024px) { grid-template-columns: repeat(3, 1fr); }
@media (min-width: 1280px) { grid-template-columns: repeat(4, 1fr); }
```

```css
/* ✅ Good: auto-fit handles it automatically */
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
```

### ❌ 项目跨列时溢出

```css
/* ❌ Bad: span might overflow */
.item { grid-column: span 4; } /* but grid only has 3 columns */
```

```css
/* ✅ Good: span all columns with -1 */
.item { grid-column: 1 / -1; } /* always spans full width */
```

### ❌ 用Flexbox做Grid的事

```css
/* ❌ Bad: complex 2D layout with nested flex */
.flex-outer { display: flex; flex-direction: column; }
.flex-row { display: flex; }
.flex-row > * { flex: 1; }
```

```css
/* ✅ Good: Grid is designed for 2D */
.layout {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
```

---

## 练习题

### 🟢 初级

**1. 创建3×2等分网格**

要求：3列2行，每个格子等宽等高，间距16px。

<details>
<summary>参考答案</summary>

```css
.grid-3x2 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 16px;
  height: 400px;
}
```
</details>

**2. 让第一个项目横跨所有列**

<details>
<summary>参考答案</summary>

```css
.grid .item:first-child {
  grid-column: 1 / -1;
}
```
</details>

### 🟡 中级

**3. 实现自适应卡片网格**

要求：每张卡片最小宽度250px，自动适应列数，间距20px。不使用任何媒体查询。

<details>
<summary>参考答案</summary>

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}
```
</details>

**4. 实现命名区域布局**

要求：header跨全宽，sidebar在左(200px)，main在右，footer跨全宽。

<details>
<summary>参考答案</summary>

```css
.layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 200px 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.footer { grid-area: footer; }
```
</details>

### 🔴 高级

**5. 实现杂志排版布局**

要求：第一行一个hero占满全宽，第二行左侧大图跨2列，右侧两个小卡片堆叠，第三行三等分。

<details>
<summary>参考答案</summary>

```css
.magazine {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.hero { grid-column: 1 / -1; }
.featured { grid-column: span 2; grid-row: span 2; }
```
</details>

---

## 知识点总结

```
CSS Grid 知识体系
├── 1. 启用: display: grid / inline-grid
├── 2. 定义轨道
│   ├── grid-template-columns → 列定义
│   ├── grid-template-rows → 行定义
│   └── fr单位 → 弹性分数
├── 3. 重复与自适应
│   ├── repeat(n, size) → 重复轨道
│   ├── auto-fill → 填充轨道
│   ├── auto-fit → 填充并折叠
│   └── minmax(min, max) → 范围限制
├── 4. 区域
│   ├── grid-template-areas → 命名区域
│   └── grid-area → 项目分配区域
├── 5. 跨越
│   ├── grid-column: span N → 跨列
│   └── grid-row: span N → 跨行
├── 6. 对齐
│   ├── justify/align-items → 单元格内对齐
│   └── justify/align-content → 整体分布
└── 7. 间距: gap → 轨道间距
```

---

## 举一反三

| 需求场景 | 推荐方案 | 关键代码 |
|----------|----------|----------|
| 等宽多列 | `repeat(N, 1fr)` | 固定列数 |
| 自适应卡片 | `auto-fit + minmax` | 无媒体查询响应式 |
| 全页布局 | 命名区域 | `grid-template-areas` |
| 仪表盘 | span跨行/列 | `grid-column: span 2` |
| 图片画廊 | `auto-fill` | 保留空位，对齐整齐 |
| 侧边栏+内容 | 固定+弹性列 | `200px 1fr` |
| 瀑布流 | Grid + `grid-auto-rows` + `dense` | `grid-auto-flow: dense` |

---

## 参考资料

- [MDN - CSS Grid Layout](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_grid_layout)
- [CSS Tricks - Complete Guide to CSS Grid](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Grid Garden](https://cssgridgarden.com/) — 交互式Grid学习游戏
- [Can I Use - CSS Grid](https://caniuse.com/css-grid) — 浏览器兼容性

---

## 代码演进

### v1 — 固定网格（入门）

```css
/* v1: Simple 3-column grid */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}
```

### v2 — 响应式自适应（进阶）

```css
/* v2: Auto-fit responsive grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
```

### v3 — 命名区域全页布局（实战）

```css
/* v3: Named areas with responsive fallback */
.page {
  display: grid;
  grid-template-areas:
    "header header header"
    "nav    main   aside"
    "footer footer footer";
  grid-template-columns: 220px 1fr 180px;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
@media (max-width: 768px) {
  .page {
    grid-template-areas: "header" "nav" "main" "aside" "footer";
    grid-template-columns: 1fr;
  }
}
```
