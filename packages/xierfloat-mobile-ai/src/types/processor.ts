/**
 * 处理器类型定义
 *
 * 基于 Mealy Machine 模式: (state, input) → (state, output[])
 */

import type { AgentState, AgentEvent, StreamEvent } from './event'
import type { Message } from './message'
import type { ToolExecutionResult } from './tool'

/** 处理器函数签名 */
export type Processor<TState, TInput, TOutput> = (
  state: TState,
  input: TInput
) => [TState, TOutput[]]

/** 异步处理器函数签名 */
export type AsyncProcessor<TState, TInput, TOutput> = (
  state: TState,
  input: TInput
) => Promise<[TState, TOutput[]]>

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

/** 消息处理器输入 */
export interface MessageProcessorInput {
  type: 'user_input' | 'tool_result'
  content: string | ToolExecutionResult
  metadata?: Record<string, unknown>
}

/** 消息处理器输出 */
export interface MessageProcessorOutput {
  message: Message
  shouldStream: boolean
}

/** 工具处理器输入 */
export interface ToolProcessorInput {
  toolCallId: string
  toolName: string
  arguments: Record<string, unknown>
}

/** 工具处理器输出 */
export interface ToolProcessorOutput {
  toolCallId: string
  result: ToolExecutionResult
}

/** 处理器组合器 */
export const ProcessorCombinators = {
  /** 串联组合: 将两个处理器串联 */
  pipe<TState, TInput, TMiddle, TOutput>(
    first: Processor<TState, TInput, TMiddle>,
    second: Processor<TState, TMiddle, TOutput>
  ): Processor<TState, TInput, TOutput> {
    return (state: TState, input: TInput): [TState, TOutput[]] => {
      const [midState, midOutputs] = first(state, input)
      const allOutputs: TOutput[] = []
      let currentState = midState

      for (const midOutput of midOutputs) {
        const [newState, outputs] = second(currentState, midOutput)
        currentState = newState
        allOutputs.push(...outputs)
      }

      return [currentState, allOutputs]
    }
  },

  /** 并联组合: 同时执行多个处理器 */
  parallel<TState, TInput, TOutput>(
    processors: Array<Processor<TState, TInput, TOutput>>
  ): Processor<TState, TInput, TOutput> {
    return (state: TState, input: TInput): [TState, TOutput[]] => {
      const allOutputs: TOutput[] = []
      let currentState = state

      for (const processor of processors) {
        const [newState, outputs] = processor(currentState, input)
        currentState = newState
        allOutputs.push(...outputs)
      }

      return [currentState, allOutputs]
    }
  },

  /** 条件组合: 根据条件选择处理器 */
  conditional<TState, TInput, TOutput>(
    condition: (state: TState, input: TInput) => boolean,
    ifTrue: Processor<TState, TInput, TOutput>,
    ifFalse: Processor<TState, TInput, TOutput>
  ): Processor<TState, TInput, TOutput> {
    return (state: TState, input: TInput): [TState, TOutput[]] => {
      if (condition(state, input)) {
        return ifTrue(state, input)
      }
      return ifFalse(state, input)
    }
  },

  /** 映射组合: 转换输出 */
  map<TState, TInput, TOutput, TMapped>(
    processor: Processor<TState, TInput, TOutput>,
    mapper: (output: TOutput) => TMapped
  ): Processor<TState, TInput, TMapped> {
    return (state: TState, input: TInput): [TState, TMapped[]] => {
      const [newState, outputs] = processor(state, input)
      return [newState, outputs.map(mapper)]
    }
  },

  /** 过滤组合: 过滤输出 */
  filter<TState, TInput, TOutput>(
    processor: Processor<TState, TInput, TOutput>,
    predicate: (output: TOutput) => boolean
  ): Processor<TState, TInput, TOutput> {
    return (state: TState, input: TInput): [TState, TOutput[]] => {
      const [newState, outputs] = processor(state, input)
      return [newState, outputs.filter(predicate)]
    }
  },

  /** 空处理器: 不产生输出 */
  empty<TState, TInput, TOutput>(): Processor<TState, TInput, TOutput> {
    return (state: TState, _input: TInput): [TState, TOutput[]] => {
      return [state, []]
    }
  },

  /** 恒等处理器: 输入即输出 */
  identity<TState, T>(): Processor<TState, T, T> {
    return (state: TState, input: T): [TState, T[]] => {
      return [state, [input]]
    }
  }
}
