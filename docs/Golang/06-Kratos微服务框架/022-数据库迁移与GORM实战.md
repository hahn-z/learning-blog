---
title: "022-数据库迁移与GORM实战"
slug: "022-kratos-migration"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:11:07.035+08:00"
updated_at: "2026-04-29T10:02:45.448+08:00"
reading_time: 19
tags: []
---


# 022-数据库迁移与GORM实战

> 难度：⭐⭐⭐（中级）
>
> 本文讲解 Kratos 项目中数据库迁移的完整实践，从 GORM AutoMigrate 到版本化迁移工具 golang-migrate，覆盖开发、测试、生产全场景。

---

## 一、概念讲解

### 1.1 为什么需要数据库迁移？

数据库 Schema 随业务演进不断变化。手动修改数据库容易遗漏、难以回滚、多环境不一致。迁移工具让 Schema 变更**版本化、可追溯、可回滚**。

### 1.2 迁移方案对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| GORM AutoMigrate | 开发阶段 | 零配置，自动同步 | 无法回滚，不记录历史 |
| golang-migrate | 生产环境 | 版本化，可回滚 | 需手动编写 SQL |
| Atlas | 高级需求 | 声明式，自动diff | 学习成本高 |
| Goose | 替代方案 | Go/SQL双格式 | 社区较小 |

### 1.3 Kratos Data 层与迁移的关系

Kratos 的 `data` 层负责数据库操作。迁移通常在 `data.NewData()` 初始化时执行，确保应用启动时 Schema 是最新的。

---

## 二、脑图

```
数据库迁移
├── 开发阶段
│   ├── GORM AutoMigrate
│   └── 自动建表 + 加字段
├── 版本化迁移
│   ├── golang-migrate
│   ├── UP / DOWN 文件
│   └── 版本号管理
├── 种子数据
│   ├── 初始数据
│   └── 测试数据
├── 生产策略
│   ├── 迁移脚本 Review
│   ├── 灰度发布
│   └── 备份先行
└── 回滚方案
    ├── migrate down
    └── 紧急恢复脚本
```

---

## 三、完整代码

### v1: GORM AutoMigrate（开发阶段）

```go
// internal/data/data.go - Data layer with AutoMigrate
package data

import (
	"context"
	"log"

	"entgo.io/ent/dialect/sql/schema"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/go-kratos/kratos/v2/config"
)

// User model for GORM
type User struct {
	ID        int64  `gorm:"primaryKey;autoIncrement"`
	Username  string `gorm:"uniqueIndex;size:64;not null"`
	Email     string `gorm:"uniqueIndex;size:128;not null"`
	Password  string `gorm:"size:256;not null"`
	Role      string `gorm:"size:32;default:user"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// Data holds database connection
type Data struct {
	DB *gorm.DB
}

// NewData creates a new Data instance with AutoMigrate
func NewData(c *conf.Data) (*Data, func(), error) {
	db, err := gorm.Open(mysql.Open(c.GetDatabase().GetSource()), &gorm.Config{})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect database: %w", err)
	}

	// AutoMigrate for development - syncs struct to table
	if err := db.AutoMigrate(
		&User{},
		// Add more models here
	); err != nil {
		return nil, nil, fmt.Errorf("failed to auto migrate: %w", err)
	}

	log.Println("Database migrated successfully")

	cleanup := func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}
	return &Data{DB: db}, cleanup, nil
}
```

### v2: golang-migrate 版本化迁移

```sql
-- migrations/000001_create_users_table.up.sql
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    email VARCHAR(128) NOT NULL,
    password VARCHAR(256) NOT NULL,
    role VARCHAR(32) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE INDEX idx_username (username),
    UNIQUE INDEX idx_email (email),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```sql
-- migrations/000001_create_users_table.down.sql
DROP TABLE IF EXISTS users;
```

```sql
-- migrations/000002_add_user_status.up.sql
ALTER TABLE users ADD COLUMN status TINYINT DEFAULT 1 COMMENT '1:active 2:disabled' AFTER role;
```

```sql
-- migrations/000002_add_user_status.down.sql
ALTER TABLE users DROP COLUMN status;
```

```go
// internal/data/migrate.go - Migration runner
package data

import (
	"embed"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// RunMigrations executes all pending migrations
func RunMigrations(dsn string) error {
	d, err := iofs.New(migrationFS, "migrations")
	if err != nil {
		return fmt.Errorf("failed to read migrations: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", d, "mysql://"+dsn)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration failed: %w", err)
	}

	return nil
}

// Rollback rolls back the last migration
func Rollback(dsn string) error {
	d, err := iofs.New(migrationFS, "migrations")
	if err != nil {
		return err
	}
	m, err := migrate.NewWithSourceInstance("iofs", d, "mysql://"+dsn)
	if err != nil {
		return err
	}
	defer m.Close()
	return m.Steps(-1)
}
```

### v3: 种子数据 + 生产策略

```go
// internal/data/seed.go - Seed data management
package data

import (
	"context"
	"log"

	"gorm.io/gorm"
)

// Seeder handles database seeding
type Seeder struct {
	db *gorm.DB
}

// NewSeeder creates a new seeder
func NewSeeder(db *gorm.DB) *Seeder {
	return &Seeder{db: db}
}

// Run executes all seeders
func (s *Seeder) Run(ctx context.Context) error {
	if err := s.seedRoles(ctx); err != nil {
		return fmt.Errorf("seed roles: %w", err)
	}
	if err := s.seedAdmin(ctx); err != nil {
		return fmt.Errorf("seed admin: %w", err)
	}
	log.Println("Seed data applied successfully")
	return nil
}

func (s *Seeder) seedRoles(ctx context.Context) error {
	roles := []Role{
		{Name: "admin", Description: "System administrator"},
		{Name: "user", Description: "Regular user"},
		{Name: "editor", Description: "Content editor"},
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&roles).Error
}

func (s *Seeder) seedAdmin(ctx context.Context) error {
	admin := User{
		Username: "admin",
		Email:    "admin@example.com",
		Password: "$2a$10$...", // bcrypt hash
		Role:     "admin",
	}
	result := s.db.WithContext(ctx).Where("username = ?", "admin").FirstOrCreate(&admin)
	return result.Error
}
```

```go
// cmd/server/main.go - Production migration strategy
func main() {
	// Run migrations BEFORE app starts
	dsn := os.Getenv("DATABASE_URL")
	if err := data.RunMigrations(dsn); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	// Then start the app
	app := initApp()
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
```

---

## 四、执行预览

```bash
# Run migrations
$ go run cmd/server/main.go
Database migrated successfully

# Check migration status
$ migrate -database "mysql://user:pass@tcp(localhost:3306)/db" -path migrations version
2

# Rollback last migration
$ migrate -database "mysql://..." -path migrations down 1
Applied migration 000002_add_user_status

# Force version (emergency)
$ migrate -database "mysql://..." -path migrations force 1
```

---

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 迁移顺序 | 文件名前缀决定顺序，不要手动修改 |
| 幂等性 | SQL 使用 `IF NOT EXISTS`/`IF EXISTS` |
| 大表加列 | MySQL 支持 Online DDL，但需测试锁影响 |
| 备份 | 生产环境迁移前必须备份 |
| 嵌入迁移 | `//go:embed` 确保二进制包含迁移文件 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 生产环境用 AutoMigrate | 使用版本化迁移文件 |
| 迁移中写业务逻辑 | 迁移只管 Schema，不含业务 |
| 不写 down 文件 | 每个 up 必须有对应的 down |
| 修改已应用的迁移文件 | 创建新迁移文件修正 |
| 迁移文件名有空格 | 使用下划线：`000001_create_users.up.sql` |
| 不测试回滚 | CI 中测试 migrate up + down |

---

## 七、练习题

🟢 **初级：** 使用 GORM AutoMigrate 创建 3 个表的模型并自动建表。

🟡 **中级：** 使用 golang-migrate 创建迁移文件，支持 `//go:embed` 嵌入。

🔴 **高级：** 实现 CI/CD 中的自动迁移流程，含预检（dry-run）和自动回滚。

---

## 八、知识点总结

```
数据库迁移
├── 方案选择
│   ├── AutoMigrate (开发)
│   ├── golang-migrate (生产)
│   └── Atlas (高级)
├── 迁移管理
│   ├── UP/DOWN 文件对
│   ├── 版本号顺序
│   └── 嵌入二进制
├── 种子数据
│   ├── OnConflict 去重
│   └── FirstOrCreate 幂等
└── 生产策略
    ├── 备份先行
    ├── 灰度执行
    └── 紧急回滚
```

---

## 九、举一反三

| 场景 | 方案 |
|------|------|
| 多数据库 | 每个服务独立迁移，不跨库 |
| 分库分表 | 迁移脚本遍历所有分片执行 |
| 数据迁移 | Schema迁移 + 数据转换脚本分开 |
| CI 集成 | migrate up → 测试 → migrate down |
| 多环境 | dev/staging/prod 使用同一套迁移文件 |

---

## 十、参考资料

- [golang-migrate 官方文档](https://github.com/golang-migrate/migrate)
- [GORM AutoMigrate](https://gorm.io/docs/migration.html)
- [Database Refactoring](https://databaserefactoring.com/)

---

## 十一、代码演进

| 版本 | 变化 |
|------|------|
| v1 | GORM AutoMigrate，适合开发阶段快速迭代 |
| v2 | golang-migrate 版本化迁移，UP/DOWN 文件，embed 嵌入 |
| v3 | 种子数据 + 生产部署策略 + 回滚方案 |
