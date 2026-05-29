---
title: "004-HTML5多媒体与Canvas"
slug: "004-html5-multimedia"
category: "HTML5"
tech_stack: "HTML-CSS"
created_at: "2026-04-26T10:33:05.564+08:00"
updated_at: "2026-04-29T10:02:45.925+08:00"
reading_time: 53
tags: []
---

# 004-HTML5多媒体与Canvas

> **难度：** 🟡 中级 | **阅读时间：** 30分钟 | **前置知识：** HTML基础、JavaScript基础

---

## 一、概念讲解

### 1.1 HTML5多媒体

HTML5之前，音视频需要Flash等插件。HTML5原生支持：

| 元素 | 作用 | 核心属性 |
|------|------|----------|
| `<audio>` | 音频播放 | src, controls, autoplay, loop, preload |
| `<video>` | 视频播放 | src, controls, width, height, poster |
| `<source>` | 媒体源 | src, type（多格式兼容） |
| `<track>` | 字幕 | src, kind, srclang, label |

**视频格式兼容性：**

| 格式 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| MP4(H.264) | ✅ | ✅ | ✅ | ✅ |
| WebM(VP8/9) | ✅ | ✅ | ❌ | ✅ |
| Ogg(Theora) | ✅ | ✅ | ❌ | ✅ |

### 1.2 Canvas基础

Canvas是HTML5的2D绘图API，通过JavaScript绘制图形：

```javascript
// Get canvas context
var canvas = document.getElementById('myCanvas');
var ctx = canvas.getContext('2d');

// Draw rectangle
ctx.fillStyle = '#3498db';
ctx.fillRect(10, 10, 100, 50);

// Draw text
ctx.font = '24px Arial';
ctx.fillText('Hello Canvas', 10, 100);
```

**Canvas核心绘图方法：**

| 类型 | 方法 | 说明 |
|------|------|------|
| 矩形 | fillRect/strokeRect/clearRect | 最基础的图形 |
| 路径 | beginPath/moveTo/lineTo/closePath | 自定义形状 |
| 圆弧 | arc/arcTo | 圆形和弧线 |
| 文字 | fillText/strokeText | 文字渲染 |
| 图片 | drawImage | 图片绘制和裁剪 |
| 变换 | translate/rotate/scale | 坐标变换 |
| 渐变 | createLinearGradient/createRadialGradient | 渐变填充 |

---

## 二、知识脑图

```
HTML5多媒体与Canvas
├── 多媒体
│   ├── audio（音频）
│   │   ├── 属性：controls/autoplay/loop/preload
│   │   └── 事件：play/pause/ended/timeupdate
│   ├── video（视频）
│   │   ├── 属性：controls/poster/width/height
│   │   └── 事件：loadedmetadata/canplay/ended
│   └── source（多格式兼容）
├── Canvas
│   ├── 基础绘图
│   │   ├── 矩形（fillRect）
│   │   ├── 路径（beginPath/lineTo）
│   │   ├── 圆弧（arc）
│   │   └── 文字（fillText）
│   ├── 样式
│   │   ├── fillStyle/strokeStyle
│   │   ├── 渐变（linear/radial）
│   │   ├── 阴影（shadowColor/Blur）
│   │   └── 线条（lineWidth/lineCap/join）
│   ├── 变换
│   │   ├── translate（平移）
│   │   ├── rotate（旋转）
│   │   └── scale（缩放）
│   └── 动画
│       ├── requestAnimationFrame
│       ├── 清除重绘模式
│       └── 粒子系统
└── 实战
    ├── 自定义音频播放器
    ├── Canvas画板
    └── 粒子动画
```

---

## 三、完整代码示例

### 3.1 Canvas画板 + 粒子动画

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML5多媒体与Canvas</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: system-ui, sans-serif;
            background: #1a1a2e;
            color: white;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }

        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 28px;
        }

        h1 span { color: #e94560; }

        /* Section card */
        .section {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            backdrop-filter: blur(10px);
        }

        .section h2 {
            color: #e94560;
            margin-bottom: 16px;
            font-size: 20px;
        }

        /* Audio player custom UI */
        .audio-player {
            background: rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .play-btn {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #e94560;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
            flex-shrink: 0;
        }

        .play-btn:hover { transform: scale(1.1); }

        .audio-info {
            flex: 1;
        }

        .audio-title {
            font-weight: 600;
            margin-bottom: 8px;
        }

        .progress-bar {
            width: 100%;
            height: 6px;
            background: rgba(255,255,255,0.15);
            border-radius: 3px;
            cursor: pointer;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            background: #e94560;
            border-radius: 3px;
            width: 0%;
            transition: width 0.1s linear;
        }

        .time-display {
            font-size: 12px;
            color: rgba(255,255,255,0.6);
            margin-top: 4px;
        }

        /* Video section */
        .video-container {
            position: relative;
            border-radius: 8px;
            overflow: hidden;
            background: #000;
        }

        video {
            width: 100%;
            display: block;
        }

        .video-placeholder {
            padding: 80px 20px;
            text-align: center;
            color: rgba(255,255,255,0.4);
        }

        /* Drawing board */
        .draw-toolbar {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
            flex-wrap: wrap;
            align-items: center;
        }

        .draw-toolbar label {
            font-size: 14px;
        }

        .color-btn {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid transparent;
            cursor: pointer;
            transition: border-color 0.2s;
        }

        .color-btn.active { border-color: white; }

        .tool-btn {
            padding: 6px 14px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
        }

        .tool-btn:hover { background: rgba(255,255,255,0.2); }

        #drawCanvas {
            background: white;
            border-radius: 8px;
            cursor: crosshair;
            display: block;
            width: 100%;
            touch-action: none;
        }

        /* Particle canvas */
        #particleCanvas {
            border-radius: 8px;
            display: block;
            width: 100%;
            background: #16213e;
        }

        .particle-controls {
            display: flex;
            gap: 10px;
            margin-top: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 HTML5 <span>多媒体</span>与Canvas</h1>

        <!-- Audio Section -->
        <div class="section">
            <h2>🔊 自定义音频播放器</h2>
            <div class="audio-player">
                <button class="play-btn" id="playBtn" onclick="togglePlay()">▶</button>
                <div class="audio-info">
                    <div class="audio-title">🎵 示例音频（浏览器内置音调）</div>
                    <div class="progress-bar" id="audioProgress" onclick="seekAudio(event)">
                        <div class="progress-fill" id="audioProgressFill"></div>
                    </div>
                    <div class="time-display" id="audioTime">0:00 / 0:00</div>
                </div>
            </div>
            <p style="margin-top:12px;font-size:13px;opacity:0.6;">
                提示：使用Web Audio API生成示例音调（无需外部音频文件）
            </p>
        </div>

        <!-- Canvas Drawing Board -->
        <div class="section">
            <h2>🖌️ Canvas画板</h2>
            <div class="draw-toolbar">
                <label>颜色：</label>
                <button class="color-btn active" style="background:#e94560" onclick="setColor('#e94560', this)"></button>
                <button class="color-btn" style="background:#3498db" onclick="setColor('#3498db', this)"></button>
                <button class="color-btn" style="background:#2ecc71" onclick="setColor('#2ecc71', this)"></button>
                <button class="color-btn" style="background:#f1c40f" onclick="setColor('#f1c40f', this)"></button>
                <button class="color-btn" style="background:#333333" onclick="setColor('#333333', this)"></button>

                <label style="margin-left:10px;">粗细：</label>
                <input type="range" id="brushSize" min="1" max="20" value="3"
                       style="width:100px;" oninput="drawState.lineWidth=this.value">

                <button class="tool-btn" onclick="clearCanvas()">清空</button>
                <button class="tool-btn" onclick="saveCanvas()">保存</button>
            </div>
            <canvas id="drawCanvas" width="850" height="400"></canvas>
        </div>

        <!-- Particle Animation -->
        <div class="section">
            <h2>✨ Canvas粒子动画</h2>
            <canvas id="particleCanvas" width="850" height="350"></canvas>
            <div class="particle-controls">
                <button class="tool-btn" onclick="toggleParticles()">暂停/继续</button>
                <button class="tool-btn" onclick="addParticles(20)">+20粒子</button>
                <button class="tool-btn" onclick="resetParticles()">重置</button>
            </div>
        </div>
    </div>

    <script>
        // ========== Audio: Web Audio API Tone Generator ==========
        var audioCtx = null;
        var isPlaying = false;
        var playStartTime = 0;
        var duration = 5; // 5 second tone
        var source = null;
        var animFrameId = null;

        function togglePlay() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (isPlaying) {
                // Stop
                if (source) source.stop();
                isPlaying = false;
                document.getElementById('playBtn').textContent = '▶';
                cancelAnimationFrame(animFrameId);
            } else {
                // Play a pleasant chord
                source = audioCtx.createOscillator();
                var gainNode = audioCtx.createGain();
                source.type = 'sine';
                source.frequency.value = 440; // A4 note
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                source.start();
                source.stop(audioCtx.currentTime + duration);

                playStartTime = Date.now();
                isPlaying = true;
                document.getElementById('playBtn').textContent = '⏸';
                updateAudioProgress();

                source.onended = function() {
                    isPlaying = false;
                    document.getElementById('playBtn').textContent = '▶';
                    document.getElementById('audioProgressFill').style.width = '100%';
                };
            }
        }

        function updateAudioProgress() {
            if (!isPlaying) return;
            var elapsed = (Date.now() - playStartTime) / 1000;
            var pct = Math.min(elapsed / duration * 100, 100);
            document.getElementById('audioProgressFill').style.width = pct + '%';

            var curr = formatTime(elapsed);
            var total = formatTime(duration);
            document.getElementById('audioTime').textContent = curr + ' / ' + total;

            animFrameId = requestAnimationFrame(updateAudioProgress);
        }

        function formatTime(sec) {
            var m = Math.floor(sec / 60);
            var s = Math.floor(sec % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }

        function seekAudio(e) {
            // Simplified: restart at proportional position
            var bar = document.getElementById('audioProgress');
            var pct = e.offsetX / bar.offsetWidth;
            playStartTime = Date.now() - pct * duration * 1000;
        }

        // ========== Canvas Drawing Board ==========
        var drawCanvas = document.getElementById('drawCanvas');
        var drawCtx = drawCanvas.getContext('2d');
        var drawState = {
            drawing: false,
            color: '#e94560',
            lineWidth: 3,
            lastX: 0,
            lastY: 0
        };

        // Scale canvas for sharp rendering
        function scaleCanvas(canvas, ctx) {
            var rect = canvas.getBoundingClientRect();
            var dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
        }

        function getDrawPos(e) {
            var rect = drawCanvas.getBoundingClientRect();
            var touch = e.touches ? e.touches[0] : e;
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }

        function startDraw(e) {
            e.preventDefault();
            drawState.drawing = true;
            var pos = getDrawPos(e);
            drawState.lastX = pos.x;
            drawState.lastY = pos.y;
        }

        function doDraw(e) {
            if (!drawState.drawing) return;
            e.preventDefault();
            var pos = getDrawPos(e);

            drawCtx.beginPath();
            drawCtx.moveTo(drawState.lastX, drawState.lastY);
            drawCtx.lineTo(pos.x, pos.y);
            drawCtx.strokeStyle = drawState.color;
            drawCtx.lineWidth = drawState.lineWidth;
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';
            drawCtx.stroke();

            drawState.lastX = pos.x;
            drawState.lastY = pos.y;
        }

        function endDraw() {
            drawState.drawing = false;
        }

        // Mouse events
        drawCanvas.addEventListener('mousedown', startDraw);
        drawCanvas.addEventListener('mousemove', doDraw);
        drawCanvas.addEventListener('mouseup', endDraw);
        drawCanvas.addEventListener('mouseleave', endDraw);

        // Touch events
        drawCanvas.addEventListener('touchstart', startDraw);
        drawCanvas.addEventListener('touchmove', doDraw);
        drawCanvas.addEventListener('touchend', endDraw);

        function setColor(color, btn) {
            drawState.color = color;
            document.querySelectorAll('.color-btn').forEach(function(b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
        }

        function clearCanvas() {
            var rect = drawCanvas.getBoundingClientRect();
            drawCtx.clearRect(0, 0, rect.width, rect.height);
        }

        function saveCanvas() {
            var link = document.createElement('a');
            link.download = 'canvas-drawing.png';
            link.href = drawCanvas.toDataURL();
            link.click();
        }

        // ========== Particle Animation ==========
        var pCanvas = document.getElementById('particleCanvas');
        var pCtx = pCanvas.getContext('2d');
        var particles = [];
        var particlesRunning = true;
        var mouseX = 0, mouseY = 0;

        function Particle(x, y) {
            this.x = x || Math.random() * 850;
            this.y = y || Math.random() * 350;
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = (Math.random() - 0.5) * 2;
            this.radius = Math.random() * 3 + 1;
            this.alpha = Math.random() * 0.5 + 0.5;
            // Random color from palette
            var colors = ['#e94560', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        function initParticles(count) {
            particles = [];
            for (var i = 0; i < count; i++) {
                particles.push(new Particle());
            }
        }

        function addParticles(count) {
            for (var i = 0; i < count; i++) {
                particles.push(new Particle(mouseX || 425, mouseY || 175));
            }
        }

        function resetParticles() {
            initParticles(50);
        }

        function animateParticles() {
            if (!particlesRunning) {
                requestAnimationFrame(animateParticles);
                return;
            }

            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

            particles.forEach(function(p) {
                // Update position
                p.x += p.vx;
                p.y += p.vy;

                // Bounce off walls
                if (p.x < 0 || p.x > 850) p.vx *= -1;
                if (p.y < 0 || p.y > 350) p.vy *= -1;

                // Draw particle with glow
                pCtx.beginPath();
                pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                pCtx.fillStyle = p.color;
                pCtx.globalAlpha = p.alpha;
                pCtx.shadowColor = p.color;
                pCtx.shadowBlur = 10;
                pCtx.fill();
            });

            // Draw connections between nearby particles
            pCtx.globalAlpha = 1;
            pCtx.shadowBlur = 0;
            for (var i = 0; i < particles.length; i++) {
                for (var j = i + 1; j < particles.length; j++) {
                    var dx = particles[i].x - particles[j].x;
                    var dy = particles[i].y - particles[j].y;
                    var dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 100) {
                        pCtx.beginPath();
                        pCtx.moveTo(particles[i].x, particles[i].y);
                        pCtx.lineTo(particles[j].x, particles[j].y);
                        pCtx.strokeStyle = 'rgba(255,255,255,' + (1 - dist / 100) * 0.15 + ')';
                        pCtx.lineWidth = 1;
                        pCtx.stroke();
                    }
                }
            }

            requestAnimationFrame(animateParticles);
        }

        pCanvas.addEventListener('mousemove', function(e) {
            var rect = pCanvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        });

        function toggleParticles() {
            particlesRunning = !particlesRunning;
        }

        // Initialize
        initParticles(50);
        animateParticles();
    </script>
</body>
</html>
```

### 执行预览

深色主题页面，三个交互区域：
1. **音频播放器** — 红色播放按钮，进度条，时间显示（用Web Audio API生成音调）
2. **Canvas画板** — 5种颜色选择，粗细滑动条，支持鼠标和触摸绘画，可清空/保存
3. **粒子动画** — 50个彩色粒子在深蓝背景中漂浮，近距粒子间有连线，可暂停/添加/重置

---

## 四、注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| Canvas分辨率 | 需处理devicePixelRatio | 否则高分屏模糊 |
| video自动播放 | 浏览器限制autoplay | 需muted或用户交互触发 |
| Canvas性能 | 大量粒子注意性能 | 用对象池、减少drawCall |
| 音频上下文 | 需用户交互后创建 | Chrome阻止自动播放 |
| Canvas尺寸 | CSS尺寸≠画布尺寸 | 同时设置width/height属性和CSS |

---

## 五、避坑指南

### ❌ Canvas不处理DPR
```javascript
// Blurry on retina screens
canvas.width = 800;
canvas.height = 400;
```
### ✅ 处理设备像素比
```javascript
var dpr = window.devicePixelRatio || 1;
canvas.width = 800 * dpr;
canvas.height = 400 * dpr;
ctx.scale(dpr, dpr);
canvas.style.width = '800px';
canvas.style.height = '400px';
```

### ❌ 用setInterval做动画
```javascript
setInterval(function() {
    draw();
}, 16);
```
### ✅ 用requestAnimationFrame
```javascript
function animate() {
    draw();
    requestAnimationFrame(animate);
}
animate();
```

### ❌ 不清除Canvas就重绘
```javascript
function draw() {
    ctx.fillRect(x, y, 50, 50); // Overlapping frames!
}
```
### ✅ 每帧先清除
```javascript
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(x, y, 50, 50);
}
```

---

## 六、练习题

### 🟢 入门
1. 用Canvas绘制一个蓝色矩形和一个红色圆形。
2. 创建一个自定义音频播放器UI（不需要真实音频）。

### 🟡 进阶
3. 实现Canvas画板，支持颜色选择、粗细调节和橡皮擦。
4. 创建50个粒子的动画，粒子碰到边界反弹。

### 🔴 挑战
5. 实现粒子跟随鼠标效果：粒子被鼠标吸引或排斥。
6. 用Canvas实现一个简单的弹球游戏（挡板+球+砖块）。

---

## 七、知识点总结

```
HTML5多媒体与Canvas
├── 多媒体
│   ├── audio/video元素
│   ├── source多格式兼容
│   ├── track字幕
│   └── Web Audio API
├── Canvas基础
│   ├── getContext('2d')
│   ├── 矩形/路径/圆弧/文字
│   ├── 样式（fill/stroke/gradient）
│   └── 变换（translate/rotate/scale）
├── Canvas动画
│   ├── requestAnimationFrame
│   ├── 清除重绘模式
│   └── 粒子系统
└── 注意事项
    ├── DPR适配
    ├── 性能优化
    └── 触摸事件
```

---

## 八、举一反三

| 场景 | 技术方案 | 关键点 |
|------|----------|--------|
| 在线画板 | Canvas + 触摸事件 | DPR适配、笔触平滑 |
| 数据可视化 | Canvas绑定数据 | 自动缩放、动画过渡 |
| 小游戏 | Canvas + requestAnimationFrame | 碰撞检测、游戏循环 |
| 音频可视化 | Web Audio API + Canvas | AnalyserNode + 频谱绘制 |
| 图片编辑器 | Canvas + drawImage | 裁剪、滤镜、导出 |

---

## 九、参考资料

- [MDN - Canvas教程](https://developer.mozilla.org/zh-CN/docs/Web/API/Canvas_API/Tutorial)
- [MDN - Web Audio API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Audio_API)
- [Canvas性能优化](https://developer.mozilla.org/zh-CN/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

---

## 十、代码演进

### v1 — 静态Canvas绘图
```javascript
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(10, 10, 100, 50);
```

### v2 — 交互式画板
```javascript
canvas.addEventListener('mousemove', function(e) {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
});
```

### v3 — 完整画板 + 粒子动画
```javascript
// Drawing board: color picker, brush size, clear, save
// Particle system: 50+ particles, connections, mouse interaction
// Audio player: Web Audio API, progress bar, custom controls
// DPR-aware canvas, touch support, animation loop
```

> **演进要点：** 静态绘图 → 交互绘制 → 完整应用（画板+动画+音频，DPR适配，触摸支持）。