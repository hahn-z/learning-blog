---
title: "008 - Django ORM 深入：从基础查询到事务与性能优化"
slug: "008-django-orm"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.5+08:00"
updated_at: "2026-04-29T10:02:47.723+08:00"
reading_time: 26
tags: []
---

## 难度标注

> **难度：⭐⭐⭐ 中级** | 预计阅读时间：18分钟 | 前置知识：Django基础、SQL基础

## 概念讲解

### ORM 是什么？

ORM（Object-Relational Mapping）把数据库表映射为 Python 类，让你用 **Python 代码操作数据库**，而不是写 SQL。

```
Python 对象  <->  ORM  <->  数据库表
Article.objects.filter(title__contains="DRF")
-> SELECT * FROM article WHERE title LIKE '%DRF%'
```

### Django ORM 核心能力

| 能力 | 说明 | 示例 |
|------|------|------|
| 查询 | filter/exclude/annotate | `Article.objects.filter(views__gte=100)` |
| 关联 | ForeignKey/ManyToMany/OneToOne | `article.author.username` |
| 聚合 | Count/Sum/Avg/Max/Min | `Comment.objects.count()` |
| 事务 | atomic/transaction | `with transaction.atomic():` |
| 迁移 | makemigrations/migrate | 版本化数据库变更 |
| QuerySet 惰性 | 不执行不查询 | 链式调用直到求值 |

## 脑图

```
Django ORM 深入
├── 查询
│   ├── filter / exclude / get
│   ├── Q 对象（复杂 OR 查询）
│   ├── F 对象（字段间比较/更新）
│   ├── annotate（注解/计算字段）
│   └── aggregate（聚合）
├── 关联
│   ├── ForeignKey（多对一）
│   ├── ManyToManyField（多对多）
│   ├── OneToOneField（一对一）
│   ├── select_related（JOIN 优化）
│   └── prefetch_related（二次查询优化）
├── 性能
│   ├── only / defer（字段懒加载）
│   ├── bulk_create / bulk_update
│   ├── iterator()（大结果集流式）
│   └── explain()（查看执行计划）
├── 事务
│   ├── atomic()
│   ├── savepoint
│   └── on_commit 回调
└── 高级
    ├── Raw SQL / raw()
    ├── Extra / annotations
    ├── 自定义 Manager
    └── 多数据库路由
```

## 完整代码：电商数据模型

### v1 基础版本 - 模型定义 + 简单查询

```python
# models.py - v1: basic models
from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class Product(models.Model):
    name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="products")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Order(models.Model):
    user = models.ForeignKey("auth.User", on_delete=models.CASCADE)
    products = models.ManyToManyField(Product, through="OrderItem")
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default="pending")

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)  # snapshot price
```

```python
# queries_v1.py - basic CRUD
from .models import Product, Category, Order

# Create
cat = Category.objects.create(name="Electronics")
prod = Product.objects.create(name="MacBook", price=12999.00, stock=50, category=cat)

# Read
products = Product.objects.filter(price__gte=1000, stock__gt=0)
product = Product.objects.get(name="MacBook")

# Update
Product.objects.filter(name="MacBook").update(price=11999.00)

# Delete
Product.objects.filter(stock=0).delete()
```

### v2 进阶版本 - 关联查询 + 聚合 + Q/F

```python
# queries_v2.py - advanced queries
from django.db.models import Count, Sum, Avg, F, Q
from .models import Product, Category, Order

# --- Q objects: complex OR conditions ---
# Find products: (price < 500 AND in stock) OR (name contains "Pro")
products = Product.objects.filter(
    Q(price__lt=500, stock__gt=0) | Q(name__icontains="Pro")
)

# --- F objects: compare/update fields dynamically ---
# Increase all prices by 10%
Product.objects.update(price=F("price") * 1.10)

# --- Aggregation ---
# Total revenue
revenue = OrderItem.objects.aggregate(
    total=Sum(F("quantity") * F("price"))
)
# -> {'total': Decimal('258000.00')}

# Average price per category
Category.objects.annotate(
    avg_price=Avg("products__price"),
    product_count=Count("products")
).values("name", "avg_price", "product_count")
# -> [{'name':'Electronics','avg_price':8500,'product_count':12}, ...]

# --- select_related vs prefetch_related ---
# select_related: ForeignKey (SQL JOIN, single query)
orders = Order.objects.select_related("user").all()

# prefetch_related: ManyToMany / reverse FK (2 queries)
categories = Category.objects.prefetch_related("products").all()
for cat in categories:
    products = list(cat.products.all())  # no extra query

# --- Annotation with Case/When ---
from django.db.models import Case, When, Value, CharField

products = Product.objects.annotate(
    stock_status=Case(
        When(stock=0, then=Value("out_of_stock")),
        When(stock__lt=10, then=Value("low")),
        default=Value("in_stock"),
        output_field=CharField(),
    )
)
```

### v3 生产版本 - 事务 + 批量操作 + 性能优化

```python
# queries_v3.py - production patterns
from django.db import transaction
from django.db.models import F, Sum
from .models import Product, Order, OrderItem

# --- Transaction with atomic ---
def create_order(user, items):
    """
    Create order with stock deduction in a single transaction.
    items = [{"product_id": 1, "quantity": 2}, ...]
    """
    with transaction.atomic():
        order = Order.objects.create(user=user, status="pending")

        for item in items:
            product = Product.objects.select_for_update().get(pk=item["product_id"])

            if product.stock < item["quantity"]:
                raise ValueError(f"Insufficient stock for {product.name}")

            # Deduct stock using F() to avoid race condition
            Product.objects.filter(pk=product.pk).update(
                stock=F("stock") - item["quantity"]
            )

            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=item["quantity"],
                price=product.price,  # snapshot current price
            )

        # Calculate total
        total = order.items.aggregate(
            total=Sum(F("quantity") * F("price"))
        )["total"]

        order.status = "confirmed"
        order.save()

    return order

# --- Bulk operations ---
# Bulk create (single INSERT)
new_products = [
    Product(name=f"Product {i}", price=99.00, stock=100, category=cat)
    for i in range(1000)
]
Product.objects.bulk_create(new_products, batch_size=500)

# Bulk update (single UPDATE)
products = Product.objects.filter(price__lt=100)
for p in products:
    p.price *= 1.10
Product.objects.bulk_update(products, ["price"], batch_size=500)

# --- Performance: only/defer ---
# Only load needed fields (saves memory and bandwidth)
Product.objects.only("name", "price").all()

# --- Performance: iterator for large datasets ---
for product in Product.objects.iterator(chunk_size=1000):
    process(product)  # memory-efficient iteration

# --- Custom Manager ---
class ProductManager(models.Manager):
    def available(self):
        return self.filter(stock__gt=0, is_active=True)

    def by_category(self, category_name):
        return self.filter(category__name=category_name)

class Product(models.Model):
    # ... fields ...
    objects = ProductManager()  # override default manager

# Usage: Product.objects.available().filter(price__lt=1000)
```

## 执行预览

```bash
python manage.py shell

>>> from shop.models import *
>>> Category.objects.annotate(product_count=Count("products")).values("name","product_count")
<QuerySet [{'name': 'Electronics', 'product_count': 12}]>

>>> Product.objects.filter(Q(price__lt=500) | Q(name__contains="Pro"))
<QuerySet [<Product: MacBook Pro>, <Product: USB Cable>]>

>>> Product.objects.update(price=F("price")*1.1)
12  # 12 rows updated

>>> with transaction.atomic():
...     order = create_order(user, [{"product_id":1,"quantity":2}])
>>> order.status
'confirmed'

>>> Product.objects.explain()
"Seq Scan on shop_product  (cost=0.00..15.50 rows=550 width=200)"
```

## 注意事项

| 项目 | 说明 | 建议 |
|-----|------|------|
| N+1 问题 | 循环中访问关联对象 | `select_related`/`prefetch_related` |
| QuerySet 惰性 | 赋值不执行查询 | 注意在循环外调用 `.all()` |
| F() 并发 | 更新时用 F() 避免竞态 | `stock=F("stock")-1` |
| select_for_update | 事务中锁定行 | 配合 `transaction.atomic()` 使用 |
| bulk_create 限制 | 不触发 `save()` 信号 | ManyToMany 不支持批量 |
| 迁移风险 | 删字段会丢数据 | 生产用 `--fake` + 手动 SQL |

## 避坑指南

❌ **在循环中逐条查询关联对象**
```python
for order in Order.objects.all():
    print(order.user.name)  # N+1 query!
```
✅ **用 select_related 一次查询**
```python
for order in Order.objects.select_related("user").all():
    print(order.user.name)  # 1 query total
```

❌ **直接赋值更新计数字段（竞态条件）**
```python
product.stock -= 1
product.save()  # race condition!
```
✅ **用 F() 原子更新**
```python
Product.objects.filter(pk=pk).update(stock=F("stock")-1)
```

❌ **对大数据集用 list() 全部加载**
✅ **用 `.iterator(chunk_size=1000)` 流式处理**

❌ **在 Django 信号里做重型操作**
✅ **用 `transaction.on_commit()` 延迟到事务提交后**

## 练习题

🟢 **基础题：构建查询**
给定 Product 模型，写出：价格在 100-500 之间、库存 > 0、按价格降序的查询。

🟡 **进阶题：统计报表**
用 annotate + aggregate 统计每个用户的：订单数、总消费金额、平均客单价。

🔴 **挑战题：库存扣减系统**
实现一个 `deduct_stock(product_id, quantity)` 函数，要求：事务保护、并发安全（select_for_update）、库存不足抛异常、记录操作日志。

## 知识点总结

```
Django ORM
├── 基础查询
│   ├── filter / exclude / get / values
│   ├── 查找表达式：__gt, __contains, __icontains, __in...
│   └── 排序：order_by() / Meta.ordering
├── 高级查询
│   ├── Q() - OR / NOT 条件组合
│   ├── F() - 字段引用 / 原子更新
│   ├── annotate - 行级计算
│   └── aggregate - 全局聚合
├── 关联优化
│   ├── select_related - FK JOIN
│   ├── prefetch_related - 反向/多对多
│   └── Prefetch对象 - 控制预查询
├── 性能
│   ├── only / defer - 字段裁剪
│   ├── bulk_create / bulk_update
│   └── iterator - 流式读取
└── 事务
    ├── atomic() - 事务管理
    ├── select_for_update - 行锁
    └── on_commit - 提交后回调
```

## 举一反三

| 场景 | 方案 | 关键 API |
|------|------|----------|
| 分页查询 | `Paginator` 或切片 | `qs[offset:offset+limit]` |
| 全文搜索 | PostgreSQL `SearchVector` | `SearchVectorField` |
| 软删除 | 自定义 `SoftDeleteManager` | 过滤 `is_deleted=False` |
| 多租户 | 自定义 Manager + Middleware | 自动注入 `tenant_id` 过滤 |
| 读写分离 | 数据库路由 `DATABASE_ROUTERS` | `db_for_read` / `db_for_write` |
| 慢查询排查 | `connection.queries` + Silk | SQL 日志分析 |

## 参考资料

- [Django ORM 官方文档 - Making queries](https://docs.djangoproject.com/en/stable/topics/db/queries/)
- [Django ORM aggregation](https://docs.djangoproject.com/en/stable/topics/db/aggregation/)
- [Django Database transactions](https://docs.djangoproject.com/en/stable/topics/db/transactions/)
- [django-silk - 请求 profiling 工具](https://github.com/jazzband/django-silk)

## 代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 | 基础模型 + 简单 CRUD | 学习入门 |
| v2 | Q/F + 聚合 + 关联优化 | 中等复杂度项目 |
| v3 | 事务 + 批量 + 并发安全 | 生产环境 |
