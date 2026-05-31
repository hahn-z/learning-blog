---
title: "001 - CSS3 Flexbox弹性布局从入门到精通"
slug: "001-css3-flexbox-guide"
category: "CSS3"
tech_stack: "HTML-CSS"
created_at: "2026-04-26T10:22:37.323+08:00"
updated_at: "2026-04-29T10:02:45.94+08:00"
reading_time: 26
tags: ["前端"]
---

## 难度标注

> **难度等级：** ⭐⭐（初级→中级）
> **前置知识：** HTML基础、CSS选择器与盒模型
> **预计学习时间：** 60-90分钟
> **适用场景：** 导航栏、卡片列表、居中布局、侧边栏、圣杯布局等一维排列场景

---

## 概念讲解

### 什么是Flexbox？

Flexbox（Flexible Box Layout，弹性盒布局）是CSS3引入的一种**一维布局模型**，专门解决以下痛点：

- **垂直居中**：不再需要各种hack（line-height、table-cell、负margin）
- **等分空间**：容器内项目自动分配剩余空间
- **顺序控制**：不改变DOM顺序即可调整视觉排列
- **弹性伸缩**：项目根据可用空间自动放大或缩小

### 核心概念：容器与项目

采用Flex布局的元素称为**Flex容器（Container）**，其**直接子元素**称为**Flex项目（Item）**。

```
┌─────────── Flex Container ───────────┐
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐ │
│  │Item1│  │Item2│  │Item3│  │Item4│ │
│  └─────┘  └─────┘  └─────┘  └─────┘ │
└──────────────────────────────────────┘
```

### 主轴与交叉轴

Flex布局有两条轴：

- **主轴（Main Axis）**：项目排列的方向，默认水平从左到右
- **交叉轴（Cross Axis）**：垂直于主轴的方向

```
         Main Axis (flex-direction: row) →
    ┌──────────────────────────────────┐ ↑
    │   [Item1] [Item2] [Item3]       │ │ Cross Axis
    │                                  │ │
    └──────────────────────────────────┘ ↓
```

---

## 脑图（ASCII）

```
Flexbox 弹性布局
├── 容器属性 (Container)
│   ├── display: flex | inline-flex
│   ├── flex-direction: row | column | row-reverse | column-reverse
│   ├── flex-wrap: nowrap | wrap | wrap-reverse
│   ├── justify-content: flex-start | center | space-between | space-around | space-evenly
│   ├── align-items: stretch | flex-start | flex-end | center | baseline
│   ├── align-content: flex-start | center | space-between | stretch
│   └── gap: <length>
├── 项目属性 (Item)
│   ├── order: <integer>
│   ├── flex-grow: <number>
│   ├── flex-shrink: <number>
│   ├── flex-basis: <length> | auto
│   ├── flex: grow shrink basis (shorthand)
│   └── align-self: auto | flex-start | flex-end | center | stretch
└── 经典布局
    ├── 完美居中
    ├── 等分导航
    ├── 侧边栏布局
    ├── 圣杯布局
    └── 粘性页脚
```

---

## 完整CSS代码

### 基础示例：Flex容器与项目

```html
<!-- Basic flex container with items -->
<div class="flex-basic">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>
```

```css
/* Enable flex layout */
.flex-basic {
  display: flex;           /* children become flex items */
  flex-direction: row;     /* left to right (default) */
  gap: 12px;               /* space between items */
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

/* Base item style */
.flex-basic .item {
  padding: 20px 32px;
  background: #3b82f6;
  color: white;
  border-radius: 6px;
  font-weight: 600;
}
```

### 实战案例1：完美居中

```css
/* Perfect centering — the classic Flexbox use case */
.perfect-center {
  display: flex;
  justify-content: center;   /* horizontal center */
  align-items: center;       /* vertical center */
  height: 100vh;             /* full viewport height */
}

.perfect-center .box {
  padding: 40px 60px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}
```

### 实战案例2：响应式卡片网格

```css
/* Responsive card grid using flex-wrap */
.card-grid {
  display: flex;
  flex-wrap: wrap;           /* allow items to wrap */
  gap: 24px;
  padding: 24px;
}

.card {
  flex: 1 1 300px;           /* grow, shrink, min 300px */
  max-width: calc(33.333% - 16px); /* limit to ~1/3 */
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* Card image fills width */
.card img {
  width: 100%;
  height: 200px;
  object-fit: cover;         /* crop to fill */
}

.card-body {
  padding: 16px;
}

.card-title {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
}

.card-text {
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.5;
}
```

### 实战案例3：圣杯布局（Holy Grail）

```css
/* Full page layout: header + 3 columns + footer */
.holy-grail {
  display: flex;
  flex-direction: column;    /* stack rows vertically */
  min-height: 100vh;
}

.hg-header {
  flex: 0 0 auto;            /* don't grow or shrink */
  padding: 16px 24px;
  background: #1e293b;
  color: white;
}

.hg-body {
  display: flex;             /* body is a flex row */
  flex: 1;                   /* take remaining space */
}

.hg-nav {
  flex: 0 0 220px;           /* fixed width sidebar */
  background: #f1f5f9;
  padding: 20px;
}

.hg-main {
  flex: 1;                   /* fill remaining width */
  padding: 20px;
}

.hg-aside {
  flex: 0 0 180px;           /* fixed width aside */
  background: #f1f5f9;
  padding: 20px;
}

.hg-footer {
  flex: 0 0 auto;
  padding: 16px 24px;
  background: #1e293b;
  color: white;
}

/* Mobile: stack everything vertically */
@media (max-width: 768px) {
  .hg-body {
    flex-direction: column;
  }
  .hg-nav,
  .hg-aside {
    flex: 0 0 auto;          /* auto height on mobile */
  }
}
```

---

## 执行预览

### flex-direction 对比

```
row (默认):          column:
[A] [B] [C]          [A]
                      [B]
                      [C]
```

### justify-content 对比

```
flex-start:    [A][B][C]__________
center:        _____[A][B][C]_____
space-between: [A]____[B]____[C]
space-around:  __[A]__[B]__[C]__
space-evenly:  ___[A]___[B]___[C]___
```

### 圣杯布局效果

```
┌──────────────────────────────────┐
│            Header                │
├──────┬───────────────────┬───────┤
│      │                   │       │
│ Nav  │    Main Content   │ Aside │
│220px │     (flex: 1)     │180px  │
│      │                   │       │
├──────┴───────────────────┴───────┤
│            Footer                │
└──────────────────────────────────┘
```

---

## 注意事项

| 属性 | 注意点 | 建议 |
|------|--------|------|
| `display: flex` | 只影响直接子元素 | 嵌套flex需在子元素再次设置 |
| `flex-grow` | 默认为0（不放大） | 等分空间用 `flex: 1` |
| `flex-shrink` | 默认为1（会缩小） | 固定尺寸项目设 `flex-shrink: 0` |
| `flex-basis` | 优先级高于width | 理解 `flex: 1` 等于 `1 1 0%` |
| `gap` | IE不支持 | 旧项目用margin替代 |
| `flex-wrap` | 默认nowrap（不换行） | 卡片布局务必设置 `wrap` |
| `min-width` | flex项目默认不会缩小到内容以下 | 文本截断需设 `min-width: 0` |
| `order` | 仅改变视觉顺序 | 不影响DOM和Tab顺序，注意无障碍 |

---

## 避坑指南

### ❌ 用margin实现项目间距

```css
/* ❌ Bad: manual margins are fragile */
.item { margin-right: 16px; }
.item:last-child { margin-right: 0; }
```

```css
/* ✅ Good: use gap for consistent spacing */
.container {
  display: flex;
  gap: 16px;
}
```

### ❌ flex项目内容溢出

```css
/* ❌ Bad: long text breaks layout */
.item {
  flex: 1;
  /* text overflows container */
}
```

```css
/* ✅ Good: allow shrinking below content size */
.item {
  flex: 1;
  min-width: 0;              /* key fix! */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### ❌ 用float或inline-block做布局

```css
/* ❌ Bad: legacy approaches */
.container { overflow: hidden; }
.item { float: left; width: 33.33%; }
```

```css
/* ✅ Good: Flexbox is the modern standard */
.container {
  display: flex;
  gap: 16px;
}
.item { flex: 1; }
```

### ❌ 所有项目都设 flex: 1 导致固定宽度失效

```css
/* ❌ Bad: sidebar should not grow */
.sidebar { flex: 1; }
.content { flex: 1; }
```

```css
/* ✅ Good: fix sidebar, let content grow */
.sidebar { flex: 0 0 250px; }
.content { flex: 1; }
```

---

## 练习题

### 🟢 初级

**1. 实现水平居中的导航栏**

要求：导航链接水平排列，整体居中，间距16px。

```html
<nav class="navbar">
  <a href="#">首页</a>
  <a href="#">产品</a>
  <a href="#">关于</a>
  <a href="#">联系</a>
</nav>
```

<details>
<summary>参考答案</summary>

```css
.navbar {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: #1e293b;
}
.navbar a {
  color: white;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 4px;
}
.navbar a:hover {
  background: rgba(255, 255, 255, 0.1);
}
```
</details>

**2. 垂直居中一个元素**

要求：在一个300x300的容器中，将一个按钮垂直水平居中。

<details>
<summary>参考答案</summary>

```css
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 300px;
  height: 300px;
  background: #f1f5f9;
}
```
</details>

### 🟡 中级

**3. 实现粘性页脚布局**

要求：页头和页脚固定高度，中间内容区域自动撑满剩余空间。

<details>
<summary>参考答案</summary>

```css
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.page-header { flex: 0 0 64px; }
.page-content { flex: 1; }
.page-footer { flex: 0 0 48px; }
```
</details>

**4. 实现等宽卡片自动换行布局**

要求：每张卡片最小宽度280px，自动换行，间距20px。

<details>
<summary>参考答案</summary>

```css
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
.card {
  flex: 1 1 280px;
}
```
</details>

### 🔴 高级

**5. 实现响应式圣杯布局**

要求：桌面端三栏（导航220px + 弹性主内容 + 侧边栏180px），移动端（≤768px）变为单栏堆叠。

<details>
<summary>参考答案</summary>

参考上方"实战案例3：圣杯布局"完整代码。
</details>

---

## 知识点总结

```
Flexbox 知识体系
├── 1. 启用: display: flex / inline-flex
├── 2. 轴线: flex-direction → 决定主轴方向
├── 3. 换行: flex-wrap → 控制是否换行
├── 4. 对齐
│   ├── justify-content → 主轴对齐
│   ├── align-items → 交叉轴单行对齐
│   └── align-content → 交叉轴多行对齐
├── 5. 弹性
│   ├── flex-grow → 放大比例
│   ├── flex-shrink → 缩小比例
│   ├── flex-basis → 初始大小
│   └── flex (shorthand) → 推荐写法
├── 6. 间距: gap → 替代margin
├── 7. 排序: order → 视觉顺序调整
└── 8. 单独控制: align-self → 单项目交叉轴对齐
```

---

## 举一反三

| 需求场景 | 推荐方案 | 关键属性 |
|----------|----------|----------|
| 水平导航栏 | `display: flex` | `justify-content`, `gap` |
| 垂直居中 | `display: flex` | `justify-content: center` + `align-items: center` |
| 等分空间 | `flex: 1` on items | `flex-grow`, `flex-basis: 0` |
| 固定+弹性 | 一侧固定，一侧flex:1 | `flex: 0 0 240px` + `flex: 1` |
| 自动换行卡片 | `flex-wrap: wrap` | `flex: 1 1 280px`, `gap` |
| 粘性页脚 | `flex-direction: column` | 容器 `min-height: 100vh`, 内容 `flex: 1` |
| 底部对齐按钮 | 卡片用flex column | `margin-top: auto` on button |
| 反向排列 | `flex-direction: row-reverse` | 或用 `order` 属性 |

---

## 参考资料

- [MDN - CSS Flexible Box Layout](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_flexible_box_layout)
- [CSS Tricks - A Complete Guide to Flexbox](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [Flexbox Froggy](https://flexboxfroggy.com/) — 交互式学习游戏
- [Can I Use - Flexbox](https://caniuse.com/flexbox) — 浏览器兼容性查询

---

## 代码演进

### v1 — 最简居中（入门）

```css
/* v1: Just center something, nothing fancy */
.box {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
```

### v2 — 侧边栏布局（进阶）

```css
/* v2: Sidebar + main content */
.layout {
  display: flex;
  gap: 24px;
  min-height: 100vh;
}
.sidebar { flex: 0 0 250px; }
.main { flex: 1; }
```

### v3 — 完整圣杯布局（实战）

```css
/* v3: Full page with header, footer, responsive */
.page { display: flex; flex-direction: column; min-height: 100vh; }
.page-header, .page-footer { flex: 0 0 auto; }
.page-body { display: flex; flex: 1; }
.page-nav { flex: 0 0 220px; }
.page-main { flex: 1; }
.page-aside { flex: 0 0 180px; }
@media (max-width: 768px) {
  .page-body { flex-direction: column; }
  .page-nav, .page-aside { flex: 0 0 auto; }
}
```
