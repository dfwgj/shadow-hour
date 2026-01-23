<p align="center">
  <img src="apps/App_Resources/Android/src/main/res/mipmap-xhdpi/ic_launcher.png" alt="Shadow Hour" width="96" height="96">
</p>

<h1 align="center">影时 Shadow Hour</h1>

<p align="center">
  基于 NativeScript Vue3 的智能日程管理移动应用
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NativeScript-8.x-3655FF?logo=nativescript" alt="NativeScript">
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js" alt="Vue 3">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## 核心特性

### AI 智能助手

- 支持多 LLM 提供商（OpenAI、Claude、DeepSeek、通义千问、SiliconFlow 等）
- 流式响应，实时对话体验
- MCP 协议工具调用，AI 可直接操作日历和通知

### 日程管理

- 日历事件的增删改查
- 智能日程安排建议
- 本地通知提醒

### 技术架构

- **Monorepo 架构**：Turborepo + pnpm workspace
- **TypeScript 全栈**：类型安全
- **模块化设计**：核心能力抽离为独立包
  - `nativeScript-ai` - LLM 对话引擎、上下文管理、技能系统
  - `nativeScript-http-stream` - 原生 HTTP 流式请求
  - `nativeScript-ui` - 通用 UI 组件库

### 跨平台

- 原生 Android / iOS 应用
- SQLite 本地数据持久化
- 原生推送通知

## 项目结构

```
shadow-hour/
├── apps/                    # 主应用
│   └── src/
│       ├── pages/           # 页面组件
│       ├── services/        # 业务服务
│       └── assets/          # 静态资源
├── packages/
│   ├── nativeScript-ai/     # AI 能力包
│   ├── nativeScript-http-stream/  # HTTP 流式请求
│   └── nativeScript-ui/     # UI 组件库
└── docs/                    # 文档
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- NativeScript CLI
- Android Studio / Xcode

### 安装依赖

```bash
pnpm install
```

### 开发运行

```bash
# Android
cd apps && ns run android

# iOS
cd apps && ns run ios
```

### 构建发布

```bash
cd apps && ns build android --release
```

## 配置说明

在应用内 **AI 设置** 页面配置 LLM 服务商：

| 服务商 | 模型示例 | 说明 |
|--------|----------|------|
| OpenAI | gpt-4o, gpt-4o-mini | 需要 API Key |
| Claude | claude-3-5-sonnet | 需要 API Key |
| DeepSeek | deepseek-chat | 国内可用 |
| SiliconFlow | Qwen/Qwen2.5-7B-Instruct | 国内可用，支持多模型 |

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | NativeScript 8 + Vue 3 |
| 语言 | TypeScript 5 |
| 构建 | Turborepo + Vite |
| 包管理 | pnpm workspace |
| 样式 | TailwindCSS |
| 存储 | SQLite + ApplicationSettings |
| AI | OpenAI API / Anthropic API 兼容 |

## License

[MIT](LICENSE)

## Author

**DF蓝梦 / xierfloat**
