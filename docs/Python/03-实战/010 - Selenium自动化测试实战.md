---
title: "010 - Selenium自动化测试实战"
slug: "010-selenium"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.51+08:00"
updated_at: "2026-04-29T10:02:47.736+08:00"
reading_time: 26
tags: []
---

# Selenium 自动化测试实战

> **难度：⭐⭐⭐ 中级** | Python 3.8+ | 预计学习时间 60 分钟

## 一、概念讲解

Selenium 是一个强大的 Web 自动化测试框架，支持多种浏览器和编程语言。在 Python 生态中，Selenium WebDriver 是进行 Web 自动化测试、爬虫和数据采集的首选工具。

### 核心概念

- **WebDriver**：浏览器驱动程序，充当浏览器与脚本之间的桥梁
- **WebElement**：页面中的 HTML 元素抽象
- **Locator Strategy**：元素定位策略（ID、CSS、XPath 等）
- **Wait Mechanism**：显式等待 vs 隐式等待
- **Page Object Model**：页面对象模式，提高测试代码可维护性

### Selenium 4 新特性

Selenium 4 基于 W3C WebDriver 标准重构，带来更好的跨浏览器兼容性和相对定位器（Relative Locators）。

## 二、知识脑图

```
Selenium 自动化
├── 环境搭建
│   ├── pip install selenium
│   ├── WebDriver Manager
│   └── Headless 模式
├── 元素定位
│   ├── By.ID
│   ├── By.CSS_SELECTOR
│   ├── By.XPATH
│   ├── By.CLASS_NAME
│   └── 相对定位器 (Selenium 4)
├── 浏览器操作
│   ├── get / back / forward / refresh
│   ├── maximize / minimize
│   ├── switch_to (窗口/iframe/alert)
│   └── execute_script
├── 等待策略
│   ├── time.sleep (不推荐)
│   ├── implicitly_wait
│   └── WebDriverWait + expected_conditions
├── 交互操作
│   ├── click / send_keys / clear
│   ├── select (下拉框)
│   ├── ActionChains (高级交互)
│   └── 截图 / 文件上传
└── 最佳实践
    ├── Page Object Model
    ├── pytest 集成
    ├── 并行执行
    └── CI/CD 集成
```

## 三、完整代码

### v1：基础入门 — 百度搜索自动化

```python
# selenium_basic.py - Basic Selenium automation: Baidu search
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time

def baidu_search():
    """Demo: search on Baidu and print results."""
    # Setup Chrome with auto-managed driver
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")  # Run without GUI
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )

    try:
        # Navigate to Baidu
        driver.get("https://www.baidu.com")
        print(f"Page title: {driver.title}")

        # Find search box and type query
        search_box = driver.find_element(By.ID, "kw")
        search_box.send_keys("Selenium Python")

        # Click search button
        search_btn = driver.find_element(By.ID, "su")
        search_btn.click()

        # Wait for results to load
        time.sleep(2)
        print(f"Title after search: {driver.title}")

        # Extract search results
        results = driver.find_elements(By.CSS_SELECTOR, "h3 a")
        for i, result in enumerate(results[:5], 1):
            print(f"  {i}. {result.text}")

    finally:
        driver.quit()
        print("Browser closed.")

if __name__ == "__main__":
    baidu_search()
```

### v2：进阶 — 显式等待 + Page Object 模式

```python
# selenium_advanced.py - Advanced patterns with Page Object Model
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from typing import List


class SearchPage:
    """Page Object for search engine page."""

    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    def load(self, url: str) -> "SearchPage":
        self.driver.get(url)
        return self

    def search(self, query: str) -> "ResultsPage":
        box = self.wait.until(
            EC.presence_of_element_located((By.ID, "kw"))
        )
        box.clear()
        box.send_keys(query)

        btn = self.wait.until(
            EC.element_to_be_clickable((By.ID, "su"))
        )
        btn.click()
        return ResultsPage(self.driver)


class ResultsPage:
    """Page Object for search results page."""

    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    def get_results(self, limit: int = 5) -> List[str]:
        items = self.wait.until(
            EC.presence_of_all_elements_located(
                (By.CSS_SELECTOR, "h3 a")
            )
        )
        return [item.text for item in items[:limit] if item.text]

    def result_count(self) -> int:
        return len(self.get_results(limit=100))


def create_driver() -> webdriver.Chrome:
    """Create a configured Chrome driver instance."""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    return webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )


def main():
    driver = create_driver()
    try:
        search_page = SearchPage(driver)
        results_page = search_page.load("https://www.baidu.com").search("Python Selenium")
        results = results_page.get_results()
        print(f"Found {len(results)} results:")
        for i, title in enumerate(results, 1):
            print(f"  {i}. {title}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
```

### v3：实战 — 完整测试套件 + 截图 + 报告

```python
# selenium_suite.py - Full test suite with reporting
import pytest
import os
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


@pytest.fixture(scope="module")
def driver():
    """Shared browser instance for all tests."""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    drv = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    drv.implicitly_wait(5)
    yield drv
    drv.quit()


@pytest.fixture
def wait(driver):
    return WebDriverWait(driver, 10)


class TestBaiduSearch:
    """Test suite for Baidu search functionality."""

    def test_homepage_loads(self, driver, wait):
        """Verify homepage loads correctly."""
        driver.get("https://www.baidu.com")
        assert "百度" in driver.title
        search_box = wait.until(
            EC.presence_of_element_located((By.ID, "kw"))
        )
        assert search_box.is_displayed()

    def test_search_returns_results(self, driver, wait):
        """Verify search returns results."""
        search_box = driver.find_element(By.ID, "kw")
        search_box.clear()
        search_box.send_keys("Python testing")
        driver.find_element(By.ID, "su").click()

        results = wait.until(
            EC.presence_of_all_elements_located(
                (By.CSS_SELECTOR, "h3 a")
            )
        )
        assert len(results) > 0, "No search results found"

    def test_screenshot_capture(self, driver, tmp_path):
        """Demo: capture screenshot."""
        driver.get("https://www.baidu.com")
        path = tmp_path / "screenshot.png"
        driver.save_screenshot(str(path))
        assert path.exists()
        print(f"Screenshot saved: {path}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
```

## 四、执行预览

```
$ python selenium_basic.py
Page title: 百度一下，你就知道
Title after search: Selenium Python_百度搜索
  1. Selenium with Python
  2. Selenium Python教程
  3. Python Selenium安装
  4. Selenium自动化测试
  5. Python Selenium实战
Browser closed.

$ python -m pytest selenium_suite.py -v
======================== test session starts ========================
collected 3 items

selenium_suite.py::TestBaiduSearch::test_homepage_loads PASSED
selenium_suite.py::TestBaiduSearch::test_search_returns_results PASSED
selenium_suite.py::TestBaiduSearch::test_screenshot_capture PASSED

======================== 3 passed in 8.42s ========================
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 浏览器版本 | Chrome/Edge/Firefox 版本需与 WebDriver 匹配 |
| Headless 模式 | 服务器部署时必须使用 `--headless=new` |
| 资源占用 | 每个浏览器实例约 200-500MB 内存 |
| 并发限制 | 单机建议不超过 5 个并行实例 |
| 反爬虫 | 频繁请求可能触发验证码，需设置合理间隔 |
| 元素等待 | 优先使用显式等待，避免 `time.sleep()` |
| 文件下载 | Headless 模式下载文件需额外配置 |
| HTTPS | 自签名证书页面需 `--ignore-certificate-errors` |

## 六、避坑指南

| 坑 | ❌ 错误做法 | ✅ 正确做法 |
|----|-----------|-----------|
| WebDriver 版本 | 手动下载驱动放到 PATH | 使用 `webdriver_manager` 自动管理 |
| 元素未加载 | `time.sleep(5)` 硬等 | `WebDriverWait` + `expected_conditions` |
| iframe 嵌套 | 直接定位 iframe 内元素 | `driver.switch_to.frame()` 先切换 |
| 多窗口 | 不切换直接操作 | `driver.switch_to.window()` 切换 |
| 元素被遮挡 | 直接 `click()` | 用 JavaScript 点击或滚动到可见 |
| 页面未加载完 | 立即查找元素 | 等待 DOM ready 或特定元素出现 |
| 中文乱码 | 默认编码 | `options.add_argument("--lang=zh-CN")` |
| 重复定位 | 每次重新 `find_element` | 缓存常用元素引用 |

## 七、练习题

### 🟢 入门
1. 编写脚本打开 Bing 搜索，搜索 "Python" 并打印前 5 条结果标题
2. 实现自动登录 the-internet.herokuapp.com 的测试页面

### 🟡 进阶
3. 使用 Page Object 模式重构一个完整的登录流程测试
4. 实现多页面截图功能，将截图保存到指定目录
5. 编写一个自动化脚本，监控某个网页的特定区域内容变化

### 🔴 挑战
6. 搭建完整的 pytest + Selenium 测试框架，支持并行执行和 HTML 报告
7. 实现验证码识别方案（OCR + 人工介入回退机制）

## 八、知识点总结

```
Selenium 核心知识
├── 基础
│   ├── WebDriver 配置 → ChromeOptions
│   ├── 元素定位 → By.ID / CSS / XPath
│   └── 基本交互 → click / send_keys
├── 等待机制
│   ├── 隐式等待 → implicitly_wait
│   ├── 显式等待 → WebDriverWait + EC
│   └── Fluent Wait → 自定义轮询
├── 高级操作
│   ├── ActionChains → 鼠标/键盘
│   ├── switch_to → iframe/window/alert
│   ├── execute_script → JS 注入
│   └── 截图 → save_screenshot
└── 设计模式
    ├── Page Object Model
    ├── 测试数据分离
    └── pytest fixtures
```

## 九、举一反三

| 应用场景 | 核心技术 | 扩展方向 |
|---------|---------|---------|
| Web 自动化测试 | Selenium + pytest | CI/CD 集成、Allure 报告 |
| 数据采集 | Selenium + Headless | 配合 BeautifulSoup 解析 |
| 性能监控 | Selenium + Timing API | Web Vitals 指标采集 |
| UI 回归测试 | Selenium + 截图对比 | 视觉回归测试（Applitools） |
| 表单自动填写 | Selenium + 数据驱动 | 批量数据录入自动化 |
| 竞品监控 | Selenium + 定时任务 | 价格/内容变更监控 |

## 十、参考资料

- [Selenium 官方文档](https://www.selenium.dev/documentation/)
- [Selenium Python Binding](https://selenium-python.readthedocs.io/)
- [WebDriver W3C 标准](https://w3c.github.io/webdriver/)
- [webdriver_manager GitHub](https://github.com/SergeyPirogov/webdriver_manager)
- [pytest 官方文档](https://docs.pytest.org/)

## 十一、代码演进

| 版本 | 重点 | 改进 |
|------|------|------|
| v1 基础入门 | 直线流程，快速上手 | `time.sleep` 等待，无封装 |
| v2 进阶模式 | Page Object + 显式等待 | 解耦页面逻辑，可维护性提升 |
| v3 测试套件 | pytest 集成 + fixture + 截图 | 完整测试框架，支持 CI/CD |

> **下一步建议：** 将 v3 框架集成到 CI/CD 流水线中，配合 Docker 容器实现自动化测试的持续交付。
