# TCamp 智能体功能实现方案

> 基于 AgentX 架构设计，适配 NativeScript-Vue 移动端环境

## 实现状态: ✅ 已完成

包位置: `packages/xierfloat-mobile-ai`

### 已完成模块

| 模块 | 状态 | 文件数 | 说明 |
|------|------|--------|------|
| types/ | ✅ | 7 | 类型定义 (config, message, event, tool, session, processor) |
| engine/ | ✅ | 3 | 事件引擎 (EventBus, MealyMachine) |
| llm/ | ✅ | 5 | LLM 适配器 (OpenAI, Anthropic, 注册表) |
| mcp/ | ✅ | 6 | MCP 工具 (Calendar, Notification, WebSearch) |
| context/ | ✅ | 2 | 上下文管理和 Token 优化 |
| prompt/ | ✅ | 2 | 提示词模板 (日程专家) |
| storage/ | ✅ | 3 | 存储仓储 (Config, Session) |
| composables/ | ✅ | 3 | Vue Composables (useAgent, useChat) |

### 快速开始

```typescript
import { useChat, LLM_PRESETS } from '@xierfloat-monorepo/mobile-ai'

// 1. 初始化聊天
const chat = useChat({
  config: {
    ...LLM_PRESETS['gpt-4o'],
    id: 'my-config',
    apiKey: 'sk-xxx'
  },
  useSchedulerPrompt: true  // 使用日程专家提示词
})

// 2. 发送消息
await chat.send('帮我安排明天下午3点的会议')

// 3. 监听响应
chat.subscribe((event) => {
  if (event.type === 'text_delta') {
    console.log(event.data.text)
  }
})
```

### 注册 MCP 工具

```typescript
import { getToolRegistry, createCalendarTools } from '@xierfloat-monorepo/mobile-ai'

// 注入日历数据访问层
const calendarDataAccess = {
  query: async (params) => { /* SQLite 查询 */ },
  create: async (params) => { /* SQLite 插入 */ },
  update: async (params) => { /* SQLite 更新 */ },
  delete: async (id) => { /* SQLite 删除 */ }
}

// 注册工具
getToolRegistry().registerAll(createCalendarTools(calendarDataAccess))
```

---

## 一、架构总览

### 1.1 核心设计理念

参考 AgentX 的 **Mealy Machine** 模式，采用事件驱动架构：

```
(state, input) → (state, output)
```

**设计原则**：
- **纯函数处理器** - 无副作用，确定性输出，可测试
- **事件驱动** - 所有操作通过事件流转
- **分层架构** - UI层、业务层、服务层、存储层分离
- **平台适配** - 针对 NativeScript 移动端优化

### 1.2 整体架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                           UI 层 (Pages/Components)                    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │  ChatPage.vue  │  │ ConfigPage.vue │  │  HistoryPage.vue       │  │
│  │  (对话界面)     │  │ (模型配置)      │  │  (历史记录)            │  │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬────────────┘  │
│          │                   │                       │               │
├──────────┴───────────────────┴───────────────────────┴───────────────┤
│                        Composables 层 (业务逻辑)                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │   useAgent()   │  │   useChat()    │  │   useFileParser()      │  │
│  │  (智能体核心)   │  │  (会话管理)     │  │   (文件解析)           │  │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬────────────┘  │
│          │                   │                       │               │
├──────────┴───────────────────┴───────────────────────┴───────────────┤
│                        AgentEngine (事件引擎)                          │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                        EventBus (事件总线)                        ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ ││
│  │  │   emit()   │  │    on()    │  │ request()  │  │ onCommand()│ ││
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘ ││
│  └──────────────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                     MealyMachine (状态机)                         ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   ││
│  │  │ StreamProc   │  │ MessageProc  │  │ ContextProc          │   ││
│  │  │ (流事件处理) │  │ (消息组装)    │  │ (上下文管理)          │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   ││
│  └──────────────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│                         Services 层 (服务)                            │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │  LLMAdapter    │  │  MCPToolkit    │  │  FileParserService     │  │
│  │  (模型适配器)   │  │  (MCP工具集)   │  │  (文件解析服务)         │  │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬────────────┘  │
│          │                   │                       │               │
├──────────┴───────────────────┴───────────────────────┴───────────────┤
│                         Storage 层 (持久化)                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │ ConfigStore    │  │ SessionStore   │  │  MessageStore          │  │
│  │ (模型配置)      │  │ (会话存储)      │  │  (消息历史)            │  │
│  └────────────────┘  └────────────────┘  └────────────────────────┘  │
│                              SQLite                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.3 四层事件系统

参考 AgentX 的事件分层设计：

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Stream (流事件)                                        │
│  来源: LLM API 实时流                                            │
│  事件: message_start, text_delta, tool_use_start, etc.          │
│  特点: 增量、实时、流式传输                                       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: State (状态事件)                                       │
│  来源: AgentEngine 状态机                                        │
│  事件: agent_idle, agent_thinking, agent_responding, etc.       │
│  特点: 状态转换、UI 状态同步                                      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Message (消息事件)                                     │
│  来源: MessageAssembler 组装                                     │
│  事件: user_message, assistant_message, tool_call_message       │
│  特点: 完整消息、可持久化、业务语义                                │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Tool (工具事件)                                        │
│  来源: MCPToolkit 执行                                           │
│  事件: tool_call_start, tool_call_result, tool_call_error       │
│  特点: MCP 工具调用、结果反馈                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、目录结构

```
apps/mobile/src/
├── pages/
│   ├── Home.vue                        # 现有主页
│   └── agent/
│       ├── Chat.vue                    # 智能体对话页面
│       ├── Config.vue                  # 模型配置页面
│       └── History.vue                 # 历史记录页面
│
├── components/
│   ├── AddEventModal.vue               # 现有
│   └── agent/
│       ├── ChatMessage.vue             # 消息气泡组件
│       ├── ChatInput.vue               # 输入框组件
│       ├── StreamingText.vue           # 流式文本渲染
│       ├── ToolCallCard.vue            # 工具调用展示卡片
│       ├── FileAttachment.vue          # 文件附件预览
│       └── ModelSelector.vue           # 模型选择器
│
├── composables/
│   ├── useCalendar.ts                  # 现有
│   └── agent/
│       ├── useAgent.ts                 # 智能体核心 Hook
│       ├── useChat.ts                  # 会话状态管理
│       ├── useStreaming.ts             # 流式响应处理
│       └── useFileParser.ts            # 文件解析 Hook
│
├── services/
│   ├── database/                       # 现有
│   ├── notification.ts                 # 现有
│   └── agent/
│       ├── index.ts                    # 服务统一导出
│       │
│       ├── engine/                     # AgentEngine 核心
│       │   ├── EventBus.ts             # 事件总线 (Pub/Sub)
│       │   ├── MealyMachine.ts         # Mealy 状态机
│       │   ├── AgentEngine.ts          # 引擎主类
│       │   └── processors/             # 处理器
│       │       ├── index.ts
│       │       ├── StreamProcessor.ts  # 流事件处理
│       │       ├── MessageProcessor.ts # 消息组装
│       │       ├── StateProcessor.ts   # 状态管理
│       │       └── ContextProcessor.ts # 上下文归纳
│       │
│       ├── llm/                        # LLM 适配层
│       │   ├── LLMAdapter.ts           # 适配器基类
│       │   ├── LLMFactory.ts           # 工厂函数
│       │   └── providers/              # 模型提供商
│       │       ├── OpenAIAdapter.ts    # OpenAI 兼容 (GPT/DeepSeek/Qwen)
│       │       ├── AnthropicAdapter.ts # Claude 适配
│       │       └── types.ts            # 类型定义
│       │
│       ├── mcp/                        # MCP 工具层
│       │   ├── MCPToolkit.ts           # 工具管理器
│       │   ├── MCPExecutor.ts          # 工具执行器
│       │   └── tools/                  # 工具定义
│       │       ├── index.ts
│       │       ├── CalendarTool.ts     # 日程工具
│       │       ├── NotificationTool.ts # 通知工具
│       │       └── WebSearchTool.ts    # 搜索工具
│       │
│       ├── prompt/                     # 提示词管理
│       │   ├── PromptManager.ts        # 提示词管理器
│       │   └── templates/
│       │       └── scheduler.ts        # 日程专家模板
│       │
│       ├── context/                    # 上下文管理
│       │   ├── ContextManager.ts       # 上下文管理器
│       │   └── Summarizer.ts           # 归纳总结器
│       │
│       ├── parser/                     # 文件解析
│       │   ├── FileParserService.ts    # 解析服务
│       │   ├── PDFParser.ts            # PDF 解析
│       │   ├── WordParser.ts           # Word 解析
│       │   ├── ExcelParser.ts          # Excel 解析
│       │   └── ImageParser.ts          # 图片识别
│       │
│       └── storage/                    # 持久化
│           ├── ConfigRepository.ts     # 配置存储
│           ├── SessionRepository.ts    # 会话存储
│           └── MessageRepository.ts    # 消息存储
│
└── types/
    ├── calendar.ts                     # 现有
    └── agent.ts                        # 智能体类型定义
```

---

## 三、核心类型定义

```typescript
// types/agent.ts

// ==================== 模型配置 ====================

export type LLMProvider = 'openai' | 'anthropic' | 'deepseek' | 'qwen' | 'ollama' | 'custom'

export interface LLMConfig {
  id: string
  name: string                        // 显示名称
  provider: LLMProvider
  apiKey: string
  baseUrl?: string                    // 自定义端点
  model: string                       // 模型ID
  maxTokens?: number
  temperature?: number
  isDefault?: boolean
  supportsVision?: boolean            // 是否支持图片
  supportsTools?: boolean             // 是否支持工具调用
}

// ==================== 事件类型 ====================

export type AgentState =
  | 'idle'          // 空闲
  | 'thinking'      // 等待响应
  | 'responding'    // 流式输出中
  | 'tool_calling'  // 工具调用中
  | 'error'         // 错误

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

// 流事件类型 (Layer 1)
export type StreamEventType =
  | 'message_start'
  | 'text_delta'
  | 'tool_use_start'
  | 'tool_use_delta'
  | 'tool_use_stop'
  | 'message_stop'
  | 'error'

export interface StreamEvent {
  type: StreamEventType
  timestamp: number
  data: unknown
}

// 状态事件类型 (Layer 2)
export type StateEventType =
  | 'agent_state_change'
  | 'conversation_start'
  | 'conversation_end'

export interface StateEvent {
  type: StateEventType
  timestamp: number
  data: {
    previous: AgentState
    current: AgentState
  }
}

// 消息事件类型 (Layer 3)
export type MessageEventType =
  | 'user_message'
  | 'assistant_message'
  | 'tool_call_message'
  | 'tool_result_message'

export interface MessageEvent {
  type: MessageEventType
  timestamp: number
  data: Message
}

// ==================== 消息类型 ====================

export interface Message {
  id: string
  role: MessageRole
  content: ContentPart[]
  timestamp: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

export type ContentPart = TextPart | ImagePart | FilePart

export interface TextPart {
  type: 'text'
  text: string
}

export interface ImagePart {
  type: 'image'
  url: string                         // base64 或 file:// URI
  mimeType: string
}

export interface FilePart {
  type: 'file'
  name: string
  uri: string
  mimeType: string
  extractedText?: string              // 解析后的文本
}

// ==================== 工具类型 ====================

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  status: 'pending' | 'executing' | 'completed' | 'error'
}

export interface ToolResult {
  toolCallId: string
  content: string
  isError?: boolean
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, MCPToolProperty>
    required?: string[]
  }
  execute: (args: Record<string, unknown>) => Promise<string>
}

export interface MCPToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
}

// ==================== 会话类型 ====================

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  summary?: string                    // 上下文摘要
  modelConfigId: string
  createdAt: number
  updatedAt: number
}

// ==================== Processor 类型 (Mealy Machine) ====================

/**
 * 核心处理器类型
 * (state, input) → [newState, outputs[]]
 */
export type Processor<TState, TInput, TOutput> = (
  state: Readonly<TState>,
  input: TInput
) => [TState, TOutput[]]

// Agent 引擎状态
export interface AgentEngineState {
  agentState: AgentState
  currentMessageId: string | null
  pendingText: string
  pendingToolCalls: Map<string, Partial<ToolCall>>
  contextSummary: string | null
  tokenCount: number
}
```

---

## 四、核心组件实现

### 4.1 EventBus (事件总线)

```typescript
// services/agent/engine/EventBus.ts

import { ref } from 'nativescript-vue'
import type { StreamEvent, StateEvent, MessageEvent } from '~/types/agent'

type AgentEvent = StreamEvent | StateEvent | MessageEvent

type EventHandler<T = AgentEvent> = (event: T) => void

interface Subscription {
  id: string
  type: string
  handler: EventHandler
  once: boolean
}

/**
 * EventBus - 事件总线
 *
 * 参考 AgentX 的 SystemBus 实现，采用 Pub/Sub 模式
 */
export class EventBus {
  private subscriptions: Subscription[] = []
  private idCounter = 0

  /**
   * 发布事件
   */
  emit(event: AgentEvent): void {
    const handlers = this.subscriptions.filter(s =>
      s.type === event.type || s.type === '*'
    )

    for (const sub of handlers) {
      try {
        sub.handler(event)
        if (sub.once) {
          this.off(sub.id)
        }
      } catch (error) {
        console.error(`[EventBus] Handler error for ${event.type}:`, error)
      }
    }
  }

  /**
   * 订阅事件
   */
  on<T extends AgentEvent>(
    type: T['type'] | '*',
    handler: EventHandler<T>
  ): () => void {
    const id = `sub_${++this.idCounter}`
    this.subscriptions.push({
      id,
      type,
      handler: handler as EventHandler,
      once: false
    })
    return () => this.off(id)
  }

  /**
   * 订阅一次
   */
  once<T extends AgentEvent>(
    type: T['type'],
    handler: EventHandler<T>
  ): () => void {
    const id = `sub_${++this.idCounter}`
    this.subscriptions.push({
      id,
      type,
      handler: handler as EventHandler,
      once: true
    })
    return () => this.off(id)
  }

  /**
   * 取消订阅
   */
  off(id: string): void {
    this.subscriptions = this.subscriptions.filter(s => s.id !== id)
  }

  /**
   * 请求-响应模式
   */
  async request<TReq extends AgentEvent, TRes extends AgentEvent>(
    requestEvent: TReq,
    responseType: TRes['type'],
    timeout = 30000
  ): Promise<TRes> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe()
        reject(new Error(`Request timeout: ${requestEvent.type}`))
      }, timeout)

      const unsubscribe = this.once<TRes>(responseType, (event) => {
        clearTimeout(timer)
        resolve(event)
      })

      this.emit(requestEvent)
    })
  }

  /**
   * 清理所有订阅
   */
  destroy(): void {
    this.subscriptions = []
  }
}

// 全局单例
export const eventBus = new EventBus()
```

### 4.2 MealyMachine (状态机)

```typescript
// services/agent/engine/MealyMachine.ts

import type {
  Processor,
  AgentEngineState,
  StreamEvent,
  AgentEvent
} from '~/types/agent'

/**
 * MealyMachine - 米利状态机
 *
 * 核心公式: (state, input) → (state, output)
 *
 * 参考 AgentX 的 MealyMachine 实现
 */
export class MealyMachine<TState, TInput, TOutput> {
  private state: TState
  private processor: Processor<TState, TInput, TOutput>

  constructor(
    initialState: TState,
    processor: Processor<TState, TInput, TOutput>
  ) {
    this.state = initialState
    this.processor = processor
  }

  /**
   * 处理输入事件
   */
  process(input: TInput): TOutput[] {
    const [newState, outputs] = this.processor(this.state, input)
    this.state = newState
    return outputs
  }

  /**
   * 获取当前状态
   */
  getState(): Readonly<TState> {
    return this.state
  }

  /**
   * 重置状态
   */
  reset(initialState: TState): void {
    this.state = initialState
  }
}

// ==================== 组合器函数 ====================

/**
 * combineProcessors - 组合多个处理器
 *
 * 每个子处理器管理自己的状态切片
 */
export function combineProcessors<TState, TInput, TOutput>(
  processors: { [K in keyof TState]: Processor<TState[K], TInput, TOutput> }
): Processor<TState, TInput, TOutput> {
  return (state: Readonly<TState>, input: TInput): [TState, TOutput[]] => {
    const newState = {} as TState
    const allOutputs: TOutput[] = []

    for (const key in processors) {
      const processor = processors[key]
      const subState = state[key]
      const [newSubState, outputs] = processor(subState, input)

      newState[key] = newSubState
      allOutputs.push(...outputs)
    }

    return [newState, allOutputs]
  }
}

/**
 * filterProcessor - 过滤处理器
 */
export function filterProcessor<TState, TInput, TOutput>(
  predicate: (input: TInput) => boolean,
  processor: Processor<TState, TInput, TOutput>
): Processor<TState, TInput, TOutput> {
  return (state: Readonly<TState>, input: TInput): [TState, TOutput[]] => {
    if (predicate(input)) {
      return processor(state, input)
    }
    return [state as TState, []]
  }
}
```

### 4.3 LLMAdapter (模型适配器)

```typescript
// services/agent/llm/LLMAdapter.ts

import { Http } from '@nativescript/core'
import type {
  LLMConfig,
  Message,
  MCPTool,
  StreamEvent
} from '~/types/agent'

export type StreamCallback = (event: StreamEvent) => void

/**
 * LLMAdapter - LLM 适配器基类
 *
 * 参考 AgentX 的 ClaudeEnvironment 适配器模式
 */
export abstract class LLMAdapter {
  protected config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  /**
   * 发送消息并获取流式响应
   */
  abstract chat(
    messages: Message[],
    tools?: MCPTool[],
    onStream?: StreamCallback
  ): Promise<Message>

  /**
   * 检查模型是否可用
   */
  abstract checkAvailability(): Promise<boolean>

  /**
   * 将内部消息格式转换为 API 格式
   */
  protected convertMessages(messages: Message[]): unknown[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.toolResults?.[0]?.toolCallId,
          content: msg.toolResults?.[0]?.content || ''
        }
      }

      const content = msg.content.map(part => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text }
        }
        if (part.type === 'image') {
          return {
            type: 'image_url',
            image_url: { url: part.url }
          }
        }
        if (part.type === 'file' && part.extractedText) {
          return { type: 'text', text: `[文件: ${part.name}]\n${part.extractedText}` }
        }
        return null
      }).filter(Boolean)

      return {
        role: msg.role,
        content: content.length === 1 && content[0].type === 'text'
          ? content[0].text
          : content,
        ...(msg.toolCalls ? {
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }))
        } : {})
      }
    })
  }

  /**
   * 将 MCPTool 转换为 OpenAI 格式
   */
  protected convertTools(tools: MCPTool[]): unknown[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }))
  }
}
```

### 4.4 OpenAI 兼容适配器

```typescript
// services/agent/llm/providers/OpenAIAdapter.ts

import { Http } from '@nativescript/core'
import { LLMAdapter, type StreamCallback } from '../LLMAdapter'
import type {
  LLMConfig,
  Message,
  MCPTool,
  StreamEvent,
  ToolCall,
  ContentPart
} from '~/types/agent'

/**
 * OpenAI 兼容适配器
 *
 * 支持: OpenAI, DeepSeek, 通义千问, Ollama 等 OpenAI 兼容 API
 */
export class OpenAIAdapter extends LLMAdapter {

  async chat(
    messages: Message[],
    tools?: MCPTool[],
    onStream?: StreamCallback
  ): Promise<Message> {
    const url = `${this.config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.convertMessages(messages),
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature ?? 0.7,
      stream: !!onStream
    }

    if (tools && tools.length > 0 && this.config.supportsTools !== false) {
      body.tools = this.convertTools(tools)
      body.tool_choice = 'auto'
    }

    if (onStream) {
      return this.streamChat(url, body, onStream)
    }

    return this.normalChat(url, body)
  }

  private async normalChat(url: string, body: Record<string, unknown>): Promise<Message> {
    const response = await Http.request({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      content: JSON.stringify(body)
    })

    const data = response.content.toJSON()
    return this.parseResponse(data)
  }

  private async streamChat(
    url: string,
    body: Record<string, unknown>,
    onStream: StreamCallback
  ): Promise<Message> {
    const messageId = `msg_${Date.now()}`
    let content = ''
    const toolCalls: ToolCall[] = []
    let currentToolCall: Partial<ToolCall> | null = null
    let currentToolArguments = ''

    try {
      // 发送流式请求
      onStream({
        type: 'message_start',
        timestamp: Date.now(),
        data: { messageId }
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(body)
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            onStream({
              type: 'message_stop',
              timestamp: Date.now(),
              data: { stopReason: 'end_turn' }
            })
            break
          }

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices[0]?.delta

            // 处理文本增量
            if (delta?.content) {
              content += delta.content
              onStream({
                type: 'text_delta',
                timestamp: Date.now(),
                data: { text: delta.content }
              })
            }

            // 处理工具调用
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) {
                  // 保存之前的工具调用
                  if (currentToolCall && currentToolCall.id) {
                    currentToolCall.arguments = JSON.parse(currentToolArguments || '{}')
                    toolCalls.push(currentToolCall as ToolCall)
                    onStream({
                      type: 'tool_use_stop',
                      timestamp: Date.now(),
                      data: { toolCallId: currentToolCall.id }
                    })
                  }

                  // 开始新的工具调用
                  currentToolCall = {
                    id: tc.id,
                    name: tc.function?.name || '',
                    status: 'pending'
                  }
                  currentToolArguments = ''

                  onStream({
                    type: 'tool_use_start',
                    timestamp: Date.now(),
                    data: {
                      toolCallId: tc.id,
                      toolName: tc.function?.name
                    }
                  })
                }

                if (tc.function?.arguments) {
                  currentToolArguments += tc.function.arguments
                  onStream({
                    type: 'tool_use_delta',
                    timestamp: Date.now(),
                    data: { partialJson: tc.function.arguments }
                  })
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      // 完成最后一个工具调用
      if (currentToolCall && currentToolCall.id) {
        currentToolCall.arguments = JSON.parse(currentToolArguments || '{}')
        toolCalls.push(currentToolCall as ToolCall)
        onStream({
          type: 'tool_use_stop',
          timestamp: Date.now(),
          data: { toolCallId: currentToolCall.id }
        })
      }

    } catch (error) {
      onStream({
        type: 'error',
        timestamp: Date.now(),
        data: { error: String(error) }
      })
      throw error
    }

    return {
      id: messageId,
      role: 'assistant',
      content: content ? [{ type: 'text', text: content }] : [],
      timestamp: Date.now(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }
  }

  private parseResponse(data: any): Message {
    const choice = data.choices[0]
    const message = choice.message

    const content: ContentPart[] = []
    if (message.content) {
      content.push({ type: 'text', text: message.content })
    }

    const toolCalls: ToolCall[] | undefined = message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
      status: 'pending' as const
    }))

    return {
      id: data.id || `msg_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      toolCalls
    }
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl || 'https://api.openai.com/v1'}/models`
      const response = await Http.request({
        url,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        timeout: 5000
      })
      return response.statusCode === 200
    } catch {
      return false
    }
  }
}
```

### 4.5 MCP 工具定义

```typescript
// services/agent/mcp/tools/CalendarTool.ts

import type { MCPTool } from '~/types/agent'
import {
  addEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventsByDate,
  getEventsByDateRange,
  searchEvents,
  getUpcomingEvents
} from '~/services/database'

/**
 * 日程工具集
 *
 * 遵循 MCP 协议规范定义工具
 */
export const calendarTools: MCPTool[] = [
  {
    name: 'calendar_query',
    description: '查询日程信息。支持查询所有日程、指定日期、日期范围、即将到来的日程或搜索关键词。',
    inputSchema: {
      type: 'object',
      properties: {
        queryType: {
          type: 'string',
          description: '查询类型',
          enum: ['all', 'date', 'range', 'upcoming', 'search']
        },
        date: {
          type: 'string',
          description: '查询日期 (ISO格式，queryType=date时使用)'
        },
        startDate: {
          type: 'string',
          description: '开始日期 (ISO格式，queryType=range时使用)'
        },
        endDate: {
          type: 'string',
          description: '结束日期 (ISO格式，queryType=range时使用)'
        },
        days: {
          type: 'number',
          description: '未来天数 (queryType=upcoming时使用，默认7)'
        },
        keyword: {
          type: 'string',
          description: '搜索关键词 (queryType=search时使用)'
        }
      },
      required: ['queryType']
    },
    execute: async (args) => {
      try {
        let events
        const queryType = args.queryType as string

        switch (queryType) {
          case 'all':
            events = await getAllEvents()
            break
          case 'date':
            if (!args.date) throw new Error('缺少 date 参数')
            events = await getEventsByDate(new Date(args.date as string))
            break
          case 'range':
            if (!args.startDate || !args.endDate) throw new Error('缺少日期范围参数')
            events = await getEventsByDateRange(
              new Date(args.startDate as string),
              new Date(args.endDate as string)
            )
            break
          case 'upcoming':
            events = await getUpcomingEvents((args.days as number) || 7)
            break
          case 'search':
            if (!args.keyword) throw new Error('缺少 keyword 参数')
            events = await searchEvents(args.keyword as string)
            break
          default:
            throw new Error(`未知的查询类型: ${queryType}`)
        }

        return JSON.stringify({
          success: true,
          count: events.length,
          events: events.map(e => ({
            uid: e.uid,
            summary: e.summary,
            description: e.description,
            dtStart: e.dtStart.toISOString(),
            dtEnd: e.dtEnd?.toISOString(),
            location: e.location
          }))
        })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    }
  },

  {
    name: 'calendar_create',
    description: '创建新的日程事件。',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '日程标题'
        },
        dtStart: {
          type: 'string',
          description: '开始时间 (ISO格式)'
        },
        dtEnd: {
          type: 'string',
          description: '结束时间 (ISO格式，可选)'
        },
        description: {
          type: 'string',
          description: '日程描述'
        },
        location: {
          type: 'string',
          description: '地点'
        },
        reminderMinutes: {
          type: 'number',
          description: '提前提醒分钟数 (默认10)'
        }
      },
      required: ['summary', 'dtStart']
    },
    execute: async (args) => {
      try {
        const event = await addEvent({
          summary: args.summary as string,
          dtStart: new Date(args.dtStart as string),
          dtEnd: args.dtEnd ? new Date(args.dtEnd as string) : undefined,
          description: args.description as string | undefined,
          location: args.location as string | undefined,
          alarms: [{
            action: 'DISPLAY',
            trigger: { minutes: -((args.reminderMinutes as number) || 10) }
          }]
        })

        return JSON.stringify({
          success: true,
          message: `已创建日程"${event.summary}"`,
          event: {
            uid: event.uid,
            summary: event.summary,
            dtStart: event.dtStart.toISOString()
          }
        })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    }
  },

  {
    name: 'calendar_update',
    description: '更新已有的日程事件。',
    inputSchema: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          description: '日程唯一标识'
        },
        summary: {
          type: 'string',
          description: '新的日程标题'
        },
        dtStart: {
          type: 'string',
          description: '新的开始时间 (ISO格式)'
        },
        dtEnd: {
          type: 'string',
          description: '新的结束时间 (ISO格式)'
        },
        description: {
          type: 'string',
          description: '新的描述'
        }
      },
      required: ['uid']
    },
    execute: async (args) => {
      try {
        const updates: Record<string, unknown> = {}
        if (args.summary) updates.summary = args.summary
        if (args.dtStart) updates.dtStart = new Date(args.dtStart as string)
        if (args.dtEnd) updates.dtEnd = new Date(args.dtEnd as string)
        if (args.description) updates.description = args.description

        await updateEvent(args.uid as string, updates)

        return JSON.stringify({
          success: true,
          message: '日程已更新'
        })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    }
  },

  {
    name: 'calendar_delete',
    description: '删除日程事件。',
    inputSchema: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          description: '日程唯一标识'
        }
      },
      required: ['uid']
    },
    execute: async (args) => {
      try {
        await deleteEvent(args.uid as string)
        return JSON.stringify({
          success: true,
          message: '日程已删除'
        })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    }
  },

  {
    name: 'get_current_time',
    description: '获取当前时间信息，用于日程安排参考。',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    execute: async () => {
      const now = new Date()
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

      return JSON.stringify({
        iso: now.toISOString(),
        local: now.toLocaleString('zh-CN'),
        date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
        time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
        dayOfWeek: weekDays[now.getDay()],
        timestamp: now.getTime()
      })
    }
  }
]
```

### 4.6 上下文管理器

```typescript
// services/agent/context/ContextManager.ts

import type { Message, ChatSession } from '~/types/agent'

/**
 * ContextManager - 上下文管理器
 *
 * 功能:
 * 1. Token 估算
 * 2. 上下文窗口管理
 * 3. 历史消息归纳
 */
export class ContextManager {
  private maxTokens: number
  private summaryThreshold: number

  constructor(options?: { maxTokens?: number; summaryThreshold?: number }) {
    this.maxTokens = options?.maxTokens || 8000
    this.summaryThreshold = options?.summaryThreshold || 6000
  }

  /**
   * 估算 Token 数量
   * 中文约 2 字符/token，英文约 4 字符/token
   */
  estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars / 2 + otherChars / 4)
  }

  /**
   * 计算消息列表的 Token 数
   */
  calculateMessageTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => {
      let tokens = 0
      for (const part of msg.content) {
        if (part.type === 'text') {
          tokens += this.estimateTokens(part.text)
        }
      }
      if (msg.toolCalls) {
        tokens += this.estimateTokens(JSON.stringify(msg.toolCalls))
      }
      if (msg.toolResults) {
        tokens += this.estimateTokens(JSON.stringify(msg.toolResults))
      }
      return sum + tokens
    }, 0)
  }

  /**
   * 准备发送给模型的消息
   * 包含上下文管理和归纳
   */
  async prepareMessages(
    session: ChatSession,
    systemPrompt: string
  ): Promise<Message[]> {
    const messages: Message[] = []

    // 1. 添加系统提示词
    messages.push({
      id: 'system',
      role: 'system',
      content: [{ type: 'text', text: systemPrompt }],
      timestamp: 0
    })

    // 2. 如果有历史摘要，添加摘要
    if (session.summary) {
      messages.push({
        id: 'summary',
        role: 'system',
        content: [{
          type: 'text',
          text: `[历史对话摘要]\n${session.summary}`
        }],
        timestamp: 0
      })
    }

    // 3. 检查是否需要归纳
    const sessionMessages = [...session.messages]
    const totalTokens = this.calculateMessageTokens(sessionMessages)

    if (totalTokens > this.summaryThreshold && sessionMessages.length > 6) {
      // 保留最近 1/3 的消息
      const recentCount = Math.max(4, Math.floor(sessionMessages.length / 3))
      const toSummarize = sessionMessages.slice(0, -recentCount)
      const toKeep = sessionMessages.slice(-recentCount)

      // 生成摘要
      const newSummary = await this.summarize(toSummarize, session.summary)
      session.summary = newSummary

      messages.push(...toKeep)
    } else {
      messages.push(...sessionMessages)
    }

    return messages
  }

  /**
   * 归纳历史消息
   */
  async summarize(messages: Message[], existingSummary?: string): Promise<string> {
    const keyPoints: string[] = []

    // 提取用户请求
    const userRequests = messages
      .filter(m => m.role === 'user')
      .map(m => {
        const textPart = m.content.find(p => p.type === 'text')
        return textPart?.type === 'text' ? textPart.text : ''
      })
      .filter(Boolean)
      .slice(-5)

    if (userRequests.length > 0) {
      keyPoints.push(`用户请求: ${userRequests.join('; ')}`)
    }

    // 提取工具调用结果
    const toolResults = messages
      .filter(m => m.toolResults && m.toolResults.length > 0)
      .flatMap(m => m.toolResults!)
      .map(r => {
        try {
          const result = JSON.parse(r.content)
          return result.success ? (result.message || '操作成功') : null
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .slice(-3)

    if (toolResults.length > 0) {
      keyPoints.push(`执行结果: ${toolResults.join('; ')}`)
    }

    // 提取助手回复要点
    const assistantReplies = messages
      .filter(m => m.role === 'assistant' && !m.toolCalls)
      .map(m => {
        const textPart = m.content.find(p => p.type === 'text')
        if (textPart?.type === 'text') {
          return textPart.text.slice(0, 100) + (textPart.text.length > 100 ? '...' : '')
        }
        return ''
      })
      .filter(Boolean)
      .slice(-3)

    if (assistantReplies.length > 0) {
      keyPoints.push(`助手回复: ${assistantReplies.join(' | ')}`)
    }

    // 合并现有摘要
    let summary = ''
    if (existingSummary) {
      summary = `${existingSummary}\n---\n`
    }
    summary += keyPoints.join('\n')

    return summary
  }
}
```

### 4.7 日程专家提示词

```typescript
// services/agent/prompt/templates/scheduler.ts

export const SCHEDULER_SYSTEM_PROMPT = `你是一个专业的日程安排助手，名叫"小历"。你的职责是帮助用户高效管理日程安排。

## 核心能力

1. **日程查询** - 查看用户的日程安排
   - 今日/明日/本周日程
   - 指定日期范围
   - 关键词搜索

2. **日程创建** - 帮助用户创建新日程
   - 解析自然语言时间表达
   - 智能设置提醒

3. **日程修改** - 调整已有日程
   - 修改时间、标题、描述
   - 删除不需要的日程

4. **通知提醒** - 设置及时提醒

5. **信息搜索** - 获取相关信息

## 工作原则

1. **确认优先** - 执行重要操作前先确认
2. **时间敏感** - 注意当前时间，避免过期日程
3. **冲突检测** - 创建前检查时间冲突
4. **简洁回复** - 直接、专业、不啰嗦

## 时间解析规则

- "明天下午3点" → 明天 15:00
- "下周一上午" → 下周一 09:00
- "后天晚上8点" → 后天 20:00
- "周五" → 本周五（如果已过则下周五）
- "3个小时后" → 当前时间 + 3小时

## 对话示例

用户: 帮我看看明天有什么安排
助手: [调用 calendar_query] 您明天有2个日程：
1. 09:00-10:00 团队周会
2. 14:00-15:30 产品评审

用户: 下午加一个3点的客户会议
助手: 好的，我帮您在明天下午3点创建"客户会议"，预计时长1小时，提前10分钟提醒，确认吗？

用户: 确认
助手: [调用 calendar_create] 已创建！"客户会议"安排在明天15:00-16:00，届时会提前10分钟提醒您。

## 注意事项

- 始终使用 get_current_time 工具获取当前时间
- 创建日程时务必确认具体时间
- 如果用户表述不清，主动询问
- 保持友好专业的语气`

export function getSchedulerPrompt(): string {
  return SCHEDULER_SYSTEM_PROMPT
}
```

---

## 五、核心 Composable

### 5.1 useAgent

```typescript
// composables/agent/useAgent.ts

import { ref, computed, onUnmounted } from 'nativescript-vue'
import type {
  ChatSession,
  Message,
  LLMConfig,
  AgentState,
  StreamEvent,
  MCPTool
} from '~/types/agent'
import { EventBus } from '~/services/agent/engine/EventBus'
import { LLMFactory } from '~/services/agent/llm/LLMFactory'
import { MCPToolkit } from '~/services/agent/mcp/MCPToolkit'
import { ContextManager } from '~/services/agent/context/ContextManager'
import { getSchedulerPrompt } from '~/services/agent/prompt/templates/scheduler'
import { SessionRepository } from '~/services/agent/storage/SessionRepository'
import { ConfigRepository } from '~/services/agent/storage/ConfigRepository'

/**
 * useAgent - 智能体核心 Hook
 *
 * 提供完整的智能体交互能力
 */
export function useAgent() {
  // ==================== 状态 ====================
  const currentSession = ref<ChatSession | null>(null)
  const agentState = ref<AgentState>('idle')
  const streamingText = ref('')
  const currentConfig = ref<LLMConfig | null>(null)
  const error = ref<string | null>(null)

  // ==================== 服务实例 ====================
  const eventBus = new EventBus()
  const contextManager = new ContextManager()
  const mcpToolkit = new MCPToolkit()
  const sessionRepo = new SessionRepository()
  const configRepo = new ConfigRepository()

  // ==================== 计算属性 ====================
  const messages = computed(() => currentSession.value?.messages || [])
  const isLoading = computed(() => agentState.value !== 'idle' && agentState.value !== 'error')
  const canSend = computed(() => agentState.value === 'idle' && !!currentConfig.value)

  // ==================== 事件订阅 ====================
  const unsubscribes: (() => void)[] = []

  // 订阅流事件
  unsubscribes.push(
    eventBus.on<StreamEvent>('text_delta', (event) => {
      streamingText.value += (event.data as { text: string }).text
    })
  )

  unsubscribes.push(
    eventBus.on<StreamEvent>('message_start', () => {
      streamingText.value = ''
      agentState.value = 'responding'
    })
  )

  unsubscribes.push(
    eventBus.on<StreamEvent>('message_stop', () => {
      agentState.value = 'idle'
    })
  )

  unsubscribes.push(
    eventBus.on<StreamEvent>('tool_use_start', () => {
      agentState.value = 'tool_calling'
    })
  )

  unsubscribes.push(
    eventBus.on<StreamEvent>('error', (event) => {
      error.value = (event.data as { error: string }).error
      agentState.value = 'error'
    })
  )

  // ==================== 初始化 ====================
  async function init() {
    // 加载默认配置
    currentConfig.value = await configRepo.getDefault()
  }

  // ==================== 会话管理 ====================
  function createSession(): ChatSession {
    const session: ChatSession = {
      id: `session_${Date.now()}`,
      title: '新对话',
      messages: [],
      modelConfigId: currentConfig.value?.id || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    currentSession.value = session
    return session
  }

  async function loadSession(sessionId: string) {
    const session = await sessionRepo.findById(sessionId)
    if (session) {
      currentSession.value = session
    }
  }

  // ==================== 发送消息 ====================
  async function sendMessage(content: string, attachments?: unknown[]) {
    if (!currentSession.value || !currentConfig.value) {
      error.value = '请先配置模型'
      return
    }

    error.value = null
    agentState.value = 'thinking'
    streamingText.value = ''

    try {
      // 1. 创建用户消息
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: [{ type: 'text', text: content }],
        timestamp: Date.now()
      }
      currentSession.value.messages.push(userMessage)

      // 2. 准备上下文
      const contextMessages = await contextManager.prepareMessages(
        currentSession.value,
        getSchedulerPrompt()
      )

      // 3. 创建 LLM 适配器
      const llmAdapter = LLMFactory.create(currentConfig.value)

      // 4. 获取工具列表
      const tools = mcpToolkit.getTools()

      // 5. 调用模型 (流式)
      let response = await llmAdapter.chat(
        contextMessages,
        tools,
        (event) => eventBus.emit(event)
      )

      // 6. 处理工具调用循环
      while (response.toolCalls && response.toolCalls.length > 0) {
        // 添加助手消息 (包含工具调用)
        currentSession.value.messages.push(response)

        // 执行工具
        for (const toolCall of response.toolCalls) {
          agentState.value = 'tool_calling'

          const result = await mcpToolkit.execute(toolCall.name, toolCall.arguments)

          // 添加工具结果消息
          const toolResultMessage: Message = {
            id: `tool_${Date.now()}_${toolCall.id}`,
            role: 'tool',
            content: [],
            timestamp: Date.now(),
            toolResults: [{
              toolCallId: toolCall.id,
              content: result
            }]
          }
          currentSession.value.messages.push(toolResultMessage)
        }

        // 重新准备上下文并继续对话
        const newContextMessages = await contextManager.prepareMessages(
          currentSession.value,
          getSchedulerPrompt()
        )

        streamingText.value = ''
        response = await llmAdapter.chat(
          newContextMessages,
          tools,
          (event) => eventBus.emit(event)
        )
      }

      // 7. 添加最终助手回复
      currentSession.value.messages.push(response)

      // 8. 更新会话标题
      if (currentSession.value.messages.length <= 3) {
        currentSession.value.title = content.slice(0, 20) +
          (content.length > 20 ? '...' : '')
      }

      // 9. 保存会话
      currentSession.value.updatedAt = Date.now()
      await sessionRepo.save(currentSession.value)

    } catch (err) {
      error.value = String(err)
      agentState.value = 'error'
      console.error('[useAgent] 发送消息失败:', err)
    } finally {
      if (agentState.value !== 'error') {
        agentState.value = 'idle'
      }
    }
  }

  // ==================== 模型切换 ====================
  async function switchConfig(config: LLMConfig) {
    currentConfig.value = config
    await configRepo.setDefault(config.id)
  }

  // ==================== 清理 ====================
  function clearSession() {
    if (currentSession.value) {
      currentSession.value.messages = []
      currentSession.value.summary = undefined
    }
  }

  onUnmounted(() => {
    unsubscribes.forEach(unsub => unsub())
    eventBus.destroy()
  })

  return {
    // 状态
    currentSession,
    messages,
    agentState,
    streamingText,
    currentConfig,
    error,
    isLoading,
    canSend,

    // 方法
    init,
    createSession,
    loadSession,
    sendMessage,
    switchConfig,
    clearSession,

    // 事件总线 (用于自定义订阅)
    eventBus
  }
}
```

---

## 六、存储层设计

### 6.1 数据库表结构

```sql
-- 模型配置表
CREATE TABLE IF NOT EXISTS llm_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT,
  model TEXT NOT NULL,
  max_tokens INTEGER DEFAULT 4096,
  temperature REAL DEFAULT 0.7,
  is_default INTEGER DEFAULT 0,
  supports_vision INTEGER DEFAULT 0,
  supports_tools INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  model_config_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,           -- JSON 格式存储 ContentPart[]
  tool_calls TEXT,                 -- JSON 格式存储 ToolCall[]
  tool_results TEXT,               -- JSON 格式存储 ToolResult[]
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at DESC);
```

---

## 七、UI 页面设计

### 7.1 对话页面

```vue
<!-- pages/agent/Chat.vue -->
<script lang="ts" setup>
import { ref, onMounted, nextTick } from 'nativescript-vue'
import { useAgent } from '~/composables/agent/useAgent'
import ChatMessage from '~/components/agent/ChatMessage.vue'
import ChatInput from '~/components/agent/ChatInput.vue'

const scrollView = ref()
const {
  messages,
  agentState,
  streamingText,
  currentConfig,
  error,
  isLoading,
  canSend,
  init,
  createSession,
  sendMessage
} = useAgent()

onMounted(async () => {
  await init()
  createSession()
})

async function handleSend(text: string) {
  await sendMessage(text)
  // 滚动到底部
  nextTick(() => {
    scrollView.value?.nativeView?.scrollToVerticalOffset(
      scrollView.value?.nativeView?.scrollableHeight,
      true
    )
  })
}

function navigateToConfig() {
  // 导航到配置页
}

function navigateToHistory() {
  // 导航到历史页
}
</script>

<template>
  <Page>
    <GridLayout rows="auto, *, auto">
      <!-- 顶部栏 -->
      <GridLayout row="0" columns="auto, *, auto, auto" class="p-4 bg-white border-b border-gray-100">
        <Label col="0" text="←" class="text-xl" @tap="$navigateBack()" />
        <Label col="1" :text="currentConfig?.name || '未配置'" class="text-lg font-medium text-center" />
        <Label col="2" text="⚙" class="text-xl mr-4" @tap="navigateToConfig" />
        <Label col="3" text="📋" class="text-xl" @tap="navigateToHistory" />
      </GridLayout>

      <!-- 消息列表 -->
      <ScrollView row="1" ref="scrollView">
        <StackLayout class="p-4">
          <!-- 欢迎语 -->
          <StackLayout v-if="messages.length === 0" class="p-4 bg-gray-50 rounded-xl">
            <Label text="你好！我是小历，你的日程助手。" class="text-base text-gray-800 mb-2" />
            <Label text="我可以帮你：" class="text-sm text-gray-600 mb-1" />
            <Label text="• 查看和管理日程" class="text-sm text-gray-600" />
            <Label text="• 创建新的日程安排" class="text-sm text-gray-600" />
            <Label text="• 设置提醒通知" class="text-sm text-gray-600" />
            <Label text="• 搜索相关信息" class="text-sm text-gray-600 mt-2" />
          </StackLayout>

          <!-- 消息列表 -->
          <ChatMessage
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            class="mb-3"
          />

          <!-- 流式输出 -->
          <ChatMessage
            v-if="streamingText"
            :message="{
              id: 'streaming',
              role: 'assistant',
              content: [{ type: 'text', text: streamingText }],
              timestamp: Date.now()
            }"
            :is-streaming="true"
            class="mb-3"
          />

          <!-- 加载状态 -->
          <StackLayout v-if="isLoading && !streamingText" class="items-center p-4">
            <ActivityIndicator busy="true" />
            <Label
              :text="agentState === 'thinking' ? '思考中...' :
                     agentState === 'tool_calling' ? '执行操作中...' : '处理中...'"
              class="text-sm text-gray-500 mt-2"
            />
          </StackLayout>

          <!-- 错误提示 -->
          <Label
            v-if="error"
            :text="error"
            class="text-sm text-red-500 p-3 bg-red-50 rounded-lg"
            textWrap="true"
          />
        </StackLayout>
      </ScrollView>

      <!-- 输入区域 -->
      <ChatInput
        row="2"
        :disabled="!canSend"
        @send="handleSend"
      />
    </GridLayout>
  </Page>
</template>
```

---

## 八、实现步骤

### Phase 1: 基础架构 (核心)

| 步骤 | 任务 | 文件 |
|------|------|------|
| 1 | 类型定义 | `types/agent.ts` |
| 2 | EventBus 事件总线 | `services/agent/engine/EventBus.ts` |
| 3 | MealyMachine 状态机 | `services/agent/engine/MealyMachine.ts` |
| 4 | LLMAdapter 基类 | `services/agent/llm/LLMAdapter.ts` |
| 5 | OpenAI 适配器 | `services/agent/llm/providers/OpenAIAdapter.ts` |
| 6 | 配置存储 | `services/agent/storage/ConfigRepository.ts` |

### Phase 2: MCP 工具 (核心)

| 步骤 | 任务 | 文件 |
|------|------|------|
| 7 | MCPToolkit 工具管理 | `services/agent/mcp/MCPToolkit.ts` |
| 8 | 日程工具 | `services/agent/mcp/tools/CalendarTool.ts` |
| 9 | 通知工具 | `services/agent/mcp/tools/NotificationTool.ts` |
| 10 | 搜索工具 | `services/agent/mcp/tools/WebSearchTool.ts` |

### Phase 3: 会话管理

| 步骤 | 任务 | 文件 |
|------|------|------|
| 11 | 上下文管理器 | `services/agent/context/ContextManager.ts` |
| 12 | 提示词模板 | `services/agent/prompt/templates/scheduler.ts` |
| 13 | 会话存储 | `services/agent/storage/SessionRepository.ts` |
| 14 | useAgent Hook | `composables/agent/useAgent.ts` |

### Phase 4: UI 页面

| 步骤 | 任务 | 文件 |
|------|------|------|
| 15 | 消息组件 | `components/agent/ChatMessage.vue` |
| 16 | 输入组件 | `components/agent/ChatInput.vue` |
| 17 | 对话页面 | `pages/agent/Chat.vue` |
| 18 | 配置页面 | `pages/agent/Config.vue` |
| 19 | 历史页面 | `pages/agent/History.vue` |

### Phase 5: 文件解析 (增强)

| 步骤 | 任务 | 文件 |
|------|------|------|
| 20 | PDF 解析 | `services/agent/parser/PDFParser.ts` |
| 21 | Word 解析 | `services/agent/parser/WordParser.ts` |
| 22 | Excel 解析 | `services/agent/parser/ExcelParser.ts` |
| 23 | 图片识别 | `services/agent/parser/ImageParser.ts` |

---

## 九、设计模式速查

| 模式 | 应用位置 | 说明 |
|------|---------|------|
| **Mealy Machine** | `MealyMachine.ts` | 纯函数事件处理，可测试 |
| **Pub/Sub** | `EventBus.ts` | 事件驱动，解耦组件 |
| **Adapter** | `LLMAdapter.ts` | 多模型适配 |
| **Factory** | `LLMFactory.ts` | 动态创建适配器 |
| **Repository** | `*Repository.ts` | 数据访问抽象 |
| **Strategy** | `useAgent.ts` | 上下文归纳策略 |
| **Facade** | `useAgent.ts` | 统一 API 入口 |
| **Combinator** | `MealyMachine.ts` | 处理器组合 |

---

## 十、依赖安装

```bash
cd apps/mobile

# 网络请求 (已内置)
# @nativescript/core 包含 Http

# 文件解析 (可选)
pnpm add pdfjs-dist xlsx mammoth
```

---

## 十一、参考资源

- [AgentX 架构文档](../AgentX/docs/)
- [NativeScript Core](https://docs.nativescript.org/)
- [OpenAI API](https://platform.openai.com/docs/)
- [MCP 协议规范](https://modelcontextprotocol.io/)

---

**文档版本**: 1.0.0
**创建日期**: 2024-12-08
**基于**: AgentX 架构设计
