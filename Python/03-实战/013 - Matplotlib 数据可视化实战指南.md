---
title: "013 - Matplotlib 数据可视化实战指南"
slug: "013-matplotlib"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.527+08:00"
updated_at: "2026-04-29T10:02:47.76+08:00"
reading_time: 25
tags: []
---

# Matplotlib 数据可视化实战指南

> **难度：** ⭐⭐ 中级 | **预计阅读：** 25 分钟 | **标签：** Python, 数据可视化, Matplotlib

---

## 一、概念讲解

Matplotlib 是 Python 生态中最经典的数据可视化库，由 John Hunter 于 2003 年创建。它提供了从简单折线图到复杂 3D 图表的完整绘图能力，是数据分析和科学计算的标配工具。

### 核心架构

Matplotlib 采用三层架构：

- **Backend Layer**：处理渲染（Agg、Qt、TkAgg 等）
- **Artist Layer**：所有可见元素都是 Artist（Figure、Axes、Line2D 等）
- **Scripting Layer**：`pyplot` 接口，面向用户的便捷 API

关键概念辨析：

| 概念 | 说明 |
|------|------|
| Figure | 画布，最顶层的容器 |
| Axes | 坐标系（不是 Axis），一个 Figure 可包含多个 |
| Axis | 坐标轴（X 轴、Y 轴） |
| Artist | 所有在画布上渲染的对象 |

两种接口风格：**Pyplot 风格**（MATLAB 式，快速出图）和 **面向对象风格**（精细控制，推荐用于复杂场景）。

---

## 二、知识脑图

```
Matplotlib
├── 基础图表
│   ├── 折线图 plot()
│   ├── 柱状图 bar() / barh()
│   ├── 散点图 scatter()
│   ├── 直方图 hist()
│   └── 饼图 pie()
├── 样式定制
│   ├── 颜色 / 线型 / 标记
│   ├── 字体 / 标签 / 图例
│   ├── 网格 / 边框
│   └── 样式表 style.use()
├── 子图布局
│   ├── subplot() 等分布局
│   ├── subplots() 批量创建
│   └── GridSpec 不规则布局
├── 进阶图表
│   ├── 热力图 imshow()
│   ├── 箱线图 boxplot()
│   ├── 小提琴图 violinplot()
│   └── 极坐标图 polar()
└── 输出
    ├── savefig() 保存文件
    └── show() 交互显示
```

---

## 三、完整代码实战

### 项目：电商销售数据可视化仪表盘

```python
'''
E-commerce Sales Dashboard with Matplotlib
Demonstrates: line, bar, scatter, pie, heatmap charts
'''
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np

# ---------- Sample Data Generation ----------
np.random.seed(42)
months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

# Monthly revenue (10k CNY)
revenue = np.cumsum(np.random.randn(12) * 5 + 10)
revenue = np.abs(revenue) + 50

# Product category sales
categories = ['Electronics', 'Clothing', 'Food', 'Books', 'Sports']
cat_sales = [np.random.randint(100, 500) for _ in categories]

# Customer data: spending vs visit frequency
visits = np.random.randint(1, 50, 100)
spending = visits * np.random.uniform(80, 200, 100) + np.random.randn(100) * 500
spending = np.abs(spending)

# Daily heatmap data (7 days x 24 hours)
heat_data = np.random.poisson(lam=15, size=(7, 24))

# ---------- Color Theme ----------
COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']

# ---------- Create Dashboard ----------
fig = plt.figure(figsize=(18, 12), facecolor='#FAFAFA')
fig.suptitle('E-commerce Sales Dashboard 2024',
             fontsize=20, fontweight='bold', y=0.98)

gs = gridspec.GridSpec(2, 3, hspace=0.35, wspace=0.3,
                       left=0.06, right=0.96, top=0.92, bottom=0.06)

# --- 1. Line Chart: Monthly Revenue Trend ---
ax1 = fig.add_subplot(gs[0, 0])
ax1.plot(months, revenue, 'o-', color=COLORS[0], linewidth=2.5,
         markersize=6, markerfacecolor='white', markeredgewidth=2)
ax1.fill_between(months, revenue, alpha=0.15, color=COLORS[0])
ax1.set_title('Monthly Revenue Trend (10k CNY)', fontsize=12, pad=10)
ax1.set_ylabel('Revenue (10k)')
ax1.grid(True, alpha=0.3, linestyle='--')
ax1.tick_params(axis='x', rotation=45)

# Annotate peak
peak_idx = np.argmax(revenue)
ax1.annotate(f'Peak: {revenue[peak_idx]:.1f}',
             xy=(months[peak_idx], revenue[peak_idx]),
             xytext=(20, 15), textcoords='offset points',
             arrowprops=dict(arrowstyle='->', color='red'),
             fontsize=9, color='red', fontweight='bold')

# --- 2. Bar Chart: Category Sales ---
ax2 = fig.add_subplot(gs[0, 1])
bars = ax2.bar(categories, cat_sales, color=COLORS[:5],
               edgecolor='white', linewidth=1.5)
ax2.set_title('Sales by Category', fontsize=12, pad=10)
ax2.set_ylabel('Units Sold')
ax2.tick_params(axis='x', rotation=30)

# Add value labels on bars
for bar, val in zip(bars, cat_sales):
    ax2.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 5,
             str(val), ha='center', va='bottom', fontsize=9, fontweight='bold')

# --- 3. Scatter Plot: Customer Analysis ---
ax3 = fig.add_subplot(gs[0, 2])
scatter = ax3.scatter(visits, spending, c=visits, cmap='viridis',
                      alpha=0.6, s=30, edgecolors='white', linewidth=0.5)
ax3.set_title('Customer: Visits vs Spending', fontsize=12, pad=10)
ax3.set_xlabel('Visit Count')
ax3.set_ylabel('Spending (CNY)')
fig.colorbar(scatter, ax=ax3, label='Visits', shrink=0.8)

# Trend line
z = np.polyfit(visits, spending, 1)
p = np.poly1d(z)
x_line = np.linspace(visits.min(), visits.max(), 100)
ax3.plot(x_line, p(x_line), '--', color='red', alpha=0.8, linewidth=1.5,
         label='Trend')
ax3.legend(fontsize=8)

# --- 4. Pie Chart: Market Share ---
ax4 = fig.add_subplot(gs[1, 0])
explode = [0.05] * 5
wedges, texts, autotexts = ax4.pie(
    cat_sales, labels=categories, autopct='%1.1f%%',
    colors=COLORS[:5], explode=explode,
    shadow=True, startangle=90, pctdistance=0.8
)
for t in autotexts:
    t.set_fontsize(8)
    t.set_fontweight('bold')
ax4.set_title('Market Share Distribution', fontsize=12, pad=10)

# --- 5. Heatmap: Traffic by Hour & Day ---
ax5 = fig.add_subplot(gs[1, 1:])
days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
im = ax5.imshow(heat_data, cmap='YlOrRd', aspect='auto')
ax5.set_xticks(range(24))
ax5.set_xticklabels([f'{h}:00' for h in range(24)], fontsize=7, rotation=45)
ax5.set_yticks(range(7))
ax5.set_yticklabels(days)
ax5.set_title('Site Traffic Heatmap (by Hour & Day)', fontsize=12, pad=10)
fig.colorbar(im, ax=ax5, label='Visits', shrink=0.8)

# Add text annotations for peak hours
for i in range(7):
    for j in range(24):
        val = heat_data[i, j]
        if val > 25:
            ax5.text(j, i, str(val), ha='center', va='center',
                     fontsize=6, color='white', fontweight='bold')

plt.savefig('/tmp/dashboard.png', dpi=150, bbox_inches='tight')
print("Dashboard saved to /tmp/dashboard.png")
plt.close()
```

---

## 四、执行预览

```
Dashboard saved to /tmp/dashboard.png

[生成的图表包含]
+---------------------------------------------+
|  E-commerce Sales Dashboard 2024            |
+--------------+--------------+---------------+
| Revenue Line | Category Bar | Scatter Plot  |
| 上升趋势     | 对比柱状     | 相关分析       |
+--------------+--------------+---------------+
| Pie Chart    | Traffic Heatmap (wide)        |
| 份额分布     | 24h x 7day 热力图             |
+--------------+------------------------------+
```

图表效果：
- 折线图：带填充区域，峰值标注
- 柱状图：每根柱子颜色不同，顶部有数值
- 散点图：颜色映射 + 趋势线
- 饼图：阴影 + 突出显示
- 热力图：高峰时段标注白色数字

---

## 五、注意事项

| 场景 | 注意事项 | 说明 |
|------|---------|------|
| 中文字体 | 需手动配置 | `plt.rcParams['font.sans-serif'] = ['SimHei']` |
| 内存泄漏 | 大量绘图时 | 每次用完 `plt.close()` 关闭 Figure |
| DPI 设置 | 保存图片时 | 屏幕 72dpi，论文 300dpi，海报 600dpi |
| 交互模式 | Jupyter 中 | 用 `%%matplotlib inline` 或 `notebook` |
| 性能 | 大数据量散点图 | 超过 10 万点考虑降采样或用 `hexbin` |
| 样式冲突 | 多图绘制 | 每次 `plt.style.use()` 影响全局 |
| 文件格式 | savefig | PNG 通用，SVG 矢量无损，PDF 印刷级 |

---

## 六、避坑指南

### 错误：中文显示方块 → 正确：配置字体

```python
# Wrong: Chinese shows as squares
plt.title('销售趋势')

# Correct: Configure font explicitly
plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False  # Fix minus sign
plt.title('销售趋势')
```

### 错误：子图重叠 → 正确：用 tight_layout

```python
# Wrong: Labels overlap between subplots
fig, axes = plt.subplots(2, 2)

# Correct: Auto-adjust spacing
fig, axes = plt.subplots(2, 2)
fig.tight_layout(pad=2.0)

# Best: Use GridSpec for full control
gs = gridspec.GridSpec(2, 2, hspace=0.3, wspace=0.3)
```

### 错误：颜色不够用 → 正确：使用 colormap

```python
# Wrong: Hard-coding colors manually
colors = ['red', 'blue', 'green', 'orange', 'purple', 'pink']

# Correct: Use built-in colormaps
cmap = plt.cm.get_cmap('Set2', 8)
colors = [cmap(i) for i in range(8)]
```

### 错误：图例遮挡数据 → 正确：精确定位

```python
# Wrong: Legend covers data points
plt.legend()

# Correct: Place outside or specify position
plt.legend(loc='upper left', bbox_to_anchor=(1.02, 1), borderaxespad=0)
```

---

## 七、练习题

### 入门级

1. 绘制一条正弦曲线 `y = sin(x)`，x 范围 `[0, 2*pi]`，设置标题、坐标轴标签和网格
2. 生成一组随机数据（100 个点），绘制直方图，设置 20 个 bin，添加均值竖线

### 中级

3. 创建 2x2 子图布局，分别绘制折线图、柱状图、散点图、饼图，使用 `tight_layout` 防止重叠
4. 读取 CSV 文件，绘制某列数据的时间序列图，标注最大值和最小值点

### 高级

5. 使用 `GridSpec` 创建不规则布局：上方一个宽图占满，下方两个窄图并排，模拟仪表盘布局
6. 用 `FuncAnimation` 制作一个动态折线图，实时展示随机数据的滚动更新

---

## 八、知识点总结

```
Matplotlib 核心知识树
├── Figure（画布）
│   ├── 创建：plt.figure(figsize, dpi)
│   ├── 保存：savefig(path, dpi, bbox_inches)
│   └── 显示：show() / close()
├── Axes（坐标系）
│   ├── 创建：add_subplot() / subplots()
│   ├── 标题：set_title() / suptitle()
│   ├── 范围：set_xlim() / set_ylim()
│   └── 刻度：set_xticks() / tick_params()
├── 基础绘图
│   ├── plot() → 折线图
│   ├── bar() → 柱状图
│   ├── scatter() → 散点图
│   ├── hist() → 直方图
│   ├── pie() → 饼图
│   ├── imshow() → 热力图
│   ├── boxplot() → 箱线图
│   └── fill_between() → 填充区域
├── 装饰元素
│   ├── legend() → 图例
│   ├── colorbar() → 颜色条
│   ├── annotate() → 标注
│   ├── text() → 文本
│   └── grid() → 网格
└── 样式系统
    ├── style.use() → 预设样式
    ├── rcParams → 全局配置
    └── colormap → 颜色映射
```

---

## 九、举一反三

| 技能 | 基础用法 | 进阶场景 | 实战扩展 |
|------|---------|---------|---------|
| 折线图 | 单线趋势 | 多线对比 + 双 Y 轴 | 股票 K 线图 + 成交量 |
| 柱状图 | 简单计数 | 堆叠/分组 + 误差棒 | 月度报表自动生成 |
| 散点图 | 两维关系 | 气泡图（三维度） | 聚类结果可视化 |
| 热力图 | 矩阵展示 | 相关性矩阵 | 用户行为时序分析 |
| 子图 | 规则排列 | GridSpec 自定义 | 完整数据仪表盘 |
| 动画 | 静态图 | FuncAnimation | 实时监控面板 |

**替代库对比：**

| 库 | 优势 | 劣势 | 适用场景 |
|---|------|------|---------|
| Matplotlib | 全面、可控、出版级 | API 繁琐、交互弱 | 论文、报表、精细控制 |
| Seaborn | 统计图表、美观 | 封装层限制 | 数据探索、统计分析 |
| Plotly | 交互、Web 友好 | 大数据慢 | Web 仪表盘、演示 |
| Bokeh | 大数据、流式 | 学习曲线 | 实时监控、大数据可视化 |

---

## 十、参考资料

- [Matplotlib 官方文档](https://matplotlib.org/stable/index.html)
- [Matplotlib Gallery](https://matplotlib.org/stable/gallery/index.html) — 最实用的示例集
- [Python Data Science Handbook](https://jakevdp.github.io/PythonDataScienceHandbook/) — Jake VanderPlas
- [Matplotlib Cheatsheet](https://github.com/matplotlib/cheatsheets) — 官方速查表

---

## 十一、代码演进

### v1：最简折线图（5 行搞定）

```python
import matplotlib.pyplot as plt
plt.plot([1, 2, 3, 4], [10, 20, 25, 30])
plt.title('Simple Line')
plt.show()
```

### v2：面向对象 + 样式定制

```python
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(8, 5))
x = np.linspace(0, 2 * np.pi, 100)
ax.plot(x, np.sin(x), '-', label='sin(x)', linewidth=2)
ax.plot(x, np.cos(x), '--', label='cos(x)', linewidth=2)
ax.set_title('Trigonometric Functions', fontsize=14)
ax.legend()
ax.grid(True, alpha=0.3)
fig.tight_layout()
plt.savefig('trig.png', dpi=150)
```

### v3：完整仪表盘（本文实战代码）

- GridSpec 不规则布局
- 5 种图表类型组合
- 颜色主题 + 自动标注
- 高 DPI 输出
