# JWT 认证原理与实践

> 分类：Web基础 | 认证授权 | 难度：⭐⭐ | 预估用时：35 分钟

---

## 🎯 学习目标

1. ✅ 能够解释 JWT 的三段式结构和签名验证原理（理解）
2. ✅ 能够用 PyJWT 库签发和验证 Token（应用）
3. ✅ 能够在 FastAPI 中集成 JWT 认证中间件（应用）
4. ✅ 能够识别 JWT 安全风险并实施防御措施（评价）

---

## 📋 前置知识自检

1. **HTTP 无状态是什么意思？**（答不上来？→ 先补 [《11-HTTP协议全解析》](./11-http-协议全解析.md)）
2. **你知道 Base64 编码和加密的区别吗？**（答不上来？本文会讲）
3. **你写过 FastAPI 的依赖注入吗？**（答不上来？→ 先补 [《15-FastAPI入门实战》](./15-fastapi-入门实战.md)）

---

## 💡 概念讲解

- **一句话定义**：JWT（JSON Web Token）是一种无状态的认证令牌，包含签名信息，自验证无需服务器存储会话。
- **现实类比**：JWT 像一张带防伪印章的入场券。印章（签名）由主办方（服务器）盖的，验证处（后端）只要检查印章真伪，就知道票是不是伪造的，不需要查数据库。
- **技术场景**：单点登录、移动端认证、微服务间鉴权、第三方登录（OAuth2）。
- **⚠️ 常见误解**：很多人以为 JWT 的 Payload（载荷）是加密的。其实只是 Base64 编码，任何人都能解码！安全全靠签名验证。

---

## 🧠 实时脑图

```text
[JWT 结构] 🔴
    ||
    ├──→ [Header] 🟢 → {"alg": "HS256", "typ": "JWT"}
    ||
    ├──→ [Payload] 🔴 → {"user_id": 123, "exp": 1700000000}
    ||         │
    │          ├── 标准声明 (iss, sub, exp, iat, jti)
    │          └── 自定义声明 (role, permissions...)
    ||
    ├──→ [Signature] 🔴 → HMACSHA256( header + "." + payload, secret )
    ||         │
    │          ├── HS256 (对称密钥，服务器自己用)
    │          └── RS256 (非对称密钥，第三方验证)
    ||
    └──→ 最终格式: base64(header).base64(payload).base64(signature)

[认证流程] 🔴
    || 用户登录
    ↓
    [服务器签发 JWT] 🔴 → 包含用户信息 + 过期时间 + 签名
    ||
    ↓ (存储客户端)
    [客户端发送请求] 🔴 → Authorization: Bearer <token>
    ||
    ↓
    [服务器验证 JWT] 🔴 → 验证签名 + 验证过期时间 + 提取用户信息
    ||
    └──→ [授权通过/拒绝] 🟢
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | 需安装：`pip install pyjwt[crypto]`

### 1. JWT 基础操作 — 签发与验证

```python
"""JWT 基础：签发、解析、验证"""
import time
import jwt
from datetime import datetime, timedelta
from typing import Dict, Any


# 🔴 生产环境必须用环境变量！
SECRET_KEY = "your-secret-key-change-in-production-!"
ALGORITHM = "HS256"


def create_access_token(data: Dict[str, Any], expires_delta: timedelta = None) -> str:
    """签发 Access Token"""
    to_encode = data.copy()

    # 设置过期时间
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)

    to_encode.update({"exp": expire, "iat": datetime.utcnow()})

    # 🔴 签发
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """验证并解析 Token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token 已过期")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Token 无效: {e}")


# 使用
user_data = {"user_id": 123, "role": "admin", "username": "铁蛋"}

# 签发（默认 15 分钟过期）
token = create_access_token(user_data)
print(f"Token: {token}")

# 解码（Base64 可逆，任何人都能看到）
decoded_raw = jwt.get_unverified_header(token)
decoded_payload = jwt.decode(token, options={"verify_signature": False})
print(f"Payload (不验证签名): {decoded_payload}")

# 验证并解码（会检查签名和过期时间）
try:
    payload = decode_access_token(token)
    print(f"验证通过: {payload}")
except ValueError as e:
    print(f"验证失败: {e}")
```

### 2. 刷新 Token 机制

```python
"""Refresh Token：无感续期"""
import secrets


def create_tokens(user_id: int) -> Dict[str, str]:
    """同时签发 Access Token 和 Refresh Token"""
    # Access Token：短生命周期（15分钟）
    access_token = create_access_token(
        {"user_id": user_id, "type": "access"},
        expires_delta=timedelta(minutes=15)
    )

    # Refresh Token：长生命周期（7天）
    # 🔴 Refresh Token 应该存储在数据库中，用于吊销
    refresh_token = secrets.token_urlsafe(32)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# 生产环境需要数据库存储
refresh_token_store = {}  # 实际应用用 Redis/数据库


def refresh_access_token(refresh_token: str) -> str:
    """用 Refresh Token 换取新的 Access Token"""
    # 1. 验证 Refresh Token 是否有效（查数据库）
    user_id = refresh_token_store.get(refresh_token)
    if not user_id:
        raise ValueError("Refresh Token 无效或已吊销")

    # 2. 签发新的 Access Token
    new_access_token = create_access_token(
        {"user_id": user_id, "type": "access"},
        expires_delta=timedelta(minutes=15)
    )

    # 3. 可选：刷新后重新签发 Refresh Token（提升安全性）
    new_refresh_token = secrets.token_urlsafe(32)
    del refresh_token_store[refresh_token]  # 删除旧的
    refresh_token_store[new_refresh_token] = user_id  # 存新的

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token
    }


# 模拟使用
tokens = create_tokens(123)
refresh_token_store[tokens["refresh_token"]] = 123

# 假设 Access Token 过期了，用 Refresh Token 续期
new_tokens = refresh_access_token(tokens["refresh_token"])
print(f"新 Access Token: {new_tokens['access_token'][:50]}...")
```

### 3. FastAPI 集成 — 完整示例

```python
"""FastAPI 集成 JWT 认证"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

app = FastAPI()
security = HTTPBearer()  # 🔴 从 Authorization: Bearer <token> 提取


# --- 数据模型 ---
class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


# --- 伪造用户数据库 ---
fake_users_db = {
    "admin": {"username": "admin", "password": "secret", "user_id": 1, "role": "admin"},
    "user": {"username": "user", "password": "password", "user_id": 2, "role": "user"},
}


# --- 依赖注入：验证 JWT ---
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """从 Token 中提取用户信息"""
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="无效的 Token")
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    # 🔴 实际应用中应该查询数据库获取完整用户信息
    return {"user_id": user_id, "role": payload.get("role")}


# --- 可选：依赖注入 — 角色检查 ---
async def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)):
    """要求管理员权限"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="权限不足")
    return current_user


# --- 路由 ---
@app.post("/login", response_model=TokenResponse)
async def login(form: UserLogin):
    """用户登录，签发 Token"""
    user = fake_users_db.get(form.username)
    if not user or user["password"] != form.password:
        raise HTTPException(
            status_code=401,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = create_tokens(user["user_id"])
    return tokens


@app.get("/profile")
async def get_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """获取当前用户信息（需要登录）"""
    return {"user": current_user}


@app.get("/admin")
async def admin_panel(current_user: Dict[str, Any] = Depends(require_admin)):
    """管理员面板（需要 admin 角色）"""
    return {"message": "欢迎管理员", "user": current_user}


@app.post("/refresh")
async def refresh_token(refresh_token: str):
    """刷新 Token"""
    try:
        new_tokens = refresh_access_token(refresh_token)
        return new_tokens
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


# 启动: uvicorn 14-jwt-demo:app --reload
```

### 4. 安全增强 — 防御措施

```python
"""JWT 安全最佳实践"""
from jwt import PyJWTError
import os


# 🔴 安全配置
class JWTConfig:
    # 密钥强度：至少 32 字节，使用 secrets 生成
    SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(32)

    # 算法选择：对称用 HS256，非对称用 RS256
    ALGORITHM = "HS256"

    # Access Token 生命周期：越短越安全
    ACCESS_TOKEN_EXPIRE_MINUTES = 15

    # Refresh Token 生命周期：通常 7-30 天
    REFRESH_TOKEN_EXPIRE_DAYS = 7

    # 签发者（iss）用于区分不同服务
    ISSUER = "my-app.example.com"

    # 受众（aud）用于限制 Token 使用范围
    AUDIENCE = "my-app-users"


def create_secure_token(user_id: int, role: str) -> str:
    """签发安全的 Token"""
    now = datetime.utcnow()

    payload = {
        # 标准声明
        "iss": JWTConfig.ISSUER,           # 签发者
        "sub": str(user_id),               # 主题（用户ID）
        "aud": JWTConfig.AUDIENCE,         # 受众
        "iat": int(now.timestamp()),       # 签发时间
        "exp": int((now + timedelta(minutes=JWTConfig.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),  # 过期时间
        "jti": secrets.token_hex(16),      # JWT ID（用于吊销）

        # 自定义声明
        "user_id": user_id,
        "role": role,
    }

    return jwt.encode(payload, JWTConfig.SECRET_KEY, algorithm=JWTConfig.ALGORITHM)


def verify_secure_token(token: str) -> Dict[str, Any]:
    """验证 Token（含 iss/aud/jti 检查）"""
    try:
        payload = jwt.decode(
            token,
            JWTConfig.SECRET_KEY,
            algorithms=[JWTConfig.ALGORITHM],
            issuer=JWTConfig.ISSUER,      # 验证签发者
            audience=JWTConfig.AUDIENCE,  # 验证受众
        )

        # 🔴 可选：检查黑名单（已吊销的 jti）
        jti = payload.get("jti")
        if jti in revoked_tokens:
            raise ValueError("Token 已被吊销")

        return payload

    except PyJWTError as e:
        raise ValueError(f"Token 验证失败: {e}")


# 模拟吊销列表（实际用 Redis）
revoked_tokens = set()


def revoke_token(token: str):
    """吊销 Token（加入黑名单）"""
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        jti = payload.get("jti")
        if jti:
            revoked_tokens.add(jti)
    except:
        pass
```

---

## 👀 执行预览

```bash
$ python 14-jwt-basic.py
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMjMsInJvbGUiOiJhZG1pbiIsInVzZXJuYW1lIjoi6Zi_5beeIiwiZXhwIjoxNzAwMDAwMDAwLCJpYXQiOjE2OTk5OTk5OTl9.xxxxxxxxxxxxxxxxxxxx
Payload (不验证签名): {'user_id': 123, 'role': 'admin', 'username': '铁蛋', 'exp': 1700000000, 'iat': 1699999999}
验证通过: {'user_id': 123, 'role': 'admin', 'username': '铁蛋', 'exp': 1700000000, 'iat': 1699999999}

$ uvicorn 14-jwt-demo:app --reload
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8000

$ curl -X POST http://127.0.0.1:8000/login -H "Content-Type: application/json" -d '{"username":"admin","password":"secret"}'
{
  "access_token": "eyJhbGc...",
  "refresh_token": "xyZ1Ab2c...",
  "token_type": "bearer"
}

$ curl http://127.0.0.1:8000/profile -H "Authorization: Bearer eyJhbGc..."
{"user": {"user_id": 1, "role": "admin"}}
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| **SECRET_KEY 泄露** | 攻击者可伪造任意 Token | 🔴 |
| **使用过弱的算法（如 none）** | 可绕过签名验证 | 🔴 |
| **Payload 不设置 exp 过期时间** | Token 永久有效，无法吊销 | 🔴 |
| **在 Payload 中放敏感信息（密码）** | Base64 可逆，所有人可见 | 🔴 |
| **Access Token 生命周期过长** | Token 被盗后危害期长 | 🟡 |
| **验证时忽略 issuer/audience** | 其他服务签发的 Token 也能用 | 🟡 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 把密码放在 Payload 中 | Base64 解码就能看到 | ✅ 只放 user_id，用 user_id 查数据库获取权限 |
| ❌ 用 `datetime.now()` 而非 `datetime.utcnow()` | 时区问题导致 Token 立即过期 | ✅ 始终用 UTC 时间 |
| ❌ Refresh Token 也用 JWT | 无法吊销，只能等过期 | ✅ 用随机字符串 + 数据库存储，便于吊销 |
| ❌ 签名算法接受 `none` | 可绕过验证 | ✅ 验证时明确指定 `algorithms=["HS256"]` |
| ❌ 前端用 LocalStorage 存 Token | XSS 攻击可窃取 | ✅ 用 HttpOnly Cookie 存储 |

---

## 🔍 调试排查

#### 故障场景1：Token 验证总是失败

**症状**：`jwt.ExpiredSignatureError` 或 `jwt.InvalidTokenError`
**排查思路**：
1. 用 `jwt.decode(token, options={"verify_signature": False})` 查看 Payload
2. 检查 `exp` 时间是否已过期 → 用 `datetime.now(timezone.utc)` 对比
3. 检查 SECRET_KEY 是否与签发时一致

**根因**：最常见是时钟不同步或 SECRET_KEY 不匹配
**修复**：统一服务器时间，确保 SECRET_KEY 环境变量一致

#### 故障场景2：跨服务 Token 验证失败

**症状**：服务 A 签发的 Token，服务 B 验证失败
**排查思路**：
1. 检查两个服务的 SECRET_KEY 是否一致
2. 检查 ALGORITHM 是否一致（HS256 vs RS256）
3. 检查是否有 issuer/audience 限制

**根因**：密钥不一致或算法不匹配
**修复**：统一配置，使用共享密钥库（如 Vault）

---

## 📝 练习题

### 🟢 基础题
1. **解释 JWT 三段式结构的含义**，哪一段是安全的关键？（→ 目标 #1）
2. **写一个函数验证 Token 是否过期**，不抛出异常，返回布尔值（→ 目标 #2）

### 🟡 进阶题
3. **实现一个 JWT 黑名单**，用 Redis 存储，支持吊销 Token（→ 目标 #3）
4. **用 RS256（非对称）实现 JWT**，签名用私钥，验证用公钥（→ 目标 #2）

### 🔴 开放题
5. **比较 JWT vs Session Cookie 的优劣**，什么场景用 JWT？什么场景用 Session？（→ 目标 #4）
6. **设计一个单点登录（SSO）系统**，基于 JWT + Refresh Token 机制（→ 目标 #3）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
JWT (JSON Web Token)
├── 结构
│   ├── Header → 算法、类型 (Base64 编码，不加密)
│   ├── Payload → 用户数据、过期时间 (Base64 编码，不加密)
│   └── Signature → HMACSHA256(header.payload, secret)
├── 标准声明
│   ├── iss (Issuer) → 签发者
│   ├── sub (Subject) → 主题（用户ID）
│   ├── aud (Audience) → 受众
│   ├── exp (Expiration) → 过期时间（必填）
│   ├── iat (Issued At) → 签发时间
│   └── jti (JWT ID) → Token ID（用于吊销）
├── 算法
│   ├── HS256 (HMAC-SHA256) → 对称密钥，服务端自用
│   └── RS256 (RSA-SHA256) → 非对称密钥，第三方验证
├── 认证流程
│   ├── 登录 → 签发 Access Token + Refresh Token
│   ├── 请求 → Authorization: Bearer <token>
│   └── 验证 → 签名 + 过期 + 吊销检查
└── 安全要点
    ├── SECRET_KEY 必须强且保密
    ├── Access Token 短生命周期（15分钟）
    ├── Refresh Token 长生命周期 + 数据库存储
    ├── Payload 不放敏感信息
    └── HttpOnly Cookie 存储（防 XSS）
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 微服务鉴权 | 服务间用 JWT 传递用户身份，免查数据库 |
| 第三方登录 | OAuth2 返回 JWT，前端携带 JWT 访问业务接口 |
| API 密钥 | 用 JWT 生成带过期时间的 API Key |
| 一次性操作 | 在 Payload 中嵌入操作 ID，验证后加入黑名单 |

---

## 🗺️ 学习路径

```
[《12-RESTful API设计原则》] → **📍 本篇：JWT认证** → [《15-FastAPI入门实战》]
                                   ├─→ [《17-FastAPI LLM代理服务》]
                                   └─→ [《26-LLM多模型统一接入》]
```

**下一篇**：
- → [《15-FastAPI入门实战》](./15-fastapi-入门实战.md)：在真实 API 项目中应用 JWT
- → [《17-FastAPI LLM代理服务》](./17-fastapi-llm-代理服务.md)：LLM 服务的认证鉴权设计

**相关主题**：
- [《11-HTTP协议全解析》](./11-http-协议全解析.md)：理解 HTTP 的无状态特性
- [《20-Messages设计》](./20-messages-design.md)：Token 传输的消息格式设计

---

## 🔒 安全考量

| 风险 | 攻击方式 | 防御措施 | 等级 |
|------|----------|----------|------|
| **Secret Key 泄露** | 攻击者伪造 Token | 用环境变量，密钥轮换，使用密钥管理服务 | 🔴 |
| **Payload 明文暴露** | Base64 解码窃取信息 | 不放敏感数据，只放 ID | 🟡 |
| **算法混淆攻击** | 将 `alg` 改为 `none` 绕过验证 | 验证时明确指定 `algorithms` | 🔴 |
| **Token 被盗** | XSS / 中间人攻击 | HttpOnly Cookie，HTTPS，短生命周期 | 🔴 |
| **时间同步问题** | 时区差异导致 Token 立即过期 | 统一用 UTC，NTP 同步 | 🟡 |

---

## ⚔️ 横向对比

| 维度 | JWT | Session Cookie | OAuth2 |
|------|-----|---------------|--------|
| 存储位置 | 客户端 | 服务器 | 第三方 |
| 可扩展性 | 高（无状态） | 低（依赖服务器内存） | 高 |
| 单点登录 | ✅ 支持 | ❌ 不支持 | ✅ 原生支持 |
| Token 吊销 | 难（需黑名单） | 易（删 Session） | 易（撤销授权） |
| 跨域支持 | ✅ 好 | ⚠️ 需 CORS 配置 | ✅ 好 |
| 学习成本 | 低 | 低 | 中 |
| **推荐指数** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

**铁蛋建议**：
- 单体应用：Session Cookie 够用
- 微服务 / 移动端：JWT 首选
- 第三方登录：OAuth2 + JWT

---

## 📚 参考资料

- [JWT.io](https://jwt.io/) [等级：官方工具] — 在线调试 JWT，查看解码结果
- [RFC 7519 - JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519) [等级：权威标准] — JWT 官方规范
- [PyJWT 文档](https://pyjwt.readthedocs.io/) [等级：官方] — Python JWT 库完整文档
- [FastAPI 安全教程](https://fastapi.tiangolo.com/tutorial/security/) [等级：官方] — FastAPI 安全最佳实践

---

## 📝 练习题参考答案

<details>
<summary>点击展开答案</summary>

**1. 答案：** JWT = Header（算法/类型） + Payload（数据） + Signature（签名）。Signature 是安全的关键，由 Header 和 Payload 用密钥签名生成，防止篡改。

**2. 验证过期（不抛异常）：**
```python
import jwt
from datetime import datetime, timezone

def is_token_expired(token: str) -> bool:
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        exp = payload.get("exp")
        if exp is None:
            return True  # 无过期时间视为已过期
        return datetime.now(timezone.utc).timestamp() > exp
    except:
        return True
```

**4. RS256 实现示例：**
```python
from jwt import PyJWKClient

# 签名（私钥）
token = jwt.encode(payload, private_key, algorithm="RS256")

# 验证（公钥）
jwks_client = PyJWKClient("https://example.com/.well-known/jwks.json")
signing_key = jwks_client.get_signing_key_from_jwt(token)
payload = jwt.decode(token, signing_key.key, algorithms=["RS256"])
```

</details>