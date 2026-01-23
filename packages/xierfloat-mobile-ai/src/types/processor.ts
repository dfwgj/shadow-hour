/**
 * 处理器类型定义
 *
 * 基于 Mealy Machine 模式: (state, input) → (state, output[])
 */

import type { AgentState, AgentEvent, StreamEvent } from './event'

/** 处理器函数签名 */
export type Processor<TState, TInput, TOutput> = (
  state: TState,
  input: TInput
) => [TState, TOutput[]]

/** Agent 内部状态 */
export interface AgentInternalState {
  /** 当前状态 */
  current: AgentState
  /** 当前消息 ID */
  currentMessageId?: string
  /** 累积的文本内容 */
  accumulatedText: string
  /** 当前工具调用 */
  currentToolCall?: {
    id: string
    name: string
    partialJson: string
  }
  /** 待处理的工具调用列表 */
  pendingToolCalls: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
  }>
  /** 错误信息 */
  error?: string
}

/** 创建初始 Agent 状态 */
export function createInitialAgentState(): AgentInternalState {
  return {
    current: 'idle',
    accumulatedText: '',
    pendingToolCalls: []
  }
}

/** 流处理器输入 */
export type StreamProcessorInput = StreamEvent

/** 流处理器输出 */
export type StreamProcessorOutput = AgentEvent

/** 流处理器类型 */
export type StreamProcessor = Processor<AgentInternalState, StreamProcessorInput, StreamProcessorOutput>
