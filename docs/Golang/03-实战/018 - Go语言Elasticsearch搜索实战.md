---
title: "018 - Go语言Elasticsearch搜索实战"
slug: "018-cron"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.42+08:00"
updated_at: "2026-04-29T10:02:45.026+08:00"
reading_time: 68
tags: ["标准库"]
---

# Go语言Elasticsearch搜索实战

**难度：中高级** ⭐⭐⭐⭐

## 1. 概念讲解

### 什么是Elasticsearch？

Elasticsearch（简称ES）是一个基于Lucene的分布式搜索和分析引擎，专为海量数据的近实时搜索而设计。它以JSON文档方式存储数据，通过RESTful API进行操作，是目前最流行的全文搜索引擎。

### 为什么选择Elasticsearch？

传统数据库的 `LIKE '%keyword%'` 查询存在致命缺陷：

- **性能差**：无法利用索引，全表扫描
- **功能弱**：不支持相关性排序、分词、同义词
- **扩展难**：单机瓶颈，水平扩展困难

Elasticsearch的优势：

- **全文检索**：内置分词器，支持中英文分词
- **相关性排序**：TF-IDF / BM25 算法，结果更精准
- **近实时**：写入后约1秒即可搜索
- **分布式**：天然支持集群，PB级数据处理
- **聚合分析**：强大的统计聚合能力

### Go语言ES客户端

| 客户端库 | 特点 |
|---------|------|
| `elastic/go-elasticsearch` | 官方维护，v8支持ES 8.x |
| `olivere/elastic` | 社区流行，API更友好（仅支持到v7） |
| `bytespirit/goes` | 轻量级封装 |

本文使用官方 `github.com/elastic/go-elasticsearch/v8` 库。

## 2. 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                    Elasticsearch 搜索架构                         │
└──────────────────────────────────────────────────────────────────┘

  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐
  │  MySQL   │───▶│  数据同步器   │───▶│  Elasticsearch集群   │
  │ (业务DB) │    │ (Canal/双写)  │    │                      │
  └──────────┘    └──────────────┘    │  ┌───────┐┌───────┐  │
                                       │  │Node 1 ││Node 2 │  │
                                       │  │       ││       │  │
                                       │  │Index A││Index B│  │
                                       │  │ Shard ││ Shard │  │
                                       │  └───────┘└───────┘  │
                                       └──────────┬───────────┘
                                                  │
                                          ┌───────▼────────┐
                                          │  Go应用服务器    │
                                          │  - 索引管理      │
                                          │  - 文档CRUD     │
                                          │  - 全文搜索      │
                                          │  - 聚合分析      │
                                          └────────────────┘
```

```
索引(Index)结构：
┌─────────────────────────────────────────┐
│ Index: articles                          │
├─────────────────────────────────────────┤
│ Mapping:                                 │
│   title    → text (ik_max_word分词)      │
│   content  → text (ik_smart分词)         │
│   author   → keyword                     │
│   tags     → keyword (数组)              │
│   created  → date                        │
│   views    → integer                     │
├─────────────────────────────────────────┤
│ Document 1: { "title": "Go入门...", ... }│
│ Document 2: { "title": "Go进阶...", ... }│
│ Document 3: { "title": "Go实战...", ... }│
└─────────────────────────────────────────┘
```

## 3. 完整Go代码示例

### 3.1 连接与初始化

```go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
)

// ESClient wraps the Elasticsearch client
type ESClient struct {
	client *elasticsearch.Client
	ctx    context.Context
	index  string
}

// NewESClient creates a new Elasticsearch client
func NewESClient(addresses []string, index string) (*ESClient, error) {
	cfg := elasticsearch.Config{
		Addresses: addresses,
		// Username:  "elastic",
		// Password:  "changeme",
	}

	client, err := elasticsearch.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create ES client: %w", err)
	}

	// Test connection
	res, err := client.Info()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ES: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("ES info error: %s", res.String())
	}

	es := &ESClient{
		client: client,
		ctx:    context.Background(),
		index:  index,
	}

	log.Println("✅ Connected to Elasticsearch")
	return es, nil
}

// CreateIndex creates the index with custom mapping
func (es *ESClient) CreateIndex() error {
	mapping := `{
		"mappings": {
			"properties": {
				"title": {
					"type": "text",
					"analyzer": "standard",
					"fields": {
						"keyword": { "type": "keyword" },
						"search": {
							"type": "text",
							"analyzer": "standard"
						}
					}
				},
				"content": {
					"type": "text",
					"analyzer": "standard"
				},
				"author":    { "type": "keyword" },
				"category":  { "type": "keyword" },
				"tags":      { "type": "keyword" },
				"status":    { "type": "keyword" },
				"views":     { "type": "integer" },
				"likes":     { "type": "integer" },
				"score":     { "type": "float" },
				"published_at": { "type": "date", "format": "2006-01-02T15:04:05Z" },
				"created_at":   { "type": "date", "format": "2006-01-02T15:04:05Z" }
			}
		},
		"settings": {
			"number_of_shards": 1,
			"number_of_replicas": 0
		}
	}`

	// Delete existing index first (for demo purposes)
	es.client.Indices.Delete([]string{es.index})

	req := esapi.IndicesCreateRequest{
		Index: es.index,
		Body:  strings.NewReader(mapping),
	}

	res, err := req.Do(es.ctx, es.client)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("create index error: %s", res.String())
	}

	log.Printf("✅ Index '%s' created successfully", es.index)
	return nil
}
```

### 3.2 文档模型

```go
// Article represents a blog article document
type Article struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	Author      string    `json:"author"`
	Category    string    `json:"category"`
	Tags        []string  `json:"tags"`
	Status      string    `json:"status"`
	Views       int       `json:"views"`
	Likes       int       `json:"likes"`
	Score       float64   `json:"score"`
	PublishedAt time.Time `json:"published_at"`
	CreatedAt   time.Time `json:"created_at"`
}

// SearchResult represents a search response
type SearchResult struct {
	Total    int64      `json:"total"`
	Articles []Article  `json:"articles"`
	Took     int64      `json:"took"`
}

// AggregationResult represents aggregation response
type AggregationResult struct {
	Buckets []struct {
		Key   string `json:"key"`
		Count int64  `json:"doc_count"`
	} `json:"buckets"`
}
```

### 3.3 文档CRUD操作

```go
// IndexDocument indexes a single document
func (es *ESClient) IndexDocument(doc Article) error {
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	req := esapi.IndexRequest{
		Index:      es.index,
		DocumentID: doc.ID,
		Body:       bytes.NewReader(body),
		Refresh:    "true",
	}

	res, err := req.Do(es.ctx, es.client)
	if err != nil {
		return fmt.Errorf("index request failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("index error: %s", res.String())
	}

	log.Printf("✅ Indexed document: %s", doc.Title)
	return nil
}

// BulkIndex indexes multiple documents at once
func (es *ESClient) BulkIndex(docs []Article) error {
	var buf bytes.Buffer

	for _, doc := range docs {
		// Action line
		meta := fmt.Sprintf(`{"index":{"_index":"%s","_id":"%s"}}`, es.index, doc.ID)
		buf.WriteString(meta + "\n")

		// Document line
		data, err := json.Marshal(doc)
		if err != nil {
			return fmt.Errorf("marshal error: %w", err)
		}
		buf.WriteString(string(data) + "\n")
	}

	req := esapi.BulkRequest{
		Body:    &buf,
		Refresh: "true",
	}

	res, err := req.Do(es.ctx, es.client)
	if err != nil {
		return fmt.Errorf("bulk request failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("bulk error: %s", res.String())
	}

	log.Printf("✅ Bulk indexed %d documents", len(docs))
	return nil
}

// GetDocument retrieves a document by ID
func (es *ESClient) GetDocument(id string) (*Article, error) {
	req := esapi.GetRequest{
		Index:      es.index,
		DocumentID: id,
	}

	res, err := req.Do(es.ctx, es.client)
	if err != nil {
		return nil, fmt.Errorf("get request failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("document not found: %s", id)
	}

	var result struct {
		Source Article `json:"_source"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	return &result.Source, nil
}

// DeleteDocument removes a document by ID
func (es *ESClient) DeleteDocument(id string) error {
	req := esapi.DeleteRequest{
		Index:      es.index,
		DocumentID: id,
		Refresh:    "true",
	}

	res, err := req.Do(es.ctx, es.client)
	if err != nil {
		return fmt.Errorf("delete request failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("delete error: %s", res.String())
	}

	log.Printf("✅ Deleted document: %s", id)
	return nil
}

// UpdateDocument partially updates a document
func (es *ESClient) UpdateDocument(id string, fields map[string]interface{}) error {
	doc := map[string]interface{}{"doc": fields}
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	req := esapi.UpdateRequest{
		Index:      es.index,
		DocumentID: id,
		Body:       bytes.NewReader(body),
		Refresh:    "true",
	}

	res, err := req.Do(es.ctx, es.client)
	if err != nil {
		return fmt.Errorf("update request failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("update error: %s", res.String())
	}

	log.Printf("✅ Updated document: %s", id)
	return nil
}
```

### 3.4 搜索功能实现

```go
// FullTextSearch performs a full-text search with highlighting
func (es *ESClient) FullTextSearch(query string, from, size int) (*SearchResult, error) {
	searchQuery := fmt.Sprintf(`{
		"query": {
			"multi_match": {
				"query": "%s",
				"fields": ["title^3", "content^1", "tags^2"],
				"type": "best_fields",
				"fuzziness": "AUTO"
			}
		},
		"highlight": {
			"pre_tags": ["**"],
			"post_tags": ["**"],
			"fields": {
				"title": {},
				"content": {
					"fragment_size": 150,
					"number_of_fragments": 3
				}
			}
		},
		"sort": [
			"_score",
			{ "views": { "order": "desc" } }
		],
		"from": %d,
		"size": %d
	}`, query, from, size)

	res, err := es.client.Search(
		es.client.Search.WithContext(es.ctx),
		es.client.Search.WithIndex(es.index),
		es.client.Search.WithBody(strings.NewReader(searchQuery)),
		es.client.Search.WithTrackTotalHits(true),
	)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("search error: %s", res.String())
	}

	var result struct {
		Hits struct {
			Total struct {
				Value int64 `json:"value"`
			} `json:"total"`
			Hits []struct {
				Source     Article  `json:"_source"`
				Highlight map[string][]string `json:"highlight"`
			} `json:"hits"`
		} `json:"hits"`
		Took int64 `json:"took"`
	}

	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	articles := make([]Article, 0, len(result.Hits.Hits))
	for _, hit := range result.Hits.Hits {
		articles = append(articles, hit.Source)
	}

	return &SearchResult{
		Total:    result.Hits.Total.Value,
		Articles: articles,
		Took:     result.Took,
	}, nil
}

// BoolSearch performs a boolean compound search
func (es *ESClient) BoolSearch(filters map[string]interface{}, must string) (*SearchResult, error) {
	filterClauses := []string{}

	if author, ok := filters["author"]; ok {
		filterClauses = append(filterClauses, fmt.Sprintf(
			`{"term":{"author":"%s"}}`, author))
	}
	if category, ok := filters["category"]; ok {
		filterClauses = append(filterClauses, fmt.Sprintf(
			`{"term":{"category":"%s"}}`, category))
	}
	if tags, ok := filters["tags"]; ok {
		tagList := tags.([]string)
		for _, tag := range tagList {
			filterClauses = append(filterClauses, fmt.Sprintf(
				`{"term":{"tags":"%s"}}`, tag))
		}
	}
	if status, ok := filters["status"]; ok {
		filterClauses = append(filterClauses, fmt.Sprintf(
			`{"term":{"status":"%s"}}`, status))
	}

	mustClause := ""
	if must != "" {
		mustClause = fmt.Sprintf(`{
			"multi_match": {
				"query": "%s",
				"fields": ["title^2", "content"]
			}
		}`, must)
	}

	filterStr := strings.Join(filterClauses, ",")
	query := fmt.Sprintf(`{
		"query": {
			"bool": {
				"must": [%s],
				"filter": [%s]
			}
		},
		"sort": [{ "published_at": { "order": "desc" } }],
		"size": 20
	}`, mustClause, filterStr)

	res, err := es.client.Search(
		es.client.Search.WithContext(es.ctx),
		es.client.Search.WithIndex(es.index),
		es.client.Search.WithBody(strings.NewReader(query)),
	)
	if err != nil {
		return nil, fmt.Errorf("bool search failed: %w", err)
	}
	defer res.Body.Close()

	var result struct {
		Hits struct {
			Total struct {
				Value int64 `json:"value"`
			} `json:"total"`
			Hits []struct {
				Source Article `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	json.NewDecoder(res.Body).Decode(&result)

	articles := make([]Article, 0)
	for _, hit := range result.Hits.Hits {
		articles = append(articles, hit.Source)
	}

	return &SearchResult{
		Total:    result.Hits.Total.Value,
		Articles: articles,
	}, nil
}

// SuggestSearch implements search-as-you-type with prefix matching
func (es *ESClient) SuggestSearch(prefix string) ([]string, error) {
	query := fmt.Sprintf(`{
		"query": {
			"match_phrase_prefix": {
				"title": "%s"
			}
		},
		"_source": ["title"],
		"size": 10
	}`, prefix)

	res, err := es.client.Search(
		es.client.Search.WithContext(es.ctx),
		es.client.Search.WithIndex(es.index),
		es.client.Search.WithBody(strings.NewReader(query)),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var result struct {
		Hits struct {
			Hits []struct {
				Source Article `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	json.NewDecoder(res.Body).Decode(&result)

	titles := make([]string, 0)
	for _, hit := range result.Hits.Hits {
		titles = append(titles, hit.Source.Title)
	}

	return titles, nil
}
```

### 3.5 聚合分析

```go
// AggregateByCategory counts documents per category
func (es *ESClient) AggregateByCategory() (*AggregationResult, error) {
	query := `{
		"size": 0,
		"aggs": {
			"categories": {
				"terms": { "field": "category", "size": 20 }
			}
		}
	}`

	res, err := es.client.Search(
		es.client.Search.WithContext(es.ctx),
		es.client.Search.WithIndex(es.index),
		es.client.Search.WithBody(strings.NewReader(query)),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var result struct {
		Aggregations struct {
			Categories AggregationResult `json:"categories"`
		} `json:"aggregations"`
	}
	json.NewDecoder(res.Body).Decode(&result)

	return &result.Aggregations.Categories, nil
}

// StatsAggregation calculates stats on numeric fields
func (es *ESClient) StatsAggregation(field string) (map[string]float64, error) {
	query := fmt.Sprintf(`{
		"size": 0,
		"aggs": {
			"stats": { "stats": { "field": "%s" } }
		}
	}`, field)

	res, err := es.client.Search(
		es.client.Search.WithContext(es.ctx),
		es.client.Search.WithIndex(es.index),
		es.client.Search.WithBody(strings.NewReader(query)),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var result struct {
		Aggregations struct {
			Stats map[string]float64 `json:"stats"`
		} `json:"aggregations"`
	}
	json.NewDecoder(res.Body).Decode(&result)

	return result.Aggregations.Stats, nil
}

// DateHistogram creates a time-based histogram of publications
func (es *ESClient) DateHistogram(interval string) (*AggregationResult, error) {
	query := fmt.Sprintf(`{
		"size": 0,
		"aggs": {
			"timeline": {
				"date_histogram": {
					"field": "published_at",
					"calendar_interval": "%s"
				}
			}
		}
	}`, interval)

	res, err := es.client.Search(
		es.client.Search.WithContext(es.ctx),
		es.client.Search.WithIndex(es.index),
		es.client.Search.WithBody(strings.NewReader(query)),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var result struct {
		Aggregations struct {
			Timeline AggregationResult `json:"timeline"`
		} `json:"aggregations"`
	}
	json.NewDecoder(res.Body).Decode(&result)

	return &result.Aggregations.Timeline, nil
}
```

### 3.6 完整示例

```go
func main() {
	es, err := NewESClient([]string{"http://localhost:9200"}, "articles")
	if err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}

	// Create index
	if err := es.CreateIndex(); err != nil {
		log.Fatalf("❌ Failed to create index: %v", err)
	}

	// Prepare sample data
	now := time.Now()
	articles := []Article{
		{ID: "1", Title: "Go语言入门教程", Content: "Go语言是一门开源的编程语言，由Google开发。它具有简洁、高效、并发支持好等特点，适合构建高并发的网络服务。", Author: "张三", Category: "tutorial", Tags: []string{"go", "beginner", "programming"}, Status: "published", Views: 1500, Likes: 120, Score: 4.8, PublishedAt: now.Add(-72 * time.Hour), CreatedAt: now.Add(-96 * time.Hour)},
		{ID: "2", Title: "Go并发编程实战", Content: "Goroutine和Channel是Go语言并发编程的核心。Goroutine是轻量级线程，Channel用于goroutine之间的通信。通过select语句可以实现多路复用。", Author: "李四", Category: "advanced", Tags: []string{"go", "concurrency", "goroutine"}, Status: "published", Views: 2300, Likes: 200, Score: 4.9, PublishedAt: now.Add(-48 * time.Hour), CreatedAt: now.Add(-60 * time.Hour)},
		{ID: "3", Title: "Go微服务架构设计", Content: "微服务架构将大型应用拆分为多个小型服务。Go语言因其高性能和低资源消耗，非常适合构建微服务。常用的微服务框架有gRPC、Go-Kit等。", Author: "王五", Category: "architecture", Tags: []string{"go", "microservice", "grpc"}, Status: "published", Views: 1800, Likes: 150, Score: 4.7, PublishedAt: now.Add(-24 * time.Hour), CreatedAt: now.Add(-36 * time.Hour)},
		{ID: "4", Title: "Go语言Web开发指南", Content: "Go语言标准库提供了强大的HTTP包，可以快速构建Web应用。结合Gin、Echo等框架，可以更高效地开发RESTful API。", Author: "张三", Category: "tutorial", Tags: []string{"go", "web", "gin"}, Status: "published", Views: 3200, Likes: 280, Score: 4.6, PublishedAt: now.Add(-12 * time.Hour), CreatedAt: now.Add(-18 * time.Hour)},
		{ID: "5", Title: "Go测试最佳实践", Content: "Go语言内置了testing包，支持单元测试、基准测试和示例测试。配合testify等库，可以编写更优雅的测试代码。", Author: "赵六", Category: "testing", Tags: []string{"go", "testing", "best-practice"}, Status: "draft", Views: 500, Likes: 30, Score: 4.5, PublishedAt: now, CreatedAt: now.Add(-6 * time.Hour)},
	}

	fmt.Println("\n========== 1. 批量索引文档 ==========")
	if err := es.BulkIndex(articles); err != nil {
		log.Fatalf("❌ Bulk index failed: %v", err)
	}

	fmt.Println("\n========== 2. 全文搜索 ==========")
	result, err := es.FullTextSearch("Go语言 并发", 0, 5)
	if err != nil {
		log.Printf("❌ Search failed: %v", err)
	} else {
		fmt.Printf("Found %d results in %dms:\n", result.Total, result.Took)
		for _, a := range result.Articles {
			fmt.Printf("  - %s (views: %d)\n", a.Title, a.Views)
		}
	}

	fmt.Println("\n========== 3. 布尔组合搜索 ==========")
	boolResult, err := es.BoolSearch(map[string]interface{}{
		"author":  "张三",
		"status":  "published",
	}, "Web")
	if err != nil {
		log.Printf("❌ Bool search failed: %v", err)
	} else {
		fmt.Printf("Found %d results:\n", boolResult.Total)
		for _, a := range boolResult.Articles {
			fmt.Printf("  - %s by %s\n", a.Title, a.Author)
		}
	}

	fmt.Println("\n========== 4. 搜索建议 ==========")
	suggestions, err := es.SuggestSearch("Go")
	if err != nil {
		log.Printf("❌ Suggest failed: %v", err)
	} else {
		fmt.Println("Suggestions:")
		for _, s := range suggestions {
			fmt.Printf("  - %s\n", s)
		}
	}

	fmt.Println("\n========== 5. 单文档操作 ==========")
	doc, err := es.GetDocument("1")
	if err != nil {
		log.Printf("❌ Get failed: %v", err)
	} else {
		fmt.Printf("Got: %s by %s\n", doc.Title, doc.Author)
	}

	// Update
	if err := es.UpdateDocument("1", map[string]interface{}{"views": 2000}); err != nil {
		log.Printf("❌ Update failed: %v", err)
	} else {
		doc, _ = es.GetDocument("1")
		fmt.Printf("Updated views: %d\n", doc.Views)
	}

	fmt.Println("\n========== 6. 聚合分析 ==========")
	agg, err := es.AggregateByCategory()
	if err != nil {
		log.Printf("❌ Aggregation failed: %v", err)
	} else {
		fmt.Println("Categories:")
		for _, b := range agg.Buckets {
			fmt.Printf("  - %s: %d articles\n", b.Key, b.Count)
		}
	}

	stats, err := es.StatsAggregation("views")
	if err != nil {
		log.Printf("❌ Stats failed: %v", err)
	} else {
		fmt.Printf("Views stats: avg=%.0f, max=%.0f, min=%.0f, total=%.0f\n",
			stats["avg"], stats["max"], stats["min"], stats["sum"])
	}

	fmt.Println("\n========== 7. 删除文档 ==========")
	if err := es.DeleteDocument("5"); err != nil {
		log.Printf("❌ Delete failed: %v", err)
	}

	fmt.Println("\n✅ All operations completed!")
}
```

## 4. 执行预览

```
✅ Connected to Elasticsearch
✅ Index 'articles' created successfully

========== 1. 批量索引文档 ==========
✅ Bulk indexed 5 documents

========== 2. 全文搜索 ==========
Found 4 results in 12ms:
  - Go并发编程实战 (views: 2300)
  - Go语言入门教程 (views: 1500)
  - Go微服务架构设计 (views: 1800)
  - Go语言Web开发指南 (views: 3200)

========== 3. 布尔组合搜索 ==========
Found 1 results:
  - Go语言Web开发指南 by 张三

========== 4. 搜索建议 ==========
Suggestions:
  - Go语言入门教程
  - Go并发编程实战
  - Go微服务架构设计
  - Go语言Web开发指南

========== 5. 单文档操作 ==========
Got: Go语言入门教程 by 张三
Updated views: 2000

========== 6. 聚合分析 ==========
Categories:
  - tutorial: 2 articles
  - advanced: 1 articles
  - architecture: 1 articles
  - testing: 1 articles
Views stats: avg=1860, max=3200, min=500, total=9300

========== 7. 删除文档 ==========
✅ Deleted document: 5

✅ All operations completed!
```

## 5. 注意事项

| 注意事项 | 说明 | 解决方案 |
|---------|------|---------|
| **Mapping不可变** | 字段类型一旦创建不可修改 | 使用Reindex API重建索引 |
| **深分页问题** | `from+size > 10000` 时性能差 | 使用 `search_after` 或 Scroll API |
| **文本分词** | 中文需安装IK分词插件 | 安装 `analysis-ik` 插件，使用 `ik_max_word` |
| **写入延迟** | 默认1秒refresh间隔 | 批量写入时关闭refresh，完成后手动刷新 |
| **字段爆炸** | 动态映射可能导致字段过多 | 设置 `dynamic: strict` 或 `dynamic: false` |
| **堆内存** | 聚合和排序消耗大量堆内存 | 控制聚合桶数量，使用 `doc_values` |
| **集群脑裂** | 网络分区导致多主节点 | ES 7.x+已自动处理，设置最少主节点数 |

## 6. 避坑指南

### ❌ 错误做法

```go
// ❌ 每次查询创建新连接
func badSearch(query string) {
    es, _ := elasticsearch.NewClient(...)  // 每次新建
    es.Search(...)
}

// ❌ 使用 from/size 做深分页
func badDeepPagination(es *ESClient) {
    // 当 from=100000, size=10 时，ES需要在每个分片上排序100010条数据
    query := `{"from": 100000, "size": 10, "query": {"match_all": {}}}`
}

// ❌ 不处理连接错误和超时
func badNoTimeout(es *ESClient) {
    ctx := context.Background()  // 无超时
    res, _ := es.client.Search(
        es.client.Search.WithContext(ctx),
    )
    // 忽略错误
    defer res.Body.Close()  // 可能 res 为 nil
}

// ❌ 在循环中逐条索引
func badLoopIndex(es *ESClient, docs []Article) {
    for _, doc := range docs {
        es.IndexDocument(doc)  // 每次一条HTTP请求
    }
}
```

### ✅ 正确做法

```go
// ✅ 全局复用ES客户端（线程安全）
var globalES *elasticsearch.Client

func init() {
    globalES, _ = elasticsearch.NewClient(elasticsearch.Config{
        Addresses: []string{"http://localhost:9200"},
    })
}

// ✅ 使用 search_after 做深分页
func goodDeepPagination(es *ESClient, afterKey map[string]interface{}) {
    query := `{
        "size": 100,
        "query": {"match_all": {}},
        "sort": [{"published_at": "desc"}, "_id"]
    }`
    // 每次返回最后一条的sort值作为下次的search_after
}

// ✅ 设置合理的超时
func goodSearchWithTimeout(es *ESClient) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    res, err := es.client.Search(
        es.client.Search.WithContext(ctx),
        es.client.Search.WithIndex(es.index),
    )
    if err != nil {
        log.Printf("search timeout or error: %v", err)
        return
    }
    defer res.Body.Close()

    if res.IsError() {
        log.Printf("search error: %s", res.String())
        return
    }
}

// ✅ 批量索引
func goodBulkIndex(es *ESClient, docs []Article) {
    // Batch size 500-1000 is optimal
    batchSize := 500
    for i := 0; i < len(docs); i += batchSize {
        end := i + batchSize
        if end > len(docs) {
            end = len(docs)
        }
        es.BulkIndex(docs[i:end])
    }
}
```

## 7. 练习题

### 🟢 基础练习

1. 创建一个产品索引，支持按名称、描述全文搜索
2. 实现文档的增删改查操作，包含错误处理
3. 实现一个简单的分页搜索接口

### 🟡 进阶练习

1. 实现一个多字段加权搜索（标题权重3，内容权重1，标签权重2）
2. 实现嵌套聚合：先按分类聚合，再统计每个分类的平均阅读量
3. 实现一个搜索建议功能（基于前缀匹配+热度排序）

### 🔴 挑战练习

1. 实现一个完整的搜索服务：支持拼音搜索、同义词扩展、搜索纠错
2. 实现MySQL到ES的数据实时同步（基于Canal或双写方案）
3. 实现一个搜索日志分析系统，统计热门搜索词和零结果率

## 8. 知识点总结

```
Go语言Elasticsearch搜索实战
├── 基础概念
│   ├── 索引(Index)与文档(Document)
│   ├── 映射(Mapping)与字段类型
│   ├── 分片(Shard)与副本(Replica)
│   └── 分析器(Analyzer)与分词
├── 文档操作
│   ├── 索引文档(Index)
│   ├── 批量索引(Bulk)
│   ├── 获取文档(Get)
│   ├── 更新文档(Update)
│   └── 删除文档(Delete)
├── 搜索功能
│   ├── 全文搜索(Multi-match)
│   ├── 布尔组合(Bool Query)
│   ├── 前缀建议(Suggest)
│   ├── 高亮显示(Highlight)
│   └── 排序与分页
├── 聚合分析
│   ├── 词条聚合(Terms)
│   ├── 统计聚合(Stats)
│   ├── 日期直方图(Date Histogram)
│   └── 嵌套聚合
├── 性能优化
│   ├── 批量操作
│   ├── search_after深分页
│   ├── 合理设置Mapping
│   └── 索引生命周期管理
└── 最佳实践
    ├── 连接池复用
    ├── 超时控制
    ├── 错误处理
    └── 数据同步策略
```

## 9. 举一反三

| 场景 | 搜索方案 | 关键配置 |
|-----|---------|---------|
| 电商商品搜索 | multi_match + bool filter | title^3, category filter, price range |
| 日志分析 | date_histogram + terms | 按时间分桶，按级别聚合 |
| 文章搜索 | multi_match + highlight | title^2, content, 高亮显示 |
| 用户搜索 | wildcard + fuzzy | 支持模糊匹配用户名 |
| 自动补全 | match_phrase_prefix | 前缀匹配 + 热度排序 |
| 地理搜索 | geo_distance + sort | 按距离排序 |
| 多语言搜索 | 多字段 + 不同分析器 | ik_max_word(中文) + standard(英文) |

## 10. 参考资料

- [Elasticsearch官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [go-elasticsearch GitHub](https://github.com/elastic/go-elasticsearch)
- [Elasticsearch权威指南](https://www.elastic.co/guide/cn/elasticsearch/guide/current/index.html)
- [IK Analysis插件](https://github.com/medcl/elasticsearch-analysis-ik)

## 11. 代码演进

### v1: 基础索引与搜索

```go
// Simple index and search
func indexDoc(id, body string) {
    req := esapi.IndexRequest{
        Index:      "articles",
        DocumentID: id,
        Body:       strings.NewReader(body),
    }
    req.Do(ctx, client)
}

func search(query string) {
    client.Search(
        client.Search.WithIndex("articles"),
        client.Search.WithBody(strings.NewReader(
            `{"query":{"match":{"title":"` + query + `"}}}`,
        )),
    )
}
```

### v2: 结构化搜索与聚合

```go
// Structured search with bool query + aggregations
func structuredSearch(query Query) (*SearchResult, error) {
    esq := buildBoolQuery(query.Filters, query.Must)
    agg := buildAggregation(query.GroupBy)

    body := map[string]interface{}{
        "query": esq,
        "aggs":  agg,
        "from":  query.From,
        "size":  query.Size,
    }
    // Execute and parse response
}
```

### v3: 生产级搜索服务

```go
// Production search service with caching, monitoring, circuit breaking
type SearchService struct {
    es          *ESClient
    cache       *CacheManager
    metrics     *Metrics
    circuit     *CircuitBreaker
    rateLimiter *RateLimiter
}

func (s *SearchService) Search(ctx context.Context, req *SearchRequest) (*SearchResponse, error) {
    // 1. Rate limiting
    if !s.rateLimiter.Allow() { return nil, ErrRateLimited }

    // 2. Check cache
    if cached, ok := s.cache.Get(req.CacheKey()); ok { return cached, nil }

    // 3. Circuit breaker
    result, err := s.circuit.Execute(func() (interface{}, error) {
        return s.es.FullTextSearch(req.Query, req.From, req.Size)
    })

    // 4. Cache result
    s.cache.Set(req.CacheKey(), result)

    // 5. Record metrics
    s.metrics.RecordSearch(req, result)

    return result, nil
}
```

---

**总结**：Elasticsearch是构建搜索系统的利器。掌握索引设计、搜索语法、聚合分析、性能调优，能让你在海量数据场景下实现毫秒级搜索体验。结合Go语言的高性能特性，可以构建出生产级的搜索服务。
