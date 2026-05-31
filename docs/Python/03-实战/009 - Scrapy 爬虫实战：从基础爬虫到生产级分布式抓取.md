---
title: "009 - Scrapy 爬虫实战：从基础爬虫到生产级分布式抓取"
slug: "009-scrapy"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.505+08:00"
updated_at: "2026-04-29T10:02:47.729+08:00"
reading_time: 34
tags: []
---

## 难度标注

> **难度：⭐⭐⭐⭐ 中高级** | 预计阅读时间：20分钟 | 前置知识：Python基础、HTML/CSS选择器、HTTP协议

## 概念讲解

### 为什么选 Scrapy？

| 特性 | requests+BS4 | Scrapy |
|------|-------------|--------|
| 并发 | 单线程（需手动） | 内置 Twisted 异步 |
| 去重 | 手动维护 | 自动 URL 去重 |
| 管道 | 手写 | 内置 Pipeline 机制 |
| 中间件 | 手写 | Downloader/Spider 中间件 |
| 分布式 | 手写 | Scrapy-Redis 扩展 |
| 调试 | print | scrapy shell + parse 命令 |

**Scrapy 核心数据流：**

```
Spider -> Request -> Engine -> Scheduler -> Downloader -> Response -> Spider -> Items -> Pipeline
              ^                                                         |
              +---------------------------------------------------------+
```

## 脑图

```
Scrapy 架构
├── Spider（爬虫）
│   ├── scrapy.Spider - 基础
│   ├── CrawlSpider - 规则爬取
│   ├── XMLFeedSpider - XML
│   └── 自定义 start_requests
├── Selector（选择器）
│   ├── CSS 选择器
│   ├── XPath 选择器
│   └── .re() 正则提取
├── Item（数据模型）
│   ├── 定义字段
│   ├── ItemLoader - 批量处理
│   └── 输入/输出处理器
├── Pipeline（管道）
│   ├── 数据清洗
│   ├── 去重
│   ├── 存储数据库
│   └── 存储文件
├── Middlewares（中间件）
│   ├── 随机 UA
│   ├── 代理 IP
│   ├── 重试逻辑
│   └── Cookies 处理
└── Settings（配置）
    ├── CONCURRENT_REQUESTS
    ├── DOWNLOAD_DELAY
    ├── ROBOTSTXT_OBEY
    └── AUTOTHROTTLE
```

## 完整代码：技术博客爬虫

### 项目初始化

```bash
scrapy startproject techblog_scraper
cd techblog_scraper
scrapy genspider blogspider example.com
```

### v1 基础版本 - 单页爬取

```python
# items.py - define data structure
import scrapy

class BlogPostItem(scrapy.Item):
    title = scrapy.Field()
    url = scrapy.Field()
    author = scrapy.Field()
    publish_date = scrapy.Field()
    tags = scrapy.Field()
    content = scrapy.Field()
    crawl_time = scrapy.Field()
```

```python
# spiders/blogspider.py - v1: basic spider
import scrapy
from ..items import BlogPostItem

class BlogSpider(scrapy.Spider):
    name = "blogspider"
    allowed_domains = ["example.com"]
    start_urls = ["https://example.com/blog"]

    def parse(self, response):
        """Parse blog listing page."""
        articles = response.css("article.post")

        for article in articles:
            item = BlogPostItem()
            item["title"] = article.css("h2 a::text").get()
            item["url"] = article.css("h2 a::attr(href)").get()
            item["author"] = article.css(".author::text").get()
            item["publish_date"] = article.css("time::attr(datetime)").get()
            yield item

        # Pagination
        next_page = response.css("a.next-page::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)
```

```python
# settings.py - v1: basic settings
BOT_NAME = "techblog_scraper"
SPIDER_MODULES = ["techblog_scraper.spiders"]
NEWSPIDER_MODULE = "techblog_scraper.spiders"
ROBOTSTXT_OBEY = True
CONCURRENT_REQUESTS = 8
DOWNLOAD_DELAY = 1
FEEDS = {
    "output.json": {"format": "json"},
}
```

**v1 问题**：没去重、没清洗、没存储数据库、没反反爬、内容没抓全文。

### v2 进阶版本 - ItemLoader + Pipeline + 详情页

```python
# loaders.py - ItemLoader for clean data processing
from itemloaders.processors import TakeFirst, MapCompose, Join
from scrapy.loader import ItemLoader

class BlogPostLoader(ItemLoader):
    # Input processors: applied when assigning values
    title_in = MapCompose(str.strip)
    author_in = MapCompose(str.strip)
    tags_in = MapCompose(str.strip)

    # Output processors: applied when loading item
    default_output_processor = TakeFirst()
    tags_out = MapCompose(str.strip)  # tags stay as list
```

```python
# spiders/blogspider.py - v2: detail page + ItemLoader
import scrapy
from datetime import datetime
from ..items import BlogPostItem
from ..loaders import BlogPostLoader

class BlogSpider(scrapy.Spider):
    name = "blogspider"
    allowed_domains = ["example.com"]

    custom_settings = {
        "DOWNLOAD_DELAY": 2,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 4,
    }

    def start_requests(self):
        """Custom start requests with categories."""
        categories = ["python", "javascript", "devops"]
        for cat in categories:
            url = f"https://example.com/blog/category/{cat}"
            yield scrapy.Request(url, callback=self.parse_list,
                                 meta={"category": cat})

    def parse_list(self, response):
        """Parse listing page, yield detail page requests."""
        articles = response.css("article.post")

        self.logger.info(f"Found {len(articles)} articles on {response.url}")

        for article in articles:
            url = article.css("h2 a::attr(href)").get()
            if url:
                yield response.follow(
                    url,
                    callback=self.parse_detail,
                    meta={"category": response.meta.get("category")},
                )

        # Pagination with depth limit
        next_page = response.css("a.next::attr(href)").get()
        current_depth = response.meta.get("depth", 0)
        if next_page and current_depth < 10:
            yield response.follow(
                next_page,
                callback=self.parse_list,
                meta={"depth": current_depth + 1, "category": response.meta.get("category")},
            )

    def parse_detail(self, response):
        """Parse article detail page."""
        loader = BlogPostLoader(item=BlogPostItem(), response=response)

        loader.add_css("title", "h1.title::text")
        loader.add_css("author", ".author-name::text")
        loader.add_css("publish_date", "time::attr(datetime)")
        loader.add_css("tags", ".tag::text")
        loader.add_css("content", ".article-body")
        loader.add_value("url", response.url)
        loader.add_value("crawl_time", datetime.now().isoformat())

        yield loader.load_item()
```

```python
# pipelines.py - v2: validation + dedup + database
import hashlib
import sqlite3
from scrapy.exceptions import DropItem

class DeduplicationPipeline:
    """Drop duplicate items based on URL hash."""

    def __init__(self):
        self.seen = set()

    def process_item(self, item, spider):
        url_hash = hashlib.md5(item["url"].encode()).hexdigest()
        if url_hash in self.seen:
            spider.logger.debug(f"Duplicate: {item['url']}")
            raise DropItem(f"Duplicate item: {item['url']}")
        self.seen.add(url_hash)
        return item

class ValidationPipeline:
    """Ensure required fields exist."""

    REQUIRED_FIELDS = ["title", "url", "content"]

    def process_item(self, item, spider):
        for field in self.REQUIRED_FIELDS:
            if not item.get(field):
                raise DropItem(f"Missing {field} in {item.get('url')}")
        return item

class SQLitePipeline:
    """Store items in SQLite database."""

    def open_spider(self, spider):
        self.conn = sqlite3.connect("blog_posts.db")
        self.cursor = self.conn.cursor()
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                url TEXT PRIMARY KEY,
                title TEXT,
                author TEXT,
                publish_date TEXT,
                tags TEXT,
                content TEXT,
                crawl_time TEXT
            )
        """)
        self.conn.commit()

    def close_spider(self, spider):
        self.conn.close()

    def process_item(self, item, spider):
        self.cursor.execute(
            "INSERT OR REPLACE INTO posts VALUES (?,?,?,?,?,?,?)",
            (item["url"], item["title"], item.get("author",""),
             item.get("publish_date",""), ",".join(item.get("tags",[])),
             item.get("content",""), item.get("crawl_time",""))
        )
        self.conn.commit()
        return item
```

### v3 生产版本 - 中间件 + 代理 + AutoThrottle

```python
# middlewares.py - anti-ban middleware
import random
from scrapy import signals

class RandomUserAgentMiddleware:
    """Rotate User-Agent for each request."""

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 Safari/605.1",
        "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    ]

    def process_request(self, request, spider):
        request.headers["User-Agent"] = random.choice(self.USER_AGENTS)

class ProxyMiddleware:
    """Rotate proxy IPs from a pool."""

    def __init__(self, proxy_list):
        self.proxies = proxy_list
        self.current = 0

    @classmethod
    def from_crawler(cls, crawler):
        proxy_file = crawler.settings.get("PROXY_LIST_FILE", "")
        if proxy_file:
            with open(proxy_file) as f:
                proxies = [line.strip() for line in f if line.strip()]
        else:
            proxies = []
        return cls(proxies)

    def process_request(self, request, spider):
        if self.proxies:
            proxy = self.proxies[self.current % len(self.proxies)]
            request.meta["proxy"] = proxy
            self.current += 1

class RetryMiddleware:
    """Custom retry with exponential backoff."""

    RETRY_TIMES = 3
    RETRY_HTTP_CODES = [429, 500, 502, 503, 504]

    def __init__(self):
        self.retry_count = {}

    def process_response(self, request, response, spider):
        if response.status in self.RETRY_HTTP_CODES:
            url = request.url
            self.retry_count[url] = self.retry_count.get(url, 0) + 1

            if self.retry_count[url] <= self.RETRY_TIMES:
                spider.logger.warning(f"Retry {self.retry_count[url]}: {url}")
                return request.replace(dont_filter=True)
            else:
                spider.logger.error(f"Max retries exceeded: {url}")

        return response
```

```python
# settings.py - v3: production settings
BOT_NAME = "techblog_scraper"

# Concurrency & politeness
CONCURRENT_REQUESTS = 16
CONCURRENT_REQUESTS_PER_DOMAIN = 4
DOWNLOAD_DELAY = 2
RANDOMIZE_DOWNLOAD_DELAY = True
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0

# Retry & timeout
RETRY_TIMES = 3
RETRY_HTTP_CODES = [429, 500, 502, 503, 504]
DOWNLOAD_TIMEOUT = 30

# Anti-ban
ROBOTSTXT_OBEY = True
COOKIES_ENABLED = False

# Middlewares
DOWNLOADER_MIDDLEWARES = {
    "techblog_scraper.middlewares.RandomUserAgentMiddleware": 400,
    "techblog_scraper.middlewares.ProxyMiddleware": 410,
}

# Pipelines
ITEM_PIPELINES = {
    "techblog_scraper.pipelines.DeduplicationPipeline": 100,
    "techblog_scraper.pipelines.ValidationPipeline": 200,
    "techblog_scraper.pipelines.SQLitePipeline": 300,
}

# Logging
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"

# Feeds (for export)
FEEDS = {
    "output/%(time)s.json": {"format": "json", "encoding": "utf-8"},
    "output/%(time)s.csv": {"format": "csv"},
}
```

```python
# run.py - convenient entry point
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

if __name__ == "__main__":
    settings = get_project_settings()
    process = CrawlerProcess(settings)
    process.crawl("blogspider")
    process.start()  # blocks until finished
```

## 执行预览

```bash
# Run spider
scrapy crawl blogspider

# Output:
# 2026-04-29 07:00:00 [blogspider] INFO: Found 15 articles on https://example.com/blog/category/python
# 2026-04-29 07:00:02 [blogspider] INFO: Crawled 15 articles, 0 duplicates
# 2026-04-29 07:00:05 [blogspider] INFO: Spider closed (finished)
# {'downloader/response_count': 50, 'item_scraped_count': 45, ...}

# Debug in shell
scrapy shell "https://example.com/blog"
>>> response.css("h1::text").get()
'Blog Home'

# Parse command (test spider logic)
scrapy parse --spider=blogspider -c parse_list "https://example.com/blog"

# Export to JSON
scrapy crawl blogspider -o output.json

# Check stats after run
# Item scraped count: 45
# Duplicate dropped: 3
# Retry count: 2
```

## 注意事项

| 项目 | 说明 | 建议 |
|-----|------|------|
| robots.txt | 默认遵守爬取规则 | 确认目标站点允许爬取 |
| 请求频率 | 太快会被封 IP | `AUTOTHROTTLE_ENABLED=True` |
| 内存 | 大量 URL 在队列中占内存 | 设置 `SCHEDULER_DISK_QUEUE` |
| 编码 | 页面编码不一致 | Scrapy 自动处理大部分情况 |
| 动态页面 | JS 渲染的内容抓不到 | 用 Splash 或 Playwright 中间件 |
| 法律 | 爬取敏感数据有法律风险 | 只爬公开数据，遵守 ToS |

## 避坑指南

❌ **用 `time.sleep()` 控制频率**
✅ 用 `DOWNLOAD_DELAY` + `AUTOTHROTTLE` 自动调速

❌ **在 `parse` 里发同步 HTTP 请求**
✅ 全部用 `yield Request()` 异步回调

❌ **忽略 HTTP 错误状态码**
✅ 配置 `RETRY_HTTP_CODES` + `handle_httpstatus_list`

❌ **Pipeline 里做阻塞 IO（同步数据库写入）**
✅ 批量写入（攒够 N 条再 insert），或用异步 Pipeline

❌ **XPath/CSS 选择器写死具体路径**
✅ 用语义化的 class/属性选择器，降低页面变更影响

## 练习题

🟢 **基础题：多页面爬取**
修改 v1 爬虫，爬取分页列表的前 5 页，将结果保存为 CSV 文件。

🟡 **进阶题：登录爬取**
实现一个需要登录才能访问的站点爬虫（通过 `FormRequest.from_response` 提交登录表单）。

🔴 **挑战题：分布式爬虫**
使用 Scrapy-Redis 实现分布式爬虫：多台机器共享 URL 队列，去重集合存储在 Redis 中。

## 知识点总结

```
Scrapy 爬虫
├── 核心组件
│   ├── Spider - 定义爬取逻辑和 URL
│   ├── Engine - 调度中心
│   ├── Scheduler - URL 队列 + 去重
│   ├── Downloader - HTTP 请求
│   └── Pipeline - 数据处理流水线
├── 数据提取
│   ├── CSS Selector - .css("h1::text")
│   ├── XPath - .xpath("//h1/text()")
│   └── .re() - 正则提取
├── Item & Loader
│   ├── Item - 数据模型
│   └── ItemLoader - 输入输出处理器
├── 反反爬
│   ├── 随机 UA
│   ├── 代理 IP 池
│   ├── 请求频率控制
│   └── Cookie 管理
└── 进阶
    ├── Scrapy-Redis - 分布式
    ├── Splash - JS 渲染
    ├── AutoThrottle - 自适应频率
    └── Contracts - 爬虫测试
```

## 举一反三

| 场景 | 方案 | 关键技术 |
|------|------|----------|
| 静态页面 | 基础 Spider | CSS/XPath |
| 登录后爬取 | FormRequest | Cookie + Session |
| JS 动态渲染 | Splash / Playwright | 中间件集成 |
| 增量爬取 | 记录上次爬取时间 | dupefilter 自定义 |
| 海量数据分布式 | Scrapy-Redis | 共享调度器 |
| 定时爬取 | Scrapyd + cron | 部署管理 |
| 数据监控 | Scrapy+Prometheus | 自定义扩展 |

## 参考资料

- [Scrapy 官方文档](https://docs.scrapy.org/)
- [Scrapy-Redis 分布式爬虫](https://github.com/rmax/scrapy-redis)
- [scrapy-playwright](https://github.com/scrapy-plugins/scrapy-playwright)
- [Scrapyd - 爬虫部署服务](https://scrapyd.readthedocs.io/)

## 代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 | 单页爬取 + 文件输出 | 学习、小规模爬取 |
| v2 | ItemLoader + Pipeline + 详情页 | 中等项目 |
| v3 | 中间件 + 代理 + AutoThrottle | 生产级大规模爬取 |
