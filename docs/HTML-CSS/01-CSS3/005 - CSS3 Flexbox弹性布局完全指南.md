---
title: "005 - CSS3 Flexbox弹性布局完全指南"
slug: "005-css3-flexbox"
category: "CSS3"
tech_stack: "HTML-CSS"
created_at: "2026-04-26T10:39:37.153+08:00"
updated_at: "2026-04-29T10:02:45.971+08:00"
reading_time: 29
tags: []
---


## 难度标注

> **难度：** ⭐⭐⭐ 中级
> **前置知识：** CSS盒模型、display属性基础
> **预计学习时间：** 50-70分钟

---

## 一、概念讲解

### 什么是Flexbox？

Flexbox（Flexible Box Layout）是CSS3引入的一维布局模型，专为在**一个方向**（行或列）上分配空间和对齐元素而设计。

Flex布局的核心概念：

- **Flex Container（弹性容器）** — 设置 `display: flex` 的元素
- **Flex Item（弹性项目）** — 容器的直接子元素
- **Main Axis（主轴）** — Flex项目的排列方向（默认水平）
- **Cross Axis（交叉轴）** — 与主轴垂直的方向

### 为什么用Flexbox？

| 传统方案 | Flexbox方案 |
|----------|-------------|
| `float` + `clearfix` | `display: flex` |
| `inline-block` 间隙问题 | 无间隙 |
| `table` 布局语义错误 | 语义化HTML |
| 垂直居中需要 hack | `align-items: center` |
| 等高列需要 JS | 天然等高 |

### 容器属性一览

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `flex-direction` | 主轴方向 | `row` |
| `flex-wrap` | 是否换行 | `nowrap` |
| `flex-flow` | direction + wrap 简写 | `row nowrap` |
| `justify-content` | 主轴对齐 | `flex-start` |
| `align-items` | 交叉轴对齐 | `stretch` |
| `align-content` | 多行对齐 | `stretch` |
| `gap` | 项目间距 | `0` |

### 项目属性一览

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `order` | 排列顺序 | `0` |
| `flex-grow` | 放大比例 | `0` |
| `flex-shrink` | 缩小比例 | `1` |
| `flex-basis` | 初始大小 | `auto` |
| `flex` | grow shrink basis 简写 | `0 1 auto` |
| `align-self` | 单项交叉轴对齐 | `auto` |

### flex 简写详解

```css
/* Most common patterns */
.item { flex: 1; }        /* flex: 1 1 0% — grow equally */
.item { flex: auto; }     /* flex: 1 1 auto — grow based on content */
.item { flex: none; }     /* flex: 0 0 auto — fixed size, no grow/shrink */
.item { flex: 2; }        /* Takes 2x space compared to flex: 1 siblings */
```

---

## 二、脑图（ASCII）

```
Flexbox 弹性布局
├── 基础概念
│   ├── Flex Container (display: flex)
│   ├── Flex Item (直接子元素)
│   ├── Main Axis (主轴)
│   └── Cross Axis (交叉轴)
├── 容器属性
│   ├── flex-direction (row/column/row-reverse/column-reverse)
│   ├── flex-wrap (nowrap/wrap/wrap-reverse)
│   ├── justify-content (主轴分布)
│   ├── align-items (交叉轴对齐)
│   ├── align-content (多行分布)
│   └── gap (间距)
├── 项目属性
│   ├── flex-grow (放大)
│   ├── flex-shrink (缩小)
│   ├── flex-basis (基础尺寸)
│   ├── flex (简写)
│   ├── order (排序)
│   └── align-self (单项对齐)
└── 实战模式
    ├── 居中对齐 ★★★
    ├── 导航栏 ★★★
    ├── 等分布局 ★★☆
    ├── 圣杯布局 ★★☆
    └── 卡片列表 ★★★
```

---

## 三、完整CSS代码 — Flexbox常用布局模式

```css
/* ===== 1. Perfect Centering ===== */
.center-perfect {
  display: flex;
  justify-content: center;  /* Main axis center */
  align-items: center;      /* Cross axis center */
  min-height: 100vh;
}

/* ===== 2. Navigation Bar ===== */
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 60px;
  background: #2c3e50;
  color: white;
}

.navbar__logo {
  font-size: 1.4rem;
  font-weight: bold;
}

.navbar__menu {
  display: flex;
  gap: 8px;
  list-style: none;
}

.navbar__menu a {
  display: block;
  padding: 8px 16px;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background 0.2s;
}

.navbar__menu a:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* ===== 3. Equal Width Columns ===== */
.equal-columns {
  display: flex;
  gap: 16px;
}

.equal-columns > * {
  flex: 1;  /* Each child takes equal space */
  padding: 24px;
  background: #ecf0f1;
  border-radius: 8px;
}

/* ===== 4. Holy Grail Layout ===== */
.holy-grail {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.holy-grail__header,
.holy-grail__footer {
  padding: 16px 24px;
  background: #2c3e50;
  color: white;
}

.holy-grail__body {
  display: flex;
  flex: 1;  /* Take remaining vertical space */
}

.holy-grail__sidebar {
  flex: 0 0 220px;  /* Fixed width sidebar */
  padding: 16px;
  background: #ecf0f1;
}

.holy-grail__main {
  flex: 1;  /* Main content fills remaining */
  padding: 24px;
}

.holy-grail__aside {
  flex: 0 0 180px;
  padding: 16px;
  background: #ecf0f1;
}

/* Responsive: stack on mobile */
@media (max-width: 767px) {
  .holy-grail__body {
    flex-direction: column;
  }
  .holy-grail__sidebar,
  .holy-grail__aside {
    flex: none;
  }
}

/* ===== 5. Card Row with Wrapping ===== */
.card-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.card-row .card {
  /* Grow to fill, but minimum 280px */
  flex: 1 1 280px;
  /* Limit max width so last row doesn't stretch */
  max-width: calc(33.333% - 11px);
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

@media (max-width: 768px) {
  .card-row .card {
    max-width: 100%;
  }
}

/* ===== 6. Sticky Footer ===== */
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page__content {
  flex: 1;  /* Push footer to bottom */
}

.page__footer {
  padding: 20px;
  background: #f5f5f5;
  text-align: center;
}

/* ===== 7. Input Group ===== */
.input-group {
  display: flex;
}

.input-group__field {
  flex: 1;              /* Input takes remaining space */
  padding: 10px 14px;
  border: 2px solid #ddd;
  border-right: none;
  border-radius: 4px 0 0 4px;
  font-size: 1rem;
  outline: none;
}

.input-group__field:focus {
  border-color: #4a90d9;
}

.input-group__btn {
  flex: none;           /* Button keeps natural size */
  padding: 10px 20px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 1rem;
}

/* ===== 8. Media Object ===== */
.media {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.media__img {
  flex: none;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}

.media__body {
  flex: 1;
}

.media__title {
  font-size: 1rem;
  margin-bottom: 4px;
}

.media__text {
  font-size: 0.9rem;
  color: #666;
}
```

```html
<!-- Media Object Example -->
<div class="media">
  <img class="media__img" src="avatar.jpg" alt="Avatar">
  <div class="media__body">
    <h4 class="media__title">User Name</h4>
    <p class="media__text">Comment text goes here...</p>
  </div>
</div>

<!-- Input Group Example -->
<div class="input-group">
  <input class="input-group__field" type="text" placeholder="Search...">
  <button class="input-group__btn">Search</button>
</div>
```

---

## 四、执行预览

```
Perfect Centering:
┌────────────────────────────────────────┐
│                                        │
│                                        │
│            ┌──────────┐                │
│            │ Centered │                │
│            └──────────┘                │
│                                        │
│                                        │
└────────────────────────────────────────┘

Navbar:
┌────────────────────────────────────────┐
│  MyApp        Home  About  Contact     │
└────────────────────────────────────────┘

Holy Grail Layout:
┌────────────────────────────────────────┐
│              Header                     │
├──────────┬─────────────────┬───────────┤
│          │                 │           │
│ Sidebar  │   Main Content  │   Aside   │
│  220px   │    (flex: 1)    │   180px   │
│          │                 │           │
├──────────┴─────────────────┴───────────┤
│              Footer                     │
└────────────────────────────────────────┘
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| `flex-basis` 优先级 | 优先于 `width`/`height` | 用 `flex` 简写而非单独设置 width |
| `flex-shrink` | 默认为1，项目会缩小 | 固定尺寸项目设 `flex-shrink: 0` |
| `min-width` | Flex项目默认 `min-width: auto` | 可能需要设 `min-width: 0` 防止溢出 |
| `gap` 兼容性 | 现代浏览器都支持 | 旧浏览器用 margin 代替 |
| `order` 可访问性 | 视觉顺序≠DOM顺序 | 屏幕阅读器按DOM顺序读取 |
| 嵌套Flex | Flex项目也可以是Flex容器 | 嵌套层数不宜过深（≤3层） |

---

## 六、避坑指南

### ❌ flex-basis 和 width 混用
```css
/* ❌ Bad: confusing which takes effect */
.item {
  width: 200px;
  flex-basis: 150px;  /* This wins */
}
```
```css
/* ✅ Good: use flex shorthand */
.item {
  flex: 0 0 200px;  /* Clear intent: fixed 200px */
}
```

### ❌ 忘记 min-width 导致文字溢出
```css
/* ❌ Bad: long text overflows */
.flex-container {
  display: flex;
}
.item {
  /* Default min-width: auto can cause overflow */
}
```
```css
/* ✅ Good: reset min-width */
.flex-container {
  display: flex;
}
.item {
  min-width: 0;     /* Allow shrinking below content size */
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### ❌ 在 flex 容器上使用 `inline-block` 相关属性
```css
/* ❌ Bad: vertical-align has no effect in flex */
.flex-item {
  display: block;
  vertical-align: middle;  /* Ignored! */
}
```
```css
/* ✅ Good: use align-self or align-items */
.flex-item {
  align-self: center;
}
```

### ❌ flex-grow 不均等分配
```css
/* ❌ Bad: grow doesn't override content size differences */
.item-a { flex-grow: 1; }  /* Has lots of content */
.item-b { flex-grow: 1; }  /* Little content → still unequal */
```
```css
/* ✅ Good: set basis to 0 for truly equal distribution */
.item-a { flex: 1 1 0; }
.item-b { flex: 1 1 0; }
```

---

## 七、练习题

### 🟢 入门题

**1.** 使用Flexbox实现水平垂直居中（容器高400px，内容宽200px高100px）。

**2.** 实现三个等宽的列，间距20px。

### 🟡 进阶题

**3.** 实现一个导航栏：Logo靠左，菜单项靠右，垂直居中。

**4.** 实现Media Object（图片固定64px，文字自动填充剩余空间），文字超出时显示省略号。

### 🔴 挑战题

**5.** 实现圣杯布局（Header + Footer + 三栏Body），要求侧边栏固定宽度，主内容自适应，移动端纵向堆叠。

**6.** 用Flexbox实现一个瀑布流效果提示（提示：结合 `flex-direction: column` 和 `wrap`，注意内容顺序问题）。

---

## 八、知识点总结（树状）

```
Flexbox
├── 容器属性
│   ├── display: flex / inline-flex ★★★
│   ├── flex-direction ★★★
│   │   ├── row (默认水平)
│   │   ├── column (垂直)
│   │   └── *-reverse (反向)
│   ├── flex-wrap ★★★
│   │   ├── nowrap (默认不换行)
│   │   └── wrap (换行)
│   ├── justify-content ★★★
│   │   ├── flex-start / flex-end / center
│   │   ├── space-between / space-around / space-evenly
│   │   └── start / end (新语法)
│   ├── align-items ★★★
│   │   ├── stretch (默认拉伸)
│   │   ├── flex-start / flex-end / center
│   │   └── baseline
│   ├── align-content ★★☆
│   └── gap ★★★
├── 项目属性
│   ├── flex-grow ★★★
│   ├── flex-shrink ★★☆
│   ├── flex-basis ★★☆
│   ├── flex (简写) ★★★
│   ├── order ★★☆
│   └── align-self ★★☆
└── 常见问题
    ├── min-width 溢出 ★★★
    ├── flex-basis vs width ★★☆
    └── 嵌套布局 ★★☆
```

---

## 九、举一反三

| 场景 | Flex方案 | 关键属性 |
|------|----------|----------|
| 垂直居中 | `align-items: center` | 单行交叉轴居中 |
| 等分空间 | `flex: 1` on children | grow 均分 |
| 固定+自适应 | 侧边 `flex: none` + 主区 `flex: 1` | 圣杯布局核心 |
| 底部对齐 | `align-items: flex-end` | 卡片底部按钮 |
| 反转排列 | `flex-direction: row-reverse` | RTL支持 |
| 自动间距 | `justify-content: space-between` | 导航栏两端对齐 |
| 输入框+按钮 | input `flex:1` + btn `flex:none` | 搜索栏 |
| 媒体对象 | img `flex:none` + body `flex:1` | 评论列表 |

---

## 十、参考资料

1. [MDN — Flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout)
2. [CSS-Tricks — A Complete Guide to Flexbox](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
3. [Flexbox Froggy](https://flexboxfroggy.com/) — 互动学习游戏
4. [W3C — CSS Flexible Box Layout Level 1](https://www.w3.org/TR/css-flexbox-1/)
5. [Solved by Flexbox](https://philipwalton.github.io/solved-by-flexbox/)

---

## 十一、代码演进

### v1 — 最简单的Flex居中

```css
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}
.box {
  width: 200px;
  height: 100px;
  background: #4a90d9;
}
```

**问题：** 只实现了居中，没有考虑布局的通用性。

### v2 — 多组件Flex布局

```css
.navbar { display: flex; justify-content: space-between; align-items: center; }
.columns { display: flex; gap: 16px; }
.columns > * { flex: 1; }
.footer-push { display: flex; flex-direction: column; min-height: 100vh; }
.footer-push main { flex: 1; }
```

**改进：** 覆盖了导航、等分列、Sticky Footer。但缺少换行处理和响应式。

### v3 — 完整Flexbox系统（本文最终版）

```css
/* Key improvements:
   1. Holy Grail layout with responsive stacking
   2. Card grid with flex-wrap and max-width
   3. Media Object pattern
   4. Input group pattern
   5. min-width: 0 fix for text overflow
   6. gap property for clean spacing
*/
```

**改进：** 生产级Flexbox模式库，覆盖所有常见布局场景，响应式完善，无溢出问题。

---

## 十二、总结

Flexbox是CSS布局的革命性工具，尤其擅长一维方向的排列和对齐。掌握Flexbox的关键是理解**主轴/交叉轴**的概念和 **`flex` 简写**的行为。

核心要记：
- ✅ `justify-content` 管主轴，`align-items` 管交叉轴
- ✅ `flex: 1` 让项目等分空间（`flex-basis: 0`）
- ✅ `flex: 0 0 200px` 固定尺寸不伸缩
- ✅ 设 `min-width: 0` 防止内容溢出
- ✅ `gap` 替代 margin 做间距
- ✅ `order` 改变视觉顺序，但注意可访问性
