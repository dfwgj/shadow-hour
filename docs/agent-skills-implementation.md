# Agent Skills 实现文档

基于 Anthropic Agent Skills 协议的轻量级移动端实现。

## 概述

Agent Skills 是一种将 AI 专业能力模块化的协议。通过结构化的技能定义文件（SKILL.md），可以为 AI 助手动态加载特定领域的专业知识和工作方法。

### 与 MCP Tools 的区别

| 方面   | MCP Tools          | Agent Skills              |
| ------ | ------------------ | ------------------------- |
| 粒度   | 单个函数调用       | 完整的知识包（指令+资源） |
| 上下文 | 固定的 tool schema | 渐进式加载                |
| 复杂度 | 简单任务           | 复杂多步骤任务            |
| 复用性 | 代码级复用         | 知识级复用                |

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                     应用层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   AIChat    │  │   useChat   │  │  其他组件   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Skills 模块                         │   │
│  │  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │  SkillLoader  │  │    SkillRegistry      │   │   │
│  │  │  - loadInline │  │    - register         │   │   │
│  │  │  - loadUrl    │  │    - search           │   │   │
│  │  │  - loadPkg    │  │    - getRelevant      │   │   │
│  │  └───────────────┘  └───────────────────────┘   │   │
│  │                                                  │   │
│  │  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │  SkillParser  │  │    builtinSkills      │   │   │
│  │  │  - parseYaml  │  │    - 日程优化          │   │   │
│  │  │  - toPrompt   │  │    - 会议准备          │   │   │
│  │  └───────────────┘  │    - 周报生成          │   │   │
│  │                     └───────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 文件结构

```
packages/xierfloat-nativeScript-ai/src/skills/
├── types.ts           # 类型定义
├── SkillParser.ts     # SKILL.md 解析器
├── SkillRegistry.ts   # 技能注册表（管理和搜索）
├── SkillLoader.ts     # 技能加载器（多来源支持）
├── builtinSkills.ts   # 内置技能定义
└── index.ts           # 模块导出
```

## SKILL.md 文件格式

技能使用 Markdown 文件定义，包含 YAML frontmatter 元数据：

```markdown
---
name: 技能名称
description: 技能描述
version: 1.0.0
author: 作者
tags: [标签1, 标签2]
priority: 10
enabled: true
---

# 技能标题

## 你的能力

描述 AI 在使用此技能时具备的能力...

## 工作流程

1. 步骤一
2. 步骤二
3. 步骤三

## 示例

用户：...
助手：...
```

### 元数据字段说明

| 字段        | 类型     | 必填 | 说明                  |
| ----------- | -------- | ---- | --------------------- |
| name        | string   | ✅   | 技能名称              |
| description | string   | ✅   | 技能描述              |
| version     | string   | ❌   | 版本号                |
| author      | string   | ❌   | 作者                  |
| tags        | string[] | ❌   | 标签，用于分类和搜索  |
| priority    | number   | ❌   | 优先级（默认 0）      |
| enabled     | boolean  | ❌   | 是否启用（默认 true） |

## 使用方法

### 1. 加载内置技能

```typescript
import { loadSkills, builtinSkills } from "@xierfloat-monorepo/nativeScript-ai";

// 加载所有内置技能
loadSkills(builtinSkills);
```

### 2. 加载自定义技能

```typescript
import { loadSkill } from "@xierfloat-monorepo/nativeScript-ai";

loadSkill({
  id: "my-custom-skill",
  skillMd: `---
name: 我的技能
description: 这是一个自定义技能
tags: [自定义]
---

# 我的技能

## 功能
- 功能1
- 功能2
`
});
```

### 3. 搜索相关技能

```typescript
import { searchSkills } from "@xierfloat-monorepo/nativeScript-ai";

// 根据用户输入搜索相关技能
const skills = searchSkills("帮我优化日程", 3);
// 返回最多 3 个相关技能
```

### 4. 生成技能 Prompt

```typescript
import { getSkillsPrompt } from "@xierfloat-monorepo/nativeScript-ai";

// 根据用户输入自动选择相关技能，生成 Prompt
const skillPrompt = getSkillsPrompt("帮我生成周报", 2);

// 注入到系统提示词
const systemPrompt = `${basePrompt}

${skillPrompt}`;
```

### 5. 使用 SkillLoader 和 SkillRegistry

```typescript
import { createSkillLoader, createSkillRegistry } from "@xierfloat-monorepo/nativeScript-ai";

// 创建独立的注册表和加载器
const registry = createSkillRegistry({ maxCacheSize: 50 });
const loader = createSkillLoader({}, registry);

// 加载技能
loader.loadInline({ id: "skill1", skillMd: "..." });

// 搜索技能
const results = registry.search("日程优化", 5, 0.3);

// 获取统计信息
const stats = registry.getStats();
console.log(`已加载 ${stats.fullLoaded} 个技能`);
```

## 渐进式加载

为了优化性能和内存使用，支持三级渐进式加载：

```typescript
enum SkillLoadLevel {
  METADATA = 1, // 仅元数据（用于搜索索引）
  CONTENT = 2, // 元数据 + 主体内容
  FULL = 3 // 完整内容（含参考资料）
}
```

### Level 1: 元数据

- 仅加载 name、description、tags 等
- 用于快速建立搜索索引
- 内存占用最小

### Level 2: 内容

- 加载 SKILL.md 完整内容
- 用于实际对话中使用技能
- 默认加载级别

### Level 3: 完整

- 加载所有关联资源
- 包括 reference.md 等
- 用于需要详细参考的场景

## 内置技能

| 技能 ID               | 名称     | 描述                       |
| --------------------- | -------- | -------------------------- |
| schedule-optimization | 日程优化 | 分析用户日程并提供优化建议 |
| meeting-preparation   | 会议准备 | 帮助用户准备会议           |
| weekly-review         | 周报生成 | 根据本周日程自动生成周报   |
| time-estimation       | 时间估算 | 帮助用户估算任务所需时间   |

## 集成到 AI Chat

在 AIChat.vue 中集成 Skills：

```typescript
import { loadSkills, builtinSkills, getSkillsPrompt } from "@xierfloat-monorepo/nativeScript-ai";

// 初始化时加载技能
onMounted(() => {
  loadSkills(builtinSkills);
});

// 发送消息时注入相关技能
async function sendMessage() {
  const userInput = inputText.value;

  // 获取相关技能的 Prompt
  const skillPrompt = getSkillsPrompt(userInput, 2);

  // 构建增强的系统提示词
  const enhancedSystemPrompt = skillPrompt ? `${SYSTEM_PROMPT}\n\n${skillPrompt}` : SYSTEM_PROMPT;

  // 发送请求...
}
```

## 创建自定义技能

### 技能设计原则

1. **单一职责**：每个技能专注于一个领域
2. **清晰指令**：明确说明 AI 应该做什么
3. **工作流程**：提供步骤化的执行流程
4. **示例对话**：包含典型的用户-助手对话

### 技能模板

```markdown
---
name: [技能名称]
description: [一句话描述]
version: 1.0.0
tags: [标签1, 标签2]
priority: 5
---

# [技能名称]

## 你的能力

作为[角色]，你能够：

- 能力1
- 能力2
- 能力3

## 工作流程

1. [步骤1]
2. [步骤2]
3. [步骤3]

## 输出格式

[描述期望的输出格式]

## 示例对话

用户：[示例问题]
助手：[示例回答]

## 注意事项

- 注意1
- 注意2
```

## API 参考

### Types

```typescript
interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  priority?: number;
  enabled?: boolean;
}

interface Skill {
  id: string;
  metadata: SkillMetadata;
  content: SkillContent;
  loadedAt: number;
}

interface SkillSearchResult {
  skill: Skill;
  score: number;
  matchedFields: string[];
}
```

### Functions

| 函数                          | 说明                  |
| ----------------------------- | --------------------- |
| `loadSkill(def)`              | 加载单个技能          |
| `loadSkills(defs)`            | 批量加载技能          |
| `searchSkills(query, limit)`  | 搜索技能              |
| `getSkillsPrompt(input, max)` | 获取相关技能的 Prompt |
| `createSkillLoader(config)`   | 创建加载器实例        |
| `createSkillRegistry(config)` | 创建注册表实例        |
| `getSkillLoader()`            | 获取全局加载器        |
| `getSkillRegistry()`          | 获取全局注册表        |

## 未来扩展

- [ ] 支持从远程 URL 加载技能包
- [ ] 技能版本管理和更新
- [ ] 技能使用统计和分析
- [ ] 技能市场/社区共享
- [ ] 技能组合和依赖管理
