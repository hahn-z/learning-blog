---
title: "PHP OPcache原理与调优"
slug: "php-opcache-principle-tuning"
category: "性能与底层"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "性能", "OPcache", "JIT"]
:v-pre:
---# PHP OPcache原理与调优

PHP每次请求都要经历"源码→词法分析→语法分析→AST→opcode→执行"的编译过程。OPcache缓存opcode，跳过编译阶段，是PHP性能提升最直接的方案。

## OPcache工作原理

### opcode是什么

opcode是PHP编译器生成的中间指令，类似Java的字节码。每条opcode指定一个操作（ASSIGN、ADD、ECHO等）和操作数。

```
源码: $a = 1 + 2;
编译后opcode:
  ADD ~0 1 2        ; 1+2 → 临时变量~0
  ASSIGN !0 ~0      ; ~0 → $a(CV变量!0)
```

### OPcache缓存机制

OPcache将编译后的opcode以共享内存（SHM）形式缓存，所有PHP-FPM worker进程共享同一份缓存：

1. 首次请求：正常编译 → 将opcode存入共享内存
2. 后续请求：检查文件是否变更 → 未变更直接使用缓存 → 跳过编译阶段
3. 文件变更：通过文件修改时间（stat）检测 → 重新编译并更新缓存

## 核心配置参数

```ini
; php.ini / php.d/opcache.ini

; 开启OPcache
opcache.enable=1

; 共享内存大小（推荐128M-512M，根据项目规模）
opcache.memory_consumption=256

; 最大缓存文件数（项目文件数 * 1.5，含vendor）
opcache.max_accelerated_files=60000

; 字符串缓冲区大小
opcache.interned_strings_buffer=32

; 生产环境关闭文件变更检查（部署时手动reset）
opcache.validate_timestamps=0

; 文件检查间隔（秒），validate_timestamps=1时生效
opcache.revalidate_freq=60

; 优化级别（位掩码，默认0x7FFEBFFF即全部开启）
opcache.optimization_level=0x7FFEBFFF

; 开启JIT（PHP 8.0+）
opcache.jit=1255
opcache.jit_buffer_size=128M

; CLI模式也启用（用于队列worker等长运行进程）
opcache.enable_cli=1

; 保存注释（用到了注解/Doctrine就必须开启）
opcache.save_comments=1
```

### 计算max_accelerated_files

```bash
# 统计项目PHP文件数（含vendor）
find /var/www/html -name "*.php" | wc -l
# 输出例如: 42000

# 配置为文件数 * 1.5
# opcache.max_accelerated_files=63000 → 取整到最近的可选值
# OPcache的可选值: 3900, 7200, 16200, 39000, 78000, 162000
```

## 预热脚本

部署新代码后，手动触发OPcache预热，避免用户请求命中冷缓存：

```php
<?php
// warmup.php — 部署后执行：php warmup.php /var/www/html

function warmup(string $dir): void {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    
    $count = 0;
    $errors = 0;
    
    foreach ($iterator as $file) {
        if (!$file->isFile() || $file->getExtension() !== 'php') {
            continue;
        }
        
        $path = $file->getRealPath();
        
        // opcache_compile_file：编译并缓存，不执行
        if (opcache_compile_file($path)) {
            $count++;
        } else {
            $errors++;
            echo "Failed: $path\n";
        }
    }
    
    echo sprintf("Warmup complete: %d files cached, %d errors\n", $count, $errors);
}

$dir = $argv[1] ?? '/var/www/html';
warmup($dir);

// 查看OPcache状态
$status = opcache_get_status(false);
echo sprintf(
    "Memory: %.1fMB / %.1fMB, Files: %d / %d, Hit rate: %.1f%%\n",
    $status['memory_usage']['used_memory'] / 1024 / 1024,
    $status['memory_usage']['free_memory'] / 1024 / 1024 + $status['memory_usage']['used_memory'] / 1024 / 1024,
    $status['opcache_statistics']['num_cached_scripts'],
    $status['opcache_statistics']['max_cached_keys'],
    $status['opcache_statistics']['opcache_hit_rate']
);
```

## OPcache状态监控

```php
<?php
// opcache-status.php — 监控页面
$status = opcache_get_status(true);

$used = $status['memory_usage']['used_memory'];
$free = $status['memory_usage']['free_memory'];
$wasted = $status['memory_usage']['wasted_memory'];
$total = $used + $free + $wasted;

echo "=== OPcache Status ===\n";
echo sprintf("Memory: %.1fMB / %.1fMB (%.1f%% used)\n",
    $used / 1024 / 1024, $total / 1024 / 1024, $used / $total * 100);
echo sprintf("Cached scripts: %d / %d\n",
    $status['opcache_statistics']['num_cached_scripts'],
    $status['opcache_statistics']['max_cached_keys']);
echo sprintf("Hit rate: %.1f%%\n",
    $status['opcache_statistics']['opcache_hit_rate']);
echo sprintf("Interment strings: %d\n",
    $status['interned_strings_usage']['number_of_strings']);

// 重置OPcache（部署新代码后调用）
// opcache_reset();
```

## 生产部署最佳实践

```bash
# 部署流程：
# 1. 释放新代码到当前版本目录
# 2. 禁用时间戳验证
# 3. 重启PHP-FPM（清空旧缓存）或调用opcache_reset()

# 平滑重启PHP-FPM（不中断请求
sudo systemctl reload php8.3-fpm

# 或者通过PHP脚本重置
php -r "opcache_reset();"
```

## 面试常见追问

**Q: OPcache和APCu有什么区别？**
A: OPcache缓存PHP编译后的opcode（编译结果），APCu缓存用户数据（KV存储）。两者互补：OPcache避免重复编译，APCu避免重复计算/查询。

**Q: validate_timestamps=0后如何更新缓存？**
A: 必须手动触发：1) 重启PHP-FPM（`systemctl reload`）；2) 调用`opcache_reset()`；3) 自动化部署脚本中集成此步骤。这是生产环境的推荐做法，避免stat系统调用的开销。

**Q: OPcache内存满了怎么办？**
A: OPcache会淘汰最少使用（LRU）的缓存。频繁淘汰会导致缓存命中率下降。解决方案：增大`memory_consumption`，减少不必要的文件（如dev依赖）。

**Q: 为什么有时候改了代码没生效？**
A: 1) `validate_timestamps=0`时需要手动重置；2) `revalidate_freq`设太大，还在等过期检查；3) 多台服务器OPcache状态不同步。
