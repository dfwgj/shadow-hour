/**
 * 会话管理类型定义
 */

import type { Message } from './message'
import type { AgentState } from './event'

/** 会话状态 */
export type SessionStatus = 'active' | 'archived' | 'deleted'

/** 会话元数据 */
export interface SessionMetadata {
  /** 消息数量 */
  messageCount: number
  /** Token 使用量 */
  tokenUsage?: {
    input: number
    output: number
    total: number
  }
  /** 最后一条消息摘要 */
  lastMessagePreview?: string
  /** 使用的模型 */
  model?: string
  /** 自定义标签 */
  tags?: string[]
}

/** 会话 */
export interface Session {
  /** 会话唯一标识 */
  id: string
  /** 会话标题 */
  title: string
  /** 会话状态 */
  status: SessionStatus
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 元数据 */
  metadata: SessionMetadata
  /** 系统提示词 (可选覆盖) */
  systemPrompt?: string
  /** LLM 配置 ID */
  configId?: string
}

/** 会话快照 (用于列表展示) */
export interface SessionSnapshot {
  id: string
  title: string
  status: SessionStatus
  createdAt: number
  updatedAt: number
  messageCount: number
  lastMessagePreview?: string
}

/** 会话上下文 (运行时状态) */
export interface SessionContext {
  /** 会话信息 */
  session: Session
  /** 消息历史 */
  messages: Message[]
  /** 当前 Agent 状态 */
  agentState: AgentState
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否可以发送消息 */
  canSend: boolean
  /** 摘要后的消息 (Token 优化) */
  summarizedMessages?: Message[]
  /** 上下文窗口内的消息索引 */
  contextWindow?: {
    startIndex: number
    endIndex: number
    totalTokens: number
  }
}

/** 创建会话参数 */
export interface CreateSessionParams {
  title?: string
  systemPrompt?: string
  configId?: string
  tags?: string[]
}

/** 更新会话参数 */
export interface UpdateSessionParams {
  title?: string
  status?: SessionStatus
  systemPrompt?: string
  configId?: string
  tags?: string[]
}

/** 会话查询参数 */
export interface SessionQueryParams {
  status?: SessionStatus
  tags?: string[]
  keyword?: string
  startDate?: number
  endDate?: number
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'updatedAt'
  order?: 'asc' | 'desc'
}

/** 会话仓储接口 */
export interface SessionRepository {
  /** 创建会话 */
  create(params: CreateSessionParams): Promise<Session>
  /** 获取会话 */
  get(id: string): Promise<Session | null>
  /** 更新会话 */
  update(id: string, params: UpdateSessionParams): Promise<Session>
  /** 删除会话 */
  delete(id: string): Promise<void>
  /** 查询会话列表 */
  query(params?: SessionQueryParams): Promise<SessionSnapshot[]>
  /** 获取会话消息 */
  getMessages(sessionId: string, limit?: number, offset?: number): Promise<Message[]>
  /** 添加消息 */
  addMessage(sessionId: string, message: Message): Promise<void>
  /** 清空会话消息 */
  clearMessages(sessionId: string): Promise<void>
  /** 获取会话数量 */
  count(params?: SessionQueryParams): Promise<number>
}

/** 生成会话 ID */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** 创建空会话 */
export function createEmptySession(params?: CreateSessionParams): Session {
  const now = Date.now()
  return {
    id: generateSessionId(),
    title: params?.title ?? '新对话',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    metadata: {
      messageCount: 0
    },
    systemPrompt: params?.systemPrompt,
    configId: params?.configId
  }
}
