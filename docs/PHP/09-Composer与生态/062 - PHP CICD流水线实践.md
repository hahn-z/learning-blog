---
title: "PHP CI/CD流水线实践"
slug: "php-cicd-pipeline"
category: "Composer与生态"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "CI/CD", "GitHub Actions", "Docker"]
---

# PHP CI/CD流水线实践

自动化流水线是将代码安全、快速地交付到生产环境的核心。本文覆盖GitHub Actions配置、Docker多阶段构建和完整流水线设计。

## GitHub Actions配置

### PHP矩阵测试

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        php-version: ['8.2', '8.3']

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: ${{ matrix.php-version }}
          extensions: mbstring, xml, mysqlnd, redis, pcov
          coverage: pcov
          tools: composer:v2

      - name: Install dependencies
        run: composer install --prefer-dist --no-progress

      - name: PHPStan
        run: vendor/bin/phpstan analyse --no-progress --error-format=github

      - name: PHP-CS-Fixer
        run: vendor/bin/php-cs-fixer fix --dry-run --diff

      - name: PHPUnit
        env:
          DB_HOST: 127.0.0.1
          DB_DATABASE: test
          DB_USERNAME: root
          DB_PASSWORD: root
        run: vendor/bin/phpunit --coverage-text

      - name: Upload coverage
        if: matrix.php-version == '8.3'
        uses: codecov/codecov-action@v4
```

## Docker多阶段构建

```dockerfile
# 阶段1: 安装依赖
FROM composer:2.7 AS builder
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts --prefer-dist
COPY . .
RUN php artisan config:cache && php artisan route:cache

# 阶段2: 生产镜像
FROM php:8.3-fpm-alpine AS production
RUN apk add --no-cache libpng-dev libjpeg-turbo-dev freetype-dev \
    zip libzip-dev icu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd pdo_mysql zip intl opcache pcntl

COPY docker/opcache.ini /usr/local/etc/php/conf.d/
COPY --from=builder /app /var/www/html
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]
```

```ini
# docker/opcache.ini
opcache.enable=1
opcache.memory_consumption=256
opcache.max_accelerated_files=60000
opcache.validate_timestamps=0
opcache.jit=1255
opcache.jit_buffer_size=128M
```

## 部署策略

### 蓝绿部署脚本

```bash
#!/bin/bash
# deploy.sh
ACTIVE=$(cat /var/www/current_env 2>/dev/null || echo "blue")
if [ "$ACTIVE" = "blue" ]; then TARGET="green"; else TARGET="blue"; fi

echo "Deploying to $TARGET..."
cd "/var/www/$TARGET"
git pull origin main
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
sudo systemctl reload php8.3-fpm

# 切换
ln -sfn "/var/www/$TARGET" /var/www/current
echo "$TARGET" > /var/www/current_env

# 健康检查
for i in $(seq 1 10); do
    if curl -sf https://yourapp.com/health; then
        echo "Deploy successful!"
        exit 0
    fi
    sleep 3
done

echo "Health check failed, rolling back..."
# 回滚到旧环境
if [ "$TARGET" = "green" ]; then ROLLBACK="blue"; else ROLLBACK="green"; fi
ln -sfn "/var/www/$ROLLBACK" /var/www/current
echo "$ROLLBACK" > /var/www/current_env
exit 1
```

## 完整流水线流程

```
代码推送 → CI
  ├─ 代码风格 (CS-Fixer, ~10s)
  ├─ 静态分析 (PHPStan, ~30s)
  └─ 测试 (PHPUnit, ~2min)
       ↓ 通过
     构建Docker镜像 → 推送镜像仓库
       ↓
     部署Staging → 冒烟测试
       ↓ 人工审批
     部署Production → 健康检查
```

## 面试常见追问

**Q: CI和CD的区别？**
A: CI（持续集成）自动构建+测试，确保代码合并不出错。CD（持续部署）自动将通过测试的代码部署到生产。CI是CD的前提。

**Q: Docker多阶段构建的好处？**
A: 最终镜像不含composer/git等构建工具，体积小、安全。构建缓存可复用加速后续构建。

**Q: 蓝绿部署和滚动部署怎么选？**
A: 蓝绿需要双倍资源但瞬间回滚，适合关键业务。滚动资源利用率高但回滚慢。K8s原生支持滚动部署更简单。
