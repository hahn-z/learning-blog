---
title: "040 - Kubernetes 部署与生产级架构总结"
slug: "040-k8s-production"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:09.062+08:00"
updated_at: "2026-05-01T22:15:41.604+08:00"
reading_time: 7
tags: []
---

# Kubernetes 部署与生产级架构总结

> **难度：** ⭐⭐⭐⭐⭐
> **前置知识：** Docker 容器化（039篇）、Linux 网络、YAML 基础
> **预估用时：** 60-90 分钟

## 1. 概念讲解

**Kubernetes（K8s）** 是容器编排平台，自动化部署、扩缩容和管理容器化应用。核心概念包括 Pod（最小调度单元）、Service（服务发现和负载均衡）、Deployment（声明式更新）、ConfigMap/Secret（配置管理）。

类比理解：如果说 Docker 是把应用装进集装箱，Kubernetes 就是自动化码头——它决定哪个集装箱放在哪个货位（调度），根据负载增减集装箱数量（扩缩容），集装箱坏了自动换新的（自愈），外面的人只需要知道码头地址不需要知道具体哪个集装箱（服务发现）。

本篇是系列收官之作，将用户服务部署到 K8s，并总结整个 Hyperf 微服务实战系列的核心架构。

## 2. 实时脑图

```
┌─────────────────────────────────────────────────────┐
│       Kubernetes Production Architecture              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [Ingress/Nginx]                                     │
│       |                                              │
│       v                                              │
│  [Service: user-service]                             │
│       |                                              │
│  ┌────┼────┐                                         │
│  v    v    v                                         │
│ [Pod] [Pod] [Pod]  (HPA: 3-10 replicas)             │
│                                                      │
│  Dependencies:                                       │
│  ├── ConfigMap (env vars)                            │
│  ├── Secret (db password)                            │
│  ├── PVC (persistent storage)                        │
│  └── HPA (auto-scaling)                              │
│                                                      │
│  Architecture Summary:                               │
│  ├── 031-032: Kafka messaging                        │
│  ├── 033-035: Distributed transactions (Saga)        │
│  ├── 036-037: Prometheus + Grafana monitoring        │
│  ├── 038: ELK logging                                │
│  ├── 039: Docker containerization                    │
│  └── 040: Kubernetes deployment                      │
└─────────────────────────────────────────────────────┘
```

## 3. 完整代码

### 3.1 Namespace `k8s/namespace.yaml`

```yaml
# ✅ Dedicated namespace for user service
apiVersion: v1
kind: Namespace
metadata:
  name: user-service
  labels:
    app: user-service
```

### 3.2 ConfigMap `k8s/configmap.yaml`

```yaml
# ✅ Non-sensitive configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: user-service-config
  namespace: user-service
data:
  APP_ENV: "production"
  DB_HOST: "mysql-service"
  DB_PORT: "3306"
  DB_DATABASE: "user_service"
  REDIS_HOST: "redis-service"
  KAFKA_BROKERS: "kafka-service:9092"
  METRIC_DRIVER: "prometheus"
```

### 3.3 Secret `k8s/secret.yaml`

```yaml
# ✅ Sensitive configuration (base64 encoded)
apiVersion: v1
kind: Secret
metadata:
  name: user-service-secret
  namespace: user-service
type: Opaque
data:
  DB_USERNAME: cm9vdA==           # root
  DB_PASSWORD: c2VjcmV0           # secret
  APP_KEY: YmFzZTY0LWVuY29kZWQ=  # base64-encoded
```

### 3.4 Deployment `k8s/deployment.yaml`

```yaml
# ✅ Deployment with health checks and resource limits
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: user-service
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # ✅ One extra pod during update
      maxUnavailable: 0    # ✅ Zero downtime
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: registry.example.com/user-service:latest
          ports:
            - containerPort: 9501
          envFrom:
            - configMapRef:
                name: user-service-config
            - secretRef:
                name: user-service-secret
          # ✅ Liveness probe: restart if unhealthy
          livenessProbe:
            httpGet:
              path: /
              port: 9501
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
          # ✅ Readiness probe: only route traffic when ready
          readinessProbe:
            httpGet:
              path: /
              port: 9501
            initialDelaySeconds: 10
            periodSeconds: 5
          # ✅ Resource limits
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          # ✅ Graceful shutdown
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
      terminationGracePeriodSeconds: 30
```

### 3.5 Service `k8s/service.yaml`

```yaml
# ✅ ClusterIP service for internal communication
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: user-service
spec:
  selector:
    app: user-service
  ports:
    - port: 9501
      targetPort: 9501
  type: ClusterIP
---
# ✅ LoadBalancer for external access
apiVersion: v1
kind: Service
metadata:
  name: user-service-external
  namespace: user-service
spec:
  selector:
    app: user-service
  ports:
    - port: 80
      targetPort: 9501
  type: LoadBalancer
```

### 3.6 HPA 自动扩缩容 `k8s/hpa.yaml`

```yaml
# ✅ Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: user-service
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 3.7 Ingress `k8s/ingress.yaml`

```yaml
# ✅ Ingress for HTTP routing
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: user-service-ingress
  namespace: user-service
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: user-service
                port:
                  number: 9501
```

### 3.8 部署脚本 `k8s/deploy.sh`

```bash
#!/bin/bash
set -e

# ✅ Deploy user service to Kubernetes
echo "Deploying user-service to K8s..."

# Apply resources in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml

# ✅ Wait for rollout
echo "Waiting for deployment to be ready..."
kubectl rollout status deployment/user-service -n user-service --timeout=120s

echo "Deployment complete!"
kubectl get pods -n user-service
```

## 4. 执行预览

```bash
# Deploy
$ bash k8s/deploy.sh
# Deploying user-service to K8s...
# deployment.apps/user-service rolled out

# Check pods
$ kubectl get pods -n user-service
# NAME                            READY   STATUS    RESTARTS   AGE
# user-service-5f7b8c6d4d-abc12   1/1     Running   0          2m
# user-service-5f7b8c6d4d-def34   1/1     Running   0          2m
# user-service-5f7b8c6d4d-ghi56   1/1     Running   0          2m

# Test
$ curl http://api.example.com/api/register -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"12345678"}'

# Scale manually
$ kubectl scale deployment user-service --replicas=5 -n user-service

# Check HPA
$ kubectl get hpa -n user-service
# NAME                 REFERENCE           TARGETS   MINPODS   MAXPODS   REPLICAS
# user-service-hpa     Deployment/user     30%/70%   3         10        3
```

## 5. 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 资源限制必须设置 | requests + limits | Pod 抢占资源，节点不稳定 |
| 镜像用私有仓库 | 不要用 latest 标签部署 | 无法回滚，版本不可控 |
| Secret 不要明文存仓库 | 用 Sealed Secrets 或 Vault | 密码泄露 |
| 滚动更新策略配置 | maxSurge + maxUnavailable | 更新时服务中断 |
| Swoole 需要优雅关闭 | preStop hook + sleep | 请求被中断 |

## 6. 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 不配 readinessProbe | Pod 还没启动就收到流量 | 配 readinessProbe，ready 后才接流量 |
| 用 latest 标签 | 无法确定运行版本 | 用 git SHA 或语义版本号 |
| 不配 HPA | 流量突增无法自动扩容 | 配 CPU/内存指标 HPA |
| ConfigMap 改了 Pod 不更新 | Deployment 不感知 ConfigMap 变更 | 用Reloader 或手动 rollout restart |
| PVC 没配 StorageClass | 数据无法持久化 | 显式指定 StorageClass |

## 7. 练习题

🟢 **基础题 1：** 为 MySQL 和 Redis 创建独立的 Deployment 和 Service。

🟢 **基础题 2：** 编写一个 rollback 脚本，回滚到上一个版本。

🟡 **进阶题：** 使用 Helm Chart 重构所有 K8s 配置，支持 values.yaml 变量覆盖。

🔴 **开放题：** 设计一个完整的 GitOps 流水线：代码推送 -> CI 构建 -> CD 自动部署到 K8s。

## 8. 知识点总结

```
Kubernetes Deployment
├── Core Resources
│   ├── Namespace (isolation)
│   ├── ConfigMap (config)
│   ├── Secret (sensitive data)
│   ├── Deployment (pod management)
│   ├── Service (discovery + LB)
│   ├── HPA (auto-scaling)
│   └── Ingress (HTTP routing)
├── Deployment Strategy
│   ├── RollingUpdate (zero downtime)
│   └── maxSurge=1, maxUnavailable=0
├── Health Checks
│   ├── livenessProbe (restart unhealthy)
│   └── readinessProbe (traffic routing)
└── Series Architecture Summary
    ├── 031-032: Kafka messaging + reliability
    ├── 033-035: Distributed transactions (Saga)
    ├── 036-037: Monitoring (Prometheus + Grafana)
    ├── 038: Logging (ELK)
    ├── 039: Containerization (Docker)
    └── 040: Orchestration (Kubernetes)
```

## 9. 举一反三

| 场景 | K8s 资源 | 关键配置 |
|------|----------|----------|
| 多环境部署 | 同一 Chart + 不同 values | values-dev.yaml / values-prod.yaml |
| 蓝绿部署 | 两个 Deployment + Service 切换 | selector 版本标签 |
| 金丝雀发布 | Istio VirtualService + weight | 10% 新版本 + 90% 旧版本 |

## 10. 参考资料

- 🏆 [Kubernetes 官方文档](https://kubernetes.io/docs/home/)
- 🏆 [K8s 最佳实践](https://kubernetes.io/docs/concepts/configuration/overview/)
- ⭐ [Helm Chart 模板指南](https://helm.sh/docs/chart_template_guide/)
- 📖 [Hyperf 生产部署](https://hyperf.wiki/3.1/#/zh-cn/deploy)

## 11. 代码演进

### v1 ❌ 手动部署
```bash
# SSH to server, git pull, composer install, restart
# No version control, no rollback, no scaling
```

### v2 ✅ Docker + Compose
```yaml
# docker-compose up -d
# Single server, manual scaling, no self-healing
```

### v3 🟢 Kubernetes
```yaml
# kubectl apply -f k8s/
# Auto-scaling (HPA), self-healing (probes), rolling updates
# GitOps pipeline, multi-environment, production-ready
```

---

## 📚 系列总结

恭喜你完成了 Hyperf 微服务实战系列全部 40 篇文章的学习！以下是完整知识图谱：

```
Hyperf 微服务实战系列
├── 入门篇 (001-010)
│   └── Hyperf 基础、Swoole、协程、依赖注入
├── 核心篇 (011-020)
│   └── 路由、中间件、数据库、Redis、队列
├── 服务篇 (021-030)
│   └── gRPC、服务注册、配置中心、API 网关
└── 生产篇 (031-040) ← 你在这里
    ├── 消息队列：Kafka + 可靠投递 + 幂等消费
    ├── 分布式事务：CAP/SAGA + Hyperf 实现
    ├── 可观测性：Prometheus + Grafana + ELK
    └── 部署运维：Docker + Kubernetes
```

**核心理念：架构先行，简洁优先，端到端交付。**
