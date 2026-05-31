---
title: "PHP MySQL性能优化实战"
slug: "php-mysql-performance-optimization"
category: "数据库"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "MySQL", "性能优化", "索引"]
:v-pre:
---# PHP MySQL性能优化实战

## 慢查询定位

### 开启慢查询日志

```sql
-- MySQL配置
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- 超过1秒记录
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
SET GLOBAL log_queries_not_using_indexes = 'ON';  -- 未用索引的也记录

-- 查看慢查询配置
SHOW VARIABLES LIKE 'slow_query%';
```

### 用EXPLAIN分析查询

```php
<?php
function explainQuery(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare("EXPLAIN {$sql}");
    $stmt->execute($params);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($result as $row) {
        $warnings = [];

        // type列：访问类型（从好到坏）
        $badTypes = ['ALL', 'index']; // 全表扫描
        if (in_array($row['type'], $badTypes)) {
            $warnings[] = "⚠️ 访问类型: {$row['type']}（可能全表扫描）";
        }

        // Extra列：额外信息
        if (str_contains($row['Extra'] ?? '', 'Using filesort')) {
            $warnings[] = "⚠️ Using filesort（额外排序）";
        }
        if (str_contains($row['Extra'] ?? '', 'Using temporary')) {
            $warnings[] = "⚠️ Using temporary（临时表）";
        }
        if (str_contains($row['Extra'] ?? '', 'Using filesort') && str_contains($row['Extra'] ?? '', 'Using temporary')) {
            $warnings[] = "🚨 同时出现filesort和temporary，性能极差";
        }

        // rows列：预估扫描行数
        if ($row['rows'] > 10000) {
            $warnings[] = "⚠️ 预估扫描: {$row['rows']}行";
        }

        if ($warnings) {
            echo "表: {$row['table']}\n";
            echo "  SQL: {$sql}\n";
            echo "  type: {$row['type']}, key: " . ($row['key'] ?: 'NULL') . "\n";
            echo "  rows: {$row['rows']}\n";
            foreach ($warnings as $w) echo "  {$w}\n";
            echo "\n";
        }
    }

    return $result;
}

// 使用
explainQuery($pdo, 'SELECT * FROM orders WHERE user_id = ? AND status = ?', [1, 'active']);
```

EXPLAIN type列（从优到劣）：
`system > const > eq_ref > ref > range > index > ALL`

## 索引设计

### 索引类型与选择

```php
<?php
// 索引创建SQL示例

// 1. 主键索引（聚簇索引，数据按主键物理排序）
// 已通过PRIMARY KEY自动创建

// 2. 唯一索引（保证唯一性 + 查询加速）
// CREATE UNIQUE INDEX uk_email ON users(email);

// 3. 普通索引（最常见）
// CREATE INDEX idx_user_id ON orders(user_id);

// 4. 联合索引（最左前缀原则）
// CREATE INDEX idx_user_status_date ON orders(user_id, status, created_at);
// 生效: WHERE user_id = ?
// 生效: WHERE user_id = ? AND status = ?
// 生效: WHERE user_id = ? AND status = ? AND created_at > ?
// 不生效: WHERE status = ? （跳过了user_id）
// 部分生效: WHERE user_id = ? AND created_at > ? （跳过status，created_at无法用索引）

// 5. 覆盖索引（查询列都在索引中，不需要回表）
// SELECT user_id, status FROM orders WHERE user_id = 1;
// 如果有idx_user_status_date索引，查询直接从索引取数据

class IndexAdvisor
{
    // 分析查询建议索引
    public static function suggest(PDO $pdo, string $table, array $whereColumns, array $selectColumns = []): string
    {
        $existing = self::getExistingIndexes($pdo, $table);

        // 最左前缀：等值条件列在前，范围条件列在后
        $indexColumns = implode(', ', $whereColumns);

        // 考虑覆盖索引
        if ($selectColumns) {
            $allColumns = array_unique(array_merge($whereColumns, $selectColumns));
            $indexColumns = implode(', ', $allColumns);
        }

        return "CREATE INDEX idx_{$table}_" . implode('_', $whereColumns)
             . " ON {$table}({$indexColumns});";
    }

    private static function getExistingIndexes(PDO $pdo, string $table): array
    {
        $stmt = $pdo->query("SHOW INDEX FROM {$table}");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
```

## 批量操作优化

### 批量INSERT

```php
<?php
// ❌ 逐条插入（N次网络往返）
foreach ($users as $user) {
    $pdo->prepare('INSERT INTO users (name, email) VALUES (?, ?)')
        ->execute([$user['name'], $user['email']]);
}

// ✅ 批量INSERT（1次网络往返）
function batchInsert(PDO $pdo, string $table, array $columns, array $rows, int $batchSize = 1000): int
{
    $placeholders = '(' . implode(',', array_fill(0, count($columns), '?')) . ')';
    $sql = "INSERT INTO {$table} (" . implode(',', $columns) . ") VALUES ";
    $totalInserted = 0;

    foreach (array_chunk($rows, $batchSize) as $batch) {
        $values = [];
        $params = [];
        foreach ($batch as $row) {
            $values[] = $placeholders;
            foreach ($columns as $col) {
                $params[] = $row[$col] ?? null;
            }
        }

        $stmt = $pdo->prepare($sql . implode(',', $values));
        $stmt->execute($params);
        $totalInserted += $stmt->rowCount();
    }

    return $totalInserted;
}

// 使用
$inserted = batchInsert($pdo, 'users', ['name', 'email', 'age'], [
    ['name' => '张三', 'email' => 'z@test.com', 'age' => 25],
    ['name' => '李四', 'email' => 'l@test.com', 'age' => 30],
    // ... 10000条
], 1000); // 每批1000条

// REPLACE INTO：存在则替换（根据主键/唯一键判断）
$sql = "REPLACE INTO user_stats (user_id, login_count, last_login) VALUES (?, ?, ?)";

// INSERT ... ON DUPLICATE KEY UPDATE：存在则更新
$sql = "INSERT INTO user_stats (user_id, login_count, last_login)
        VALUES (:uid, 1, NOW())
        ON DUPLICATE KEY UPDATE
        login_count = login_count + 1,
        last_login = NOW()";
$pdo->prepare($sql)->execute([':uid' => $userId]);
```

### LOAD DATA批量导入

```php
<?php
// 最快的导入方式（比批量INSERT快10倍以上）
function fastImport(PDO $pdo, string $table, string $csvPath): int
{
    $sql = "LOAD DATA LOCAL INFILE '{$csvPath}'
            INTO TABLE {$table}
            FIELDS TERMINATED BY ','
            ENCLOSED BY '\"'
            LINES TERMINATED BY '\\n'
            IGNORE 1 LINES";

    // 需要PDO开启LOCAL_INFILE
    $pdo->setAttribute(PDO::MYSQL_ATTR_LOCAL_INFILE, true);

    return $pdo->exec($sql);
}
```

## 查询构建器设计

```php
<?php
class QueryBuilder
{
    private string $table;
    private array $wheres = [];
    private array $params = [];
    private array $orders = [];
    private ?int $limit = null;
    private ?int $offset = null;
    private array $selects = ['*'];
    private array $joins = [];

    public function __construct(private PDO $pdo) {}

    public function table(string $table): self
    {
        $this->table = $table;
        return $this;
    }

    public function select(array $columns): self
    {
        $this->selects = $columns;
        return $this;
    }

    public function where(string $column, mixed $value, string $op = '='): self
    {
        $placeholder = ':w' . count($this->params);
        $this->wheres[] = "{$column} {$op} {$placeholder}";
        $this->params[$placeholder] = $value;
        return $this;
    }

    public function whereIn(string $column, array $values): self
    {
        $placeholders = [];
        foreach ($values as $value) {
            $ph = ':w' . count($this->params);
            $placeholders[] = $ph;
            $this->params[$ph] = $value;
        }
        $this->wheres[] = "{$column} IN (" . implode(', ', $placeholders) . ")";
        return $this;
    }

    public function orderBy(string $column, string $direction = 'ASC'): self
    {
        // 白名单防止SQL注入
        $dir = strtoupper($direction) === 'DESC' ? 'DESC' : 'ASC';
        $this->orders[] = "{$column} {$dir}";
        return $this;
    }

    public function limit(int $limit, ?int $offset = null): self
    {
        $this->limit = $limit;
        $this->offset = $offset;
        return $this;
    }

    public function join(string $table, string $on, string $type = 'INNER'): self
    {
        $this->joins[] = "{$type} JOIN {$table} ON {$on}";
        return $this;
    }

    public function get(): array
    {
        $sql = $this->buildSelect();
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($this->params);
        $this->reset();
        return $stmt->fetchAll();
    }

    public function first(): ?array
    {
        $this->limit = 1;
        $results = $this->get();
        return $results[0] ?? null;
    }

    public function count(): int
    {
        $this->selects = ['COUNT(*) as cnt'];
        $result = $this->first();
        return (int)($result['cnt'] ?? 0);
    }

    public function paginate(int $page, int $perPage = 20): array
    {
        $total = $this->count();
        $this->selects = ['*'];
        $this->limit($perPage, ($page - 1) * $perPage);
        $items = $this->get();

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => (int)ceil($total / $perPage),
        ];
    }

    private function buildSelect(): string
    {
        $sql = 'SELECT ' . implode(', ', $this->selects) . " FROM {$this->table}";

        if ($this->joins) {
            $sql .= ' ' . implode(' ', $this->joins);
        }

        if ($this->wheres) {
            $sql .= ' WHERE ' . implode(' AND ', $this->wheres);
        }

        if ($this->orders) {
            $sql .= ' ORDER BY ' . implode(', ', $this->orders);
        }

        if ($this->limit !== null) {
            $sql .= " LIMIT {$this->limit}";
        }
        if ($this->offset !== null) {
            $sql .= " OFFSET {$this->offset}";
        }

        return $sql;
    }

    private function reset(): void
    {
        $this->wheres = [];
        $this->params = [];
        $this->orders = [];
        $this->limit = null;
        $this->offset = null;
        $this->selects = ['*'];
        $this->joins = [];
    }
}

// 使用
$users = (new QueryBuilder($pdo))
    ->table('users')
    ->select(['id', 'name', 'email'])
    ->where('status', 'active')
    ->whereIn('role', ['admin', 'editor'])
    ->orderBy('created_at', 'DESC')
    ->paginate(1, 20);
```

## 面试常见追问

**Q: 联合索引(a,b,c)，WHERE a=1 AND c=3能用索引吗？**
A: 能用到`a`的部分（最左前缀），但`c`无法利用索引的有序性。MySQL 8.0+的`index skip scan`可以在某些情况下跳过b使用c，但效率不如完整的联合索引。最佳做法是调整索引列顺序为`(a,c,b)`或建两个索引。

**Q: LIMIT深分页（LIMIT 100000, 10）怎么优化？**
A: 三种方案：1) **游标分页**（`WHERE id > ? LIMIT 10`），避免offset扫描；2) **延迟关联**（`SELECT * FROM t JOIN (SELECT id FROM t LIMIT 100000,10) tmp USING(id)`），子查询走覆盖索引；3) **ES/搜索引擎**，大数据量用专业方案。

**Q: 批量INSERT每批多少条最优？**
A: 取决于单行大小。经验值：小行（几列）1000-5000条，大行（含TEXT）100-500条。过大的batch会导致单条SQL过长（超过`max_allowed_packet`）。建议用`array_chunk`分批，每批用事务包裹。
