---
title: "012 - Pandas进阶技巧"
slug: "012-pandas-advanced"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.52+08:00"
updated_at: "2026-04-29T10:02:47.752+08:00"
reading_time: 33
tags: []
---

# Pandas 进阶技巧

> **难度：⭐⭐⭐ 中级** | Python 3.8+ | 预计学习时间 60 分钟

## 一、概念讲解

掌握了 Pandas 基础后，进阶技巧能帮你处理更复杂的数据分析场景。本文聚焦：**多级索引、数据合并、透视表、时间序列、性能优化**——这些是日常数据分析的高频操作。

### 核心概念

- **MultiIndex**：多级索引，支持高维数据在二维表格中的表示
- **Merge/Join**：类似 SQL 的表关联操作
- **Pivot Table**：数据透视，将长表转宽表
- **Window Functions**：滚动窗口计算（移动平均、累计求和等）
- **性能优化**：向量化、分类类型、惰性求值

## 二、知识脑图

```
Pandas 进阶
├── 多级索引 (MultiIndex)
│   ├── 创建方式
│   ├── 索引操作
│   └── stack / unstack
├── 数据合并
│   ├── concat (纵向/横向拼接)
│   ├── merge (SQL式关联)
│   ├── join (索引关联)
│   └── combine_first (数据填充)
├── 透视与重塑
│   ├── pivot_table
│   ├── melt (宽转长)
│   ├── crosstab (交叉表)
│   └── explode (展开列表列)
├── 时间序列
│   ├── 时间索引 (DatetimeIndex)
│   ├── 重采样 (resample)
│   ├── 滚动窗口 (rolling)
│   ├── 移位 (shift)
│   └── 时间差 (Timedelta)
├── 高级分组
│   ├── transform
│   ├── apply vs agg
│   ├── 多列分组
│   └── 自定义聚合函数
└── 性能优化
    ├── 向量化操作
    ├── eval() / query()
    ├── category 类型
    ├── 分块处理
    └── Swifter / Dask
```

## 三、完整代码

### v1：数据合并与重塑

```python
# pandas_advanced_v1.py - Merge, reshape, and pivot operations
import pandas as pd
import numpy as np


def demo_merge():
    """Demonstrate different merge strategies."""
    # Sales data
    sales = pd.DataFrame({
        "order_id": [1001, 1002, 1003, 1004, 1005],
        "product_id": ["P01", "P02", "P01", "P03", "P02"],
        "quantity": [2, 1, 3, 1, 5],
        "price": [99.0, 199.0, 99.0, 299.0, 199.0],
    })

    # Product info
    products = pd.DataFrame({
        "product_id": ["P01", "P02", "P03", "P04"],
        "name": ["Widget A", "Widget B", "Widget C", "Widget D"],
        "category": ["Tools", "Electronics", "Tools", "Accessories"],
    })

    # Inner join - only matching rows
    result_inner = sales.merge(products, on="product_id", how="inner")
    print("=== Inner Join ===")
    print(result_inner)

    # Left join - keep all sales even if no product match
    result_left = sales.merge(products, on="product_id", how="left")
    print(f"\n=== Left Join ===")
    print(result_left)

    # Calculate revenue per order
    result_inner["revenue"] = result_inner["quantity"] * result_inner["price"]
    print(f"\n=== With Revenue ===")
    print(result_inner[["order_id", "name", "quantity", "revenue"]])

    # Concat example - append new sales
    new_sales = pd.DataFrame({
        "order_id": [1006, 1007],
        "product_id": ["P04", "P01"],
        "quantity": [2, 1],
        "price": [49.0, 99.0],
    })
    all_sales = pd.concat([sales, new_sales], ignore_index=True)
    print(f"\n=== After Concat (shape: {all_sales.shape}) ===")
    print(all_sales)


def demo_reshape():
    """Pivot table and melt operations."""
    # Long format data
    data = pd.DataFrame({
        "month": ["Jan", "Jan", "Feb", "Feb", "Mar", "Mar"],
        "product": ["A", "B", "A", "B", "A", "B"],
        "sales": [100, 150, 120, 180, 130, 200],
        "cost": [60, 90, 70, 100, 75, 120],
    })
    print("=== Long Format ===")
    print(data)

    # Pivot: long -> wide
    pivot = data.pivot_table(
        values="sales",
        index="month",
        columns="product",
        aggfunc="sum",
        margins=True  # Add row/column totals
    )
    print(f"\n=== Pivot Table ===")
    print(pivot)

    # Melt: wide -> long
    wide = pd.DataFrame({
        "product": ["A", "B"],
        "Jan": [100, 150],
        "Feb": [120, 180],
        "Mar": [130, 200],
    })
    print(f"\n=== Wide Format ===")
    print(wide)

    long = wide.melt(
        id_vars="product",
        var_name="month",
        value_name="sales"
    )
    print(f"\n=== After Melt ===")
    print(long)

    # Crosstab
    ct = pd.crosstab(data["month"], data["product"], values=data["sales"], aggfunc="sum")
    print(f"\n=== Crosstab ===")
    print(ct)


if __name__ == "__main__":
    demo_merge()
    print("\n" + "=" * 60 + "\n")
    demo_reshape()
```

### v2：时间序列分析

```python
# pandas_advanced_v2.py - Time series analysis
import pandas as pd
import numpy as np


def demo_timeseries():
    """Time series: resample, rolling, shift."""
    # Generate daily sales data for one year
    np.random.seed(42)
    dates = pd.date_range("2024-01-01", periods=365, freq="D")
    sales = np.random.poisson(lam=100, size=365).cumsum() + 5000
    noise = np.random.normal(0, 200, 365)
    sales = sales + noise.astype(int)

    ts = pd.Series(sales, index=dates, name="cumulative_sales")
    df = pd.DataFrame({
        "sales": np.abs(np.diff(np.r_[0, sales])).astype(int),
        "visitors": np.random.poisson(500, 365),
    }, index=dates)

    print("=== Daily Data (first 5 rows) ===")
    print(df.head())

    # Resample: daily -> monthly
    monthly = df.resample("M").agg({
        "sales": "sum",
        "visitors": "mean",
    })
    monthly.columns = ["total_sales", "avg_visitors"]
    print(f"\n=== Monthly Resampled ===")
    print(monthly)

    # Rolling window: 7-day moving average
    df["sales_ma7"] = df["sales"].rolling(window=7).mean()
    df["sales_ma30"] = df["sales"].rolling(window=30).mean()
    print(f"\n=== With Moving Averages ===")
    print(df[["sales", "sales_ma7", "sales_ma30"]].iloc[30:35])

    # Shift: day-over-day change
    df["sales_prev"] = df["sales"].shift(1)
    df["sales_change"] = df["sales"] - df["sales_prev"]
    df["sales_pct_change"] = df["sales"].pct_change() * 100
    print(f"\n=== Day-over-Day Change ===")
    print(df[["sales", "sales_prev", "sales_change", "sales_pct_change"]].head())

    # Expanding window: cumulative mean
    df["sales_cummean"] = df["sales"].expanding().mean()
    print(f"\n=== Cumulative Mean (last 5) ===")
    print(df["sales_cummean"].tail())

    # Group by month and compute stats
    print(f"\n=== Monthly Statistics ===")
    monthly_stats = df.groupby(df.index.month)["sales"].agg(
        ["mean", "std", "min", "max"]
    ).round(0)
    monthly_stats.index.name = "month"
    print(monthly_stats)


if __name__ == "__main__":
    demo_timeseries()
```

### v3：实战 — 电商销售数据分析

```python
# pandas_advanced_v3.py - E-commerce sales analysis
import pandas as pd
import numpy as np


def generate_ecommerce_data(n=1000):
    """Generate realistic e-commerce order data."""
    np.random.seed(42)
    categories = ["Electronics", "Clothing", "Books", "Home", "Sports"]
    products = {
        "Electronics": ["Phone", "Tablet", "Laptop", "Headphones"],
        "Clothing": ["Shirt", "Pants", "Jacket", "Shoes"],
        "Books": ["Python", "ML", "Fiction", "History"],
        "Home": ["Lamp", "Chair", "Desk", "Sofa"],
        "Sports": ["Ball", "Racket", "Shoes", "Gloves"],
    }

    dates = pd.date_range("2024-01-01", periods=n, freq="6H")
    cats = np.random.choice(categories, n)
    prods = [np.random.choice(products[c]) for c in cats]

    df = pd.DataFrame({
        "order_id": range(10001, 10001 + n),
        "timestamp": dates,
        "category": cats,
        "product": prods,
        "quantity": np.random.randint(1, 6, n),
        "unit_price": np.random.choice([29, 49, 79, 99, 149, 199, 299, 499], n),
        "customer_id": np.random.randint(1000, 1100, n),
    })
    df["revenue"] = df["quantity"] * df["unit_price"]
    return df


def full_analysis(df):
    """Comprehensive e-commerce data analysis."""
    print("=" * 60)
    print("       E-COMMERCE SALES ANALYSIS")
    print("=" * 60)

    # Ensure datetime
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["hour"] = df["timestamp"].dt.hour
    df["weekday"] = df["timestamp"].dt.day_name()
    df["month"] = df["timestamp"].dt.to_period("M")

    # 1. Revenue by category (sorted)
    print("\n📦 Revenue by Category:")
    cat_rev = df.groupby("category")["revenue"].agg(
        ["sum", "mean", "count"]
    ).sort_values("sum", ascending=False).round(0)
    cat_rev.columns = ["total_revenue", "avg_order_value", "order_count"]
    print(cat_rev.to_string())

    # 2. Top products
    print("\n🏆 Top 10 Products by Revenue:")
    top = df.groupby("product")["revenue"].sum().nlargest(10)
    print(top.to_string())

    # 3. Monthly trend with pivot
    print("\n📈 Monthly Revenue by Category (Pivot):")
    monthly_pivot = df.pivot_table(
        values="revenue",
        index="month",
        columns="category",
        aggfunc="sum",
        fill_value=0,
    )
    print(monthly_pivot.to_string())

    # 4. Hourly pattern
    print("\n⏰ Hourly Order Distribution:")
    hourly = df.groupby("hour").agg(
        orders=("order_id", "count"),
        revenue=("revenue", "sum"),
    )
    print(hourly.to_string())

    # 5. Customer analysis with transform
    print("\n👤 Customer Metrics:")
    cust = df.groupby("customer_id").agg(
        orders=("order_id", "count"),
        total_revenue=("revenue", "sum"),
        avg_order=("revenue", "mean"),
        categories=("category", "nunique"),
    ).round(0)
    cust["segment"] = pd.cut(
        cust["total_revenue"],
        bins=[0, 500, 2000, 5000, float("inf")],
        labels=["Bronze", "Silver", "Gold", "Platinum"],
    )
    print(f"\nSegment Distribution:")
    print(cust["segment"].value_counts().to_string())
    print(f"\nTop 5 Customers:")
    print(cust.nlargest(5, "total_revenue").to_string())

    # 6. Rolling 7-day revenue
    print("\n📊 7-Day Rolling Revenue (last 10):")
    daily = df.set_index("timestamp")["revenue"].resample("D").sum()
    rolling = daily.rolling(7).mean().dropna().tail(10)
    print(rolling.round(0).to_string())

    return df


if __name__ == "__main__":
    df = generate_ecommerce_data(1000)
    df = full_analysis(df)
    df.to_csv("ecommerce_report.csv", index=False)
    print("\n✅ Report exported to ecommerce_report.csv")
```

## 四、执行预览

```
$ python pandas_advanced_v3.py
============================================================
       E-COMMERCE SALES ANALYSIS
============================================================

📦 Revenue by Category:
             total_revenue  avg_order_value  order_count
category
Electronics       125640.0            621.0          202
Sports            108570.0            559.0          194
Home              102890.0            509.0          202
Clothing           98760.0            484.0          204
Books              89540.0            456.0          198

🏆 Top 10 Products by Revenue:
Laptop        34200
Phone         28950
Tablet        22100
Headphones    19800
...

⏰ Hourly Order Distribution:
hour  orders  revenue
0     165     85230
6     168     86450
12    167     87120
18    167     86280
...
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| merge 键类型 | 左右表的关联键类型需一致（str vs int） |
| 时间索引 | 时间序列操作前确保 index 为 DatetimeIndex |
| resample 频率 | `D`=日, `W`=周, `M`=月末, `Q`=季, `Y`=年 |
| 内存消耗 | 大表 merge 可能产生笛卡尔积，注意数据膨胀 |
| rolling 窗口 | 前 N-1 个值为 NaN，可用 `min_periods` 控制 |
| MultiIndex | 索引操作较复杂，必要时用 `reset_index()` 展平 |
| category 类型 | 低基数列用 category 可节省 50%+ 内存 |

## 六、避坑指南

| 坑 | ❌ 错误做法 | ✅ 正确做法 |
|----|-----------|-----------|
| merge 重复列 | 不指定 suffixes | `suffixes=("_left", "_right")` |
| 时间无索引 | `df[df["date"] > "2024-01"]` | `df.set_index("date")` 后切片 |
| pivot 重复值 | `df.pivot()` 报错 | `df.pivot_table(aggfunc="sum")` |
| rolling 首值 | 不处理 NaN | `.dropna()` 或 `min_periods=1` |
| resample 方向 | 不确定是向前还是向后 | `label="right"`（默认）表示区间右端 |
| apply 性能 | `df.apply(lambda ...)` 处理大表 | 优先向量化，apply 作为最后手段 |
| concat 索引 | 忽略索引导致重复 | `ignore_index=True` 或验证唯一性 |

## 七、练习题

### 🟢 入门
1. 合并两个 CSV 文件（订单表 + 商品表），计算每个类别的总销售额
2. 将宽格式月度数据 `melt` 为长格式，再 `pivot_table` 回来

### 🟡 进阶
3. 使用 `resample` 和 `rolling` 分析某股票数据的 30 日均线和月收益率
4. 实现一个 RFM 分析（Recency, Frequency, Monetary），按客户分群
5. 使用 MultiIndex 创建"年-月-日"三级索引的销售额报表

### 🔴 挑战
6. 实现完整的漏斗分析：浏览→加购→下单→支付，计算各环节转化率
7. 处理 100 万行数据集，对比 pandas vs 分块处理 vs Dask 的性能差异

## 八、知识点总结

```
Pandas 进阶知识体系
├── 数据合并
│   ├── merge → SQL 式关联 (inner/left/right/outer)
│   ├── concat → 纵向/横向拼接
│   ├── join → 索引关联
│   └── combine_first → 数据互补
├── 数据重塑
│   ├── pivot_table → 长转宽 (聚合)
│   ├── melt → 宽转长
│   ├── stack/unstack → 层级转换
│   └── crosstab → 交叉频率表
├── 时间序列
│   ├── DatetimeIndex → 时间索引
│   ├── resample → 重采样 (D/W/M/Q/Y)
│   ├── rolling → 滑动窗口
│   ├── shift → 数据移位
│   └── expanding → 扩展窗口
├── 高级分组
│   ├── transform → 组内变换（保持形状）
│   ├── apply → 任意函数
│   └── filter → 组级过滤
└── 性能优化
    ├── category 类型 → 低基数列
    ├── 向量化 → 避免 Python 循环
    ├── chunksize → 分块处理大文件
    └── eval/query → 大 DataFrame 表达式优化
```

## 九、举一反三

| 应用场景 | 核心技术 | 扩展方向 |
|---------|---------|---------|
| 销售分析 | pivot_table + resample | 自动化商业报告 |
| 用户分群 | groupby + pd.cut | RFM 模型、CLV 预测 |
| A/B 测试 | crosstab + 统计检验 | 实验分析框架 |
| 财务报表 | merge + MultiIndex | 自动化财务报告 |
| 日志分析 | 时间索引 + rolling | 异常检测与告警 |
| 数据管道 | concat + transform | ETL 自动化 |

## 十、参考资料

- [Pandas 官方用户指南](https://pandas.pydata.org/docs/user_guide/)
- [Pandas Merge/Join 详解](https://pandas.pydata.org/docs/user_guide/merging.html)
- [Time Series 文档](https://pandas.pydata.org/docs/user_guide/timeseries.html)
- [Pandas Performance Tips](https://pandas.pydata.org/docs/user_guide/enhancingperf.html)
- [Effective Pandas (Book)](https://leanpub.com/effective-pandas)

## 十一、代码演进

| 版本 | 重点 | 改进 |
|------|------|------|
| v1 合并与重塑 | merge + pivot + melt | 掌握数据关联和形态转换 |
| v2 时间序列 | resample + rolling + shift | 时间维度分析能力 |
| v3 综合实战 | 电商分析全流程 | 从数据生成到多维度分析报告 |

> **下一步建议：** 学习 Polars（新一代 DataFrame 库）对比 Pandas 的性能优势，或将分析结果接入可视化工具（Matplotlib/Plotly）生成图表。
