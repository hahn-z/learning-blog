---
title: "PHP-FPM调优实战"
slug: "php-fpm-tuning-practice"
category: "性能与底层"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "性能", "PHP-FPM", "调优"]
---

# PHP-FPM调优实战

PHP-FPM（FastCGI Process Manager）是PHP生产环境的标准进程管理器。正确配置FPM参数直接决定了服务器能承载多少并发。

## 进程管理模式

PHP-FPM有三种pm（Process Manager）模式，适用不同场景：

| 模式 | 原理 | 适用场景 | 内存 |
|------|------|----------|------|
| static | 固定数量的worker | 流量稳定可预测 | 恒定 |
| dynamic | 按需调整，设min/max | 大部分Web应用 | 动态 |
| ondemand | 完全按需创建，空闲销毁 | 低流量/开发环境 | 最省 |

### pm=dynamic配置（最常用）

```ini
; /etc/php/8.3/fpm/pool.d/www.conf

[www]
user = www-data
group = www-data
listen = /run/php/php8.3-fpm.sock

; === 进程管理 ===
pm = dynamic

; 最大子进程数（所有模式都需要设置）
; 计算: 可用内存 / 单进程内存
; 例如: 8GB * 0.7(留给系统) / 80MB(单进程) ≈ 70
pm.max_children = 70

; 空闲时的最小进程数（减少动态创建开销）
pm.min_spare_servers = 10

; 空闲时的最大进程数
pm.max_spare_servers = 20

; 启动时创建的进程数
pm.start_servers = 15

; === 超时控制 ===
; 单个请求最大执行时间（秒），超时worker被杀掉
request_terminate_timeout = 30

; 慢请求日志阈值（秒），超过则记录调用栈
request_slowlog_timeout = 5
slowlog = /var/log/php-fpm/slow.log

; === 进程生命周期 ===
; 每个worker处理N个请求后自动重启（防内存泄漏）
pm.max_requests = 1000

; === Status页面 ===
pm.status_path = /fpm-status
ping.path = /fpm-ping
ping.response = pong

; === 日志 ===
access.log = /var/log/php-fpm/$pool.access.log
; 记录请求耗时
access.format = "%R - %u %t \"%m %r%Q%q\" %s %f %{mili}dms %{kilo}MkB %C%%"
```

### pm.max_children计算方法

```bash
#!/bin/bash
# calculate-fpm.sh — 计算合理的max_children

# 1. 查看系统可用内存（MB）
TOTAL_MEM=$(free -m | awk '/Mem:/ {print $2}')
echo "Total memory: ${TOTAL_MEM}MB"

# 2. 估算单进程内存（观察实际运行数据）
# 方法: 在业务高峰期执行
AVG_MEM=$(ps -ylC php-fpm --sort:rss | awk 'NR>1 {sum+=$8; count++} END {printf "%.0f", sum/count/1024}')
echo "Avg PHP-FPM process: ${AVG_MEM}MB"

# 3. 留给系统/MySQL/Nginx等服务的内存（MB）
RESERVED_MEM=2048
AVAIL_MEM=$((TOTAL_MEM - RESERVED_MEM))

# 4. 计算
MAX_CHILDREN=$((AVAIL_MEM / AVG_MEM))
echo "Recommended pm.max_children: $MAX_CHILDREN"

# 5. 验证当前配置
echo "---"
echo "Current PHP-FPM processes: $(pgrep php-fpm | wc -l)"
echo "Current total PHP-FPM memory: $(ps -ylC php-fpm --sort:rss | awk 'NR>1 {sum+=$8} END {printf "%.0f", sum/1024}')MB"
```

### pm=ondemand配置（低流量场景）

```ini
pm = ondemand
pm.max_children = 50
pm.process_idle_timeout = 10s    ; 空闲10秒后销毁
pm.max_requests = 500
```

## 慢日志分析

```bash
# 慢日志输出示例:
# [31-May-2026 10:15:23]  [pool www] pid 12345
# script_filename = /var/www/html/api/index.php
# [0x7f8c3a200000] mysql_query() /var/www/html/app/Repository/UserRepository.php:45
# [0x7f8c3a200100] App\Repository\UserRepository->find() /var/www/html/app/Service/UserService.php:32

# 分析最频繁的慢请求
awk '/script_filename/' /var/log/php-fpm/slow.log | sort | uniq -c | sort -rn | head -20

# 按URI统计慢请求数量（配合access.log）
awk '$NF > 5000 {print $7}' /var/log/php-fpm/www.access.log | sort | uniq -c | sort -rn | head -20
```

## Status页面监控

```nginx
# Nginx配置 — 限制访问
location ~ ^/(fpm-status|fpm-ping)$ {
    access_log off;
    allow 127.0.0.1;
    allow 10.0.0.0/8;
    deny all;
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
}
```

```bash
# 获取详细状态
curl -s localhost/fpm-status?full

# 输出:
# pool:                 www
# process manager:      dynamic
# start time:           31/May/2026:08:00:00 +0800
# start since:          9000
# accepted conn:        150000
# listen queue:         0        # 等待队列（>0说明worker不够）
# max listen queue:     5
# listen queue len:     128
# idle processes:       15       # 空闲worker
# active processes:     5        # 忙碌worker
# total processes:      20
# max active processes: 45
# max children reached: 0        # 达到max_children的次数（>0需要增加）
# slow requests:        12
```

## 常见调优场景

### 场景1：502 Bad Gateway频繁出现

```
原因：pm.max_children太小，请求排队超时
诊断：status页面 → max children reached > 0
解决：增加max_children或优化慢请求
```

### 场景2：内存持续增长

```
原因：PHP内存泄漏（循环引用、静态属性累积）
诊断：观察单进程内存趋势 → ps -ylC php-fpm 按时间对比
解决：降低pm.max_requests（更频繁重启worker）
```

### 场景3：CPU 100%

```
原因：worker数远超CPU核心数，上下文切换开销大
诊断：pm.max_children > CPU核心数 * 2
解决：CPU密集型任务，max_children ≈ CPU核心数 * 2
     I/O密集型任务（MySQL/Redis调用多），可以更高
```

## 面试常见追问

**Q: pm.max_children设多少合适？**
A: 计算公式：`可用内存 / 单进程平均内存`。关键在于单进程内存——在业务高峰期用`ps`观察实际值，而不是拍脑袋。一般PHP应用50-120MB/进程。

**Q: request_terminate_timeout设多少？**
A: 根据业务最慢合法请求决定。普通API设10-30秒，文件上传/报表生成设60-120秒。建议配合Nginx的`fastcgi_read_timeout`一起设。

**Q: dynamic和ondemand怎么选？**
A: 流量有波峰波谷选dynamic（保持最小空闲进程），流量很低且不规律选ondemand（完全按需）。流量大且稳定选static（无进程创建开销）。

**Q: listen queue满了会怎样？**
A: 新请求被拒绝，Nginx返回502。`listen.backlog`默认511，一般够用。如果满了需要增加max_children或优化请求处理速度。
