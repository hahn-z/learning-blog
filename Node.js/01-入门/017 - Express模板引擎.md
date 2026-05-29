---
title: "017 - Express模板引擎"
slug: "017-express-template"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.654+08:00"
updated_at: "2026-04-29T10:02:47.973+08:00"
reading_time: 39
tags: []
---

# Express模板引擎

> **难度标注：** ⭐⭐ 初级 | 适合有Express基础的开发者
> **阅读时间：** 约18分钟 | **上手时间：** 约25分钟

---

## 一、概念讲解

### 什么是模板引擎？

模板引擎让你在HTML中嵌入动态数据，服务端渲染后再发送给客户端。Express支持多种模板引擎，最常用的是 **EJS** 和 **Pug**。

**核心流程：**

```
模板文件 (.ejs/.pug) + 数据 (JavaScript对象) → 模板引擎渲染 → HTML字符串 → 发送给浏览器
```

**为什么需要模板引擎？**

- 不用手动拼接HTML字符串
- 模板可复用（布局、组件）
- 数据和展示分离，更好维护

### EJS vs Pug 对比

| 特性 | EJS | Pug |
|------|-----|------|
| 语法 | `<% %>` 嵌入JS | 缩进式，无标签闭合 |
| 学习曲线 | 低（就是HTML+JS） | 中（需要学新语法） |
| 可读性 | 高，所见即所得 | 中，需要适应缩进 |
| 灵活性 | 高，直接写JS逻辑 | 中，逻辑受限于Pug语法 |
| 社区 | 大 | 大 |

**本篇以EJS为主**，因为学习成本最低，适合入门。

---

## 二、脑图（ASCII）

```
Express模板引擎
├── 基础概念
│   ├── 服务端渲染 (SSR)
│   ├── 模板 + 数据 → HTML
│   └── res.render() 渲染方法
├── EJS 语法
│   ├── <%= %> 输出（转义）
│   ├── <%- %> 输出（不转义）
│   ├── <% %> 执行JS逻辑
│   ├── <%- include() %> 包含子模板
│   └── 注释 <%# %>
├── 布局与复用
│   ├── include 公共组件
│   ├── layout 模板继承
│   └── partial 局部模板
├── 数据传递
│   ├── res.render('view', { data })
│   ├── app.locals 全局变量
│   └── res.locals 请求级变量
└── 项目结构
    ├── views/ 模板目录
    │   ├── partials/ 公共组件
    │   ├── layouts/ 布局模板
    │   └── pages/ 页面模板
    └── public/ 静态资源
```

---

## 三、完整代码

### v1：基础EJS渲染

```javascript
// v1-basic-ejs.js - Basic EJS template rendering
const express = require('express');
const app = express();
const PORT = 3000;

// Set EJS as template engine
app.set('view engine', 'ejs');
// Set views directory (default is './views')
app.set('views', './views');

// Serve static files
app.use(express.static('public'));

// Route: render a simple template with data
app.get('/', (req, res) => {
  res.render('index', {
    title: 'My Blog',
    posts: [
      { id: 1, title: 'Learning EJS', author: 'Alice', date: '2026-04-28' },
      { id: 2, title: 'Express Tips', author: 'Bob', date: '2026-04-29' },
      { id: 3, title: 'Node.js Best Practices', author: 'Charlie', date: '2026-04-30' }
    ]
  });
});

// Route: render a single post page
app.get('/post/:id', (req, res) => {
  const posts = [
    { id: 1, title: 'Learning EJS', author: 'Alice', content: 'EJS makes templating easy and intuitive...', date: '2026-04-28' },
    { id: 2, title: 'Express Tips', author: 'Bob', content: 'Here are some tips for Express development...', date: '2026-04-29' },
    { id: 3, title: 'Node.js Best Practices', author: 'Charlie', content: 'Follow these practices for better Node.js code...', date: '2026-04-30' }
  ];
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (!post) {
    return res.status(404).render('error', { title: '404', message: 'Post not found' });
  }
  res.render('post', { title: post.title, post });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

**views/index.ejs:**
```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title><%= title %></title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .post { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; }
    .post h3 { margin: 0 0 8px; }
    .meta { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1><%= title %></h1>
  
  <% if (posts.length === 0) { %>
    <p>No posts yet.</p>
  <% } else { %>
    <% posts.forEach(function(post) { %>
      <div class="post">
        <h3><a href="/post/<%= post.id %>"><%= post.title %></a></h3>
        <p class="meta">By <%= post.author %> | <%= post.date %></p>
      </div>
    <% }); %>
  <% } %>
</body>
</html>
```

**views/post.ejs:**
```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title><%= title %></title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .meta { color: #666; margin-bottom: 20px; }
    .content { line-height: 1.8; }
    a.back { display: inline-block; margin-top: 20px; }
  </style>
</head>
<body>
  <h1><%= post.title %></h1>
  <p class="meta">By <%= post.author %> | <%= post.date %></p>
  <div class="content"><p><%= post.content %></p></div>
  <a class="back" href="/">&larr; Back to Home</a>
</body>
</html>
```

**views/error.ejs:**
```html
<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><title><%= title %></title></head>
<body>
  <h1><%= title %></h1>
  <p><%= message %></p>
  <a href="/">&larr; Go Home</a>
</body>
</html>
```

### v2：模板复用 + include

```javascript
// v2-partials-ejs.js - EJS with partials and layout
const express = require('express');
const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Parse form data

// Global data available in all templates
app.locals.siteName = 'My Blog';
app.locals.currentYear = new Date().getFullYear();

// In-memory data store
let posts = [
  { id: 1, title: 'First Post', body: 'Hello World! This is my first blog post.', author: 'Alice', createdAt: new Date('2026-04-28') },
  { id: 2, title: 'EJS Partials', body: 'Partials help you reuse template components.', author: 'Bob', createdAt: new Date('2026-04-29') }
];
let nextId = 3;

// List all posts
app.get('/', (req, res) => {
  res.render('pages/index', { posts });
});

// Show new post form
app.get('/posts/new', (req, res) => {
  res.render('pages/new', { errors: [] });
});

// Create a new post
app.post('/posts', (req, res) => {
  const { title, body, author } = req.body;
  const errors = [];
  if (!title || title.trim().length < 3) errors.push('Title must be at least 3 characters');
  if (!body || body.trim().length < 10) errors.push('Body must be at least 10 characters');
  if (!author) errors.push('Author is required');
  
  if (errors.length > 0) {
    return res.render('pages/new', { errors, title, body, author });
  }
  
  posts.push({ id: nextId++, title, body, author, createdAt: new Date() });
  res.redirect('/');
});

// Show single post
app.get('/posts/:id', (req, res) => {
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).render('pages/error', { message: 'Post not found' });
  res.render('pages/show', { post });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

**views/partials/header.ejs:**
```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title + ' | ' + siteName : siteName %></title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 2px solid #eee; margin-bottom: 20px; }
    nav a { text-decoration: none; color: #333; }
    .btn { display: inline-block; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border: none; border-radius: 4px; cursor: pointer; }
    .btn:hover { background: #0056b3; }
  </style>
</head>
<body>
  <nav>
    <h1><a href="/"><%= siteName %></a></h1>
    <a href="/posts/new" class="btn">New Post</a>
  </nav>
```

**views/partials/footer.ejs:**
```html
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 0.9em;">
    &copy; <%= currentYear %> <%= siteName %>
  </footer>
</body>
</html>
```

**views/pages/index.ejs:**
```html
<!DOCTYPE html>
<html lang="zh">
<%- include('../partials/header') %>
  <% posts.forEach(function(post) { %>
    <article style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 8px;">
      <h2><a href="/posts/<%= post.id %>"><%= post.title %></a></h2>
      <p style="color: #666; font-size: 0.9em;">By <%= post.author %> | <%= post.createdAt.toLocaleDateString() %></p>
      <p><%= post.body.substring(0, 100) %><%= post.body.length > 100 ? '...' : '' %></p>
    </article>
  <% }); %>
  <% if (posts.length === 0) { %>
    <p>No posts yet. <a href="/posts/new">Create one!</a></p>
  <% } %>
<%- include('../partials/footer') %>
```

**views/pages/show.ejs:**
```html
<!DOCTYPE html>
<html lang="zh">
<%- include('../partials/header', { title: post.title }) %>
  <article>
    <h2><%= post.title %></h2>
    <p style="color: #666;">By <%= post.author %> | <%= post.createdAt.toLocaleDateString() %></p>
    <div style="margin-top: 15px; line-height: 1.8;"><%= post.body %></div>
  </article>
  <a href="/" style="display: inline-block; margin-top: 20px;">&larr; Back to Home</a>
<%- include('../partials/footer') %>
```

**views/pages/new.ejs:**
```html
<!DOCTYPE html>
<html lang="zh">
<%- include('../partials/header', { title: 'New Post' }) %>
  <h2>Create New Post</h2>
  <% if (errors && errors.length > 0) { %>
    <div style="background: #fdd; padding: 10px; border-radius: 4px; margin: 10px 0;">
      <% errors.forEach(function(err) { %><p style="color: red;"><%= err %></p><% }); %>
    </div>
  <% } %>
  <form action="/posts" method="POST" style="display: flex; flex-direction: column; gap: 10px; max-width: 500px;">
    <input name="title" placeholder="Title" value="<%= typeof title !== 'undefined' ? title : '' %>" style="padding: 8px; font-size: 16px;">
    <input name="author" placeholder="Author" value="<%= typeof author !== 'undefined' ? author : '' %>" style="padding: 8px; font-size: 16px;">
    <textarea name="body" placeholder="Write your post..." rows="10" style="padding: 8px; font-size: 16px;"><%= typeof body !== 'undefined' ? body : '' %></textarea>
    <button type="submit" class="btn">Publish</button>
  </form>
<%- include('../partials/footer') %>
```

### v3：布局系统 + 高级特性

```javascript
// v3-layout-system.js - Layout system with express-ejs-layouts
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const app = express();
const PORT = 3000;

// EJS + Layout setup
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // Default layout
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Simulated data
let products = [
  { id: 1, name: 'Laptop', price: 5999, category: 'Electronics', stock: 15, description: 'High-performance laptop for developers' },
  { id: 2, name: 'Mouse', price: 99, category: 'Accessories', stock: 50, description: 'Ergonomic wireless mouse' },
  { id: 3, name: 'Keyboard', price: 399, category: 'Accessories', stock: 30, description: 'Mechanical keyboard with RGB' }
];

app.locals.siteName = 'Product Store';
app.locals.formatPrice = (price) => `¥${price.toFixed(2)}`;

// Routes
app.get('/', (req, res) => {
  res.render('pages/home', { title: 'Home', products });
});

app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).render('pages/404', { title: 'Not Found' });
  res.render('pages/product', { title: product.name, product });
});

// Use a different layout for admin pages
app.get('/admin', (req, res) => {
  res.render('pages/admin', { title: 'Admin', products, layout: 'layouts/admin' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

**views/layouts/main.ejs:**
```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title><%= title %> | <%= siteName %></title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav>
    <a href="/"><%= siteName %></a>
    <a href="/admin">Admin</a>
  </nav>
  <main>
    <%- body %>  <!-- Page content injected here -->
  </main>
</body>
</html>
```

**views/layouts/admin.ejs:**
```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title><%= title %> | Admin</title>
</head>
<body style="background: #f5f5f5;">
  <nav style="background: #333; color: white; padding: 10px 20px;">
    <strong>Admin Panel</strong> | <a href="/" style="color: white;">Back to Site</a>
  </nav>
  <div style="padding: 20px;">
    <%- body %>
  </div>
</body>
</html>
```

---

## 四、执行预览

```bash
# 项目结构
$ tree views/ public/
views/
├── layouts/
│   └── main.ejs
├── partials/
│   ├── header.ejs
│   └── footer.ejs
├── pages/
│   ├── index.ejs
│   ├── show.ejs
│   ├── new.ejs
│   └── error.ejs
public/
└── css/
    └── style.css

# 启动v2
$ node v2-partials-ejs.js
Server running at http://localhost:3000

# 浏览器访问
# http://localhost:3000       → 文章列表
# http://localhost:3000/posts/new → 新建文章表单
# http://localhost:3000/posts/1   → 文章详情

# curl 预览
$ curl -s http://localhost:3000 | head -20
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>My Blog</title>
  ...
  <nav>
    <h1><a href="/">My Blog</a></h1>
    <a href="/posts/new" class="btn">New Post</a>
  </nav>
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| `<%=` vs `<%-` | `=` 转义HTML，`-` 不转义 | 用户输入用 `<%=` 防XSS，渲染HTML用 `<%-` |
| include路径 | 相对于当前模板文件 | 用相对路径 `../partials/header` |
| 变量未定义 | 直接用会报错 | 用 `typeof var !== 'undefined'` 检查 |
| 模板缓存 | 生产环境默认开启 | 开发时用 `nodemon` 自动重启 |
| express-ejs-layouts | 需额外安装 | `npm install express-ejs-layouts` |
| 静态文件 | 需配置 `express.static` | CSS/JS/图片放public目录 |

---

## 六、避坑指南

### ❌ 用 `<%-` 输出用户输入
```ejs
<!-- ❌ XSS漏洞：用户输入的HTML会被直接渲染 -->
<div><%- userComment %></div>
```
```ejs
<!-- ✅ 用 <%= 转义输出，防止XSS -->
<div><%= userComment %></div>
```

### ❌ include 路径写错
```ejs
<!-- ❌ 相对于项目根目录（错误） -->
<%- include('views/partials/header') %>
```
```ejs
<!-- ✅ 相对于当前模板文件 -->
<%- include('../partials/header') %>
```

### ❌ 忘记设置 view engine
```javascript
// ❌ 报错：Cannot find module 'ejs'
app.get('/', (req, res) => {
  res.render('index'); // No engine configured!
});
```
```javascript
// ✅ 先安装再配置
// npm install ejs
app.set('view engine', 'ejs');
```

### ❌ 模板中直接用未定义变量
```ejs
<!-- ❌ ReferenceError: description is not defined -->
<p><%= description %></p>
```
```ejs
<!-- ✅ 安全访问 -->
<p><%= typeof description !== 'undefined' ? description : '' %></p>
```

---

## 七、练习题

### 🟢 初级
1. 创建一个Express应用，使用EJS渲染一个显示当前时间的页面
2. 创建一个 `/users` 页面，用表格展示用户列表数据
3. 创建一个 `/about` 页面，使用 include 引入公共 header 和 footer

### 🟡 中级
4. 实现一个简单的博客：列表页 + 详情页 + 新建表单页
5. 创建一个可切换亮色/暗色主题的布局系统（通过查询参数 `?theme=dark`）
6. 实现分页功能：每页显示5篇文章，底部有页码导航

### 🔴 高级
7. 创建一个灵活的布局系统，支持多种布局模板（默认、宽屏、简洁）
8. 实现一个模板辅助函数库（formatDate, truncate, slugify），注册到 app.locals
9. 用EJS实现一个组件化的UI库：card, alert, pagination, breadcrumb

---

## 八、知识点总结

```
Express模板引擎
├── 1. EJS 基础
│   ├── <%= %> 转义输出
│   ├── <%- %> 原始输出
│   ├── <% %> JS逻辑
│   └── <%- include() %> 包含
├── 2. 数据传递
│   ├── res.render(view, data)
│   ├── app.locals → 全局
│   └── res.locals → 请求级
├── 3. 模板复用
│   ├── include 局部模板
│   ├── layout 布局系统
│   └── 区分页面/组件/布局
├── 4. 项目结构
│   ├── views/pages/ 页面
│   ├── views/partials/ 组件
│   ├── views/layouts/ 布局
│   └── public/ 静态资源
└── 5. 安全与性能
    ├── 转义防XSS
    ├── 生产环境缓存
    └── 错误处理
```

---

## 九、举一反三

| 应用场景 | 模板结构 | 关键技术点 |
|----------|----------|------------|
| 个人博客 | layout + post列表 + 详情 + 表单 | include, 分页, Markdown渲染 |
| 企业官网 | 多布局（首页/内页） + 导航 | layout切换, SEO meta |
| 电商产品页 | 布局 + 产品卡片组件 + 购物车 | 局部缓存, 动态价格 |
| 后台管理 | admin布局 + 侧边栏 + 表格 | 权限判断, 数据表格 |
| 邮件模板 | 独立模板 + 样式内联 | 邮件兼容性, 动态内容 |
| 文档站 | 布局 + 侧边导航 + 搜索 | 多级导航, 高亮当前页 |

---

## 十、参考资料

- [EJS 官方文档](https://ejs.co/)
- [Express 模板引擎指南](https://expressjs.com/en/guide/using-template-engines.html)
- [express-ejs-layouts](https://github.com/Soarez/express-ejs-layouts)
- [MDN - XSS 防护](https://developer.mozilla.org/zh-CN/docs/Glossary/Cross-site_scripting)

---

## 十一、代码演进路线

```
v1 基础EJS渲染
├── 单页面，数据直接传给模板
├── EJS基本语法（输出、循环、条件）
├── 每个页面都是完整HTML
└── 适合：理解模板引擎基本原理
        ↓
v2 模板复用 + include
├── partials（header, footer）
├── include 引入公共组件
├── 表单处理 + 数据验证
├── app.locals 全局变量
└── 适合：小型Web应用，博客
        ↓
v3 布局系统 + 高级特性
├── express-ejs-layouts 布局系统
├── 多布局切换（默认/admin）
├── 辅助函数注册到 locals
├── 模块化项目结构
└── 适合：中型项目，多页面应用
```

**关键演进思路：** 从"每个页面写完整HTML"到"复用公共部分"到"系统化的布局管理"。核心是 **DRY原则（Don't Repeat Yourself）**。
