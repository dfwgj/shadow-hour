/**
 * 事件类型定义
 *
 * 参考 AgentX 四层事件系统设计
 */

/** Agent 状态 */
export type AgentState =
  | 'idle'          // 空闲，等待输入
  | 'thinking'      // 思考中，等待 LLM 响应
  | 'responding'    // 响应中，流式输出
  | 'tool_calling'  // 工具调用中
  | 'interrupted'   // 已中断
  | 'error'         // 错误状态

// ==================== Layer 1: Stream Events (流事件) ====================

/** 流事件类型 */
export type StreamEventType =
  | 'message_start'
  | 'text_delta'
  | 'tool_use_start'
  | 'tool_use_delta'
  | 'tool_use_stop'
  | 'message_stop'
  | 'stream_error'

/** 消息开始事件数据 */
export interface MessageStartData {
  messageId: string
  model?: string
}

/** 文本增量事件数据 */
export interface TextDeltaData {
  text: string
}

/** 工具调用开始事件数据 */
export interface ToolUseStartData {
  toolCallId: string
  toolName: string
}

/** 工具调用增量事件数据 */
export interface ToolUseDeltaData {
  partialJson: string
}

/** 工具调用结束事件数据 */
export interface ToolUseStopData {
  toolCallId: string
}

/** 消息结束事件数据 */
export interface MessageStopData {
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
}

/** 流错误事件数据 */
export interface StreamErrorData {
  error: string
  code?: string
}

/** 流事件基础接口 */
export interface BaseStreamEvent<T extends StreamEventType, D> {
  type: T
  timestamp: number
  data: D
}

/** 流事件联合类型 */
export type StreamEvent =
  | BaseStreamEvent<'message_start', MessageStartData>
  | BaseStreamEvent<'text_delta', TextDeltaData>
  | BaseStreamEvent<'tool_use_start', ToolUseStartData>
  | BaseStreamEvent<'tool_use_delta', ToolUseDeltaData>
  | BaseStreamEvent<'tool_use_stop', ToolUseStopData>
  | BaseStreamEvent<'message_stop', MessageStopData>
  | BaseStreamEvent<'stream_error', StreamErrorData>

// ==================== Layer 2: State Events (状态事件) ====================

/** 状态事件类型 */
export type StateEventType =
  | 'state_change'
  | 'conversation_start'
  | 'conversation_end'

/** 状态变更事件数据 */
export interface StateChangeData {
  previous: AgentState
  current: AgentState
}

/** 对话开始事件数据 */
export interface ConversationStartData {
  sessionId: string
  timestamp: number
}

/** 对话结束事件数据 */
export interface ConversationEndData {
  sessionId: string
  messageCount: number
  duration: number
}

/** 状态事件联合类型 */
export type StateEvent =
  | BaseStreamEvent<'state_change', StateChangeData>
  | BaseStreamEvent<'conversation_start', ConversationStartData>
  | BaseStreamEvent<'conversation_end', ConversationEndData>

// ==================== Layer 3: Message Events (消息事件) ====================

import type { Message } from './message'

/** 消息事件类型 */
export type MessageEventType =
  | 'user_message'
  | 'assistant_message'
  | 'tool_call_message'
  | 'tool_result_message'

/** 消息事件 */
export interface MessageEvent {
  type: MessageEventType
  timestamp: number
  data: Message
}

// ==================== Layer 4: Tool Events (工具事件) ====================

/** 工具事件类型 */
export type ToolEventType =
  | 'tool_call_start'
  | 'tool_call_result'
  | 'tool_call_error'

/** 工具调用开始数据 */
export interface ToolCallStartEventData {
  toolCallId: string
  toolName: string
  arguments: Record<string, unknown>
}

/** 工具调用结果数据 */
export interface ToolCallResultEventData {
  toolCallId: string
  toolName: string
  result: string
  duration: number
}

/** 工具调用错误数据 */
export interface ToolCallErrorEventData {
  toolCallId: string
  toolName: string
  error: string
}

/** 工具事件联合类型 */
export type ToolEvent =
  | BaseStreamEvent<'tool_call_start', ToolCallStartEventData>
  | BaseStreamEvent<'tool_call_result', ToolCallResultEventData>
  | BaseStreamEvent<'tool_call_error', ToolCallErrorEventData>

// ==================== All Events ====================

/** 所有 Agent 事件 */
export type AgentEvent = StreamEvent | StateEvent | MessageEvent | ToolEvent

/** 事件处理器 */
export type EventHandler<T = AgentEvent> = (event: T) => void

/** 取消订阅函数 */
export type Unsubscribe = () => void
