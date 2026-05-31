---
title: "006 - CSS3 Grid网格布局完全指南"
slug: "006-css3-grid"
category: "CSS3"
tech_stack: "HTML-CSS"
created_at: "2026-04-26T10:39:37.165+08:00"
updated_at: "2026-04-29T10:02:45.981+08:00"
reading_time: 31
tags: []
---


## 难度标注

> **难度：** ⭐⭐⭐⭐ 中高级
> **前置知识：** CSS盒模型、Flexbox基础
> **预计学习时间：** 60-80分钟

---

## 一、概念讲解

### 什么是CSS Grid？

CSS Grid Layout是CSS3引入的**二维布局系统**，可以同时控制行和列。如果说Flexbox是一维布局（一次管一个方向），Grid就是二维布局（同时管行和列）。

### Grid vs Flexbox — 如何选择？

| 对比项 | Flexbox | Grid |
|--------|---------|------|
| 维度 | 一维（行或列） | 二维（行和列） |
| 内容驱动 | 项目大小由内容决定 | 布局驱动：先定义网格，再放内容 |
| 适用场景 | 导航栏、工具栏、单行/单列 | 复杂页面布局、仪表盘、图库 |
| 对齐 | 主轴+交叉轴 | 行轴+列轴，更精确 |
| 间距 | `gap` | `gap`、`grid-template-*` |

**经验法则：** 一维排列用Flexbox，二维网格用Grid。两者可以嵌套使用。

### 核心概念

```
Grid Container    — display: grid 的元素
Grid Item         — 直接子元素
Grid Line         — 网格线（虚拟的）
Grid Track        — 两条相邻线之间的空间（行或列）
Grid Cell         — 最小单元（一个格子）
Grid Area         — 由多条线围成的矩形区域
```

### 容器属性一览

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `grid-template-columns` | 定义列轨道 | `none` |
| `grid-template-rows` | 定义行轨道 | `none` |
| `grid-template-areas` | 命名区域布局 | `none` |
| `grid-auto-columns` | 隐式列大小 | `auto` |
| `grid-auto-rows` | 隐式行大小 | `auto` |
| `grid-auto-flow` | 自动放置方向 | `row` |
| `gap` / `row-gap` / `column-gap` | 间距 | `0` |
| `justify-items` | 单元格内水平对齐 | `stretch` |
| `align-items` | 单元格内垂直对齐 | `stretch` |
| `justify-content` | 网格整体水平对齐 | `stretch` |
| `align-content` | 网格整体垂直对齐 | `stretch` |

### 项目属性一览

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `grid-column-start` | 起始列线 | `auto` |
| `grid-column-end` | 结束列线 | `auto` |
| `grid-row-start` | 起始行线 | `auto` |
| `grid-row-end` | 结束行线 | `auto` |
| `grid-column` | start / end 简写 | `auto` |
| `grid-row` | start / end 简写 | `auto` |
| `grid-area` | 区域名或 row-start/column-start/row-end/column-end | `auto` |
| `justify-self` | 单项水平对齐 | `auto` |
| `align-self` | 单项垂直对齐 | `auto` |

### repeat() 和 minmax()

```css
/* Repeat 3 equal columns */
grid-template-columns: repeat(3, 1fr);

/* Auto-fill: as many 250px columns as fit */
grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));

/* Auto-fit: similar but collapses empty tracks */
grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
```

### fr 单位

`fr`（fraction）表示可用空间的等分份额：

```css
/* 1fr 1fr 2fr = 25% 25% 50% */
grid-template-columns: 1fr 1fr 2fr;

/* Mixed units */
grid-template-columns: 200px 1fr 1fr;  /* Fixed + fluid */
```

---

## 二、脑图（ASCII）

```
CSS Grid 网格布局
├── 基础概念
│   ├── Grid Container / Grid Item
│   ├── Grid Line (网格线)
│   ├── Grid Track (轨道)
│   ├── Grid Cell (单元格)
│   └── Grid Area (区域)
├── 定义网格
│   ├── grid-template-columns/rows
│   ├── repeat() 函数
│   ├── minmax() 函数
│   ├── fr 单位
│   └── auto-fill / auto-fit
├── 放置项目
│   ├── 线号定位 (1-based)
│   ├── span 关键字
│   ├── grid-template-areas (命名区域)
│   └── grid-area 简写
├── 对齐系统
│   ├── justify-items / align-items
│   ├── justify-content / align-content
│   ├── justify-self / align-self
│   └── place-* 简写
├── 隐式网格
│   ├── grid-auto-rows/columns
│   └── grid-auto-flow (row/column/dense)
└── 高级特性
    ├── subgrid (子网格)
    ├── 命名网格线
    └── 响应式 auto-fill/minmax
```

---

## 三、完整CSS代码 — Grid布局实战

```css
/* ===== 1. Basic Grid Layout ===== */
.basic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  gap: 20px;
}

/* ===== 2. Page Layout with Named Areas ===== */
.page-layout {
  display: grid;
  /* Mobile: single column */
  grid-template-areas:
    "header"
    "sidebar"
    "main"
    "footer";
  grid-template-columns: 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
  gap: 0;
}

.page-layout__header  { grid-area: header; }
.page-layout__sidebar { grid-area: sidebar; }
.page-layout__main    { grid-area: main; }
.page-layout__footer  { grid-area: footer; }

@media (min-width: 768px) {
  .page-layout {
    grid-template-areas:
      "header  header  header"
      "sidebar main    main"
      "footer  footer  footer";
    grid-template-columns: 250px 1fr;
    grid-template-rows: auto 1fr auto;
  }
}

/* ===== 3. Responsive Auto-Fill Grid ===== */
.auto-grid {
  display: grid;
  /* Auto-fill: columns >= 280px, grow to fill */
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.auto-grid__item {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ===== 4. Dashboard Layout ===== */
.dashboard {
  display: grid;
  grid-template-columns: 240px repeat(3, 1fr);
  grid-template-rows: 56px 1fr 1fr 48px;
  grid-template-areas:
    "nav    nav    nav    nav"
    "aside  chart  chart  stats"
    "aside  table  table  stats"
    "footer footer footer footer";
  min-height: 100vh;
  gap: 1px;
  background: #e0e0e0;  /* Gap color */
}

.dashboard > * {
  background: white;
}

.dashboard__nav    { grid-area: nav; }
.dashboard__aside  { grid-area: aside; }
.dashboard__chart  { grid-area: chart; }
.dashboard__table  { grid-area: table; }
.dashboard__stats  { grid-area: stats; }
.dashboard__footer { grid-area: footer; }

@media (max-width: 992px) {
  .dashboard {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 56px auto auto auto 48px;
    grid-template-areas:
      "nav    nav"
      "chart  chart"
      "table  table"
      "stats  stats"
      "footer footer";
  }
  .dashboard__aside { display: none; }
}

/* ===== 5. Overlap Layout (Magazine Style) ===== */
.magazine {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 200px);
  gap: 16px;
}

.magazine__hero {
  grid-column: 1 / 3;  /* Span 2 columns */
  grid-row: 1 / 3;     /* Span 2 rows */
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px;
  color: white;
  padding: 32px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.magazine__side {
  grid-column: 3 / 5;
  background: #2c3e50;
  border-radius: 12px;
  color: white;
  padding: 24px;
}

.magazine__item {
  background: #ecf0f1;
  border-radius: 12px;
  padding: 24px;
}

/* ===== 6. Full-Bleed Layout ===== */
.full-bleed {
  display: grid;
  grid-template-columns:
    1fr
    min(65ch, 100%)
    1fr;
}

/* Content stays in the center column */
.full-bleed > * {
  grid-column: 2;
}

/* Full-bleed elements break out */
.full-bleed__wide {
  grid-column: 1 / -1;
}

/* Left-bleed */
.full-bleed__left {
  grid-column: 1 / 2;
}

/* ===== 7. Implicit Grid with auto-rows ===== */
.masonry-like {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  grid-auto-rows: 10px;  /* Small row unit */
  gap: 16px;
}

.masonry-like__item {
  /* Calculate span based on content height */
  /* row-span needs JS or fixed heights */
  background: white;
  border-radius: 8px;
  overflow: hidden;
}
```

```html
<!-- Dashboard Example -->
<div class="dashboard">
  <nav class="dashboard__nav">Navigation</nav>
  <aside class="dashboard__aside">Sidebar Menu</aside>
  <section class="dashboard__chart">Chart Area</section>
  <section class="dashboard__table">Data Table</section>
  <aside class="dashboard__stats">Statistics</aside>
  <footer class="dashboard__footer">Footer</footer>
</div>
```

---

## 四、执行预览

```
Dashboard Layout (Desktop):
┌────────────────────────────────────────────────┐
│                  Navigation (56px)              │
├─────────┬──────────────────────┬───────────────┤
│         │                      │               │
│ Sidebar │     Chart Area       │   Statistics  │
│ (240px) │                      │               │
│         ├──────────────────────┤               │
│         │                      │               │
│         │     Data Table       │               │
│         │                      │               │
├─────────┴──────────────────────┴───────────────┤
│                    Footer (48px)                │
└────────────────────────────────────────────────┘

Magazine Layout:
┌──────────────┬──────────────┐
│              │    Side      │
│    Hero      ├──────────────┤
│              │    Item      │
├──────┬───────┼──────┬───────┤
│Item  │ Item  │Item  │ Item  │
└──────┴───────┴──────┴───────┘
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 网格线编号 | 从1开始，不是0 | 第1条线 = 1，最后一条 = -1 |
| `fr` 不能和 `%` 在同一轨道混用 | 计算复杂 | 统一用 `fr` 或统一用 `%` |
| `auto-fill` vs `auto-fit` | fill保留空轨道，fit折叠 | 多数场景用 `auto-fill` |
| 隐式网格 | 项目超出定义范围时自动创建 | 用 `grid-auto-rows` 控制大小 |
| `subgrid` 兼容性 | Chrome 117+, Firefox 71+ | 降级方案用 `inherit` |
| `gap` 不折叠 | 与 margin 不同，gap 不会折叠 | 嵌套grid注意累积间距 |

---

## 六、避坑指南

### ❌ 网格线编号从0开始
```css
/* ❌ Bad: line numbering starts at 1 */
.item { grid-column: 0 / 2; }
```
```css
/* ✅ Good: lines are 1-indexed */
.item { grid-column: 1 / 3; }
```

### ❌ auto-fill 和 auto-fit 分不清
```css
/* auto-fill: creates empty tracks */
grid-template-columns: repeat(auto-fill, 200px);
/* Result: [200] [200] [200] [empty] [empty] */

/* auto-fit: collapses empty tracks */
grid-template-columns: repeat(auto-fit, 200px);
/* Result: [200] [200] [200] — items stretch */
```
```css
/* ✅ Good: auto-fill for most responsive grids */
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
```

### ❌ 以为 grid-area 只能配合 grid-template-areas
```css
/* ❌ Limited: only using named areas */
.item { grid-area: my-area; }
```
```css
/* ✅ Good: grid-area is also a shorthand */
/* grid-area: row-start / col-start / row-end / col-end */
.item { grid-area: 1 / 1 / 3 / 4; }  /* Same as grid-row: 1/3; grid-column: 1/4; */
```

### ❌ 子元素脱离网格流
```css
/* ❌ Bad: absolute/fixed positioned items leave the grid */
.grid-child {
  position: absolute;  /* No longer participates in grid */
}
```
```css
/* ✅ Good: use grid placement or alignment */
.grid-child {
  align-self: center;
  justify-self: center;
}
```

---

## 七、练习题

### 🟢 入门题

**1.** 创建一个3列等宽、间距20px的Grid容器。

**2.** 让某个项目跨2列（从第2列到第3列）。

### 🟡 进阶题

**3.** 用 `grid-template-areas` 实现经典页面布局（Header/Sidebar/Main/Footer）。

**4.** 用 `auto-fill` + `minmax()` 实现响应式卡片网格，最小宽度300px。

### 🔴 挑战题

**5.** 实现杂志风格的非对称布局：一个英雄区跨2行2列，其余小卡片各占1格。

**6.** 用Grid实现全出血（full-bleed）布局：内容区域限宽 `65ch`，图片和引言可以突破到全宽。

---

## 八、知识点总结（树状）

```
CSS Grid
├── 基础
│   ├── display: grid / inline-grid ★★★
│   ├── grid-template-columns/rows ★★★
│   ├── fr 单位 ★★★
│   ├── gap ★★★
│   └── 网格线编号 (1-based) ★★★
├── 函数
│   ├── repeat() ★★★
│   ├── minmax() ★★★
│   ├── min() / max() ★★☆
│   └── fit-content() ★★☆
├── 自动行为
│   ├── auto-fill ★★★
│   ├── auto-fit ★★☆
│   ├── grid-auto-rows/columns ★★☆
│   └── grid-auto-flow (dense) ★★☆
├── 放置
│   ├── 线号定位 ★★★
│   ├── span 关键字 ★★★
│   ├── grid-template-areas ★★★
│   ├── grid-area 简写 ★★★
│   └── 命名线 ★★☆
├── 对齐
│   ├── justify-items / align-items ★★☆
│   ├── justify-content / align-content ★★☆
│   ├── place-items / place-content ★★☆
│   └── *-self ★★☆
└── 高级
    ├── subgrid ★★☆
    ├── full-bleed pattern ★★☆
    └── magazine layout ★★☆
```

---

## 九、举一反三

| 场景 | Grid方案 | 关键属性 |
|------|----------|----------|
| 响应式卡片网格 | `auto-fill + minmax()` | 自适应列数 |
| 页面整体布局 | `grid-template-areas` | 可视化布局定义 |
| 仪表盘 | 多轨道 + 命名区域 | 精确控制每格 |
| 杂志排版 | `span` 跨行跨列 | 非对称布局 |
| 全出血内容 | 三列 `1fr min(65ch,100%) 1fr` | 内容居中+突破 |
| 瀑布流(伪) | `grid-auto-rows: small + span` | JS配合计算高度 |
| 粘性页脚 | `grid-template-rows: auto 1fr auto` | 一行搞定 |

---

## 十、参考资料

1. [MDN — CSS Grid Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
2. [CSS-Tricks — A Complete Guide to CSS Grid](https://css-tricks.com/snippets/css/complete-guide-grid/)
3. [Grid Garden](https://cssgridgarden.com/) — 互动学习游戏
4. [W3C — CSS Grid Layout Level 1](https://www.w3.org/TR/css-grid-1/)
5. [Grid by Example](https://gridbyexample.com/) — Rachel Andrew

---

## 十一、代码演进

### v1 — 固定列Grid

```css
.layout {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
  grid-template-rows: 60px 1fr 40px;
  gap: 16px;
  min-height: 100vh;
}
```

**问题：** 不响应式，移动端体验差。

### v2 — 响应式 auto-fill

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

**改进：** 响应式自适应，但只有卡片网格，缺少页面级布局。

### v3 — 完整Grid布局系统（本文最终版）

```css
/* Key improvements:
   1. Named areas for visual layout definition
   2. Responsive breakpoints with area reassignment
   3. Dashboard with precise grid placement
   4. Magazine layout with span
   5. Full-bleed pattern for content sites
   6. auto-fill + minmax for card grids
*/
```

**改进：** 生产级Grid布局系统，覆盖从简单卡片网格到复杂仪表盘的所有场景。

---

## 十二、总结

CSS Grid是CSS布局的终极武器，特别适合二维复杂布局。与Flexbox互补使用，Grid管整体页面结构，Flexbox管组件内部排列。

核心要记：
- ✅ `fr` 按比例分配可用空间
- ✅ `repeat(auto-fill, minmax(280px, 1fr))` 响应式网格一行搞定
- ✅ `grid-template-areas` 让布局一目了然
- ✅ 网格线从 **1** 开始，`-1` 是最后一条
- ✅ `gap` 做间距，不用 margin
- ✅ Grid + Flexbox 组合拳：Grid管宏观，Flexbox管微观
