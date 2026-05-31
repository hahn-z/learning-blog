---
title: "016 - Celery 任务队列：从入门到生产级部署"
slug: "016-celery"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.544+08:00"
updated_at: "2026-04-29T10:02:47.784+08:00"
reading_time: 22
tags: []
---

# Celery 任务队列：从入门到生产级部署

> **难度：⭐⭐⭐ 中高级** | **预计阅读：20 分钟** | **Python 3.8+**

## 一、概念讲解

Celery 是 Python 生态中最流行的分布式任务队列框架。它解决了什么问题？

**场景**：用户上传了一个 500MB 的视频，你的 Web 服务器需要花 3 分钟来转码。你不可能让用户等 3 分钟才看到响应——这就需要异步任务队列。

**核心概念**：

| 概念 | 作用 | 类比 |
|------|------|------|
| **Producer** | 发送任务的程序 | 寄件人 |
| **Broker** | 任务消息中间件 | 快递分拣中心 |
| **Worker** | 执行任务的进程 | 快递员 |
| **Backend** | 存储任务结果 | 签收记录 |
| **Task** | 一个异步函数 | 一个包裹 |

**工作流程**：Producer -> Broker（Redis/RabbitMQ）-> Worker -> Backend（存储结果）

## 二、脑图（ASCII）

```
                    Celery 架构
                        |
        +---------------+---------------+
        |               |               |
     Producer        Broker          Worker
        |               |               |
   +----+----+    +----+----+    +----+----+
   | Web请求 |    | Redis   |    | 进程池  |
   | 定时任务 |    | RabbitMQ|    | 协程    |
   | 手动触发 |    | SQS     |    |gevent   |
   +---------+    +---------+    +---------+
                        |
                  +-----+-----+
                  |  Backend  |
                  | RPC/Redis |
                  | Django DB |
                  +-----------+
```

## 三、完整代码

### v1：最简 Celery 应用

```python
# tasks.py - Minimal Celery setup
from celery import Celery

# Use Redis as broker and backend
app = Celery('myapp', broker='redis://localhost:6379/0',
             backend='redis://localhost:6379/1')

@app.task
def add(x, y):
    # Simple addition task for testing
    return x + y

@app.task
def slow_operation(seconds):
    # Simulate a long-running task
    import time
    time.sleep(seconds)
    return f"Done after {seconds}s"
```

```python
# producer.py - Send tasks
from tasks import add, slow_operation

# Send task and get AsyncResult
result = add.delay(4, 9)
print(f"Task ID: {result.id}")
print(f"Result: {result.get(timeout=10)}")  # Blocks until done

# Send with countdown (delayed execution)
slow_operation.apply_async(args=[5], countdown=10)  # Run after 10s
```

启动 Worker：
```bash
celery -A tasks worker --loglevel=info
```

### v2：项目结构 + 配置文件 + 重试机制

```python
# proj/celery_app.py
from celery import Celery

app = Celery('proj')
app.config_from_object('proj.celeryconfig')
app.autodiscover_tasks(['proj'])
```

```python
# proj/celeryconfig.py
broker_url = 'redis://localhost:6379/0'
result_backend = 'redis://localhost:6379/1'

task_serializer = 'json'
result_serializer = 'json'
accept_content = ['json']

worker_concurrency = 4
worker_prefetch_multiplier = 2

task_track_started = True
task_time_limit = 300          # Hard limit: 5 min
task_soft_time_limit = 240     # Soft limit: 4 min

task_default_retry_delay = 60
task_default_max_retries = 3

task_annotations = {
    'proj.tasks.send_email': {'rate_limit': '10/m'},
}

result_expires = 3600
timezone = 'Asia/Shanghai'
enable_utc = True
```

```python
# proj/tasks/email_tasks.py
from proj.celery_app import app
import smtplib
from email.mime.text import MIMEText

@app.task(bind=True, max_retries=3, default_retry_delay=30)
def send_email(self, to, subject, body):
    # Send email with automatic retry on failure
    try:
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = 'noreply@example.com'
        msg['To'] = to

        with smtplib.SMTP('smtp.example.com', 587) as server:
            server.starttls()
            server.login('user', 'password')
            server.send_message(msg)

        return {'status': 'sent', 'to': to}
    except (smtplib.SMTPException, ConnectionError) as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
```

### v3：生产级部署 + Canvas 工作流 + 定时任务

```python
# proj/tasks/pipeline.py
from celery import chain, group, chord
from proj.celery_app import app

@app.task
def validate_file(file_id):
    # Step 1: Validate uploaded file
    return {'file_id': file_id, 'valid': True}

@app.task
def process_chunk(chunk_info):
    # Process a single chunk of data
    import time
    time.sleep(1)
    return {'chunk': chunk_info, 'status': 'done'}

@app.task
def merge_results(results):
    # Merge all chunk results into final output
    return {'total_chunks': len(results), 'merged': True}

@app.task
def notify_user(result):
    # Send notification to user about completion
    return {'notified': True, 'result': result}

def run_pipeline(file_id, num_chunks):
    # Execute: validate -> process chunks in parallel -> merge -> notify
    workflow = chain(
        validate_file.s(file_id),
        group(process_chunk.s(i) for i in range(num_chunks)),
        merge_results.s(),
        notify_user.s()
    )
    return workflow.apply_async()
```

```python
# proj/celeryconfig.py (add beat schedule)
from celery.schedules import crontab

beat_schedule = {
    'cleanup-every-night': {
        'task': 'proj.tasks.maintenance.cleanup_temp_files',
        'schedule': crontab(hour=3, minute=0),
    },
    'health-check': {
        'task': 'proj.tasks.maintenance.health_check',
        'schedule': 30.0,
    },
}
```

```python
# proj/tasks/maintenance.py
from proj.celery_app import app
import os
from datetime import datetime

@app.task
def cleanup_temp_files():
    # Remove temporary files older than 24 hours
    temp_dir = '/tmp/uploads'
    if not os.path.exists(temp_dir):
        return {'cleaned': 0}
    cleaned = 0
    now = datetime.now().timestamp()
    for f in os.listdir(temp_dir):
        fp = os.path.join(temp_dir, f)
        if os.path.getmtime(fp) < now - 86400:
            os.remove(fp)
            cleaned += 1
    return {'cleaned': cleaned}

@app.task
def health_check():
    # Verify all services are reachable
    import redis
    try:
        r = redis.Redis('localhost', 6379)
        r.ping()
        return {'status': 'healthy'}
    except Exception as e:
        return {'status': 'unhealthy', 'error': str(e)}
```

## 四、执行预览

```
$ celery -A proj worker --loglevel=info

 -------------- celery@myserver v5.3.6
--- ***** -----
-- ******* ---- Linux-6.1.0 2026-04-29 07:00:00
- *** --- * ---
- ** ---------- [config]
- ** ---------- .> app:         proj:0x7f...
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     redis://localhost:6379/1
- *** --- * --- .> concurrency: 4 (prefork)
 -------------- [queues]
                .> celery           exchange=celery(direct) key=celery

[tasks]
  . proj.tasks.email_tasks.send_email
  . proj.tasks.maintenance.cleanup_temp_files
  . proj.tasks.pipeline.validate_file

[2026-04-29 07:00:05] Received task: proj.tasks.email_tasks.send_email[a1b2c3]
[2026-04-29 07:00:06] Task succeeded in 0.8s: {'status': 'sent', 'to': 'user@example.com'}
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| Broker 选择 | Redis 适合中小项目，RabbitMQ 适合大型项目 | 生产推荐 RabbitMQ |
| 序列化 | 默认 pickle 有安全风险 | 使用 JSON 序列化 |
| 并发模型 | prefork(默认)、gevent、eventlet | CPU 密集用 prefork，IO 密集用 gevent |
| 任务幂等性 | 任务可能重复执行 | 设计任务为幂等操作 |
| 结果后端 | 不需要结果就别配置 | 减少不必要的存储开销 |
| 时区 | 定时任务对时区敏感 | 统一使用 UTC，显示时转换 |
| 内存泄漏 | Worker 长时间运行可能泄漏 | 配置 worker_max_tasks_per_child |
| 大任务 | 超大任务可能超时 | 拆分为小任务 + chain |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 | 原因 |
|------------|------------|------|
| `result.get()` 在 Web 请求中同步等待 | 用 `result.id` 轮询或 WebSocket 推送 | 阻塞 Web 服务器 |
| 在任务中访问 Django ORM 闭包对象 | 传 ID，在任务中重新查询 | 序列化失败/连接泄漏 |
| 不设 `task_time_limit` | 必须设置硬超时 | 僵尸任务堆积 |
| Worker 和代码版本不一致 | 用 Docker 统一部署版本 | 任务签名不匹配 |
| 用 `@task` 不传 `bind=True` | 需要重试时用 `bind=True` | 无法访问重试上下文 |
| Broker 和 Backend 用同一个 Redis DB | 分开使用不同 DB | 避免键冲突 |

## 七、练习题

🟢 **基础题**：创建一个 Celery 任务，接收文件路径参数，计算文件的 MD5 值并返回。

```python
import hashlib
@app.task
def calc_md5(filepath):
    h = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()
```

🟡 **进阶题**：实现一个图片处理流水线：上传验证 -> 生成缩略图 -> 上传 CDN -> 通知用户，使用 Celery Canvas 编排。

🔴 **挑战题**：设计一个可水平扩展的分布式爬虫，要求：(1) URL 去重 (2) 失败重试 (3) 速率限制 (4) 结果聚合，使用 Celery + Redis 实现。

## 八、知识点总结

```
Celery 知识树
├── 核心概念
│   ├── Producer（生产者）
│   ├── Broker（消息代理）
│   ├── Worker（消费者）
│   └── Backend（结果存储）
├── 配置
│   ├── 序列化方式
│   ├── 并发模型
│   ├── 超时与重试
│   └── 速率限制
├── Canvas 工作流
│   ├── chain（串行）
│   ├── group（并行）
│   ├── chord（并行+聚合）
│   └── chunks（分块）
├── 定时任务
│   ├── Beat 调度器
│   └── crontab 表达式
└── 运维
    ├── Flower 监控
    ├── Worker 管理
    └── 日志与告警
```

## 九、举一反三

| 场景 | Celery 方案 | 关键组件 |
|------|-------------|----------|
| 批量发邮件 | group + rate_limit | 并行但限速 |
| 视频转码流水线 | chain + chord | 串行验证，并行转码 |
| 每日数据报表 | Beat + chain | 定时触发串行流程 |
| 实时通知推送 | WebSocket + task | 异步处理+推送结果 |
| 分布式 ML 训练 | group + chord | 数据分片+结果聚合 |

## 十、参考资料

- [Celery 官方文档](https://docs.celeryq.dev/)
- [Celery Canvas 文档](https://docs.celeryq.dev/en/stable/userguide/canvas.html)
- [Flower 监控工具](https://github.com/mher/flower)
- [Redis 作为 Broker 最佳实践](https://docs.celeryq.dev/en/stable/getting-started/brokers/redis.html)

## 十一、代码演进路线

```
v1 (入门)  ->  v2 (工程化)  ->  v3 (生产级)
-----------------------------------------
单文件          配置分离         Canvas 工作流
无重试          重试+限速        定时任务 Beat
硬编码          模块化           Docker 部署
print调试       结构化日志       Flower 监控
单 Worker       多队列           水平扩展
```
