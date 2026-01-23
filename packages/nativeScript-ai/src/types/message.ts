/**
 * 消息类型定义
 */

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

/** 内容部件类型 */
export type ContentPartType = 'text' | 'image' | 'file'

/** 文本内容 */
export interface TextPart {
  type: 'text'
  text: string
}

/** 图片内容 */
export interface ImagePart {
  type: 'image'
  /** 图片 URL (base64 或 file://) */
  url: string
  /** MIME 类型 */
  mimeType?: string
  /** 图片描述 (可选) */
  alt?: string
}

/** 文件内容 */
export interface FilePart {
  type: 'file'
  /** 文件名 */
  name: string
  /** 文件 URI */
  uri: string
  /** MIME 类型 */
  mimeType: string
  /** 文件大小 (字节) */
  size?: number
  /** 解析后的文本内容 */
  extractedText?: string
}

/** 内容部件联合类型 */
export type ContentPart = TextPart | ImagePart | FilePart

/** 工具调用状态 */
export type ToolCallStatus = 'pending' | 'executing' | 'completed' | 'error'

/** 工具调用 */
export interface ToolCall {
  /** 工具调用 ID */
  id: string
  /** 工具名称 */
  name: string
  /** 调用参数 */
  arguments: Record<string, unknown>
  /** 执行状态 */
  status: ToolCallStatus
}

/** 工具执行结果 */
export interface ToolResult {
  /** 关联的工具调用 ID */
  toolCallId: string
  /** 执行结果内容 (JSON 字符串) */
  content: string
  /** 是否为错误结果 */
  isError?: boolean
}

/** 消息 */
export interface Message {
  /** 消息唯一标识 */
  id: string
  /** 消息角色 */
  role: MessageRole
  /** 消息内容 */
  content: ContentPart[]
  /** 时间戳 */
  timestamp: number
  /** 工具调用列表 (assistant 消息) */
  toolCalls?: ToolCall[]
  /** 工具结果列表 (tool 消息) */
  toolResults?: ToolResult[]
}

/** 用户消息 */
export interface UserMessage extends Message {
  role: 'user'
}

/** 助手消息 */
export interface AssistantMessage extends Message {
  role: 'assistant'
  /** 停止原因 */
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
}

/** 系统消息 */
export interface SystemMessage extends Message {
  role: 'system'
}

/** 工具消息 */
export interface ToolMessage extends Message {
  role: 'tool'
  toolResults: ToolResult[]
}

/** 创建文本消息的辅助函数类型 */
export function createTextMessage(
  role: MessageRole,
  text: string,
  options?: Partial<Message>
): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    role,
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
    ...options
  }
}

/** 提取消息文本内容 */
export function getMessageText(message: Message): string {
  return message.content
    .filter((part): part is TextPart => part.type === 'text')
    .map(part => part.text)
    .join('')
}

/** 检查消息是否包含工具调用 */
export function hasToolCalls(message: Message): boolean {
  return !!message.toolCalls && message.toolCalls.length > 0
}
