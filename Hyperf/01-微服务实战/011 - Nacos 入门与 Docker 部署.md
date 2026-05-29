---
title: "011 - Nacos 入门与 Docker 部署"
slug: "011-nacos-intro-docker"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.786+08:00"
updated_at: "2026-05-01T22:16:59.468+08:00"
reading_time: 6
tags: []
---

# 011 - Nacos 入门与 Docker 部署

> **难度：** ⭐⭐ | **前置知识：** Docker 基础、微服务基本概念 | **预估用时：** 30 分钟

## 概念讲解

**一句话定义：** Nacos 是阿里巴巴开源的服务注册与配置管理平台，为微服务架构提供服务发现、配置管理和服务管理平台。

**现实类比：** 想象一个大型商场——每家店铺开业时都要到管理处登记（服务注册），顾客想找某类店铺就到咨询台查询（服务发现），商场还会定期检查店铺是否正常营业（健康检查）。Nacos 就是这个"商场管理处"。

**技术场景：** 在用户微服务系统中，用户服务、订单服务、通知服务等都需要互相调用。每个服务实例启动时向 Nacos 注册自己的地址，其他服务通过 Nacos 查找目标服务的可用实例，实现动态的服务发现与负载均衡。

## 实时脑图

```
                    ┌─────────────────────────────┐
                    │      Nacos Server           │
                    │  ┌─────────┐ ┌───────────┐  │
                    │  │ 命名空间  │ │  配置管理   │  │
                    │  └─────────┘ └───────────┘  │
                    │  ┌─────────┐ ┌───────────┐  │
                    │  │ 服务注册  │ │  健康检查   │  │
                    │  └─────────┘ └───────────┘  │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
        │ 用户服务    │   │ 订单服务    │   │ 通知服务    │
        │ :9501     │   │ :9502     │   │ :9503     │
        └───────────┘   └───────────┘   └───────────┘
              │                │                │
              └──── 注册/心跳/拉配置 ────────────┘
```

## 完整代码

### docker-compose.yml — Nacos 单机部署

```yaml
# ✅ Nacos standalone mode with MySQL persistence
version: '3.8'

services:
  nacos-mysql:
    image: mysql:8.0
    container_name: nacos-mysql
    environment:
      MYSQL_ROOT_PASSWORD: nacos_root_pwd
      MYSQL_DATABASE: nacos_config
      MYSQL_USER: nacos
      MYSQL_PASSWORD: nacos_pwd
    volumes:
      - nacos-mysql-data:/var/lib/mysql
    ports:
      - "3306:3306"
    networks:
      - microservice-net

  nacos-server:
    image: nacos/nacos-server:v2.3.2
    container_name: nacos-server
    depends_on:
      - nacos-mysql
    environment:
      MODE: standalone
      SPRING_DATASOURCE_PLATFORM: mysql
      MYSQL_SERVICE_HOST: nacos-mysql
      MYSQL_SERVICE_PORT: 3306
      MYSQL_SERVICE_DB_NAME: nacos_config
      MYSQL_SERVICE_USER: nacos
      MYSQL_SERVICE_PASSWORD: nacos_pwd
      NACOS_AUTH_ENABLE: "true"
      NACOS_AUTH_TOKEN: "SecretKey012345678901234567890123456789012345678901234567890"
      NACOS_AUTH_IDENTITY_KEY: serverIdentity
      NACOS_AUTH_IDENTITY_VALUE: security
    ports:
      - "8848:8848"
      - "9848:9848"   # 🟡 gRPC client port
      - "9849:9849"   # gRPC server port
    networks:
      - microservice-net

volumes:
  nacos-mysql-data:

networks:
  microservice-net:
    driver: bridge
```

### 健康检查脚本 — verify-nacos.php

```php
<?php
// ✅ Verify Nacos server is running and accessible

declare(strict_types=1);

$nacosHost = getenv('NACOS_HOST') ?: '127.0.0.1';
$nacosPort = getenv('NACOS_PORT') ?: '8848';
$baseUrl = "http://{$nacosHost}:{$nacosPort}";

echo "🔍 Checking Nacos at {$baseUrl}\n\n";

// 1. Check server health
$healthUrl = "{$baseUrl}/nacos/v1/ns/operator/leader";
echo "1️⃣ Server health check...\n";
$response = file_get_contents($healthUrl);
if ($response === false) {
    echo "   ❌ Nacos is NOT reachable\n";
    exit(1);
}
echo "   ✅ Nacos is running\n";
echo "   Response: {$response}\n\n";

// 2. Check authentication
$loginUrl = "{$baseUrl}/nacos/v1/auth/login";
$loginData = http_build_query([
    'username' => 'nacos',
    'password' => 'nacos',
]);
$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => $loginData,
    ],
]);
$loginResponse = file_get_contents($loginUrl, false, $context);
$tokenData = json_decode($loginResponse, true);
if (isset($tokenData['accessToken'])) {
    echo "2️⃣ Authentication...\n";
    echo "   ✅ Login successful\n";
    echo "   Token: " . substr($tokenData['accessToken'], 0, 20) . "...\n\n";
} else {
    echo "   🟡 Auth may be disabled or default credentials changed\n\n";
}

// 3. List namespaces
$nsUrl = "{$baseUrl}/nacos/v1/console/namespaces";
$nsResponse = file_get_contents($nsUrl);
$namespaces = json_decode($nsResponse, true);
echo "3️⃣ Namespaces:\n";
if (isset($namespaces['data'])) {
    foreach ($namespaces['data'] as $ns) {
        echo "   - {$ns['namespace']} ({$ns['namespaceShowName']})\n";
    }
}
echo "\n";

// 4. Register a test service instance
$registerUrl = "{$baseUrl}/nacos/v1/ns/instance";
$registerData = http_build_query([
    'serviceName' => 'user-service',
    'ip' => '127.0.0.1',
    'port' => 9501,
    'weight' => 1.0,
    'namespaceId' => 'public',
    'groupName' => 'DEFAULT_GROUP',
]);
$regContext = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => $registerData,
    ],
]);
$regResponse = file_get_contents($registerUrl, false, $regContext);
echo "4️⃣ Register test instance:\n";
echo "   " . ($regResponse === 'ok' ? '✅ Instance registered' : "❌ Failed: {$regResponse}") . "\n\n";

// 5. Query instances
$queryUrl = "{$baseUrl}/nacos/v1/ns/instance/list?serviceName=user-service";
$queryResponse = file_get_contents($queryUrl);
$instances = json_decode($queryResponse, true);
echo "5️⃣ Query instances:\n";
if (isset($instances['hosts'])) {
    foreach ($instances['hosts'] as $host) {
        $healthy = $host['healthy'] ? '✅ healthy' : '❌ unhealthy';
        echo "   - {$host['ip']}:{$host['port']} (weight: {$host['weight']}, {$healthy})\n";
    }
} else {
    echo "   🟡 No instances found\n";
}

echo "\n🎉 Nacos verification complete!\n";
```

## 执行预览

```bash
# 启动 Nacos
$ docker-compose up -d
[+] Running 3/3
 ✔ Network microservice-net  Created
 ✔ Container nacos-mysql      Started
 ✔ Container nacos-server     Started

# 等待启动（约 30 秒）
$ sleep 30

# 验证
$ php verify-nacos.php
🔍 Checking Nacos at http://127.0.0.1:8848

1️⃣ Server health check...
   ✅ Nacos is running
2️⃣ Authentication...
   ✅ Login successful
3️⃣ Namespaces:
   - public (Public)
4️⃣ Register test instance:
   ✅ Instance registered
5️⃣ Query instances:
   - 127.0.0.1:9501 (weight: 1, ✅ healthy)

🎉 Nacos verification complete!
```

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 🔴 必须开启鉴权 | 生产环境务必启用 `NACOS_AUTH_ENABLE=true` | 未鉴权可被任意服务注册/注销，存在安全风险 |
| 🟡 MySQL 持久化 | 生产环境不要用内嵌 Derby 存储 | 内嵌存储重启丢数据，集群模式必须用 MySQL |
| 🟢 端口开放 | 8848(HTTP) + 9848/9849(gRPC) 都要开放 | gRPC 端口未开放导致 2.x 客户端连接失败 |
| 🟡 首次启动等待 | Nacos 首次启动需初始化数据库 | 立即连接会报错，建议等待 30 秒 |
| 🔴 Token 密钥管理 | `NACOS_AUTH_TOKEN` 不要用默认值 | 默认密钥可被伪造，存在认证绕过风险 |

## 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 仅开放 8848 端口 | Nacos 2.x 客户端连接超时 | 同时开放 9848、9849 gRPC 端口 |
| 使用默认密码 | 任何人可访问控制台 | 修改默认账号密码，开启鉴权 |
| 内嵌模式跑生产 | 重启后配置和注册信息丢失 | 使用 MySQL 持久化模式 |
| 容器重启 IP 变化 | 服务注册地址失效 | 使用固定 IP 或自定义网络 |
| 日志级别过高 | 磁盘被日志撑满 | 设置 `JVM_XMS=256m` 限制内存 |

## 练习题

### 🟢 基础
1. 使用 Docker CLI（非 compose）启动一个 Nacos 单机实例，并验证控制台可访问。
2. 通过 Nacos Open API 注册一个 `order-service` 实例到 `public` 命名空间。

### 🟡 进阶
3. 编写一个 Shell 脚本，每 5 秒向 Nacos 发送一次心跳，模拟服务实例保活。

### 🔴 开放
4. 如果 Nacos 集群部署 3 个节点，请设计一个高可用方案：某节点宕机后，客户端如何自动切换？

## 知识点总结

```
Nacos 入门
├── 核心功能
│   ├── 服务注册与发现
│   ├── 配置管理
│   ├── 健康检查
│   └── 命名空间隔离
├── 部署模式
│   ├── 单机模式（standalone）
│   └── 集群模式（cluster）
├── 存储方式
│   ├── 内嵌 Derby（开发）
│   └── MySQL 持久化（生产）
├── 通信端口
│   ├── 8848 — HTTP API
│   ├── 9848 — gRPC Client
│   └── 9849 — gRPC Server
└── 安全
    ├── 鉴权开关
    ├── Token 管理
    └── 命名空间隔离
```

## 举一反三

| 场景 | 适配方式 | 关键差异 |
|------|----------|----------|
| Consul 部署 | 同样支持 Docker 部署，但有 KV 存储 | Consul 用 Raft 协议，Nacos 用 AP/CP 切换 |
| Apollo 配置中心 | 专注配置管理，不支持服务发现 | Apollo 配置变更推送更精细 |
| 多数据中心 | Nacos 命名空间 + 集群分组 | 需要跨机房网络打通 |

## 参考资料

- ⭐⭐⭐ [Nacos 官方文档](https://nacos.io/zh-cn/docs/what-is-nacos.html)
- ⭐⭐⭐ [Nacos Docker 部署指南](https://nacos.io/zh-cn/docs/quick-start-docker.html)
- ⭐⭐ [Nacos 2.x 架构设计](https://nacos.io/zh-cn/docs/architecture.html)

## 代码演进

### v1 ❌ 最简部署（仅开发用）

```yaml
# ❌ No persistence, no auth — development only
services:
  nacos:
    image: nacos/nacos-server:v2.3.2
    environment:
      MODE: standalone
    ports:
      - "8848:8848"
```

### v2 ✅ MySQL 持久化 + 鉴权

```yaml
# ✅ MySQL persistence with authentication
services:
  nacos-mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: nacos_root_pwd
      MYSQL_DATABASE: nacos_config
  nacos:
    image: nacos/nacos-server:v2.3.2
    depends_on: [nacos-mysql]
    environment:
      MODE: standalone
      SPRING_DATASOURCE_PLATFORM: mysql
      MYSQL_SERVICE_HOST: nacos-mysql
      NACOS_AUTH_ENABLE: "true"
```

### v3 🟢 生产级（含资源限制 + 健康检查）

```yaml
# 🟢 Production-ready with health checks and resource limits
services:
  nacos-mysql:
    image: mysql:8.0
    deploy:
      resources:
        limits:
          memory: 512M
    healthcheck:
      test: ["CMD", "mysqladmin", "ping"]
      interval: 10s
      retries: 3
  nacos:
    image: nacos/nacos-server:v2.3.2
    deploy:
      resources:
        limits:
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8848/nacos/"]
      interval: 15s
      retries: 5
    environment:
      JVM_XMS: 256m
      JVM_XMX: 512m
```
