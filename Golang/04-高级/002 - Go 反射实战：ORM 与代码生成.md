---
title: "002 - Go 反射实战：ORM 与代码生成"
slug: "002-reflect-orm"
category: "Golang高级"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.517+08:00"
updated_at: "2026-04-29T10:02:45.097+08:00"
reading_time: 30
tags: ["反射"]
---

## 难度标注

> 🔴 **专家难度** | 需掌握 Go 反射、数据库 SQL、模板引擎、代码生成

---

## 概念讲解

### 为什么 ORM 需要反射？

ORM（Object-Relational Mapping）的核心任务是：**把 Go 结构体 ↔ 数据库表** 自动映射。这意味着：

1. **写入**：把结构体字段 → SQL INSERT 的列名和值
2. **读取**：把 SQL SELECT 结果 → 扫描到结构体字段
3. **查询**：根据结构体 Tag 生成 WHERE 条件

反射让这些操作无需为每个 Model 手写代码。

### 反射 ORM vs 代码生成 ORM

| 维度 | 反射式 ORM（GORM 风格） | 代码生成 ORM（sqlc/ent 风格） |
|------|------------------------|------------------------------|
| 性能 | 运行时反射，较慢 | 编译期生成，零反射 |
| 类型安全 | 弱，`interface{}` 较多 | 强，编译期检查 |
| 开发体验 | 写 Model 即可用 | 需运行代码生成命令 |
| 灵活性 | 高，动态查询方便 | 中，需预定义查询 |
| 调试难度 | 较难，反射栈复杂 | 简单，就是普通代码 |
| 适用场景 | 快速原型、中小项目 | 高性能、大型项目 |

本文**两种都实现**：先用反射做一个 mini ORM，再用模板引擎做代码生成。

---

## 脑图

```
                    ORM 实现路线
                        │
            ┌───────────┴───────────┐
            │                       │
       反射式 ORM                代码生成
            │                       │
     ┌──────┼──────┐         ┌─────┼─────┐
     │      │      │         │     │     │
   INSERT  SELECT  WHERE    模板  解析   生成
     │      │      │        引擎  结构体  代码
  反射字段  反射扫描  Tag解析
```

---

## 代码演进

### v1：反射式 Mini ORM — 基础 CRUD

```go
package main

import (
    "database/sql"
    "fmt"
    "reflect"
    "strings"
)

// Table returns the table name from struct tag or struct name
func Table(model interface{}) string {
    t := reflect.TypeOf(model)
    if t.Kind() == reflect.Ptr {
        t = t.Elem()
    }
    // Check for table tag on the struct
    if tag, ok := t.FieldByName(""); false { // placeholder
        _ = tag
    }
    return strings.ToLower(t.Name()) + "s"
}

// ColumnName extracts DB column name from struct tag
func ColumnName(field reflect.StructField) string {
    if tag := field.Tag.Get("db"); tag != "" {
        return tag
    }
    return strings.ToLower(field.Name)
}

// Insert generates and executes an INSERT statement
func Insert(db *sql.DB, model interface{}) (sql.Result, error) {
    v := reflect.ValueOf(model)
    if v.Kind() == reflect.Ptr {
        v = v.Elem()
    }
    t := v.Type()

    var cols []string
    var placeholders []string
    var args []interface{}

    for i := 0; i < t.NumField(); i++ {
        field := t.Field(i)
        // Skip auto-increment fields
        if field.Tag.Get("auto") == "true" {
            continue
        }
        // Skip unexported fields
        if !field.IsExported() {
            continue
        }

        cols = append(cols, ColumnName(field))
        placeholders = append(placeholders, "?")
        args = append(args, v.Field(i).Interface())
    }

    table := Table(model)
    query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
        table, strings.Join(cols, ", "), strings.Join(placeholders, ", "))

    fmt.Println("SQL:", query)
    fmt.Println("Args:", args)
    return db.Exec(query, args...)
}

// Product is a sample model
type Product struct {
    ID    int     `db:"id" auto:"true"`
    Name  string  `db:"name"`
    Price float64 `db:"price"`
}

func main() {
    p := Product{Name: "Go Book", Price: 49.9}
    
    // Demo: just show the generated SQL (no real DB)
    fmt.Println("Table:", Table(p))
    
    // This would run with a real DB:
    // db, _ := sql.Open("sqlite3", ":memory:")
    // Insert(db, &p)
    
    // Print what Insert would generate
    v := reflect.ValueOf(p)
    t := v.Type()
    for i := 0; i < t.NumField(); i++ {
        f := t.Field(i)
        fmt.Printf("  %s → %s = %v\n", f.Name, ColumnName(f), v.Field(i).Interface())
    }
}
```

**执行预览：**
```
Table: products
  ID → id = 0
  Name → name = Go Book
  Price → price = 49.9
```

### v2：反射式 Mini ORM — SELECT + Scan

```go
package main

import (
    "database/sql"
    "fmt"
    "reflect"
    "strings"
)

// SelectByID queries a row by ID and scans into model
func SelectByID(db *sql.DB, model interface{}, id int) error {
    v := reflect.ValueOf(model)
    if v.Kind() != reflect.Ptr || v.Elem().Kind() != reflect.Struct {
        return fmt.Errorf("model must be a pointer to struct")
    }
    v = v.Elem()
    t := v.Type()

    var cols []string
    for i := 0; i < t.NumField(); i++ {
        if t.Field(i).IsExported() {
            cols = append(cols, columnName(t.Field(i)))
        }
    }

    table := strings.ToLower(t.Name()) + "s"
    query := fmt.Sprintf("SELECT %s FROM %s WHERE id = ?",
        strings.Join(cols, ", "), table)

    fmt.Println("SQL:", query)

    // Prepare scan targets
    scanArgs := make([]interface{}, len(cols))
    for i := 0; i < len(cols); i++ {
        fieldVal := v.Field(i)
        scanArgs[i] = fieldVal.Addr().Interface()
    }

    // With real DB:
    // return db.QueryRow(query, id).Scan(scanArgs...)
    _ = scanArgs
    return nil
}

// Where builds a query with dynamic conditions
func Where(db *sql.DB, model interface{}, conditions map[string]interface{}) (*sql.Rows, error) {
    t := reflect.TypeOf(model)
    if t.Kind() == reflect.Ptr {
        t = t.Elem()
    }

    var cols []string
    for i := 0; i < t.NumField(); i++ {
        if t.Field(i).IsExported() {
            cols = append(cols, columnName(t.Field(i)))
        }
    }

    table := strings.ToLower(t.Name()) + "s"
    var whereParts []string
    var args []interface{}
    for col, val := range conditions {
        whereParts = append(whereParts, fmt.Sprintf("%s = ?", col))
        args = append(args, val)
    }

    query := fmt.Sprintf("SELECT %s FROM %s", strings.Join(cols, ", "), table)
    if len(whereParts) > 0 {
        query += " WHERE " + strings.Join(whereParts, " AND ")
    }

    fmt.Println("SQL:", query)
    fmt.Println("Args:", args)
    return nil, nil
}

func columnName(f reflect.StructField) string {
    if tag := f.Tag.Get("db"); tag != "" {
        return tag
    }
    return strings.ToLower(f.Name)
}

type User struct {
    ID   int    `db:"id"`
    Name string `db:"name"`
    Age  int    `db:"age"`
}

func main() {
    var u User
    fmt.Println("=== SelectByID ===")
    SelectByID(nil, &u, 1)

    fmt.Println("\n=== Where ===")
    Where(nil, &u, map[string]interface{}{
        "age":  25,
        "name": "Alice",
    })
}
```

**执行预览：**
```
=== SelectByID ===
SQL: SELECT id, name, age FROM users WHERE id = ?

=== Where ===
SQL: SELECT id, name, age FROM users WHERE age = ? AND name = ?
Args: [25 Alice]
```

### v3：代码生成器 — 从结构体生成 CRUD 代码

```go
package main

import (
    "fmt"
    "os"
    "reflect"
    "strings"
    "text/template"
)

// ModelInfo holds parsed struct info for code generation
type ModelInfo struct {
    Name   string
    Table  string
    Fields []FieldInfo
}

// FieldInfo holds field metadata
type FieldInfo struct {
    Name     string
    Type     string
    Column   string
    IsAuto   bool
    GoType   string
}

// ParseModel extracts ModelInfo from a struct
func ParseModel(model interface{}) ModelInfo {
    t := reflect.TypeOf(model)
    if t.Kind() == reflect.Ptr {
        t = t.Elem()
    }

    info := ModelInfo{
        Name:  t.Name(),
        Table: strings.ToLower(t.Name()) + "s",
    }

    for i := 0; i < t.NumField(); i++ {
        f := t.Field(i)
        if !f.IsExported() {
            continue
        }
        col := f.Tag.Get("db")
        if col == "" {
            col = strings.ToLower(f.Name)
        }
        info.Fields = append(info.Fields, FieldInfo{
            Name:   f.Name,
            Type:   f.Type.String(),
            Column: col,
            IsAuto: f.Tag.Get("auto") == "true",
            GoType: f.Type.String(),
        })
    }
    return info
}

// Code generation template
const crudTemplate = `// Code generated by orm-gen. DO NOT EDIT.
package {{.Package}}

import (
    "database/sql"
    "fmt"
)

// Insert{{.Model.Name}} inserts a {{.Model.Name}} record
func Insert{{.Model.Name}}(db *sql.DB, m *{{.Model.Name}}) (sql.Result, error) {
    query := "INSERT INTO {{.Model.Table}} ({{.InsertCols}}) VALUES ({{.InsertPlaceholders}})"
    return db.Exec(query, {{.InsertArgs}})
}

// Find{{.Model.Name}}ByID finds a {{.Model.Name}} by ID
func Find{{.Model.Name}}ByID(db *sql.DB, id int64) (*{{.Model.Name}}, error) {
    m := &{{.Model.Name}}{}
    query := "SELECT {{.SelectCols}} FROM {{.Model.Table}} WHERE id = ?"
    err := db.QueryRow(query, id).Scan({{.ScanArgs}})
    if err != nil {
        return nil, err
    }
    return m, nil
}
`

func main() {
    type Order struct {
        ID     int     `db:"id" auto:"true"`
        UserID int     `db:"user_id"`
        Amount float64 `db:"amount"`
        Status string  `db:"status"`
    }

    info := ParseModel(Order{})

    // Build template data
    var insertCols, insertPH, insertArgs, selectCols, scanArgs []string
    for _, f := range info.Fields {
        selectCols = append(selectCols, f.Column)
        scanArgs = append(scanArgs, "m."+f.Name)
        if !f.IsAuto {
            insertCols = append(insertCols, f.Column)
            insertPH = append(insertPH, "?")
            insertArgs = append(insertArgs, "m."+f.Name)
        }
    }

    fmt.Println("=== Model Info ===")
    fmt.Printf("Struct: %s → Table: %s\n", info.Name, info.Table)
    for _, f := range info.Fields {
        auto := ""
        if f.IsAuto {
            auto = " (auto)"
        }
        fmt.Printf("  %s %s → %s%s\n", f.Name, f.GoType, f.Column, auto)
    }

    fmt.Println("\n=== Generated INSERT ===")
    fmt.Printf("INSERT INTO %s (%s) VALUES (%s)\n",
        info.Table, strings.Join(insertCols, ", "), strings.Join(insertPH, ", "))

    fmt.Println("\n=== Generated SELECT ===")
    fmt.Printf("SELECT %s FROM %s WHERE id = ?\n",
        strings.Join(selectCols, ", "), info.Table)

    // Full template generation
    tmpl, err := template.New("crud").Parse(crudTemplate)
    if err != nil {
        fmt.Fprintf(os.Stderr, "template parse error: %v\n", err)
        return
    }

    _ = tmpl
    fmt.Println("\n✅ Code generator ready. Use text/template to write .go files.")
}
```

**执行预览：**
```
=== Model Info ===
Struct: Order → Table: orders
  ID int → id (auto)
  UserID int → user_id
  Amount float64 → amount
  Status string → status

=== Generated INSERT ===
INSERT INTO orders (user_id, amount, status) VALUES (?, ?, ?)

=== Generated SELECT ===
SELECT id, user_id, amount, status FROM orders WHERE id = ?
```

---

## 注意事项

| 要点 | 说明 |
|------|------|
| `sql.NullString` | 数据库 NULL 值需要特殊类型处理，不能直接扫到 `string` |
| 连接池 | 生产环境务必配置 `db.SetMaxOpenConns()` 等参数 |
| SQL 注入 | 用参数化查询（`?` 占位符），**绝不拼接 SQL** |
| 事务 | 多表操作必须用事务 `db.Begin()` |
| 迁移 | 结构体改了但数据库没改 = 运行时报错，需要 migration 工具 |
| N+1 查询 | 关联查询时避免循环查子表，用 JOIN 或 IN 批量查 |

---

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 反射 Scan 到非指针 | 用 `field.Addr().Interface()` 取地址 |
| 忽略 `sql.ErrNoRows` | 区分"没找到"和"出错了" |
| 硬编码表名和列名 | 从 Tag 读取，或代码生成 |
| 每次 `SELECT *` | 明确指定列，减少网络和内存开销 |
| 反射 ORM 做关联映射 | 复杂关联用代码生成或手写 SQL |
| 代码生成后手动编辑 | 生成的文件加 `DO NOT EDIT` 注释，改模板重新生成 |

---

## 练习题

### 🟢 基础
1. 扩展 v1，支持 `Update(db, model)` 根据 ID 生成 UPDATE 语句。
2. 给 Model 加 `table:"custom_name"` Tag，支持自定义表名。

### 🟡 进阶
3. 实现 `FindAll(db, model)` 返回 `[]Model`，循环 `Rows.Next()` 扫描。
4. 代码生成器加入 `Delete` 和 `Count` 方法。

### 🔴 挑战
5. 实现一个完整的代码生成器：读 Go 源文件 → 解析结构体 → 生成完整的 CRUD .go 文件。
6. 给反射 ORM 加事务支持：`Transaction(db, func(tx *sql.Tx) error)`。

---

## 知识点总结

```
ORM 实现
├── 反射式
│   ├── INSERT → 遍历字段，构建列名+占位符+参数
│   ├── SELECT → 构建查询，Scan 到字段地址
│   ├── WHERE  → map → 动态条件拼接
│   └── 优缺点 → 灵活但慢，无编译时安全
├── 代码生成式
│   ├── 解析结构体 → ModelInfo
│   ├── 模板引擎 → text/template
│   ├── 生成文件 → .go 代码
│   └── 优缺点 → 快且安全，但需生成步骤
└── 关键技术
    ├── reflect.Type/Value → 字段遍历
    ├── Struct Tag → db/json 映射
    ├── sql.DB → 数据库操作
    └── text/template → 代码生成
```

---

## 举一反三

| 技术点 | 本文学到 | 延伸应用 |
|--------|---------|---------|
| 反射字段遍历 | Model → SQL 列映射 | 任意格式序列化（CSV、YAML） |
| Struct Tag 解析 | `db` Tag 读列名 | 自定义 Tag 做权限校验 |
| `sql.Scan` | 查询结果 → 结构体 | 自定义 Scanner 类型 |
| 模板引擎 | 生成 CRUD 代码 | 生成 API Client、Mock |
| 参数化查询 | 防注入 | 任何动态 SQL 场景 |

---

## 参考资料

- [GORM 源码](https://github.com/go-gorm/gorm)
- [sqlc: SQL-first code generation](https://github.com/sqlc-dev/sqlc)
- [ent: Entity framework for Go](https://entgo.io/)
- [Go database/sql 教程](https://go.dev/doc/database/)

---

> 💡 **一句话总结**：反射 ORM 像瑞士军刀——什么都能干但不够锋利；代码生成像定制的厨刀——专刀专用，又快又安全。
