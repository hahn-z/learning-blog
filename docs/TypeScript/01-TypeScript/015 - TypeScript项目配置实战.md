---
title: "015 - TypeScript项目配置实战"
slug: "015-ts-project-config"
category: "TypeScript"
tech_stack: "TypeScript"
created_at: "2026-04-26T17:27:09.656+08:00"
updated_at: "2026-04-29T10:02:46.445+08:00"
reading_time: 27
tags: ["TypeScript"]
---

# TypeScript项目配置实战

> **难度：** ⭐⭐⭐ 进阶级 | **阅读时间：** 约15分钟 | **前置知识：** TypeScript基础、Node.js项目结构

## 一、概念讲解

`tsconfig.json` 是TypeScript项目的核心配置文件，决定了编译器如何处理你的代码。合理的配置能让项目开发体验流畅，避免常见的类型错误，并优化构建性能。

### 核心配置理念

1. **严格模式是底线**：新项目始终开启 `strict: true`
2. **target由运行环境决定**：Node.js用ES2022+，浏览器看兼容性需求
3. **module由构建工具决定**：用webpack/vite选ESNext，纯Node选NodeNext
4. **只配置需要的**：不要从模板复制一堆不了解的选项

## 二、脑图

```
TypeScript项目配置
├── tsconfig.json 结构
│   ├── compilerOptions
│   ├── include / exclude
│   ├── files
│   └── references (项目引用)
├── 核心选项
│   ├── strict 系列
│   ├── target / module
│   ├── moduleResolution
│   ├── esModuleInterop
│   ├── skipLibCheck
│   └── outDir / rootDir
├── 路径映射
│   ├── baseUrl
│   ├── paths
│   └── rootDirs
├── 项目引用
│   ├── composite
│   ├── references
│   └── monorepo配置
├── 构建工具集成
│   ├── webpack (ts-loader)
│   ├── Vite
│   ├── esbuild
│   └── SWC
└── 不同场景配置
    ├── Node.js 应用
    ├── React 前端
    ├── 库开发
    └── Monorepo
```

## 三、完整TypeScript代码

```typescript
// ============================================
// TypeScript Project Configuration - Examples
// ============================================

// --- 1. Base tsconfig.json (shared config) ---
// tsconfig.base.json
/*
{
  "compilerOptions": {
    // Language & Environment
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    // Strict Type Checking
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,

    // Module Resolution
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    // Output
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",

    // Performance
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    // Path Aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@utils/*": ["src/utils/*"],
      "@services/*": ["src/services/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
*/

// --- 2. Node.js Application Config ---
// tsconfig.json (Node.js project)
/*
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
*/

// --- 3. React Frontend Config ---
// tsconfig.json (React project)
/*
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/hooks/*": ["src/hooks/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
*/

// --- 4. Library Development Config ---
// tsconfig.json (library)
/*
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*.ts"]
}
*/

// --- 5. Monorepo with Project References ---
// Root tsconfig.json
/*
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/server" },
    { "path": "packages/web" }
  ]
}
*/

// packages/shared/tsconfig.json
/*
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
*/

// packages/server/tsconfig.json
/*
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "references": [
    { "path": "../shared" }
  ]
}
*/

// --- 6. Environment-specific Config ---
// src/config/env.ts
interface EnvironmentConfig {
  apiUrl: string;
  debug: boolean;
  version: string;
}

const configs: Record<string, EnvironmentConfig> = {
  development: {
    apiUrl: "http://localhost:3000",
    debug: true,
    version: "0.0.1-dev",
  },
  staging: {
    apiUrl: "https://staging-api.example.com",
    debug: false,
    version: "0.0.1-staging",
  },
  production: {
    apiUrl: "https://api.example.com",
    debug: false,
    version: "1.0.0",
  },
};

function getConfig(): EnvironmentConfig {
  const env = process.env.NODE_ENV ?? "development";
  const config = configs[env];
  if (!config) {
    throw new Error(`Unknown environment: ${env}`);
  }
  return config;
}

export const config = getConfig();

// --- 7. Build Scripts (package.json) ---
/*
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "build:clean": "rm -rf dist && tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest",
    "prepublishOnly": "npm run build"
  }
}
*/

// --- 8. ESLint TypeScript Config ---
/*
// eslint.config.js
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
    }
  }
);
*/

// --- 9. Vite + TypeScript Config ---
/*
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
  },
});
*/

// --- 10. Practical: Type-safe config loader ---
interface AppConfig {
  server: {
    port: number;
    host: string;
    cors: {
      origins: string[];
      methods: string[];
    };
  };
  database: {
    url: string;
    poolSize: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
}

function loadConfig(overrides?: DeepPartial<AppConfig>): AppConfig {
  const defaults: AppConfig = {
    server: {
      port: 3000,
      host: "0.0.0.0",
      cors: {
        origins: ["*"],
        methods: ["GET", "POST", "PUT", "DELETE"],
      },
    },
    database: {
      url: process.env.DATABASE_URL ?? "sqlite://localhost",
      poolSize: 10,
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? "dev-secret",
      expiresIn: "7d",
    },
  };

  return deepMerge(defaults, overrides ?? {});
}

type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const val = source[key];
    if (val !== undefined) {
      if (
        typeof val === "object" &&
        val !== null &&
        !Array.isArray(val) &&
        typeof target[key] === "object"
      ) {
        result[key] = deepMerge(
          target[key] as object,
          val as DeepPartial<object>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = val as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

// Usage
const appConfig = loadConfig({
  server: { port: 8080 },
  database: { poolSize: 20 },
});

console.log(`Server: ${appConfig.server.host}:${appConfig.server.port}`);
console.log(`Database pool: ${appConfig.database.poolSize}`);
```

## 四、执行预览

```
$ npx tsc --noEmit
# 编译通过 ✅

$ npx tsc --showConfig | jq '.compilerOptions | {target, module, strict}'
{
  "target": "ES2022",
  "module": "NodeNext",
  "strict": true
}

$ npx ts-node src/config/env.ts
Server: 0.0.0.0:8080
Database pool: 20
```

## 五、注意事项

| 选项 | 说明 | 建议 |
|------|------|------|
| strict | 开启所有严格检查 | 新项目必开，旧项目渐进式开启 |
| target | 编译输出目标 | Node.js用ES2022，浏览器看需求 |
| module | 模块系统 | bundler用ESNext，Node用NodeNext |
| moduleResolution | 模块解析策略 | bundler/Vite用bundler，Node用nodenext |
| skipLibCheck | 跳过.d.ts检查 | 建议开启，加快编译速度 |
| noUncheckedIndexedAccess | 数组索引可能undefined | 强烈建议开启 |

## 六、避坑指南

```
❌ 不开 strict
✅ strict: true + noUncheckedIndexedAccess: true

❌ target 和 module 不匹配
   target: ES5 + module: ESNext (矛盾)
✅ target: ES2022 + module: NodeNext (Node.js)
   target: ES2020 + module: ESNext (前端bundler)

❌ 路径别名在运行时不生效
✅ 搭配 tsconfig-paths / vite alias / webpack alias

❌ include 太宽泛
   "include": ["**/*"]
✅ 精确指定
   "include": ["src/**/*.ts"]

❌ 所有配置放一个 tsconfig.json
✅ 用 extends 继承基础配置，项目引用分割
```

## 七、练习题

### 🟢 入门
1. 从零配置一个Node.js + TypeScript项目的 `tsconfig.json`
2. 配置路径别名 `@/*` → `src/*`

### 🟡 进阶
3. 配置一个monorepo，使用项目引用（references）
4. 为React + Vite项目配置完整的TypeScript环境

### 🔴 挑战
5. 设计一个支持ESM和CJS双格式发布的库的TypeScript配置

## 八、知识点总结

```
TypeScript项目配置
├── compilerOptions
│   ├── 严格模式 → strict + 补充选项
│   ├── 模块 → target + module + moduleResolution
│   ├── 路径 → baseUrl + paths
│   └── 输出 → outDir + declaration + sourceMap
├── 项目结构
│   ├── include/exclude → 文件范围
│   ├── extends → 配置继承
│   └── references → 项目引用
├── 场景配置
│   ├── Node.js → NodeNext
│   ├── React → ESNext + bundler + jsx
│   ├── 库 → declaration + composite
│   └── Monorepo → references
└── 工具链
    ├── Vite → bundler模式
    ├── ESLint → typescript-eslint
    └── 测试 → vitest/ts-jest
```

## 九、举一反三

| 项目类型 | target | module | moduleResolution | 特殊选项 |
|---------|--------|--------|-----------------|---------|
| Node.js CLI | ES2022 | NodeNext | NodeNext | types: ["node"] |
| React SPA | ES2020 | ESNext | bundler | jsx: "react-jsx" |
| 库发布 | ES2020 | ESNext | bundler | declaration: true |
| Monorepo共享包 | ES2022 | ESNext | bundler | composite: true |
| Next.js | ES2022 | ESNext | bundler | jsx: "preserve" |

## 十、参考资料

- [TSConfig Reference](https://www.typescriptlang.org/tsconfig)
- [TypeScript Handbook - Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [typescript-eslint](https://typescript-eslint.io/)

## 十一、代码演进

### v1 → 最小配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "outDir": "./dist",
    "strict": true
  },
  "include": ["src"]
}
```

### v2 → 完整配置 + 路径映射

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "noUncheckedIndexedAccess": true
  }
}
```

### v3 → Monorepo + 项目引用

```json
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/server" },
    { "path": "packages/web" }
  ]
}
```
