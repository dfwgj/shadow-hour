# xierfloat-nativeScript-ai AI 智能体包深度解析

> 本文档深入分析 `@xierfloat-monorepo/nativeScript-ai` 包的实现，涵盖 LLM 适配器、MCP 工具系统、技能系统、上下文管理和 Vue Composables 等核心内容。

## 目录

1. [包概述与架构](#1-包概述与架构)
2. [LLM 适配器系统](#2-llm-适配器系统)
3. [MCP 工具系统](#3-mcp-工具系统)
4. [上下文管理系统](#4-上下文管理系统)
5. [技能系统](#5-技能系统)
6. [提示词模板](#6-提示词模板)
7. [存储系统](#7-存储系统)
8. [Vue Composables](#8-vue-composables)
9. [事件总线与流处理](#9-事件总线与流处理)
10. [类型定义](#10-类型定义)
11. [集成示例](#11-集成示例)

---

## 1. 包概述与架构

### 1.1 设计目的

`xierfloat-nativeScript-ai` 是一个为 NativeScript Vue 设计的 AI 智能体 SDK，具有事件驱动架构和 MCP（Model Context Protocol）支持。

### 1.2 核心特性

| 特性        | 说明                                     |
| ----------- | ---------------------------------------- |
| 多 LLM 支持 | OpenAI、Claude、DeepSeek、Qwen 等        |
| 流式响应    | 基于 nativeScript-http-stream 包的实时流 |
| MCP 工具    | 日历、通知、网络搜索、网页抓取           |
| 技能系统    | 可加载的 Markdown 知识模块               |
| 上下文管理  | Token 优化和自动摘要                     |
| Vue 3 集成  | Composition API Composables              |

### 1.3 包结构

```
src/
├── composables/          # Vue 3 Composables
│   ├── useAgent.ts       # 核心智能体状态管理
│   └── useChat.ts        # 聊天 UI 层
├── context/              # 上下文管理
│   └── ContextManager.ts # Token 优化和上下文窗口
├── engine/               # 状态机和事件系统
│   ├── EventBus.ts       # 发布/订阅实现
│   └── MealyMachine.ts   # 流处理状态机
├── llm/                  # LLM 适配器层
│   ├── AdapterRegistry.ts # 工厂模式注册表
│   ├── OpenAIAdapter.ts   # OpenAI 兼容适配器
│   └── AnthropicAdapter.ts # Claude 适配器
├── mcp/                  # MCP 工具
│   ├── ToolRegistry.ts   # 工具管理
│   └── tools/
│       ├── CalendarTool.ts
│       ├── NotificationTool.ts
│       ├── WebSearchTool/
│       └── WebFetchTool/
├── prompt/               # 提示词模板
│   └── templates.ts      # 系统提示词
├── skills/               # 技能系统
│   ├── SkillRegistry.ts
│   ├── SkillParser.ts
│   ├── SkillLoader.ts
│   └── builtinSkills.ts
├── storage/              # 持久化层
│   ├── ConfigRepository.ts
│   └── SessionRepository.ts
└── types/                # TypeScript 定义
    ├── config.ts
    ├── event.ts
    ├── message.ts
    ├── tool.ts
    └── processor.ts
```

### 1.4 导出 API

```typescript
// LLM 相关
export type { LLMAdapter, ChatRequest, ChatResponse, StreamCallback, StreamController } from "./llm";
export { OpenAIAdapter, AnthropicAdapter, getAdapterRegistry, createLLMAdapter } from "./llm";

// MCP 工具
export { ToolRegistryImpl, getToolRegistry, createToolRegistry } from "./mcp";
export {
  type CalendarDataAccess,
  createCalendarTools,
  type NotificationService,
  createNotificationTools,
  type WebSearchService,
  createWebSearchTools,
  createWebFetchTools
} from "./mcp";

// 上下文管理
export { ContextManager, createContextManager } from "./context";

// 技能系统
export { SkillRegistry, SkillLoader, getSkillRegistry, getSkillLoader } from "./skills";
export { builtinSkillPackage } from "./skills";

// 提示词
export { SCHEDULER_EXPERT_PROMPT, GENERAL_ASSISTANT_PROMPT, getSchedulerPrompt } from "./prompt";

// Composables
export { useAgent, useChat } from "./composables";

// 事件系统
export { EventBus, createEventBus, MealyMachine, streamProcessor } from "./engine";
```

---

## 2. LLM 适配器系统

### 2.1 核心接口

```typescript
// llm/types.ts
export interface LLMAdapter {
  readonly name: string;
  readonly supportsStreaming: boolean;
  readonly supportsTools: boolean;
  readonly supportsVision: boolean;

  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest, callback: StreamCallback): StreamController;
  validateConfig(): Promise<{ valid: boolean; error?: string }>;
  estimateTokens?(text: string): number;
}

export interface ChatRequest {
  messages: Message[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}
```

### 2.2 适配器注册表

```typescript
// llm/AdapterRegistry.ts
class AdapterRegistryImpl implements LLMAdapterRegistry {
  private factories = new Map<string, LLMAdapterFactory>();

  private registerBuiltinAdapters(): void {
    // OpenAI 兼容提供商
    const openaiCompatible = ["openai", "deepseek", "qwen", "moonshot", "zhipu", "ollama", "custom"];
    for (const provider of openaiCompatible) {
      this.factories.set(provider, createOpenAIAdapter);
    }
    this.factories.set("anthropic", createAnthropicAdapter);
  }

  create(config: LLMConfig): LLMAdapter {
    const factory = this.factories.get(config.provider);
    if (!factory) {
      throw new Error(`Unknown provider: ${config.provider}`);
    }
    return factory(config);
  }
}

export const getAdapterRegistry = () => AdapterRegistryImpl.getInstance();
export const createLLMAdapter = (config: LLMConfig) => getAdapterRegistry().create(config);
```

### 2.3 LLM 预设配置

```typescript
// types/config.ts
export const LLM_PRESETS: Record<string, LLMConfigPreset> = {
  "gpt-4o": {
    name: "GPT-4o",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true
  },
  "claude-3-5-sonnet": {
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true
  },
  "deepseek-v3": {
    name: "DeepSeek V3",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat"
    // ...
  },
  "qwen-max": {
    name: "Qwen Max",
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-max"
    // ...
  }
};
```

### 2.4 OpenAI 适配器实现

```typescript
// llm/OpenAIAdapter.ts
export class OpenAIAdapter implements LLMAdapter {
  readonly name = "OpenAI";
  readonly supportsStreaming = true;
  readonly supportsTools: boolean;
  readonly supportsVision: boolean;

  constructor(private config: LLMConfig) {
    this.supportsTools = config.supportsTools ?? true;
    this.supportsVision = config.supportsVision ?? false;
  }

  stream(request: ChatRequest, callback: StreamCallback): StreamController {
    const { controller, promise } = streamRequest(
      {
        url: `${this.config.baseUrl}/chat/completions`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: this.buildRequestBody(request)
      },
      {
        onData: line => {
          // 解析 SSE 格式
          if (!line.startsWith("data: ")) return;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            callback({ type: "message_stop", stopReason: this.stopReason });
            return;
          }

          const data = JSON.parse(jsonStr);
          const delta = data.choices?.[0]?.delta;

          // 文本增量
          if (delta?.content) {
            callback({ type: "text_delta", text: delta.content });
          }

          // 工具调用
          if (delta?.tool_calls) {
            this.handleToolCallDelta(delta.tool_calls, callback);
          }
        },
        onError: err => callback({ type: "stream_error", error: err }),
        onComplete: () => {}
      }
    );

    return controller;
  }

  estimateTokens(text: string): number {
    // 中文约 2 字符 = 1 token
    // 英文约 4 字符 = 1 token
    const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length || 0;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }
}
```

### 2.5 Anthropic 适配器实现

```typescript
// llm/AnthropicAdapter.ts
export class AnthropicAdapter implements LLMAdapter {
  readonly name = "Anthropic";
  readonly supportsStreaming = true;
  readonly supportsTools = true;
  readonly supportsVision = true;

  private convertMessages(messages: Message[]): AnthropicMessage[] {
    // Anthropic 使用 content blocks 格式
    return messages.map(msg => ({
      role: msg.role === "tool" ? "user" : msg.role,
      content: this.convertContent(msg)
    }));
  }

  private convertContent(msg: Message): AnthropicContent[] {
    const blocks: AnthropicContent[] = [];

    for (const part of msg.content) {
      if (part.type === "text") {
        blocks.push({ type: "text", text: part.text });
      } else if (part.type === "image") {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: part.mimeType || "image/jpeg",
            data: part.url.replace(/^data:.*?;base64,/, "")
          }
        });
      }
    }

    // 工具结果
    if (msg.toolResults) {
      for (const result of msg.toolResults) {
        blocks.push({
          type: "tool_result",
          tool_use_id: result.toolCallId,
          content: result.content,
          is_error: result.isError
        });
      }
    }

    return blocks;
  }
}
```

---

## 3. MCP 工具系统

### 3.1 核心类型

```typescript
// types/tool.ts
export interface ToolDefinition {
  name: string; // 唯一标识符
  displayName?: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, ToolParameterType>;
    required?: string[];
  };
  category?: string;
  dangerous?: boolean; // 需要确认
}

export interface ToolHandler {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolExecutionResult>;
  validate?(args: Record<string, unknown>): { valid: boolean; errors?: string[] };
}

export interface ToolContext {
  sessionId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionResult {
  success: boolean;
  content: string; // JSON 字符串结果
  error?: string;
  duration?: number; // 执行时间（毫秒）
  metadata?: Record<string, unknown>;
}
```

### 3.2 工具注册表

```typescript
// mcp/ToolRegistry.ts
export class ToolRegistryImpl implements ToolRegistry {
  private handlers = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void {
    this.handlers.set(handler.definition.name, handler);
  }

  async execute(name: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolExecutionResult> {
    const handler = this.handlers.get(name);
    if (!handler) {
      return {
        success: false,
        content: "",
        error: `Tool not found: ${name}`
      };
    }

    // 参数验证
    if (handler.validate) {
      const validation = handler.validate(args);
      if (!validation.valid) {
        return {
          success: false,
          content: "",
          error: validation.errors?.join(", ")
        };
      }
    }

    const startTime = Date.now();
    try {
      const result = await handler.execute(args, context);
      result.duration = Date.now() - startTime;
      return result;
    } catch (error: any) {
      return {
        success: false,
        content: "",
        error: error.message || String(error),
        duration: Date.now() - startTime
      };
    }
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.handlers.values()).map(h => h.definition);
  }
}

// 全局单例
export const getToolRegistry = () => ToolRegistryImpl.getInstance();
```

### 3.3 日历工具

```typescript
// mcp/tools/CalendarTool.ts
export interface CalendarDataAccess {
  query(params: CalendarQueryParams): Promise<CalendarEvent[]>;
  create(params: CalendarCreateParams): Promise<CalendarEvent>;
  update(params: CalendarUpdateParams): Promise<CalendarEvent>;
  delete(id: string): Promise<void>;
  batchCreate?(params: CalendarCreateParams[]): Promise<CalendarEvent[]>;
  batchDelete?(ids: string[]): Promise<void>;
}

export const calendarQueryDefinition: ToolDefinition = {
  name: "calendar_query",
  displayName: "查询日程",
  description: "查询日历中的日程事件。可按日期范围、关键词、分类等条件筛选。",
  inputSchema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "ISO 格式，如 2024-01-01" },
      endDate: { type: "string", description: "ISO 格式" },
      keyword: { type: "string", description: "搜索关键词" },
      category: { type: "string", description: "事件分类" },
      limit: { type: "number", description: "返回数量限制", default: 20 }
    }
  },
  category: "calendar"
};

export const calendarCreateDefinition: ToolDefinition = {
  name: "calendar_create",
  displayName: "创建日程",
  description: "创建新的日程事件。",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "事件标题" },
      startTime: { type: "string", description: "开始时间（ISO 格式）" },
      endTime: { type: "string", description: "结束时间" },
      description: { type: "string" },
      location: { type: "string" },
      category: { type: "string" },
      reminder: { type: "number", description: "提前提醒分钟数" }
    },
    required: ["title", "startTime"]
  },
  category: "calendar"
};

export function createCalendarTools(dataAccess: CalendarDataAccess): ToolHandler[] {
  return [
    createCalendarQueryHandler(dataAccess),
    createCalendarCreateHandler(dataAccess),
    createCalendarUpdateHandler(dataAccess),
    createCalendarDeleteHandler(dataAccess),
    createCalendarBatchCreateHandler(dataAccess),
    createCalendarBatchDeleteHandler(dataAccess)
  ];
}
```

### 3.4 通知工具

```typescript
// mcp/tools/NotificationTool.ts
export interface NotificationService {
  send(params: NotificationSendParams): Promise<void>;
  schedule(params: NotificationScheduleParams): Promise<string>;
  cancel(notificationId: string): Promise<void>;
  cancelAll(): Promise<void>;
  getScheduled(): Promise<ScheduledNotification[]>;
}

export function createNotificationScheduleHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationScheduleDefinition,
    async execute(args, context): Promise<ToolExecutionResult> {
      const params = args as NotificationScheduleParams;

      // 智能时间解析 - 处理本地时间
      let scheduledDate: Date;
      const scheduledAt = params.scheduledAt;

      if (scheduledAt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)) {
        // ISO 格式无时区，解析为本地时间
        const [datePart, timePart] = scheduledAt.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute, second = 0] = timePart.split(":").map(Number);
        scheduledDate = new Date(year, month - 1, day, hour, minute, second);
      } else {
        scheduledDate = new Date(scheduledAt);
      }

      // 验证时间是否有效
      if (isNaN(scheduledDate.getTime())) {
        return { success: false, content: "", error: `无效的时间格式: ${scheduledAt}` };
      }

      // 验证时间是否在未来
      if (scheduledDate.getTime() <= Date.now()) {
        return { success: false, content: "", error: `调度时间必须是未来时间` };
      }

      const notificationId = await service.schedule(params);
      return {
        success: true,
        content: JSON.stringify(
          {
            message: "通知已调度",
            notificationId,
            scheduledAt: scheduledDate.toLocaleString()
          },
          null,
          2
        )
      };
    }
  };
}
```

### 3.5 网络搜索工具

```typescript
// mcp/tools/WebSearchTool/WebSearchTool.ts
export interface WebSearchParams {
  engine?: string; // 'bing' | 'searxng' | 'wechat'
  query: string;
  limit?: number;
}

function getSearchService(engine: string, config?: WebSearchConfig): WebSearchService {
  switch (engine) {
    case "searxng":
      return new SearXNGSearchService(config?.searxng);
    case "wechat":
      return new WechatSogouSearchService();
    case "bing":
    default:
      return new BingCNSearchService();
  }
}

// Bing CN 搜索实现
export class BingCNSearchService implements WebSearchService {
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": MOBILE_USER_AGENT }
    });
    const html = await response.text();
    return this.parseResults(html, limit);
  }

  private parseResults(html: string, limit: number): SearchResult[] {
    // 解析 HTML 提取搜索结果
    // 标题、URL、摘要
  }
}

// SearXNG 元搜索实现
export class SearXNGSearchService implements WebSearchService {
  constructor(private config?: SearXNGConfig) {}

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const baseUrl = this.config?.baseUrl || "https://searx.example.com";
    const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    return data.results.slice(0, limit).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content
    }));
  }
}
```

### 3.6 网页抓取工具

```typescript
// mcp/tools/WebFetchTool/WebFetchTool.ts
export class WebFetchService {
  async fetch(url: string): Promise<WebFetchResult> {
    // 验证 URL
    if (!this.isValidUrl(url)) {
      throw new Error("Invalid URL");
    }

    const response = await fetch(url, {
      headers: { "User-Agent": MOBILE_USER_AGENT }
    });

    const contentType = response.headers.get("content-type") || "";
    const content = await response.text();
    const detectedType = this.detectContentType(contentType, content);

    let processedContent: string;
    let title: string | undefined;

    if (detectedType === "html") {
      processedContent = this.htmlToMarkdown(content);
      title = this.extractTitle(content);
    } else if (detectedType === "json") {
      processedContent = JSON.stringify(JSON.parse(content), null, 2);
    } else {
      processedContent = content;
    }

    // 限制 100KB
    if (processedContent.length > 100000) {
      processedContent = processedContent.slice(0, 100000) + "\n\n[内容已截断]";
    }

    return {
      url,
      title,
      content: processedContent,
      contentType: detectedType
    };
  }

  private htmlToMarkdown(html: string): string {
    // 移除脚本、样式、导航等
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    // 使用 Turndown 转换为 Markdown
    const turndown = new TurndownService();
    return turndown.turndown(cleaned);
  }
}
```

---

## 4. 上下文管理系统

### 4.1 配置接口

```typescript
// context/ContextManager.ts
export interface ContextManagerConfig {
  maxTokens: number; // 默认: 8000
  reserveRecentMessages: number; // 保留最近 N 条 (默认: 5)
  summaryThreshold: number; // 百分比 (默认: 0.8 = 80%)
  enableAutoSummary: boolean; // 默认: true
}

export interface ContextWindow {
  messages: Message[];
  tokenCount: number;
  isSummarized: boolean;
  summary?: string;
}
```

### 4.2 上下文管理器实现

```typescript
export class ContextManager {
  constructor(
    private config: ContextManagerConfig = {
      maxTokens: 8000,
      reserveRecentMessages: 5,
      summaryThreshold: 0.8,
      enableAutoSummary: true
    }
  ) {}

  getContextWindow(messages: Message[], systemPrompt?: string): ContextWindow {
    const systemTokens = systemPrompt ? this.estimateTokens(systemPrompt) : 0;
    const availableTokens = this.config.maxTokens - systemTokens;

    const result: Message[] = [];
    let totalTokens = 0;

    // 1. 始终包含最近 N 条消息
    const recentMessages = messages.slice(-this.config.reserveRecentMessages);
    for (const msg of recentMessages) {
      const tokens = this.estimateMessageTokens(msg);
      result.unshift(msg);
      totalTokens += tokens;
    }

    // 2. 从后向前填充剩余空间
    const olderMessages = messages.slice(0, -this.config.reserveRecentMessages);
    for (let i = olderMessages.length - 1; i >= 0 && totalTokens < availableTokens; i--) {
      const msg = olderMessages[i];
      const tokens = this.estimateMessageTokens(msg);
      if (totalTokens + tokens <= availableTokens) {
        result.unshift(msg);
        totalTokens += tokens;
      }
    }

    return {
      messages: result,
      tokenCount: totalTokens,
      isSummarized: result.length < messages.length
    };
  }

  needsSummary(messages: Message[], systemPrompt?: string): boolean {
    if (!this.config.enableAutoSummary) return false;
    const totalTokens = this.estimateTotalTokens(messages, systemPrompt);
    return totalTokens > this.config.maxTokens * this.config.summaryThreshold;
  }

  async generateSummary(messages: Message[], adapter: LLMAdapter): Promise<string> {
    const summaryPrompt = `请简洁总结以下对话的主要内容和关键信息：\n\n${messages
      .map(m => `${m.role}: ${getMessageText(m)}`)
      .join("\n")}`;

    const response = await adapter.chat({
      messages: [{ role: "user", content: [{ type: "text", text: summaryPrompt }] }],
      maxTokens: 500
    });

    return getMessageText(response.message);
  }

  estimateMessageTokens(message: Message): number {
    let tokens = 0;

    for (const part of message.content) {
      if (part.type === "text") {
        tokens += this.estimateTokens(part.text);
      } else if (part.type === "image") {
        tokens += 85; // 图片固定 85 tokens
      } else if (part.type === "file" && part.extractedText) {
        tokens += this.estimateTokens(part.extractedText);
      }
    }

    // 工具调用
    if (message.toolCalls) {
      tokens += this.estimateTokens(JSON.stringify(message.toolCalls));
    }

    // 工具结果
    if (message.toolResults) {
      for (const result of message.toolResults) {
        tokens += this.estimateTokens(result.content);
      }
    }

    return tokens;
  }

  private estimateTokens(text: string): number {
    const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length || 0;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }
}
```

---

## 5. 技能系统

### 5.1 核心类型

```typescript
// skills/types.ts
export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  priority?: number; // 越高优先级越高
  enabled?: boolean;
}

export interface SkillContent {
  main: string; // SKILL.md 主内容
  reference?: string; // 可选 reference.md
  resources?: Record<string, string>; // 附加资源
}

export interface Skill {
  id: string;
  metadata: SkillMetadata;
  content: SkillContent;
  loadedAt: number;
}

export enum SkillLoadLevel {
  METADATA = 1, // 仅元数据
  CONTENT = 2, // 元数据 + 主内容
  FULL = 3 // 完整 + 引用
}

export interface SkillSearchResult {
  skill: Skill;
  score: number; // 0-1
  matchedFields: string[]; // name, description, tags, content
}
```

### 5.2 技能解析器

```typescript
// skills/SkillParser.ts
const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

export function parseSkill(rawData: SkillRawData): Skill {
  const match = rawData.skillMd.match(frontmatterRegex);
  if (!match) {
    throw new Error("Invalid skill format: missing YAML frontmatter");
  }

  const [, yamlStr, content] = match;
  const metadata = parseYaml(yamlStr);

  // 验证必需字段
  if (!metadata.name || !metadata.description) {
    throw new Error("Skill must have name and description");
  }

  return {
    id: rawData.id,
    metadata: {
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      author: metadata.author,
      tags: metadata.tags || [],
      priority: metadata.priority ?? 0,
      enabled: metadata.enabled ?? true
    },
    content: {
      main: content.trim(),
      reference: rawData.referenceMd
    },
    loadedAt: Date.now()
  };
}

export function skillToPrompt(skill: Skill, includeReference?: boolean): string {
  let prompt = `## 技能: ${skill.metadata.name}\n`;
  prompt += `> ${skill.metadata.description}\n\n`;
  prompt += skill.content.main;

  if (includeReference && skill.content.reference) {
    prompt += `\n\n### 参考资料\n${skill.content.reference}`;
  }

  return prompt;
}

export function skillsToPrompt(skills: Skill[], includeReference?: boolean): string {
  return skills.map(s => skillToPrompt(s, includeReference)).join("\n\n---\n\n");
}
```

### 5.3 技能注册表

```typescript
// skills/SkillRegistry.ts
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private metadataIndex: Map<string, SkillMetadata> = new Map();

  register(rawData: SkillRawData): Skill {
    const skill = parseSkill(rawData);
    return this.registerSkill(skill);
  }

  registerSkill(skill: Skill): Skill {
    // 检查缓存大小
    if (this.skills.size >= this.config.maxCacheSize) {
      // 移除最早加载的技能
      const oldest = Array.from(this.skills.entries()).sort((a, b) => a[1].loadedAt - b[1].loadedAt)[0];
      if (oldest) {
        this.skills.delete(oldest[0]);
        this.metadataIndex.delete(oldest[0]);
      }
    }

    this.skills.set(skill.id, skill);
    this.metadataIndex.set(skill.id, skill.metadata);
    return skill;
  }

  search(query: string, limit = 5, threshold = 0.3): SkillSearchResult[] {
    const results: SkillSearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const skill of this.skills.values()) {
      if (!skill.metadata.enabled) continue;

      const matchedFields: string[] = [];
      let maxScore = 0;

      // 匹配名称
      const nameScore = calculateSimilarity(skill.metadata.name, queryLower);
      if (nameScore > 0) {
        matchedFields.push("name");
        maxScore = Math.max(maxScore, nameScore);
      }

      // 匹配描述
      const descScore = calculateSimilarity(skill.metadata.description, queryLower);
      if (descScore > 0) {
        matchedFields.push("description");
        maxScore = Math.max(maxScore, descScore * 0.8);
      }

      // 匹配标签
      for (const tag of skill.metadata.tags || []) {
        const tagScore = calculateSimilarity(tag, queryLower);
        if (tagScore > 0) {
          matchedFields.push(`tag:${tag}`);
          maxScore = Math.max(maxScore, tagScore * 0.9);
        }
      }

      // 匹配内容
      if (skill.content.main.toLowerCase().includes(queryLower)) {
        matchedFields.push("content");
        maxScore = Math.max(maxScore, 0.5);
      }

      if (maxScore >= threshold) {
        const finalScore = maxScore + (skill.metadata.priority ?? 0) * 0.01;
        results.push({ skill, score: finalScore, matchedFields });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  getRelevantSkillsPrompt(userInput: string, maxSkills = 3): string {
    const results = this.search(userInput, maxSkills);
    if (results.length === 0) return "";
    return skillsToPrompt(results.map(r => r.skill));
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1; // 完全匹配
  if (s1.includes(s2) || s2.includes(s1)) return 0.8; // 包含匹配

  // 分词匹配
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  let matchCount = 0;

  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1.includes(w2) || w2.includes(w1)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / Math.max(words1.length, words2.length);
}
```

### 5.4 内置技能

```typescript
// skills/builtinSkills.ts

// 1. Aigis 大脑 - 角色知识库示例
export const aigisBrainSkill: InlineSkillDefinition = {
  id: "aigis-brain",
  skillMd: `---
name: Aigis 角色知识
description: 女神异闻录3 埃癸斯角色完整信息
tags: [角色, P3, Aigis]
priority: 10
---

# Aigis 完整资料

## 基本信息
- 全名: Aigis (アイギス)
- 身份: 反阴影特殊武器
- 制造商: 桐条集团

## 战斗能力
- Persona: Athena / Palladion
- 专长: 物理攻击、支援技能
...`
};

// 2. 日程优化
export const scheduleOptimizationSkill: InlineSkillDefinition = {
  id: "schedule-optimization",
  skillMd: `---
name: 日程优化
description: 分析用户日程并提供优化建议
tags: [日程, 优化, 时间管理]
priority: 10
---

# 日程优化技能

## 分析维度
1. 日程密度分析
2. 时间冲突检测
3. 精力曲线匹配
4. 缓冲时间建议

## 使用工具
- calendar_query 获取日程
- 分析并生成建议
...`
};

// 3. 会议准备
export const meetingPreparationSkill = {
  /* ... */
};

// 4. 周报生成
export const weeklyReviewSkill = {
  /* ... */
};

// 5. 时间估算
export const timeEstimationSkill = {
  /* ... */
};

// 内置技能包
export const builtinSkillPackage: SkillPackage = {
  name: "builtin-skills",
  version: "1.0.0",
  skills: [aigisBrainSkill, scheduleOptimizationSkill, meetingPreparationSkill, weeklyReviewSkill, timeEstimationSkill]
};
```

---

## 6. 提示词模板

```typescript
// prompt/templates.ts

export const SCHEDULER_EXPERT_PROMPT = `你是一位专业的日程规划助手，具备以下能力：

## 核心能力
1. **日程管理** - 创建、查询、修改和删除日程事件
2. **时间规划** - 分析用户的时间安排，发现冲突和优化空间
3. **自然语言理解** - 理解"明天下午"、"下周一"等相对时间表达

## 可用工具
- \`calendar_query\` - 查询日程
- \`calendar_create\` - 创建日程
- \`calendar_update\` - 更新日程
- \`calendar_delete\` - 删除日程
- \`notification_schedule\` - 设置提醒
- \`web_search\` - 搜索信息

## 交互原则
1. **主动确认** - 创建日程前确认时间、标题等关键信息
2. **智能推断** - 根据上下文推断缺失的信息
3. **冲突检测** - 创建前检查时间是否冲突
4. **友好提醒** - 操作后清晰报告结果

## 日期时间处理
- 当前时间: {currentTime}
- 所有时间转换为 ISO 8601 格式
- 默认事件时长: 1 小时
- 默认提醒时间: 提前 15 分钟

请用友好、专业的方式帮助用户管理日程。`;

export const GENERAL_ASSISTANT_PROMPT = `你是一位智能助手，可以帮助用户完成各种任务。
请用简洁、专业的方式回答问题。`;

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`);
}

export function getSchedulerPrompt(currentTime?: Date): string {
  return renderTemplate(SCHEDULER_EXPERT_PROMPT, {
    currentTime: (currentTime ?? new Date()).toLocaleString("zh-CN")
  });
}

export const PromptTemplates = {
  scheduler: SCHEDULER_EXPERT_PROMPT,
  general: GENERAL_ASSISTANT_PROMPT
} as const;
```

---

## 7. 存储系统

```typescript
// storage/ConfigRepository.ts

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private data = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export interface ConfigRepository {
  getAll(): Promise<LLMConfig[]>;
  get(id: string): Promise<LLMConfig | null>;
  save(config: LLMConfig): Promise<void>;
  delete(id: string): Promise<void>;
  getDefault(): Promise<LLMConfig | null>;
  setDefault(id: string): Promise<void>;
}

export class ConfigRepositoryImpl implements ConfigRepository {
  private storage: StorageAdapter;
  private readonly CONFIGS_KEY = "llm_configs";
  private readonly DEFAULT_KEY = "default_llm_config_id";

  async save(config: LLMConfig): Promise<void> {
    const configs = await this.getAll();
    const existingIndex = configs.findIndex(c => c.id === config.id);

    const now = Date.now();
    if (existingIndex >= 0) {
      configs[existingIndex] = { ...config, updatedAt: now };
    } else {
      configs.push({ ...config, createdAt: now, updatedAt: now });
    }

    await this.storage.setItem(this.CONFIGS_KEY, JSON.stringify(configs));
  }

  async setDefault(id: string): Promise<void> {
    const configs = await this.getAll();
    const updated = configs.map(c => ({
      ...c,
      isDefault: c.id === id
    }));
    await this.storage.setItem(this.CONFIGS_KEY, JSON.stringify(updated));
    await this.storage.setItem(this.DEFAULT_KEY, id);
  }
}

export function createConfigRepository(storage: StorageAdapter): ConfigRepository {
  return new ConfigRepositoryImpl(storage);
}
```

---

## 8. Vue Composables

### 8.1 useAgent

```typescript
// composables/useAgent.ts

export interface AgentOptions {
  config: LLMConfig;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  contextConfig?: { maxTokens?: number; reserveRecentMessages?: number };
  onEvent?: (event: AgentEvent) => void;
}

export interface UseAgentReturn {
  // 响应式状态
  state: Ref<AgentState>; // 'idle' | 'thinking' | 'responding' | 'tool_calling' | 'interrupted' | 'error'
  messages: Ref<Message[]>;
  session: Ref<Session | null>;
  isProcessing: ComputedRef<boolean>;
  canSend: ComputedRef<boolean>;
  streamingText: Ref<string>;
  error: Ref<string | null>;

  // 方法
  send(content: string): Promise<void>;
  abort(): void;
  clear(): void;
  regenerate(): Promise<void>;
  subscribe(handler: (event: AgentEvent) => void): () => void;
  updateConfig(config: LLMConfig): void;
  updateSystemPrompt(prompt: string): void;
}

export function useAgent(options: AgentOptions): UseAgentReturn {
  const state = ref<AgentState>("idle");
  const messages = ref<Message[]>([]);
  const streamingText = ref("");
  const error = ref<string | null>(null);

  let adapter: LLMAdapter = createLLMAdapter(options.config);
  let systemPrompt = options.systemPrompt ?? "";
  const eventBus = createEventBus();
  const contextManager = createContextManager(options.contextConfig);
  const stateMachine = createStreamMachine();

  const isProcessing = computed(() => ["thinking", "responding", "tool_calling"].includes(state.value));
  const canSend = computed(() => state.value === "idle" || state.value === "error");

  async function send(content: string): Promise<void> {
    if (!canSend.value) return;

    // 创建用户消息
    const userMessage = createTextMessage("user", content);
    messages.value.push(userMessage);

    eventBus.emit({ type: "user_message", data: userMessage });

    await processLLMRequest();
  }

  async function processLLMRequest(): Promise<void> {
    state.value = "thinking";
    streamingText.value = "";
    error.value = null;

    try {
      // 获取上下文窗口
      const context = contextManager.getContextWindow(messages.value, systemPrompt);

      // 获取工具定义
      const tools = getToolRegistry().getDefinitions();

      // 开始流式请求
      const controller = adapter.stream(
        {
          messages: context.messages,
          systemPrompt,
          tools: tools.length > 0 ? tools : undefined
        },
        event => {
          // 通过状态机处理事件
          const outputs = stateMachine.process(event);

          for (const output of outputs) {
            eventBus.emit(output);

            if (output.type === "text_delta") {
              streamingText.value += output.text;
            } else if (output.type === "state_change") {
              state.value = output.state;
            }
          }
        }
      );

      streamController = controller;

      // 等待完成
      await new Promise<void>((resolve, reject) => {
        eventBus.once(event => {
          if (event.type === "message_stop") {
            if (event.stopReason === "tool_use") {
              executeToolCalls(stateMachine.getState().pendingToolCalls).then(resolve).catch(reject);
            } else {
              finalizeAssistantMessage();
              resolve();
            }
          } else if (event.type === "stream_error") {
            reject(new Error(event.error));
          }
        });
      });
    } catch (err: any) {
      state.value = "error";
      error.value = err.message;
      eventBus.emit({ type: "stream_error", error: err.message });
    }
  }

  async function executeToolCalls(pendingCalls: PendingToolCall[]): Promise<void> {
    state.value = "tool_calling";

    // 保存带工具调用的助手消息
    const assistantMessage = createTextMessage("assistant", streamingText.value);
    assistantMessage.toolCalls = pendingCalls.map(tc => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
      status: "pending" as const
    }));
    messages.value.push(assistantMessage);

    // 执行每个工具
    const toolResults: ToolResult[] = [];

    for (const call of pendingCalls) {
      eventBus.emit({ type: "tool_call_start", data: call });

      try {
        const result = await getToolRegistry().execute(call.name, call.arguments, {
          sessionId: session.value?.id || "default"
        });

        toolResults.push({
          toolCallId: call.id,
          content: result.content,
          isError: !result.success
        });

        eventBus.emit({ type: "tool_call_result", data: { ...call, result } });
      } catch (err: any) {
        toolResults.push({
          toolCallId: call.id,
          content: JSON.stringify({ error: err.message }),
          isError: true
        });

        eventBus.emit({ type: "tool_call_error", data: { ...call, error: err.message } });
      }
    }

    // 创建工具结果消息
    const toolMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "tool",
      content: [],
      timestamp: Date.now(),
      toolResults
    };
    messages.value.push(toolMessage);

    // 递归调用以继续对话
    await processLLMRequest();
  }

  function abort(): void {
    if (!isProcessing.value) return;

    streamController?.abort();

    if (streamingText.value) {
      const partialMessage = createTextMessage("assistant", streamingText.value);
      messages.value.push(partialMessage);
    }

    state.value = "interrupted";
    eventBus.emit({ type: "state_change", state: "interrupted" });
  }

  function clear(): void {
    messages.value = [];
    streamingText.value = "";
    error.value = null;
    state.value = "idle";
    stateMachine.reset(createInitialAgentState());
  }

  return {
    state,
    messages,
    session,
    isProcessing,
    canSend,
    streamingText,
    error,
    send,
    abort,
    clear,
    regenerate,
    subscribe: handler => eventBus.on(handler),
    updateConfig,
    updateSystemPrompt
  };
}
```

### 8.2 useChat

```typescript
// composables/useChat.ts

export interface ChatOptions {
  storage?: StorageAdapter;
  defaultSystemPrompt?: string;
  useSchedulerPrompt?: boolean;
  config?: LLMConfig;
}

export interface UseChatReturn extends UseAgentReturn {
  // 会话管理
  sessions: Ref<SessionSnapshot[]>;
  currentSessionId: Ref<string | null>;
  createSession(title?: string): Promise<Session>;
  switchSession(id: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  renameSession(id: string, title: string): Promise<void>;

  // 配置管理
  configs: Ref<LLMConfig[]>;
  currentConfig: Ref<LLMConfig | null>;
  saveConfig(config: LLMConfig): Promise<void>;
  deleteConfig(id: string): Promise<void>;
  switchConfig(id: string): Promise<void>;
}

export function useChat(options: ChatOptions = {}): UseChatReturn {
  const storage = options.storage ?? new MemoryStorageAdapter();
  const sessionRepo = createSessionRepository(storage);
  const configRepo = createConfigRepository(storage);

  const sessions = ref<SessionSnapshot[]>([]);
  const configs = ref<LLMConfig[]>([]);
  const currentSessionId = ref<string | null>(null);
  const currentConfig = ref<LLMConfig | null>(null);

  let agent: UseAgentReturn | null = null;
  const systemPrompt = options.useSchedulerPrompt ? getSchedulerPrompt() : (options.defaultSystemPrompt ?? "");

  function getAgent(): UseAgentReturn {
    if (!agent && currentConfig.value) {
      agent = useAgent({
        config: currentConfig.value,
        systemPrompt
      });
    }
    return agent!;
  }

  async function createSession(title?: string): Promise<Session> {
    const session = await sessionRepo.create({
      title: title ?? "新对话",
      systemPrompt,
      configId: currentConfig.value?.id
    });
    currentSessionId.value = session.id;
    getAgent().clear();
    await refreshSessions();
    return session;
  }

  async function switchSession(id: string): Promise<void> {
    const session = await sessionRepo.get(id);
    if (!session) return;

    currentSessionId.value = id;
    const messages = await sessionRepo.getMessages(id);

    // 重新创建 agent 并加载消息
    agent = useAgent({
      config: currentConfig.value!,
      systemPrompt
    });
    agent.messages.value = messages;
  }

  async function switchConfig(id: string): Promise<void> {
    const config = configs.value.find(c => c.id === id);
    if (!config) return;

    currentConfig.value = config;

    if (agent) {
      agent.updateConfig(config);
    }
  }

  // 自动保存消息（防抖）
  let saveTimer: any;
  watch(
    () => agent?.messages.value,
    async newMessages => {
      if (!currentSessionId.value || !newMessages) return;

      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg) {
          await sessionRepo.addMessage(currentSessionId.value!, lastMsg);
        }
      }, 500);
    }
  );

  // 初始化
  onMounted(async () => {
    await refreshConfigs();
    await refreshSessions();

    // 加载默认配置
    const defaultConfig = await configRepo.getDefault();
    if (defaultConfig) {
      currentConfig.value = defaultConfig;
    }
  });

  return {
    // 代理 useAgent 返回值
    ...toRefs(
      reactive({
        get state() {
          return getAgent().state.value;
        },
        get messages() {
          return getAgent().messages.value;
        }
        // ... 其他属性
      })
    ),

    // 会话管理
    sessions,
    currentSessionId,
    createSession,
    switchSession,
    deleteSession,
    renameSession,

    // 配置管理
    configs,
    currentConfig,
    saveConfig,
    deleteConfig,
    switchConfig
  };
}
```

---

## 9. 事件总线与流处理

### 9.1 事件总线

```typescript
// engine/EventBus.ts

export interface IEventBus {
  on<T extends AgentEvent>(handler: EventHandler<T>, filter?: EventFilter<T>): Unsubscribe;
  once<T extends AgentEvent>(handler: EventHandler<T>, filter?: EventFilter<T>): Unsubscribe;
  emit(event: AgentEvent): void;
  clear(): void;
  listenerCount(): number;
}

export class EventBus implements IEventBus {
  private subscribers = new Set<Subscriber>();

  on(handler: EventHandler, filter?: EventFilter): Unsubscribe {
    const subscriber: Subscriber = { handler, filter, once: false };
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  once(handler: EventHandler, filter?: EventFilter): Unsubscribe {
    const subscriber: Subscriber = { handler, filter, once: true };
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  emit(event: AgentEvent): void {
    const toRemove: Subscriber[] = [];

    for (const subscriber of this.subscribers) {
      // 应用过滤器
      if (subscriber.filter && !subscriber.filter(event)) {
        continue;
      }

      try {
        subscriber.handler(event);
      } catch (err) {
        console.error("Event handler error:", err);
      }

      if (subscriber.once) {
        toRemove.push(subscriber);
      }
    }

    for (const sub of toRemove) {
      this.subscribers.delete(sub);
    }
  }
}

// 事件过滤器工厂
export const EventFilters = {
  byType<T extends AgentEvent["type"]>(type: T): EventFilter {
    return event => event.type === type;
  },

  byTypes<T extends AgentEvent["type"]>(types: T[]): EventFilter {
    return event => types.includes(event.type as T);
  },

  streamEvents(): EventFilter {
    return EventFilters.byTypes([
      "message_start",
      "text_delta",
      "tool_use_start",
      "tool_use_delta",
      "tool_use_stop",
      "message_stop"
    ]);
  },

  toolEvents(): EventFilter {
    return EventFilters.byTypes(["tool_call_start", "tool_call_result", "tool_call_error"]);
  },

  and(...filters: EventFilter[]): EventFilter {
    return event => filters.every(f => f(event));
  },

  or(...filters: EventFilter[]): EventFilter {
    return event => filters.some(f => f(event));
  },

  not(filter: EventFilter): EventFilter {
    return event => !filter(event);
  }
};
```

### 9.2 Mealy 状态机

```typescript
// engine/MealyMachine.ts

// Mealy 机: (state, input) → (state, output[])
export const streamProcessor: StreamProcessor = (
  state: AgentInternalState,
  input: StreamProcessorInput
): [AgentInternalState, StreamProcessorOutput[]] => {
  const outputs: StreamProcessorOutput[] = [];

  switch (input.type) {
    case "message_start":
      return [
        {
          ...state,
          current: "responding",
          currentMessageId: input.messageId,
          accumulatedText: ""
        },
        [
          { type: "state_change", state: "responding" },
          { type: "message_start", messageId: input.messageId }
        ]
      ];

    case "text_delta":
      return [
        {
          ...state,
          accumulatedText: state.accumulatedText + input.text
        },
        [{ type: "text_delta", text: input.text }]
      ];

    case "tool_use_start":
      return [
        {
          ...state,
          current: "tool_calling",
          currentToolCall: {
            id: input.id,
            name: input.name,
            partialJson: ""
          }
        },
        [
          { type: "state_change", state: "tool_calling" },
          { type: "tool_use_start", id: input.id, name: input.name }
        ]
      ];

    case "tool_use_delta":
      return [
        {
          ...state,
          currentToolCall: {
            ...state.currentToolCall!,
            partialJson: state.currentToolCall!.partialJson + input.json
          }
        },
        [{ type: "tool_use_delta", json: input.json }]
      ];

    case "tool_use_stop":
      const toolCall = state.currentToolCall!;
      const args = JSON.parse(toolCall.partialJson);

      return [
        {
          ...state,
          currentToolCall: undefined,
          pendingToolCalls: [...state.pendingToolCalls, { id: toolCall.id, name: toolCall.name, arguments: args }]
        },
        [{ type: "tool_use_stop", id: toolCall.id, arguments: args }]
      ];

    case "message_stop":
      const nextState = input.stopReason === "tool_use" ? "tool_calling" : "idle";

      return [
        {
          ...state,
          current: nextState,
          currentMessageId: undefined
        },
        [
          { type: "state_change", state: nextState },
          { type: "message_stop", stopReason: input.stopReason }
        ]
      ];

    case "stream_error":
      return [
        {
          ...state,
          current: "error",
          error: input.error
        },
        [
          { type: "state_change", state: "error" },
          { type: "stream_error", error: input.error }
        ]
      ];
  }

  return [state, outputs];
};

export class MealyMachine<TState, TInput, TOutput> {
  private state: TState;

  constructor(
    initialState: TState,
    private processor: (state: TState, input: TInput) => [TState, TOutput[]]
  ) {
    this.state = initialState;
  }

  process(input: TInput): TOutput[] {
    const [nextState, outputs] = this.processor(this.state, input);
    this.state = nextState;
    return outputs;
  }

  getState(): TState {
    return this.state;
  }

  reset(state: TState): void {
    this.state = state;
  }
}

export const StateTransitions = {
  canStartConversation: (state: AgentState) => state === "idle" || state === "error",
  canInterrupt: (state: AgentState) => ["thinking", "responding", "tool_calling"].includes(state),
  isProcessing: (state: AgentState) => ["thinking", "responding", "tool_calling"].includes(state),
  isTerminal: (state: AgentState) => ["idle", "error", "interrupted"].includes(state)
};
```

---

## 10. 类型定义

### 10.1 消息类型

```typescript
// types/message.ts

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImagePart {
  type: "image";
  url: string; // base64 或 file://
  mimeType?: string;
  alt?: string;
}

export interface FilePart {
  type: "file";
  name: string;
  uri: string;
  mimeType: string;
  size?: number;
  extractedText?: string; // 预提取文本
}

export type ContentPart = TextPart | ImagePart | FilePart;

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "executing" | "completed" | "error";
}

export interface ToolResult {
  toolCallId: string;
  content: string; // JSON
  isError?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: ContentPart[];
  timestamp: number;
  toolCalls?: ToolCall[]; // assistant 消息
  toolResults?: ToolResult[]; // tool 消息
}

// 辅助函数
export function createTextMessage(role: MessageRole, text: string, options?: { id?: string }): Message {
  return {
    id: options?.id || `msg_${Date.now()}`,
    role,
    content: [{ type: "text", text }],
    timestamp: Date.now()
  };
}

export function getMessageText(message: Message): string {
  return message.content
    .filter((p): p is TextPart => p.type === "text")
    .map(p => p.text)
    .join("");
}

export function hasToolCalls(message: Message): boolean {
  return (message.toolCalls?.length ?? 0) > 0;
}
```

### 10.2 事件类型

```typescript
// types/event.ts

// 第一层: 流事件
export type StreamEventType =
  | "message_start"
  | "text_delta"
  | "tool_use_start"
  | "tool_use_delta"
  | "tool_use_stop"
  | "message_stop"
  | "stream_error";

// 第二层: 状态事件
export type StateEventType = "state_change" | "conversation_start" | "conversation_end";

// 第三层: 消息事件
export type MessageEventType = "user_message" | "assistant_message" | "tool_call_message" | "tool_result_message";

// 第四层: 工具事件
export type ToolEventType = "tool_call_start" | "tool_call_result" | "tool_call_error";

// 联合类型
export type AgentEventType = StreamEventType | StateEventType | MessageEventType | ToolEventType;

export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "state_change"; state: AgentState }
  | { type: "tool_call_start"; data: ToolCall }
  | { type: "tool_call_result"; data: { toolName: string; result: ToolExecutionResult } }
  | { type: "user_message"; data: Message }
  | { type: "assistant_message"; data: Message };
// ... 其他事件
```

---

## 11. 集成示例

### 11.1 基础使用

```typescript
import {
  useChat,
  LLM_PRESETS,
  getToolRegistry,
  createCalendarTools,
  createNotificationTools,
  createWebSearchTools,
  getSkillLoader,
  builtinSkillPackage
} from "@xierfloat-monorepo/nativeScript-ai";

// 配置 LLM
const config = {
  ...LLM_PRESETS["gpt-4o"],
  id: "gpt4o-main",
  apiKey: "sk-xxx"
};

// 注册工具
const registry = getToolRegistry();
registry.registerAll(createCalendarTools(calendarDataAccess));
registry.registerAll(createNotificationTools(notificationService));
registry.registerAll(createWebSearchTools());

// 加载技能
const skillLoader = getSkillLoader();
skillLoader.loadPackage(builtinSkillPackage);

// 创建聊天实例
const chat = useChat({
  config,
  useSchedulerPrompt: true
});

// 发送消息
await chat.send("明天下午2点帮我安排一个产品评审会议");

// 订阅事件
chat.subscribe(event => {
  if (event.type === "text_delta") {
    console.log("流式文本:", event.text);
  } else if (event.type === "tool_call_result") {
    console.log("工具结果:", event.data.result);
  }
});
```

### 11.2 自定义工具

```typescript
import { ToolHandler, ToolDefinition, ToolExecutionResult } from "@xierfloat-monorepo/nativeScript-ai";

const myToolDefinition: ToolDefinition = {
  name: "my_custom_tool",
  displayName: "自定义工具",
  description: "执行自定义操作",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "参数1" },
      param2: { type: "number", description: "参数2" }
    },
    required: ["param1"]
  },
  category: "custom"
};

const myToolHandler: ToolHandler = {
  definition: myToolDefinition,
  async execute(args, context): Promise<ToolExecutionResult> {
    const { param1, param2 } = args as { param1: string; param2?: number };

    // 执行自定义逻辑
    const result = await doSomething(param1, param2);

    return {
      success: true,
      content: JSON.stringify(result, null, 2)
    };
  },
  validate(args) {
    if (!args.param1) {
      return { valid: false, errors: ["param1 is required"] };
    }
    return { valid: true };
  }
};

// 注册工具
getToolRegistry().register(myToolHandler);
```

### 11.3 自定义技能

```typescript
import { SkillRawData, getSkillRegistry } from "@xierfloat-monorepo/nativeScript-ai";

const mySkill: SkillRawData = {
  id: "my-custom-skill",
  skillMd: `---
name: 我的技能
description: 这是一个自定义技能
tags: [自定义, 示例]
priority: 5
enabled: true
---

# 我的技能

## 使用方法
这个技能可以帮助用户完成...

## 步骤
1. 第一步
2. 第二步
3. 第三步
`
};

// 注册技能
getSkillRegistry().register(mySkill);

// 搜索技能
const results = getSkillRegistry().search("自定义", 3);
console.log(results);

// 获取相关技能提示词
const prompt = getSkillRegistry().getRelevantSkillsPrompt("帮我完成某个任务", 2);
```

---

## 总结

`xierfloat-nativeScript-ai` 包提供了一个完整的 AI 智能体框架：

| 模块            | 用途         | 关键技术             |
| --------------- | ------------ | -------------------- |
| **LLM 适配器**  | 多提供商支持 | 工厂模式、适配器模式 |
| **MCP 工具**    | 能力扩展     | 注册表模式、依赖注入 |
| **上下文管理**  | Token 优化   | 滑动窗口、自动摘要   |
| **技能系统**    | 知识注入     | YAML 解析、语义搜索  |
| **事件总线**    | 解耦通信     | 发布/订阅模式        |
| **状态机**      | 流处理       | Mealy 机、函数式设计 |
| **Composables** | Vue 集成     | Composition API      |

**核心设计模式：**

1. **工厂模式** - LLM 适配器注册表
2. **适配器模式** - 统一不同 LLM API
3. **仓储模式** - 配置/会话存储抽象
4. **发布/订阅** - 事件总线解耦
5. **状态机** - 纯函数式流处理
6. **依赖注入** - 工具、存储、日历可注入
7. **Composables** - Vue 3 组合式 API 集成
8. **延迟加载** - 技能支持三级加载
9. **插件架构** - 工具注册表支持动态注册
