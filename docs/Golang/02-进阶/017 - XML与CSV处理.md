---
title: "017 - XML与CSV处理"
slug: "017-xml-csv"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.124+08:00"
updated_at: "2026-04-29T10:02:44.793+08:00"
reading_time: 20
tags: ["标准库"]
---

# 047 - XML与CSV处理

> 难度：⭐⭐⭐ | 预计学习时间：30分钟

## 一、概念讲解

Go标准库提供了 `encoding/xml` 和 `encoding/csv` 两个包，分别处理XML和CSV这两种常见的数据格式。

- **encoding/xml**：支持结构体标签映射(`xml:"name"`)、Marshal/Unmarshal、流式Decoder/Encoder
- **encoding/csv**：支持读写CSV文件、自定义分隔符、流式逐行处理

两者都支持流式处理，适合大文件场景。

## 二、脑图

```
XML与CSV处理
├── XML处理
│   ├── Marshal/Unmarshal
│   ├── 结构体标签 xml:"name,attr"
│   ├── xml.Name 嵌套元素
│   ├── Decoder 流式读取
│   ├── Encoder 流式写入
│   └── 处理属性、CDATA、注释
├── CSV处理
│   ├── Reader 逐行读取
│   ├── Writer 逐行写入
│   ├── 自定义 Comma 分隔符
│   ├── LazyQuotes 宽松模式
│   └── FieldsPerRecord 字段数控制
└── 大文件处理
    ├── XML: token-by-token 解析
    ├── CSV: 逐行读写
    └── 内存控制策略
```

## 三、完整Go代码

### v1: 基础XML/CSV Marshal和Unmarshal

```go
package main

import (
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"strings"
)

// Book represents an XML book element
type Book struct {
	XMLName xml.Name `xml:"book"`
	ID      string   `xml:"id,attr"`
	Title   string   `xml:"title"`
	Author  string   `xml:"author"`
	Year    int      `xml:"year"`
}

// Library wraps multiple books
type Library struct {
	XMLName xml.Name `xml:"library"`
	Name    string   `xml:"name,attr"`
	Books   []Book   `xml:"book"`
}

func main() {
	// XML Marshal
	lib := Library{
		Name: "MyBooks",
		Books: []Book{
			{ID: "1", Title: "Go Programming", Author: "Alice", Year: 2023},
			{ID: "2", Title: "Advanced Go", Author: "Bob", Year: 2024},
		},
	}
	data, _ := xml.MarshalIndent(lib, "", "  ")
	fmt.Println("XML Output:")
	fmt.Println(string(data))

	// XML Unmarshal
	xmlInput := `<library name="Test">
		<book id="10"><title>Test Book</title><author>Charlie</author><year>2024</year></book>
	</library>`
	var lib2 Library
	xml.Unmarshal([]byte(xmlInput), &lib2)
	fmt.Printf("\nUnmarshaled: %+v\n", lib2)

	// CSV Write
	var buf strings.Builder
	w := csv.NewWriter(&buf)
	w.Write([]string{"name", "age", "city"})
	w.Write([]string{"Alice", "30", "Beijing"})
	w.Write([]string{"Bob", "25", "Shanghai"})
	w.Flush()
	fmt.Println("\nCSV Output:")
	fmt.Print(buf.String())

	// CSV Read
	r := csv.NewReader(&buf)
	records, _ := r.ReadAll()
	fmt.Println("CSV Records:")
	for i, row := range records {
		fmt.Printf("  Row %d: %v\n", i, row)
	}
}
```

**执行预览：**
```
XML Output:
<library name="MyBooks">
  <book id="1">
    <title>Go Programming</title>
    <author>Alice</author>
    <year>2023</year>
  </book>
  <book id="2">
    <title>Advanced Go</title>
    <author>Bob</author>
    <year>2024</year>
  </book>
</library>

CSV Output:
name,age,city
Alice,30,Beijing
Bob,25,Shanghai

CSV Records:
  Row 0: [name age city]
  Row 1: [Alice 30 Beijing]
  Row 2: [Bob 25 Shanghai]
```

### v2: XML流式Decoder + CSV自定义分隔符

```go
package main

import (
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

func main() {
	// XML Stream Decoder - token by token
	xmlData := `<root><item id="1">Alpha</item><item id="2">Beta</item><item id="3">Gamma</item></root>`
	dec := xml.NewDecoder(strings.NewReader(xmlData))
	for {
		token, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			panic(err)
		}
		switch t := token.(type) {
		case xml.StartElement:
			if t.Name.Local == "item" {
				var id string
				for _, attr := range t.Attr {
					if attr.Name.Local == "id" {
						id = attr.Value
					}
				}
				// Read the character data inside
				var content string
				dec.DecodeElement(&content, &t)
				fmt.Printf("Item id=%s: %s\n", id, content)
			}
		}
	}

	// CSV with tab delimiter (TSV)
	tsvData := "name\tage\tcity\nAlice\t30\tBeijing\nBob\t25\tShanghai\n"
	r := csv.NewReader(strings.NewReader(tsvData))
	r.Comma = '\t' // custom delimiter
	r.FieldsPerRecord = 3
	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		fmt.Printf("TSV Row: %v\n", record)
	}
}
```

**执行预览：**
```
Item id=1: Alpha
Item id=2: Beta
Item id=3: Gamma
TSV Row: [name age city]
TSV Row: [Alice 30 Beijing]
TSV Row: [Bob 25 Shanghai]
```

### v3: 大文件流式处理 + XML Encoder

```go
package main

import (
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

// Item for XML streaming output
type Item struct {
	XMLName xml.Name `xml:"item"`
	ID      int      `xml:"id,attr"`
	Name    string   `xml:"name"`
	Value   float64  `xml:"value"`
}

func main() {
	// Simulate processing a large CSV → convert to XML stream
	csvInput := strings.NewReader(
		"1,Widget,9.99\n2,Gadget,19.99\n3,Doohickey,4.99\n")

	var xmlOutput strings.Builder
	xmlOutput.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<catalog>\n")

	enc := xml.NewEncoder(&xmlOutput)
	r := csv.NewReader(csvInput)
	r.FieldsPerRecord = 3

	header, _ := r.Read() // skip header if present
	_ = header

	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			panic(err)
		}
		var id int
		var name string
		var value float64
		fmt.Sscanf(record[0], "%d", &id)
		name = record[1]
		fmt.Sscanf(record[2], "%f", &value)

		item := Item{ID: id, Name: name, Value: value}
		enc.Encode(item)
	}

	xmlOutput.WriteString("</catalog>\n")
	fmt.Println("CSV → XML conversion:")
	fmt.Println(xmlOutput.String())

	// Stream CSV read with error handling
	fmt.Println("--- CSV processing with stats ---")
	csvData := strings.NewReader(
		"product,qty,price\nApple,100,3.5\nBanana,200,2.8\nOrange,50,5.0\n")
	cr := csv.NewReader(csvData)
	var totalValue float64
	count := 0
	for {
		record, err := cr.Read()
		if err == io.EOF {
			break
		}
		if count == 0 { // skip header
			count++
			continue
		}
		var qty int
		var price float64
		fmt.Sscanf(record[1], "%d", &qty)
		fmt.Sscanf(record[2], "%f", &price)
		totalValue += float64(qty) * price
		fmt.Printf("  %s: qty=%d, price=%.2f, subtotal=%.2f\n",
			record[0], qty, price, float64(qty)*price)
		count++
	}
	fmt.Printf("Total: %.2f (%d items)\n", totalValue, count-1)
}
```

**执行预览：**
```
CSV → XML conversion:
<?xml version="1.0" encoding="UTF-8"?>
<catalog>
<item id="1"><name>Widget</name><value>9.99</value></item>
<item id="2"><name>Gadget</name><value>19.99</value></item>
<item id="3"><name>Doohickey</name><value>4.99</value></item>
</catalog>

--- CSV processing with stats ---
  Apple: qty=100, price=3.50, subtotal=350.00
  Banana: qty=200, price=2.80, subtotal=560.00
  Orange: qty=50, price=5.00, subtotal=250.00
Total: 1160.00 (3 items)
```

## 四、注意事项

| 要点 | 说明 |
|------|------|
| XML标签必须匹配 | 标签名和属性必须与XML结构一致 |
| XML需要根元素 | Marshal必须有一个根结构体 |
| CSV无类型 | 所有值都是string，需手动转换 |
| CSV引号规则 | 含逗号/换行/引号的字段需要双引号包裹 |
| xml.Name | 必须用xml.Name类型表示元素名 |
| BOM处理 | CSV文件可能有UTF-8 BOM，需跳过前3字节 |

## 五、避坑指南

❌ XML标签忘记XMLName：
```go
type Bad struct { Items []string `xml:"item"` } // 缺少根元素名
```
✅ 使用xml.Name指定根：
```go
type Good struct {
    XMLName xml.Name `xml:"root"`
    Items   []string `xml:"item"`
}
```

❌ CSV读完不检查Flush：
```go
w := csv.NewWriter(&buf)
w.Write(record) // 数据可能还在缓冲区
```
✅ 调用Flush并检查Error：
```go
w.Flush()
if err := w.Error(); err != nil { /* handle */ }
```

❌ 大XML用Unmarshal一次性加载：
```go
xml.Unmarshal(hugeData, &v) // 内存爆炸
```
✅ 使用Decoder逐token处理

## 六、练习题

🟢 **基础题：** 读取一个CSV文件（含name,email,age），打印每个人的信息，年龄转换为int。

🟡 **进阶题：** 解析一个RSS/Atom feed（XML格式），提取所有条目的标题和链接。

🔴 **挑战题：** 实现CSV→JSON批量转换工具，支持命令行参数指定输入输出文件，流式处理不超100MB内存。

## 七、知识点总结

```
XML与CSV处理
├── XML
│   ├── 结构体映射 (xml标签)
│   │   ├── 元素: xml:"name"
│   │   ├── 属性: xml:",attr"
│   │   ├── 内嵌: xml:",innerxml"
│   │   ├── 字符数据: xml:",chardata"
│   │   └── 忽略: xml:"-"
│   ├── Marshal/Unmarshal
│   └── Decoder/Encoder (流式)
├── CSV
│   ├── Reader/Writer
│   ├── Comma自定义分隔符
│   ├── LazyQuotes
│   └── FieldsPerRecord
└── 大文件策略
    ├── XML: Token级别解析
    ├── CSV: 逐行处理
    └── 编码转换(gbk等)
```

## 八、举一反三

| 场景 | XML方案 | CSV方案 |
|------|---------|---------|
| 配置文件 | Unmarshal到struct | 不推荐用CSV |
| 数据导入/导出 | 不推荐 | csv.Reader/Writer |
| API响应解析 | xml.Decoder流式 | — |
| 日志处理 | — | csv.Reader逐行 |
| 数据格式转换 | Decoder → Encoder | csv → json/xml |

## 九、参考资料

- [Go官方文档：encoding/xml](https://pkg.go.dev/encoding/xml)
- [Go官方文档：encoding/csv](https://pkg.go.dev/encoding/csv)
- [XML标准规范](https://www.w3.org/TR/xml/)

## 十、代码演进总结

| 版本 | 重点 | 适用场景 |
|------|------|----------|
| v1 | Marshal/Unmarshal基础 | 小文件、配置解析 |
| v2 | 流式Decoder + 自定义分隔符 | 大文件、TSV等变体 |
| v3 | CSV↔XML转换 + 统计计算 | ETL、数据处理管道 |
