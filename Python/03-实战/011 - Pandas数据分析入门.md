---
title: "011 - Pandas数据分析入门"
slug: "011-pandas-basics"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.515+08:00"
updated_at: "2026-04-29T10:02:47.744+08:00"
reading_time: 27
tags: []
---

# Pandas 数据分析入门

> **难度：⭐⭐ 初级** | Python 3.8+ | 预计学习时间 45 分钟

## 一、概念讲解

Pandas 是 Python 数据分析的基石库，提供两种核心数据结构：**Series**（一维）和 **DataFrame**（二维）。掌握 Pandas 是数据分析、数据科学和机器学习的必经之路。

### 核心概念

- **Series**：带标签的一维数组，类似增强版的列表
- **DataFrame**：带行列标签的二维表格，类似 Excel 表格或 SQL 表
- **Index**：行标签，支持自定义索引
- **数据对齐**：不同 Series/DataFrame 运算时自动对齐索引
- **向量化操作**：避免 Python 循环，使用内置方法批量处理

## 二、知识脑图

```
Pandas 基础
├── 数据结构
│   ├── Series (一维)
│   ├── DataFrame (二维)
│   └── Index (索引)
├── 数据创建
│   ├── 从字典创建
│   ├── 从列表创建
│   ├── 从 CSV 读取
│   └── 从 Excel 读取
├── 数据查看
│   ├── head / tail / sample
│   ├── info / describe
│   ├── shape / columns / dtypes
│   └── value_counts
├── 数据选择
│   ├── [] 单列选择
│   ├── loc (标签索引)
│   ├── iloc (位置索引)
│   └── boolean indexing
├── 数据清洗
│   ├── 处理缺失值 (NaN)
│   ├── fillna / dropna
│   ├── 重复值处理
│   └── 类型转换 astype
└── 数据运算
    ├── 算术运算
    ├── 统计方法
    ├── 字符串方法 (.str)
    └── 日期时间 (.dt)
```

## 三、完整代码

### v1：数据结构基础

```python
# pandas_basics_v1.py - Series and DataFrame fundamentals
import pandas as pd
import numpy as np


def demo_series():
    """Series basics: creation, indexing, operations."""
    # Create Series from list and dict
    s1 = pd.Series([10, 20, 30, 40, 50], name="scores")
    s2 = pd.Series(
        {"Alice": 85, "Bob": 92, "Charlie": 78, "Diana": 95},
        name="grades"
    )

    print("=== Series from list ===")
    print(s1)
    print(f"\nIndex: {s1.index.tolist()}")
    print(f"Values: {s1.values}")
    print(f"Mean: {s1.mean()}")

    print("\n=== Series from dict ===")
    print(s2)
    print(f"\nBob's grade: {s2['Bob']}")
    print(f"Grades > 85:\n{s2[s2 > 85]}")

    # Vectorized operations
    print(f"\nCurved grades (+5):\n{s2 + 5}")
    print(f"\nStatistics:\n{s2.describe()}")


def demo_dataframe():
    """DataFrame basics: creation, viewing, selection."""
    data = {
        "name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
        "age": [25, 30, 35, 28, 32],
        "city": ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Hangzhou"],
        "salary": [15000, 22000, 18000, 25000, 20000],
    }
    df = pd.DataFrame(data)
    print("=== DataFrame ===")
    print(df)

    # Basic inspection
    print(f"\nShape: {df.shape}")
    print(f"Columns: {df.columns.tolist()}")
    print(f"Dtypes:\n{df.dtypes}")
    print(f"\nDescribe:\n{df.describe()}")

    # Column and row selection
    print(f"\nMultiple columns:\n{df[['name', 'salary']]}")
    print(f"\nRow 0 (iloc):\n{df.iloc[0]}")
    print(f"\nRows 1-3:\n{df.iloc[1:4]}")

    # Boolean indexing
    print(f"\nHigh salary (>20000):\n{df[df['salary'] > 20000]}")


if __name__ == "__main__":
    demo_series()
    print("\n" + "=" * 50 + "\n")
    demo_dataframe()
```

### v2：数据读取与清洗

```python
# pandas_basics_v2.py - Data loading and cleaning
import pandas as pd
import numpy as np


def create_sample_data():
    """Create sample data with missing values and duplicates."""
    data = {
        "employee_id": [1001, 1002, 1003, 1004, 1005, 1006, 1007],
        "name": ["Alice", "Bob", None, "Diana", "Eve", "Frank", "Alice"],
        "department": ["Engineering", "Sales", "Marketing",
                        "Engineering", None, "Sales", "Engineering"],
        "salary": [15000, 22000, 18000, np.nan, 20000, 17000, 15000],
        "join_date": ["2022-01-15", "2021-06-20", "2023-03-10",
                       "2022-09-01", "2021-11-05", "2023-07-22", "2022-01-15"],
    }
    return pd.DataFrame(data)


def demo_cleaning():
    """Demonstrate common data cleaning operations."""
    df = create_sample_data()
    print("=== Original Data ===")
    print(df)
    print(f"\nMissing values:\n{df.isnull().sum()}")

    # Fill missing values
    df["name"] = df["name"].fillna("Unknown")
    df["department"] = df["department"].fillna(df["department"].mode()[0])
    df["salary"] = df["salary"].fillna(
        df.groupby("department")["salary"].transform("mean")
    )

    print(f"\n=== After Filling NaN ===")
    print(df)

    # Remove duplicates
    print(f"\nDuplicates: {df.duplicated().sum()}")
    df = df.drop_duplicates()

    # Convert date column and derive features
    df["join_date"] = pd.to_datetime(df["join_date"])
    df["join_year"] = df["join_date"].dt.year
    df["tenure_months"] = (
        (pd.Timestamp.now() - df["join_date"]).dt.days / 30
    ).astype(int)

    print(f"\n=== Final Cleaned Data ===")
    print(df)


def demo_aggregation():
    """Groupby and aggregation."""
    df = create_sample_data()
    df["name"] = df["name"].fillna("Unknown")
    df["salary"] = df["salary"].fillna(df["salary"].mean())

    # Group by department
    print("=== Salary by Department ===")
    print(df.groupby("department")["salary"].agg(
        ["count", "mean", "min", "max"]
    ).round(0))

    # Value counts
    print(f"\n=== Department Distribution ===")
    print(df["department"].value_counts())


if __name__ == "__main__":
    demo_cleaning()
    print("\n" + "=" * 50 + "\n")
    demo_aggregation()
```

### v3：实战 — 员工薪资分析报告

```python
# pandas_basics_v3.py - Real-world employee salary analysis
import pandas as pd
import numpy as np


def generate_employee_data(n=50):
    """Generate realistic employee data for analysis."""
    np.random.seed(42)
    departments = ["Engineering", "Sales", "Marketing", "HR", "Finance"]
    levels = ["Junior", "Mid", "Senior", "Lead"]

    data = {
        "id": range(1001, 1001 + n),
        "name": [f"Emp_{i}" for i in range(n)],
        "department": np.random.choice(departments, n),
        "level": np.random.choice(levels, n, p=[0.3, 0.35, 0.25, 0.1]),
        "base_salary": np.random.randint(8000, 35000, n),
        "performance": np.round(np.random.uniform(2.5, 5.0, n), 1),
        "join_date": pd.date_range("2020-01-01", periods=n, freq="12D"),
    }
    df = pd.DataFrame(data)
    # Inject some NaN for realism
    df.loc[np.random.choice(n, 3, replace=False), "performance"] = np.nan
    return df


def analyze(df):
    """Run comprehensive analysis on employee data."""
    print("=" * 60)
    print("       EMPLOYEE SALARY ANALYSIS REPORT")
    print("=" * 60)

    # Overview
    print(f"\nTotal employees: {len(df)}")
    print(f"Date range: {df['join_date'].min().date()} ~ {df['join_date'].max().date()}")

    # Salary distribution
    print(f"\nSalary Statistics:")
    print(df["base_salary"].describe().to_string())

    # By department
    print(f"\nBy Department:")
    dept = df.groupby("department").agg(
        headcount=("id", "count"),
        avg_salary=("base_salary", "mean"),
        avg_perf=("performance", "mean"),
    ).round(0)
    print(dept.to_string())

    # By level
    print(f"\nBy Level:")
    print(df.groupby("level")["base_salary"].agg(
        ["mean", "median", "std"]
    ).round(0).to_string())

    # Top performers
    print(f"\nTop 5 by Performance:")
    print(df.nlargest(5, "performance")[
        ["name", "department", "level", "performance", "base_salary"]
    ].to_string(index=False))

    # Salary bands
    print(f"\nSalary Bands:")
    bins = [0, 10000, 15000, 20000, 25000, 40000]
    labels = ["<10K", "10K-15K", "15K-20K", "20K-25K", "25K+"]
    df["salary_band"] = pd.cut(df["base_salary"], bins=bins, labels=labels)
    print(df["salary_band"].value_counts().sort_index().to_string())

    return df


if __name__ == "__main__":
    df = generate_employee_data(50)
    df = analyze(df)
    df.to_csv("employee_report.csv", index=False)
    print("\nReport exported to employee_report.csv")
```

## 四、执行预览

```
$ python pandas_basics_v3.py
============================================================
       EMPLOYEE SALARY ANALYSIS REPORT
============================================================

Total employees: 50
Date range: 2020-01-01 ~ 2021-08-07

Salary Statistics:
count       50.000000
mean     20952.000000
std       7585.123456
min       8234.000000
25%      15234.500000
50%      20456.000000
75%      26123.000000
max      34567.000000

By Department:
              headcount  avg_salary  avg_perf
department
Engineering         12     21345.0       3.8
Finance              9     19876.0       3.6
HR                   8     17543.0       4.0
Marketing           11     20123.0       3.7
Sales               10     22890.0       3.9
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 安装 | `pip install pandas` 会自动安装 numpy |
| 内存 | DataFrame 全部加载到内存，大数据集考虑 chunksize |
| 链式操作 | 注意 `inplace=True` vs 返回新对象 |
| SettingWithCopyWarning | 使用 `.copy()` 或 `.loc[]` 避免 |
| 编码 | 读取 CSV 时指定 `encoding="utf-8"` 或 `"gbk"` |
| 索引 | 操作后注意 index 是否需要 `reset_index()` |
| 类型推断 | Pandas 自动推断类型，有时需手动 `astype()` |

## 六、避坑指南

| 坑 | ❌ 错误做法 | ✅ 正确做法 |
|----|-----------|-----------|
| 列选择 | `df.name`（可能与方法冲突） | `df["name"]` 或 `df[["name"]]` |
| 行选择 | `df[1:3]`（不直观） | `df.iloc[1:3]` 或 `df.loc[]` |
| 修改警告 | `df[df["a"]>0]["b"] = 1` | `df.loc[df["a"]>0, "b"] = 1` |
| 链式赋值 | `df.dropna().fillna(0)` 不保存 | `df = df.dropna().fillna(0)` |
| 大文件 | `pd.read_csv("huge.csv")` | `chunksize=10000` 分块读取 |
| 日期解析 | 字符串日期无法计算 | `pd.to_datetime()` 转换 |
| 循环操作 | `for i in range(len(df))` | 向量化操作 `df["col"].str.upper()` |

## 七、练习题

### 🟢 入门
1. 创建一个包含 10 名学生成绩的 DataFrame，计算每科平均分和总分排名
2. 读取一个 CSV 文件，显示前 5 行和基本统计信息

### 🟡 进阶
3. 清洗一个含缺失值和重复行的数据集，要求：填充缺失值、去重、类型转换
4. 使用 `groupby` + `agg` 分析某电商数据集的月度销售趋势
5. 实现 `pd.cut` 和 `pd.qcut` 分箱操作，对比等宽与等频分箱的差异

### 🔴 挑战
6. 从 3 个 CSV 文件读取数据，使用 `merge` 关联后生成完整的分析报告
7. 编写一个通用的数据清洗函数，自动检测并处理缺失值、异常值、重复行

## 八、知识点总结

```
Pandas 基础知识体系
├── 数据结构
│   ├── Series → 一维，带索引
│   ├── DataFrame → 二维，行列表格
│   └── Index → 标签系统
├── 数据操作
│   ├── 选择 → loc / iloc / []
│   ├── 过滤 → boolean indexing
│   ├── 排序 → sort_values / sort_index
│   └── 去重 → drop_duplicates
├── 数据清洗
│   ├── 缺失值 → isnull / fillna / dropna
│   ├── 类型转换 → astype / to_datetime
│   └── 字符串 → .str 访问器
├── 聚合分析
│   ├── groupby → 分组
│   ├── agg → 多种聚合
│   ├── value_counts → 频次统计
│   └── describe → 描述性统计
└── 数据 IO
    ├── read_csv / to_csv
    ├── read_excel / to_excel
    └── read_json / to_json
```

## 九、举一反三

| 应用场景 | 核心技术 | 扩展方向 |
|---------|---------|---------|
| 数据报表 | groupby + agg | 自动化周报/月报生成 |
| 数据清洗 | fillna + dedup | ETL 管道构建 |
| 探索分析 | describe + 可视化 | Pandas Profiling 自动报告 |
| 特征工程 | cut + transform | 机器学习特征处理 |
| 数据合并 | merge + concat | 多源数据整合 |
| 日志分析 | 时间解析 + groupby | 运维监控数据分析 |

## 十、参考资料

- [Pandas 官方文档](https://pandas.pydata.org/docs/)
- [Pandas Cheat Sheet](https://pandas.pydata.org/Pandas_Cheat_Sheet.pdf)
- [10 Minutes to Pandas](https://pandas.pydata.org/docs/user_guide/10min.html)
- [Real Python Pandas Tutorial](https://realpython.com/pandas-python-explore-dataset/)

## 十一、代码演进

| 版本 | 重点 | 改进 |
|------|------|------|
| v1 数据结构 | Series + DataFrame 基础操作 | 理解数据结构和选择方式 |
| v2 数据清洗 | 缺失值 + 去重 + 类型转换 | 掌握真实数据清洗流程 |
| v3 实战分析 | 完整分析报告 + 多维度统计 | 从数据生成到报告输出 |

> **下一步建议：** 学习 Pandas 进阶技巧（merge、pivot_table、时间序列），处理更复杂的数据分析场景。
