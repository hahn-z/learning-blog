---
title: "018 - Telegram Bot 开发：从零到实战"
slug: "018-telegram-bot"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.554+08:00"
updated_at: "2026-04-29T10:02:47.797+08:00"
reading_time: 46
tags: []
---

# Telegram Bot 开发：从零到实战

> **难度：⭐⭐ 中级** | **预计阅读：20 分钟** | **Python 3.8+**

## 一、概念讲解

Telegram Bot 是运行在 Telegram 平台上的自动化程序。相比其他平台的 Bot，Telegram Bot API 非常友好：

- **无需审核**：创建即可用，无需等待平台审批
- **功能强大**：支持内联键盘、支付、小游戏、网页视图等
- **文档优秀**：官方 API 文档清晰完整
- **生态成熟**：python-telegram-bot 库社区活跃

**核心概念**：

| 概念 | 说明 |
|------|------|
| **Bot Token** | 创建 Bot 时获取的认证令牌 |
| **Webhook** | Telegram 主动推送消息给你的服务器 |
| **Polling** | 你的程序主动轮询获取新消息 |
| **Inline Keyboard** | 消息下方的交互按钮 |
| **Command** | 以 `/` 开头的指令，如 `/start` |
| **Handler** | 处理特定类型消息的回调函数 |

**获取 Bot Token**：在 Telegram 搜索 @BotFather -> 发送 `/newbot` -> 按提示操作 -> 获得 Token。

## 二、脑图（ASCII）

```
              Telegram Bot 开发
                    |
      +-------------+-------------+
      |             |             |
   基础功能      高级交互       部署运维
      |             |             |
  +---+---+    +---+---+    +---+----+
  |消息处理|    |内联键盘|    |Webhook |
  |命令响应|    |会话状态|    |Polling |
  |图片/文件|   |Callback|    |Docker  |
  +-------+    +-------+    +--------+
```

## 三、完整代码

### v1：最简 Bot — 命令响应

```python
# bot_v1.py - Simple echo bot
from telegram import Update
from telegram.ext import (
    ApplicationBuilder, CommandHandler,
    MessageHandler, filters, ContextTypes
)

TOKEN = "YOUR_BOT_TOKEN_HERE"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Handle /start command
    await update.message.reply_text(
        "👋 Hello! I'm a demo bot.\n\n"
        "Commands:\n"
        "/start - Show this message\n"
        "/help - Get help\n"
        "/echo <text> - Echo your message"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Handle /help command
    await update.message.reply_text(
        "📌 Available commands:\n"
        "/start - Welcome message\n"
        "/echo <text> - Repeat what you say\n"
        "Send any text and I'll echo it back!"
    )

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Echo user message back
    if context.args:
        text = " ".join(context.args)
    else:
        text = update.message.text
    await update.message.reply_text(f"🔊 {text}")

def main():
    # Start the bot using long polling
    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("echo", echo))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, echo
    ))

    print("Bot is running... Press Ctrl+C to stop")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
```

### v2：Inline Keyboard + 会话管理

```python
# bot_v2.py - Interactive bot with inline keyboards
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    ConversationHandler, MessageHandler, filters, ContextTypes
)

TOKEN = "YOUR_BOT_TOKEN_HERE"
CHOOSING, TYPING = range(2)
user_notes = {}  # In-memory store; use DB in production

async def show_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Show main menu with inline keyboard
    keyboard = [
        [InlineKeyboardButton("🌤 天气查询", callback_data="weather"),
         InlineKeyboardButton("📝 记事本", callback_data="notes")],
        [InlineKeyboardButton("🔢 计算器", callback_data="calc"),
         InlineKeyboardButton("ℹ️ 关于", callback_data="about")],
    ]
    await update.message.reply_text(
        "🤖 **多功能助手**\n\n请选择功能：",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown"
    )

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Handle inline keyboard callbacks
    query = update.callback_query
    await query.answer()
    data = query.data

    if data == "weather":
        keyboard = [
            [InlineKeyboardButton("北京", callback_data="w_beijing"),
             InlineKeyboardButton("上海", callback_data="w_shanghai")],
            [InlineKeyboardButton("🏠 返回", callback_data="back")],
        ]
        await query.edit_message_text(
            "🌤 请选择城市：",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    elif data.startswith("w_"):
        city = data[2:]
        weather = {"beijing": "☀️ 晴 25°C", "shanghai": "🌧 小雨 22°C"}
        await query.edit_message_text(
            f"🌤 **{city}**\n{weather.get(city, '未知')}",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🏠 返回", callback_data="weather")]
            ]),
            parse_mode="Markdown"
        )

    elif data == "notes":
        context.user_data["awaiting_note"] = True
        await query.edit_message_text("📝 请输入要保存的笔记：")

    elif data == "calc":
        await query.edit_message_text(
            "🔢 发送数学表达式，如 `2 + 3 * 4`",
            parse_mode="Markdown"
        )

    elif data == "about":
        await query.edit_message_text(
            "ℹ️ **关于**\n版本：v2.0\n技术：python-telegram-bot v20+",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🏠 返回", callback_data="back")]
            ]),
            parse_mode="Markdown"
        )

    elif data == "back":
        keyboard = [
            [InlineKeyboardButton("🌤 天气", callback_data="weather"),
             InlineKeyboardButton("📝 记事本", callback_data="notes")],
            [InlineKeyboardButton("🔢 计算器", callback_data="calc"),
             InlineKeyboardButton("ℹ️ 关于", callback_data="about")],
        ]
        await query.edit_message_text(
            "🤖 **多功能助手**\n\n请选择：",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

async def save_note(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Save user note
    if not context.user_data.get("awaiting_note"):
        return
    context.user_data["awaiting_note"] = False

    uid = update.message.from_user.id
    user_notes.setdefault(uid, []).append(update.message.text)
    count = len(user_notes[uid])

    await update.message.reply_text(f"✅ 笔记已保存！（第 {count} 条）")

def main():
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", show_menu))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, save_note
    ))
    print("Bot v2 running...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
```

### v3：生产级 Bot — Webhook + 数据库 + 日志

```python
# bot_v3.py - Production-ready Telegram Bot
import logging
import sqlite3
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    MessageHandler, filters, ContextTypes
)

# ============ Configuration ============
TOKEN = "YOUR_BOT_TOKEN_HERE"
WEBHOOK_URL = "https://yourdomain.com/webhook"
PORT = 8443
DB_PATH = "bot_data.db"

# ============ Logging ============
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    handlers=[
        logging.FileHandler("bot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============ Database ============
def init_db():
    # Initialize SQLite database
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            command_count INTEGER DEFAULT 0
        );
    """)
    conn.commit()
    conn.close()

def track_user(user_id: int, username: str):
    # Track user activity
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO users (user_id, username, last_active, command_count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET
            last_active = excluded.last_active,
            command_count = command_count + 1,
            username = excluded.username
    """, (user_id, username, datetime.now().isoformat()))
    conn.commit()
    conn.close()

# ============ Handlers ============
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Main menu
    user = update.effective_user
    track_user(user.id, user.username)
    logger.info(f"User {user.username} ({user.id}) started bot")

    keyboard = [
        [InlineKeyboardButton("📝 记笔记", callback_data="note_new"),
         InlineKeyboardButton("📋 查看笔记", callback_data="note_list")],
        [InlineKeyboardButton("📊 统计", callback_data="stats"),
         InlineKeyboardButton("ℹ️ 帮助", callback_data="help")],
    ]
    await update.message.reply_text(
        f"🤖 **智能笔记助手 v3**\n\n"
        f"你好 {user.first_name}！我可以帮你管理笔记。\n"
        f"请选择操作：",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown"
    )

async def quick_note(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Quick note via /note command
    user = update.effective_user
    if not context.args:
        await update.message.reply_text("用法：/note <内容>")
        return

    content = " ".join(context.args)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO notes (user_id, content) VALUES (?, ?)",
        (user.id, content)
    )
    conn.commit()
    count = conn.execute(
        "SELECT COUNT(*) FROM notes WHERE user_id = ?", (user.id,)
    ).fetchone()[0]
    conn.close()

    await update.message.reply_text(f"✅ 已保存！（共 {count} 条笔记）")

async def callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Handle all callback queries
    query = update.callback_query
    await query.answer()
    data = query.data
    uid = query.from_user.id

    if data == "note_new":
        context.user_data["awaiting"] = True
        await query.edit_message_text("📝 请输入笔记内容：")

    elif data == "note_list":
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute(
            "SELECT id, content, created_at FROM notes "
            "WHERE user_id = ? ORDER BY id DESC LIMIT 5",
            (uid,)
        ).fetchall()
        conn.close()

        if not rows:
            await query.edit_message_text("📭 还没有笔记。")
            return

        text = "📋 **最近笔记：**\n\n"
        for r in rows:
            preview = r[1][:50] + ("..." if len(r[1]) > 50 else "")
            text += f"#{r[0]} {preview}\n📅 {r[2]}\n\n"

        await query.edit_message_text(
            text,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🏠 返回", callback_data="home")]
            ]),
            parse_mode="Markdown"
        )

    elif data == "stats":
        conn = sqlite3.connect(DB_PATH)
        u = conn.execute(
            "SELECT command_count, last_active FROM users WHERE user_id = ?",
            (uid,)
        ).fetchone()
        n = conn.execute(
            "SELECT COUNT(*) FROM notes WHERE user_id = ?", (uid,)
        ).fetchone()[0]
        conn.close()

        if u:
            text = (f"📊 **你的统计**\n\n"
                    f"🔹 命令次数：{u[0]}\n"
                    f"🔹 笔记数量：{n}\n"
                    f"🔹 最后活跃：{u[1]}")
        else:
            text = "📊 暂无数据"

        await query.edit_message_text(
            text,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🏠 返回", callback_data="home")]
            ]),
            parse_mode="Markdown"
        )

    elif data == "help":
        keyboard = [[InlineKeyboardButton("🏠 返回", callback_data="home")]]
        await query.edit_message_text(
            "ℹ️ **帮助**\n\n"
            "/start - 主菜单\n"
            "/note <内容> - 快速记笔记\n"
            "/export - 导出所有笔记",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif data == "home":
        keyboard = [
            [InlineKeyboardButton("📝 记笔记", callback_data="note_new"),
             InlineKeyboardButton("📋 查看笔记", callback_data="note_list")],
            [InlineKeyboardButton("📊 统计", callback_data="stats"),
             InlineKeyboardButton("ℹ️ 帮助", callback_data="help")],
        ]
        await query.edit_message_text(
            "🤖 **智能笔记助手**\n\n请选择：",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Handle text when awaiting note input
    if not context.user_data.get("awaiting"):
        await update.message.reply_text("发送 /start 开始使用")
        return

    context.user_data["awaiting"] = False
    uid = update.message.from_user.id
    text = update.message.text

    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO notes (user_id, content) VALUES (?, ?)",
        (uid, text)
    )
    conn.commit()
    conn.close()

    await update.message.reply_text("✅ 笔记已保存！")

async def export_notes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Export all notes as text
    uid = update.effective_user.id
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT id, content, created_at FROM notes WHERE user_id = ? ORDER BY id",
        (uid,)
    ).fetchall()
    conn.close()

    if not rows:
        await update.message.reply_text("📭 没有笔记可导出")
        return

    text = "📤 笔记导出\n" + "=" * 30 + "\n\n"
    for r in rows:
        text += f"#{r[0]} [{r[2]}]\n{r[1]}\n{'-' * 30}\n"

    # Split if too long (Telegram limit: 4096 chars)
    if len(text) > 4000:
        for i in range(0, len(text), 4000):
            await update.message.reply_text(text[i:i+4000])
    else:
        await update.message.reply_text(text)

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    # Global error handler
    logger.error(f"Exception: {context.error}", exc_info=context.error)

def main():
    # Start the bot
    init_db()

    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("note", quick_note))
    app.add_handler(CommandHandler("export", export_notes))
    app.add_handler(CallbackQueryHandler(callback))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, text_handler
    ))
    app.add_error_handler(error_handler)

    # Use polling for development
    print("Bot v3 running (polling)...")
    app.run_polling(drop_pending_updates=True)

    # For production with webhook, use instead:
    # app.run_webhook(
    #     listen="0.0.0.0",
    #     port=PORT,
    #     url_path=TOKEN,
    #     webhook_url=f"{WEBHOOK_URL}/{TOKEN}",
    # )

if __name__ == "__main__":
    main()
```

## 四、执行预览

```
$ python bot_v3.py
2026-04-29 07:00:00 - telegram.ext.Application - INFO - Bot v3 running...
2026-04-29 07:00:01 - telegram.ext.Application - INFO - Starting polling

# User sends /start
2026-04-29 07:01:00 - __main__ - INFO - User john_doe (123456) started bot

# User taps "📝 记笔记"
-> Bot: 📝 请输入笔记内容：

# User types: 今天学习了 Celery 任务队列
-> Bot: ✅ 笔记已保存！

# User taps "📋 查看笔记"
-> Bot:
📋 最近笔记：
#1 今天学习了 Celery 任务队列
📅 2026-04-29 07:01:30

# User sends /export
-> Bot:
📤 笔记导出
==============================
#1 [2026-04-29 07:01:30]
今天学习了 Celery 任务队列
------------------------------
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| Token 安全 | Token 等同于 Bot 密码 | 用环境变量，不要提交到 Git |
| 异步框架 | v20+ 全部基于 asyncio | Handler 必须是 async 函数 |
| 消息长度限制 | 单条消息最多 4096 字符 | 长内容需要分段发送 |
| 速率限制 | Telegram 限制每秒 30 条消息 | 批量发送时注意限速 |
| Polling vs Webhook | Polling 适合开发，Webhook 适合生产 | 生产环境推荐 Webhook |
| 数据持久化 | 内存数据重启丢失 | 使用数据库（SQLite/PostgreSQL） |
| 错误处理 | 未捕获异常会静默失败 | 添加全局 error_handler |
| 用户隐私 | 不要记录敏感用户信息 | 遵守隐私法规 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 | 原因 |
|------------|------------|------|
| Token 硬编码在代码里 | 用 `os.environ["BOT_TOKEN"]` | 安全风险 |
| 用同步函数做 Handler | 全部用 `async def` | v20+ 是异步框架 |
| Callback 不调用 `answer()` | 每个 callback_query 都 answer | 按钮一直转圈 |
| 发送超长消息不截断 | 检查长度，分段发送 | 超过 4096 字符会报错 |
| 内存存用户数据 | 用数据库持久化 | 重启数据丢失 |
| 不处理异常 | 加 error_handler + 日志 | Bot 静默挂掉无感知 |
| edit_message_text 文本相同 | 检查内容是否有变化 | Telegram 报错 "not modified" |

## 七、练习题

🟢 **基础题**：创建一个翻译 Bot，用户发送中文自动回复英文（提示：用 `translate` 库或调用翻译 API）。

```python
from translate import Translator

async def translate_text(update, context):
    translator = Translator(to_lang="en")
    result = translator.translate(update.message.text)
    await update.message.reply_text(result)
```

🟡 **进阶题**：实现一个 TODO Bot，支持添加、查看、完成、删除四个操作，数据存储在 SQLite，使用 Inline Keyboard 交互。

🔴 **挑战题**：开发一个多语言客服 Bot：(1) 自动识别用户语言 (2) 根据语言回复 FAQ (3) 支持转人工 (4) 使用 ConversationHandler 管理多轮对话 (5) Webhook 部署。

## 八、知识点总结

```
Telegram Bot 知识树
├── 基础
│   ├── BotFather 创建 Bot
│   ├── Token 管理
│   └── Handler 注册机制
├── 消息处理
│   ├── CommandHandler（命令）
│   ├── MessageHandler（消息）
│   ├── CallbackQueryHandler（回调）
│   └── ConversationHandler（对话）
├── 交互组件
│   ├── InlineKeyboardMarkup
│   ├── ReplyKeyboardMarkup
│   ├── ForceReply
│   └── 文件/图片/语音发送
├── 部署
│   ├── Polling 模式
│   ├── Webhook 模式
│   ├── Docker 部署
│   └── 日志与监控
└── 高级
    ├── 支付 API
    ├── Inline Mode
    ├── Web App
    └── 频道/群组管理
```

## 九、举一反三

| 场景 | 方案 | 关键技术 |
|------|------|----------|
| 客服机器人 | FAQ 匹配 + 人工转接 | ConversationHandler + NLP |
| 内容订阅 | 定时推送 + InlineKeyboard | APScheduler + 定时任务 |
| 数据查询 Bot | 命令解析 + DB 查询 | SQLAlchemy + 分页显示 |
| 文件处理 Bot | 接收文件 -> 处理 -> 返回 | 文件下载 + 临时文件管理 |
| 群管 Bot | 消息过滤 + 自动踢人 | ChatMemberHandler + 权限管理 |

## 十、参考资料

- [Telegram Bot API 官方文档](https://core.telegram.org/bots/api)
- [python-telegram-bot 文档](https://docs.python-telegram-bot.org/)
- [python-telegram-bot 示例](https://github.com/python-telegram-bot/python-telegram-bot/tree/master/examples)
- [Telegram Bot 最佳实践](https://core.telegram.org/bots/features)

## 十一、代码演进路线

```
v1 (入门)        ->  v2 (交互)         ->  v3 (生产级)
------------------------------------------------------
命令响应            Inline Keyboard       Webhook 部署
纯文本回复          多级菜单导航          SQLite 持久化
内存无状态          user_data 会话        用户追踪统计
无错误处理          部分异常捕获          全局 error_handler
Polling 开发        Polling 开发          日志系统
无日志              print 调试            结构化日志
```
