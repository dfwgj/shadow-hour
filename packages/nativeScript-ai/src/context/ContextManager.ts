/**
 * 上下文管理器 - 管理对话上下文和 Token 优化
 * 提供上下文窗口管理、Token 估计、摘要生成等功能
 * @author DF蓝梦/xierfloat
 * @date 2025-12-20
 */

import type { Message } from '../types/message'
import type { LLMAdapter } from '../llm/types'

/** 上下文管理配置 */
export interface ContextManagerConfig {
  /** 最大 Token 数 */
  maxTokens: number
  /** 保留最近消息数 */
  reserveRecentMessages: number
  /** 摘要触发阈值 (Token 比例) */
  summaryThreshold: number
  /** 是否启用自动摘要 */
  enableAutoSummary: boolean
}

/** 上下文窗口信息 */
export interface ContextWindow {
  /** 窗口内消息 */
  messages: Message[]
  /** 当前 Token 数 */
  tokenCount: number
  /** 是否已摘要 */
  isSummarized: boolean
  /** 摘要内容 (如果有) */
  summary?: string
}

/** 默认配置 */
const DEFAULT_CONFIG: ContextManagerConfig = {
  maxTokens: 8000,
  reserveRecentMessages: 5,
  summaryThreshold: 0.8,
  enableAutoSummary: true
}

/**
 * 上下文管理器实现
 */
export class ContextManager {
  private config: ContextManagerConfig
  private estimateTokens: (text: string) => number

  constructor(
    config?: Partial<ContextManagerConfig>,
    tokenEstimator?: (text: string) => number
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.estimateTokens = tokenEstimator || this.defaultTokenEstimator
  }

  /**
   * 获取上下文窗口
   */
  getContextWindow(
    messages: Message[],
    systemPrompt?: string
  ): ContextWindow {
    const systemTokens = systemPrompt ? this.estimateTokens(systemPrompt) : 0
    const availableTokens = this.config.maxTokens - systemTokens

    // 从最新消息开始向前选择
    const selectedMessages: Message[] = []
    let currentTokens = 0

    // 先保留最近的消息
    const recentMessages = messages.slice(-this.config.reserveRecentMessages)

    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i]
      if (!msg) continue
      const msgTokens = this.estimateMessageTokens(msg)

      if (currentTokens + msgTokens <= availableTokens) {
        selectedMessages.unshift(msg)
        currentTokens += msgTokens
      } else {
        break
      }
    }

    // 如果还有空间，继续添加更早的消息
    const olderMessages = messages.slice(0, -this.config.reserveRecentMessages)

    for (let i = olderMessages.length - 1; i >= 0; i--) {
      const msg = olderMessages[i]
      if (!msg) continue
      const msgTokens = this.estimateMessageTokens(msg)

      if (currentTokens + msgTokens <= availableTokens) {
        selectedMessages.unshift(msg)
        currentTokens += msgTokens
      } else {
        break
      }
    }

    return {
      messages: selectedMessages,
      tokenCount: currentTokens + systemTokens,
      isSummarized: selectedMessages.length < messages.length
    }
  }

  /**
   * 检查是否需要摘要
   */
  needsSummary(messages: Message[], systemPrompt?: string): boolean {
    if (!this.config.enableAutoSummary) {
      return false
    }

    const totalTokens = this.estimateTotalTokens(messages, systemPrompt)
    return totalTokens > this.config.maxTokens * this.config.summaryThreshold
  }

  /**
   * 生成摘要 (需要 LLM 适配器)
   */
  async generateSummary(
    messages: Message[],
    adapter: LLMAdapter
  ): Promise<string> {
    const summaryPrompt = this.buildSummaryPrompt(messages)

    const response = await adapter.chat({
      messages: [{
        id: 'summary_request',
        role: 'user',
        content: [{ type: 'text', text: summaryPrompt }],
        timestamp: Date.now()
      }],
      systemPrompt: '你是一个对话摘要专家。请简洁地总结对话的关键信息。',
      maxTokens: 500
    })

    const textContent = response.message.content.find((c) => c.type === 'text')
    return textContent && textContent.type === 'text' ? textContent.text : ''
  }

  /**
   * 构建摘要提示
   */
  private buildSummaryPrompt(messages: Message[]): string {
    const conversationText = messages
      .map((msg) => {
        const role = msg.role === 'user' ? '用户' : '助手'
        const text = msg.content
          .filter((c) => c.type === 'text')
          .map((c) => c.type === 'text' ? c.text : '')
          .join('')
        return `${role}: ${text}`
      })
      .join('\n')

    return `请总结以下对话的关键信息，保留重要的上下文和决策：

${conversationText}

请用简洁的方式总结，包括：
1. 讨论的主要话题
2. 做出的关键决策
3. 待办事项或后续行动`
  }

  /**
   * 估算消息 Token 数
   */
  estimateMessageTokens(message: Message): number {
    let tokens = 0

    for (const part of message.content) {
      if (part.type === 'text') {
        tokens += this.estimateTokens(part.text)
      } else if (part.type === 'image') {
        // 图片估算为固定 Token 数
        tokens += 85
      } else if (part.type === 'file') {
        tokens += this.estimateTokens(part.extractedText || part.name)
      }
    }

    // 工具调用
    if (message.toolCalls) {
      for (const tc of message.toolCalls) {
        tokens += this.estimateTokens(tc.name)
        tokens += this.estimateTokens(JSON.stringify(tc.arguments))
      }
    }

    // 工具结果
    if (message.toolResults) {
      for (const tr of message.toolResults) {
        tokens += this.estimateTokens(tr.content)
      }
    }

    return tokens
  }

  /**
   * 估算总 Token 数
   */
  estimateTotalTokens(messages: Message[], systemPrompt?: string): number {
    let total = systemPrompt ? this.estimateTokens(systemPrompt) : 0

    for (const msg of messages) {
      total += this.estimateMessageTokens(msg)
    }

    return total
  }

  /**
   * 默认 Token 估算器
   */
  private defaultTokenEstimator(text: string): number {
    // 简单估算: 英文约 4 字符/token, 中文约 2 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars / 2 + otherChars / 4)
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): ContextManagerConfig {
    return { ...this.config }
  }
}

/**
 * 创建上下文管理器
 */
export function createContextManager(
  config?: Partial<ContextManagerConfig>,
  tokenEstimator?: (text: string) => number
): ContextManager {
  return new ContextManager(config, tokenEstimator)
}
