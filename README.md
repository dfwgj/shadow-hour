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

## 灵感来源

> *"在影时间中，时间静止，只有觉醒者才能行动。"*

本项目灵感来源于 ATLUS 经典 JRPG 游戏《**女神异闻录 (Persona)**》系列：

- **影时 (Shadow Hour)** - 致敬 P3 中的「影时间」概念，寓意在忙碌生活中找到属于自己的时间
- **时间管理系统** - 借鉴 Persona 系列标志性的日程规划与社群经营玩法
- **AI 伙伴** - 如同游戏中的 Persona，AI 助手将成为你日程管理的得力搭档

*本项目为粉丝致敬作品，与 ATLUS 官方无关。*

---

## 核心特性

### AI 智能助手

- 支持SiliconFlow提供商
- 流式响应，实时对话体验
- MCP 协议工具调用，AI 可直接操作日历和通知
- SKILL协议轻量化实现，按需加载技能

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
  - `nativeScript-ui` - 日历通用 UI 组件库

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

在应用内 **AI 设置** 页面配置SiliconFlow密钥

## 技术栈

| 类别   | 技术                            |
| ------ | ------------------------------- |
| 框架   | NativeScript 8 + Vue 3          |
| 语言   | TypeScript 5                    |
| 构建   | Turborepo + Vite                |
| 包管理 | pnpm workspace                  |
| 样式   | TailwindCSS                     |
| 存储   | SQLite + ApplicationSettings    |
| AI     | OpenAI API / Anthropic API 兼容 |

## License

[MIT](LICENSE)

## Author

**DF蓝梦 / xierfloat**
