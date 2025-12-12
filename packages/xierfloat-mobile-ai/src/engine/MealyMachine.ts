/**
 * Mealy Machine 状态机实现
 *
 * 核心模式: (state, input) → (state, output[])
 * 纯函数设计，无副作用
 */

import type {
  AgentInternalState,
  StreamProcessor,
  StreamProcessorInput,
  StreamProcessorOutput
} from '../types/processor'
import type { AgentState, StreamEvent } from '../types/event'
import { createInitialAgentState } from '../types/processor'

/**
 * 流处理器 - 将流事件转换为 Agent 事件
 *
 * 这是 Mealy Machine 的核心实现
 */
export const streamProcessor: StreamProcessor = (
  state: AgentInternalState,
  input: StreamProcessorInput
): [AgentInternalState, StreamProcessorOutput[]] => {
  const outputs: StreamProcessorOutput[] = []
  let newState = { ...state }

  switch (input.type) {
    case 'message_start': {
      newState = {
        ...newState,
        current: 'responding',
        currentMessageId: input.data.messageId,
        accumulatedText: ''
      }
      // 发出状态变更事件
      if (state.current !== 'responding') {
        outputs.push({
          type: 'state_change',
          timestamp: input.timestamp,
          data: {
            previous: state.current,
            current: 'responding'
          }
        })
      }
      // 传递原始事件
      outputs.push(input)
      break
    }

    case 'text_delta': {
      newState = {
        ...newState,
        accumulatedText: newState.accumulatedText + input.data.text
      }
      // 传递原始事件
      outputs.push(input)
      break
    }

    case 'tool_use_start': {
      newState = {
        ...newState,
        current: 'tool_calling',
        currentToolCall: {
          id: input.data.toolCallId,
          name: input.data.toolName,
          partialJson: ''
        }
      }
      // 发出状态变更事件
      if (state.current !== 'tool_calling') {
        outputs.push({
          type: 'state_change',
          timestamp: input.timestamp,
          data: {
            previous: state.current,
            current: 'tool_calling'
          }
        })
      }
      // 传递原始事件
      outputs.push(input)
      break
    }

    case 'tool_use_delta': {
      if (newState.currentToolCall) {
        newState = {
          ...newState,
          currentToolCall: {
            ...newState.currentToolCall,
            partialJson: newState.currentToolCall.partialJson + input.data.partialJson
          }
        }
      }
      // 传递原始事件
      outputs.push(input)
      break
    }

    case 'tool_use_stop': {
      // 解析完整的工具调用参数
      if (newState.currentToolCall) {
        try {
          const args = JSON.parse(newState.currentToolCall.partialJson || '{}') as Record<string, unknown>
          newState = {
            ...newState,
            pendingToolCalls: [
              ...newState.pendingToolCalls,
              {
                id: newState.currentToolCall.id,
                name: newState.currentToolCall.name,
                arguments: args
              }
            ],
            currentToolCall: undefined
          }
        } catch {
          // JSON 解析失败，记录错误
          console.error('[MealyMachine] Failed to parse tool arguments')
        }
      }
      // 传递原始事件
      outputs.push(input)
      break
    }

    case 'message_stop': {
      const stopReason = input.data.stopReason

      if (stopReason === 'tool_use' && newState.pendingToolCalls.length > 0) {
        // 有待执行的工具调用，保持 tool_calling 状态
        newState = {
          ...newState,
          current: 'tool_calling'
        }
      } else {
        // 消息结束，回到空闲状态
        newState = {
          ...newState,
          current: 'idle',
          currentMessageId: undefined
        }
        // 发出状态变更事件
        outputs.push({
          type: 'state_change',
          timestamp: input.timestamp,
          data: {
            previous: state.current,
            current: 'idle'
          }
        })
      }
      // 传递原始事件
      outputs.push(input)
      break
    }

    case 'stream_error': {
      newState = {
        ...newState,
        current: 'error',
        error: input.data.error
      }
      // 发出状态变更事件
      outputs.push({
        type: 'state_change',
        timestamp: input.timestamp,
        data: {
          previous: state.current,
          current: 'error'
        }
      })
      // 传递原始事件
      outputs.push(input)
      break
    }
  }

  return [newState, outputs]
}

/**
 * Mealy Machine 运行器
 */
export class MealyMachine<TState, TInput, TOutput> {
  private state: TState
  private processor: (state: TState, input: TInput) => [TState, TOutput[]]

  constructor(
    initialState: TState,
    processor: (state: TState, input: TInput) => [TState, TOutput[]]
  ) {
    this.state = initialState
    this.processor = processor
  }

  /**
   * 处理输入，返回输出
   */
  process(input: TInput): TOutput[] {
    const [newState, outputs] = this.processor(this.state, input)
    this.state = newState
    return outputs
  }

  /**
   * 批量处理输入
   */
  processBatch(inputs: TInput[]): TOutput[] {
    const allOutputs: TOutput[] = []
    for (const input of inputs) {
      allOutputs.push(...this.process(input))
    }
    return allOutputs
  }

  /**
   * 获取当前状态
   */
  getState(): TState {
    return this.state
  }

  /**
   * 重置状态
   */
  reset(state: TState): void {
    this.state = state
  }
}

/**
 * 创建 Agent 流处理状态机
 */
export function createStreamMachine(): MealyMachine<
  AgentInternalState,
  StreamEvent,
  StreamProcessorOutput
> {
  return new MealyMachine(createInitialAgentState(), streamProcessor)
}

/**
 * 状态转换辅助函数
 */
export const StateTransitions = {
  /** 检查是否可以开始新对话 */
  canStartConversation(state: AgentState): boolean {
    return state === 'idle' || state === 'error'
  },

  /** 检查是否可以中断 */
  canInterrupt(state: AgentState): boolean {
    return state === 'thinking' || state === 'responding' || state === 'tool_calling'
  },

  /** 检查是否正在处理 */
  isProcessing(state: AgentState): boolean {
    return state === 'thinking' || state === 'responding' || state === 'tool_calling'
  },

  /** 检查是否为终态 */
  isTerminal(state: AgentState): boolean {
    return state === 'idle' || state === 'error' || state === 'interrupted'
  }
}
