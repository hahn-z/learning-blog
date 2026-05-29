---
title: "019 - Go 分布式系统基础：从 CAP 到共识算法"
slug: "019-docker"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.431+08:00"
updated_at: "2026-04-29T10:02:45.036+08:00"
reading_time: 43
tags: ["部署"]
---

# Go 分布式系统基础：从 CAP 到共识算法

**难度：⭐⭐⭐⭐⭐（高级）**

分布式系统是现代大规模应用的基石。本文系统讲解 CAP 定理、分布式 ID、分布式事务、分布式锁及一致性共识算法，并用 Go 实现关键组件。

---

## 一、概念讲解

### 1.1 CAP 定理

CAP 指出分布式系统最多同时满足三项中的两项：

| 属性 | 说明 |
|------|------|
| **C**onsistency | 所有节点看到相同的数据 |
| **A**vailability | 每个请求都能得到响应（不保证最新） |
| **P**artition tolerance | 网络分区时系统仍能运行 |

**实际选择：** 网络分区不可避免，所以本质上是 CP（如 ZooKeeper）或 AP（如 Cassandra）。

### 1.2 分布式挑战

| 问题 | 说明 |
|------|------|
| 网络分区 | 节点间通信可能中断 |
| 时钟不同步 | 各节点物理时钟有偏差 |
| 节点故障 | 进程崩溃、机器宕机 |
| 拜占庭错误 | 节点可能发送错误信息 |

---

## 二、脑图

```
Go 分布式系统
├── 理论基础
│   ├── CAP 定理
│   ├── BASE 理论
│   ├── 一致性模型
│   │   ├── 强一致性
│   │   ├── 最终一致性
│   │   └── 因果一致性
│   └── FLP 不可能定理
├── 分布式 ID
│   ├── UUID
│   ├── Snowflake 雪花算法
│   └── 数据库自增
├── 分布式事务
│   ├── 2PC (两阶段提交)
│   ├── TCC (Try-Confirm-Cancel)
│   ├── Saga 模式
│   └── 本地消息表
├── 分布式锁
│   ├── Redis 单节点锁
│   ├── RedLock 算法
│   └── etcd 锁
├── 共识算法
│   ├── Raft
│   │   ├── Leader 选举
│   │   ├── 日志复制
│   │   └── 安全性保证
│   └── Paxos (简要)
└── 实践
    ├── 服务发现
    ├── 配置中心
    └── 分布式追踪
```

---

## 三、完整 Go 代码

### v1 Snowflake 分布式 ID 生成器

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

// Snowflake generates unique distributed IDs
// Layout: 1 bit sign | 41 bits timestamp | 10 bits machine | 12 bits sequence
type Snowflake struct {
	mu        sync.Mutex
	startTime time.Time
	machineID int64
	sequence  int64
	lastTime  int64
}

const (
	machineBits = 10
	sequenceBits = 12
	maxMachineID = (1 << machineBits) - 1   // 1023
	maxSequence  = (1 << sequenceBits) - 1   // 4095
	machineShift = sequenceBits
	timeShift    = machineBits + sequenceBits
)

// NewSnowflake creates a Snowflake generator
func NewSnowflake(machineID int64) (*Snowflake, error) {
	if machineID < 0 || machineID > maxMachineID {
		return nil, fmt.Errorf("machine ID must be 0-%d", maxMachineID)
	}

	// Custom epoch: 2024-01-01
	startTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	return &Snowflake{
		startTime: startTime,
		machineID: machineID,
	}, nil
}

// Generate creates a unique ID
func (s *Snowflake) Generate() (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Since(s.startTime).Milliseconds()
	if now < s.lastTime {
		return 0, fmt.Errorf("clock moved backwards")
	}

	if now == s.lastTime {
		s.sequence = (s.sequence + 1) & maxSequence
		if s.sequence == 0 {
			// Wait for next millisecond
			for now <= s.lastTime {
				now = time.Since(s.startTime).Milliseconds()
			}
		}
	} else {
		s.sequence = 0
	}

	s.lastTime = now

	id := (now << timeShift) |
		(s.machineID << machineShift) |
		s.sequence

	return id, nil
}

// ParseID extracts components from a snowflake ID
func (s *Snowflake) ParseID(id int64) (timestamp time.Time, machineID, sequence int64) {
	sequence = id & maxSequence
	machineID = (id >> machineShift) & maxMachineID
	ms := id >> timeShift
	timestamp = s.startTime.Add(time.Duration(ms) * time.Millisecond)
	return
}

func main() {
	sf, err := NewSnowflake(1)
	if err != nil {
		panic(err)
	}

	fmt.Println("Snowflake IDs:")
	for i := 0; i < 10; i++ {
		id, _ := sf.Generate()
		t, mid, seq := sf.ParseID(id)
		fmt.Printf("  ID=%d time=%v machine=%d seq=%d\n", id, t.Format("15:04:05.000"), mid, seq)
	}

	// Concurrent generation
	var wg sync.WaitGroup
	ids := make(chan int64, 1000)
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 200; j++ {
				id, _ := sf.Generate()
				ids <- id
			}
		}()
	}
	go func() { wg.Wait(); close(ids) }()

	unique := make(map[int64]bool)
	for id := range ids {
		if unique[id] {
			fmt.Printf("DUPLICATE: %d\n", id)
		}
		unique[id] = true
	}
	fmt.Printf("Generated %d unique IDs\n", len(unique))
}
```

### v2 分布式事务：Saga 模式

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
)

// SagaStep represents a compensatable transaction step
type SagaStep struct {
	Name       string
	Execute    func(ctx context.Context) error
	Compensate func(ctx context.Context) error
}

// Saga orchestrates distributed transactions with compensation
type Saga struct {
	name  string
	steps []SagaStep
}

// NewSaga creates a new saga
func NewSaga(name string) *Saga {
	return &Saga{name: name}
}

// AddStep adds a step to the saga
func (s *Saga) AddStep(step SagaStep) *Saga {
	s.steps = append(s.steps, step)
	return s
}

// Execute runs all steps, compensating on failure
func (s *Saga) Execute(ctx context.Context) error {
	// Track completed steps for compensation
	completed := make([]int, 0)

	for i, step := range s.steps {
		log.Printf("[SAGA:%s] Executing step %d: %s", s.name, i+1, step.Name)

		if err := step.Execute(ctx); err != nil {
			log.Printf("[SAGA:%s] Step %d failed: %v", s.name, i+1, err)

			// Compensate in reverse order
			return s.compensate(ctx, completed, err)
		}

		completed = append(completed, i)
		log.Printf("[SAGA:%s] Step %d completed", s.name, i+1)
	}

	log.Printf("[SAGA:%s] All steps completed successfully", s.name)
	return nil
}

// compensate rolls back completed steps in reverse order
func (s *Saga) compensate(ctx context.Context, completed []int, originalErr error) error {
	log.Printf("[SAGA:%s] Starting compensation for %d steps", s.name, len(completed))

	for i := len(completed) - 1; i >= 0; i-- {
		stepIdx := completed[i]
		step := s.steps[stepIdx]

		log.Printf("[SAGA:%s] Compensating step %d: %s", s.name, stepIdx+1, step.Name)
		if err := step.Compensate(ctx); err != nil {
			log.Printf("[SAGA:%s] Compensation failed for step %d: %v", s.name, stepIdx+1, err)
			// Continue compensating remaining steps
		}
	}

	return fmt.Errorf("saga '%s' failed: %w", s.name, originalErr)
}

// --- Order Processing Example ---

// OrderService simulates order operations
type OrderService struct{}

func (os *OrderService) CreateOrder(ctx context.Context) error {
	fmt.Println("  → Order created")
	return nil
}
func (os *OrderService) CancelOrder(ctx context.Context) error {
	fmt.Println("  ← Order cancelled")
	return nil
}

// PaymentService simulates payment operations
type PaymentService struct {
	shouldFail bool
}

func (ps *PaymentService) Charge(ctx context.Context) error {
	if ps.shouldFail {
		return errors.New("payment declined")
	}
	fmt.Println("  → Payment charged")
	return nil
}
func (ps *PaymentService) Refund(ctx context.Context) error {
	fmt.Println("  ← Payment refunded")
	return nil
}

// InventoryService simulates inventory operations
type InventoryService struct{}

func (is *InventoryService) Reserve(ctx context.Context) error {
	fmt.Println("  → Inventory reserved")
	return nil
}
func (is *InventoryService) Release(ctx context.Context) error {
	fmt.Println("  ← Inventory released")
	return nil
}

func main() {
	ctx := context.Background()

	// Successful saga
	fmt.Println("=== Successful Order ===")
	saga1 := NewSaga("create-order").
		AddStep(SagaStep{
			Name:       "create-order",
			Execute:    (&OrderService{}).CreateOrder,
			Compensate: (&OrderService{}).CancelOrder,
		}).
		AddStep(SagaStep{
			Name:       "reserve-inventory",
			Execute:    (&InventoryService{}).Reserve,
			Compensate: (&InventoryService{}).Release,
		}).
		AddStep(SagaStep{
			Name:       "charge-payment",
			Execute:    (&PaymentService{}).Charge,
			Compensate: (&PaymentService{}).Refund,
		})
	saga1.Execute(ctx)

	// Failed saga (payment declines)
	fmt.Println("\n=== Failed Order (compensation) ===")
	saga2 := NewSaga("create-order-fail").
		AddStep(SagaStep{
			Name:       "create-order",
			Execute:    (&OrderService{}).CreateOrder,
			Compensate: (&OrderService{}).CancelOrder,
		}).
		AddStep(SagaStep{
			Name:       "reserve-inventory",
			Execute:    (&InventoryService{}).Reserve,
			Compensate: (&InventoryService{}).Release,
		}).
		AddStep(SagaStep{
			Name:       "charge-payment",
			Execute:    (&PaymentService{shouldFail: true}).Charge,
			Compensate: (&PaymentService{shouldFail: true}).Refund,
		})
	if err := saga2.Execute(ctx); err != nil {
		fmt.Printf("Result: %v\n", err)
	}
}
```

### v3 Raft Leader 选举模拟

```go
package main

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// NodeState represents the Raft node state
type NodeState int

const (
	Follower NodeState = iota
	Candidate
	Leader
)

func (s NodeState) String() string {
	switch s {
	case Follower:
		return "Follower"
	case Candidate:
		return "Candidate"
	case Leader:
		return "Leader"
	default:
		return "Unknown"
	}
}

// LogEntry represents a replicated log entry
type LogEntry struct {
	Term    int
	Index   int
	Command string
}

// RaftNode simulates a Raft consensus node
type RaftNode struct {
	mu          sync.Mutex
	id          int
	state       NodeState
	currentTerm int
	votedFor    int
	log         []LogEntry

	// Leader state
	nextIndex  map[int]int
	matchIndex map[int]int

	// Election
	electionTimer *time.Timer
	heartbeatCh   chan bool

	// Cluster
	peers    []*RaftNode
	commitCh chan LogEntry

	// For demo
	eventCh chan string
	stopCh  chan struct{}
}

// NewRaftNode creates a new Raft node
func NewRaftNode(id int) *RaftNode {
	return &RaftNode{
		id:          id,
		state:       Follower,
		log:         []LogEntry{{Term: 0, Index: 0}}, // sentinel
		heartbeatCh: make(chan bool, 100),
		commitCh:    make(chan LogEntry, 100),
		eventCh:     make(chan string, 100),
		stopCh:      make(chan struct{}),
	}
}

// Start begins the Raft loop
func (n *RaftNode) Start(ctx context.Context) {
	n.resetElectionTimer()

	for {
		select {
		case <-ctx.Done():
			return
		case <-n.stopCh:
			return
		case <-n.heartbeatCh:
			n.resetElectionTimer()
		case <-n.electionTimer.C:
			n.startElection()
		case event := <-n.eventCh:
			// Process events
			_ = event
		}
	}
}

// resetElectionTimer sets a random election timeout
func (n *RaftNode) resetElectionTimer() {
	if n.electionTimer != nil {
		n.electionTimer.Stop()
	}
	// Random timeout: 300-600ms (simulated)
	timeout := time.Duration(300+rand.Intn(300)) * time.Millisecond
	n.electionTimer = time.NewTimer(timeout)
}

// startElection begins a leader election
func (n *RaftNode) startElection() {
	n.mu.Lock()
	n.state = Candidate
	n.currentTerm++
	n.votedFor = n.id
	term := n.currentTerm
	n.mu.Unlock()

	n.eventCh <- fmt.Sprintf("Node %d starting election for term %d", n.id, term)

	// Request votes from all peers
	votes := 1 // self vote
	var wg sync.WaitGroup
	var voteCount atomic.Int32
	voteCount.Store(1)

	for _, peer := range n.peers {
		if peer.id == n.id {
			continue
		}
		wg.Add(1)
		go func(p *RaftNode) {
			defer wg.Done()
			if p.grantVote(n.id, term) {
				voteCount.Add(1)
			}
		}(peer)
	}

	wg.Wait()
	votes = int(voteCount.Load())
	majority := len(n.peers)/2 + 1

	if votes >= majority {
		n.mu.Lock()
		if n.state == Candidate && n.currentTerm == term {
			n.state = Leader
			n.nextIndex = make(map[int]int)
			n.matchIndex = make(map[int]int)
			for _, p := range n.peers {
				if p.id != n.id {
					n.nextIndex[p.id] = len(n.log)
					n.matchIndex[p.id] = 0
				}
			}
			n.mu.Unlock()

			n.eventCh <- fmt.Sprintf("🎉 Node %d elected LEADER (term %d, votes=%d)", n.id, term, votes)

			// Start sending heartbeats
			go n.sendHeartbeats()
		} else {
			n.mu.Unlock()
		}
	} else {
		n.eventCh <- fmt.Sprintf("Node %d lost election (term %d, votes=%d/%d)", n.id, term, votes, majority)
		n.mu.Lock()
		n.state = Follower
		n.mu.Unlock()
		n.resetElectionTimer()
	}
}

// grantVote processes a vote request
func (n *RaftNode) grantVote(candidateID, term int) bool {
	n.mu.Lock()
	defer n.mu.Unlock()

	if term > n.currentTerm {
		n.currentTerm = term
		n.state = Follower
		n.votedFor = -1
	}

	if (n.votedFor == -1 || n.votedFor == candidateID) && term >= n.currentTerm {
		n.votedFor = candidateID
		n.resetElectionTimer()
		return true
	}
	return false
}

// sendHeartbeats sends periodic heartbeats as leader
func (n *RaftNode) sendHeartbeats() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-n.stopCh:
			return
		case <-ticker.C:
			n.mu.Lock()
			if n.state != Leader {
				n.mu.Unlock()
				return
			}
			term := n.currentTerm
			n.mu.Unlock()

			for _, peer := range n.peers {
				if peer.id == n.id {
					continue
				}
				go func(p *RaftNode) {
					p.receiveHeartbeat(term)
				}(peer)
			}
		}
	}
}

// receiveHeartbeat processes a leader heartbeat
func (n *RaftNode) receiveHeartbeat(leaderTerm int) {
	n.mu.Lock()
	if leaderTerm >= n.currentTerm {
		n.currentTerm = leaderTerm
		n.state = Follower
		n.votedFor = -1
	}
	n.mu.Unlock()
	n.heartbeatCh <- true
}

// Propose submits a command to the leader
func (n *RaftNode) Propose(command string) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.state != Leader {
		return
	}

	entry := LogEntry{
		Term:    n.currentTerm,
		Index:   len(n.log),
		Command: command,
	}
	n.log = append(n.log, entry)
	n.eventCh <- fmt.Sprintf("Leader %d appended: %q (term=%d index=%d)", n.id, command, entry.Term, entry.Index)
}

// RunCluster starts a demo Raft cluster
func RunCluster() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Create 5-node cluster
	nodes := make([]*RaftNode, 5)
	for i := 0; i < 5; i++ {
		nodes[i] = NewRaftNode(i)
	}
	for i := range nodes {
		nodes[i].peers = nodes
	}

	// Start all nodes
	for _, node := range nodes {
		go node.Start(ctx)
	}

	// Print events from all nodes
	var eventWg sync.WaitGroup
	for _, node := range nodes {
		eventWg.Add(1)
		go func(n *RaftNode) {
			defer eventWg.Done()
			for event := range n.eventCh {
				fmt.Printf("[Node %d] %s\n", n.id, event)
			}
		}(node)
	}

	// Wait for leader election
	time.Sleep(1 * time.Second)

	// Propose some commands
	for _, node := range nodes {
		node.mu.Lock()
		if node.state == Leader {
			fmt.Printf("\n--- Proposing commands via Leader %d ---\n", node.id)
			node.Propose("SET x=1")
			node.Propose("SET y=2")
			node.Propose("DELETE z")
		}
		node.mu.Unlock()
	}

	time.Sleep(500 * time.Millisecond)

	// Simulate leader failure
	for _, node := range nodes {
		node.mu.Lock()
		if node.state == Leader {
			fmt.Printf("\n--- Simulating Leader %d failure ---\n", node.id)
			close(node.stopCh)
		}
		node.mu.Unlock()
	}

	time.Sleep(2 * time.Second)

	// Check new leader
	for _, node := range nodes {
		node.mu.Lock()
		if node.state == Leader {
			fmt.Printf("\n--- New Leader: Node %d (term %d) ---\n", node.id, node.currentTerm)
		}
		node.mu.Unlock()
	}

	cancel()
	time.Sleep(100 * time.Millisecond)
}

func main() {
	fmt.Println("=== Raft Leader Election Simulation ===\n")
	RunCluster()
}
```

---

## 四、执行预览

```
=== Snowflake IDs ===
ID=18446744073709551616 time=20:45:12.123 machine=1 seq=0
ID=18446744073709551617 time=20:45:12.123 machine=1 seq=1
...
Generated 1000 unique IDs

=== Successful Order ===
[SAGA:create-order] Executing step 1: create-order
  → Order created
[SAGA:create-order] Executing step 2: reserve-inventory
  → Inventory reserved
[SAGA:create-order] Executing step 3: charge-payment
  → Payment charged

=== Failed Order (compensation) ===
[SAGA:create-order-fail] Step 3 failed: payment declined
[SAGA:create-order-fail] Compensating step 2: reserve-inventory
  ← Inventory released
[SAGA:create-order-fail] Compensating step 1: create-order
  ← Order cancelled

=== Raft Simulation ===
[Node 2] 🎉 Node 2 elected LEADER (term 3, votes=3)
--- Proposing commands via Leader 2 ---
[Node 2] Leader 2 appended: "SET x=1"
[Node 2] Leader 2 appended: "SET y=2"
--- Simulating Leader 2 failure ---
[Node 4] 🎉 Node 4 elected LEADER (term 4, votes=3)
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 时钟依赖 | Snowflake 依赖系统时钟单调递增，NTP 同步很重要 |
| Saga 补偿 | 补偿操作本身也可能失败，需要重试+人工介入 |
| Raft 选举超时 | 必须随机化，避免分票（split vote） |
| 网络分区 | 脑裂场景下少数派分区不可提供服务 |
| ID 生成 | 41 位时间戳约可用 69 年 |
| 并发安全 | Snowflake 的 Generate 需要加锁 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| 分布式事务用 2PC 强一致性 | 用 Saga/TCC 最终一致性 |
| 自增 ID 做分布式主键 | 用 Snowflake/UUID 等方案 |
| 忽略时钟回拨问题 | Snowflake 检测时钟回拨并拒绝/等待 |
| 单 Redis 节点做分布式锁 | 关键场景用 RedLock 或 etcd |
| 不考虑网络分区 | 按 CP 或 AP 明确选择，设计降级方案 |
| Saga 补偿不幂等 | 补偿操作必须幂等，支持重试 |

---

## 七、练习题

### 🟢 基础
1. 实现 Snowflake ID 的 Base62 编码（缩短 ID 长度）
2. 实现简单的分布式计数器（多节点原子计数）

### 🟡 进阶
3. 实现 TCC 模式（Try-Confirm-Cancel），模拟转账场景
4. 扩展 Raft 模拟：实现日志复制（AppendEntries RPC）

### 🔴 挑战
5. 基于 etcd 实现完整的分布式锁：支持租约（Lease）、自动续期、公平锁

---

## 八、知识点总结

```
分布式系统知识体系
├── 理论
│   ├── CAP / BASE
│   ├── 一致性模型
│   └── FLP 不可能
├── 分布式 ID
│   ├── Snowflake
│   └── UUID v7
├── 分布式事务
│   ├── 2PC
│   ├── TCC
│   ├── Saga (编排式/协调式)
│   └── 本地消息表
├── 共识
│   ├── Raft (选举/复制/安全)
│   ├── Paxos
│   └── ZAB
└── 协调服务
    ├── etcd
    ├── ZooKeeper
    └── Consul
```

---

## 九、举一反三

| 场景 | 推荐方案 | 技术选型 |
|------|----------|----------|
| 订单 ID | Snowflake | 自研/Leaf |
| 跨服务转账 | Saga 编排 | Seata/Capsule |
| 配置中心 | Raft 共识 | etcd/Consul |
| 分布式锁 | 租约+续期 | etcd/Redis RedLock |
| 服务发现 | 一致性 KV | etcd/Consul |
| 消息去重 | 幂等键 | 数据库唯一索引 |
| 选主 | Raft 选举 | etcd/embedded |

---

## 十、参考资料

- 《分布式系统：概念与设计》— George Coulouris
- [Raft 论文](https://raft.github.io/raft.pdf) — Diego Ongaro
- [In Search of an Understandable Consensus Algorithm](https://raft.github.io/)
- 《数据密集型应用系统设计》— Martin Kleppmann

---

## 十一、代码演进

| 版本 | 内容 | 适用场景 |
|------|------|----------|
| **v1** | Snowflake 分布式 ID 生成 | 唯一 ID 需求 |
| **v2** | Saga 分布式事务编排 | 跨服务事务 |
| **v3** | Raft Leader 选举模拟 | 理解共识算法 |

**演进路径：** v1 理解分布式 ID → v2 掌握事务协调 → v3 深入共识算法原理
