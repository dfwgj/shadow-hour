/**
 * LLM 适配器类型定义
 */

import type { Message } from '../types/message'
import type { StreamEvent } from '../types/event'
import type { ToolDefinition } from '../types/tool'
import type { LLMConfig } from '../types/config'

/** 聊天请求参数 */
export interface ChatRequest {
  /** 消息历史 */
  messages: Message[]
  /** 系统提示词 */
  systemPrompt?: string
  /** 可用工具 */
  tools?: ToolDefinition[]
  /** 最大 Token 数 (覆盖配置) */
  maxTokens?: number
  /** 温度参数 (覆盖配置) */
  temperature?: number
  /** 停止序列 */
  stopSequences?: string[]
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}

/** 聊天响应 (非流式) */
export interface ChatResponse {
  /** 响应消息 */
  message: Message
  /** Token 使用量 */
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  /** 停止原因 */
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
}

/** 流式回调 */
export type StreamCallback = (event: StreamEvent) => void

/** 流式响应控制器 */
export interface StreamController {
  /** 取消流 */
  abort(): void
  /** 是否已取消 */
  readonly aborted: boolean
}

/** LLM 适配器接口 */
export interface LLMAdapter {
  /** 适配器名称 */
  readonly name: string
  /** 是否支持流式 */
  readonly supportsStreaming: boolean
  /** 是否支持工具调用 */
  readonly supportsTools: boolean
  /** 是否支持视觉 */
  readonly supportsVision: boolean

  /**
   * 发送聊天请求 (非流式)
   */
  chat(request: ChatRequest): Promise<ChatResponse>

  /**
   * 发送聊天请求 (流式)
   */
  stream(request: ChatRequest, callback: StreamCallback): StreamController

  /**
   * 验证配置有效性
   */
  validateConfig(): Promise<{ valid: boolean; error?: string }>

  /**
   * 估算 Token 数量
   */
  estimateTokens?(text: string): number
}

/** 适配器工厂函数 */
export type LLMAdapterFactory = (config: LLMConfig) => LLMAdapter

/** 已注册的适配器工厂 */
export interface LLMAdapterRegistry {
  /** 注册适配器工厂 */
  register(provider: string, factory: LLMAdapterFactory): void
  /** 获取适配器工厂 */
  get(provider: string): LLMAdapterFactory | undefined
  /** 创建适配器实例 */
  create(config: LLMConfig): LLMAdapter
  /** 获取所有已注册的提供商 */
  providers(): string[]
}
