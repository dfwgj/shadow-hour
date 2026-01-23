/**
 * 会话存储仓储
 * @author DF蓝梦/xierfloat
 * @date 2025-12-26
 */

import type { Message } from '../types/message'
import type {
  Session,
  SessionSnapshot,
  CreateSessionParams,
  UpdateSessionParams,
  SessionQueryParams,
  SessionRepository
} from '../types/session'
import { createEmptySession } from '../types/session'
import type { StorageAdapter } from './ConfigRepository'

const SESSIONS_KEY = 'chat_sessions'
const MESSAGES_KEY_PREFIX = 'chat_messages_'

/**
 * 会话仓储实现
 */
export class SessionRepositoryImpl implements SessionRepository {
  private storage: StorageAdapter

  constructor(storage: StorageAdapter) {
    this.storage = storage
  }

  async create(params: CreateSessionParams): Promise<Session> {
    const session = createEmptySession(params)
    await this.saveSession(session)
    return session
  }

  async get(id: string): Promise<Session | null> {
    const sessions = await this.getAllSessions()
    return sessions.find((s) => s.id === id) ?? null
  }

  async update(id: string, params: UpdateSessionParams): Promise<Session> {
    const session = await this.get(id)
    if (!session) {
      throw new Error(`Session not found: ${id}`)
    }

    const updated: Session = {
      ...session,
      ...params,
      updatedAt: Date.now()
    }

    await this.saveSession(updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    const sessions = await this.getAllSessions()
    const filtered = sessions.filter((s) => s.id !== id)
    await this.storage.setItem(SESSIONS_KEY, JSON.stringify(filtered))

    // 删除消息
    await this.storage.removeItem(MESSAGES_KEY_PREFIX + id)
  }

  async query(params?: SessionQueryParams): Promise<SessionSnapshot[]> {
    let sessions = await this.getAllSessions()

    // 过滤
    if (params?.status) {
      sessions = sessions.filter((s) => s.status === params.status)
    }

    if (params?.keyword) {
      const keyword = params.keyword.toLowerCase()
      sessions = sessions.filter((s) =>
        s.title.toLowerCase().includes(keyword) ||
        s.metadata.lastMessagePreview?.toLowerCase().includes(keyword)
      )
    }

    if (params?.startDate) {
      sessions = sessions.filter((s) => s.createdAt >= params.startDate!)
    }

    if (params?.endDate) {
      sessions = sessions.filter((s) => s.createdAt <= params.endDate!)
    }

    if (params?.tags && params.tags.length > 0) {
      const tagSet = new Set(params.tags)
      sessions = sessions.filter((s) =>
        s.metadata.tags?.some((t) => tagSet.has(t))
      )
    }

    // 排序
    const orderBy = params?.orderBy ?? 'updatedAt'
    const order = params?.order ?? 'desc'
    sessions.sort((a, b) => {
      const aVal = a[orderBy]
      const bVal = b[orderBy]
      return order === 'desc' ? bVal - aVal : aVal - bVal
    })

    // 分页
    const offset = params?.offset ?? 0
    const limit = params?.limit ?? 50
    sessions = sessions.slice(offset, offset + limit)

    // 转换为快照
    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s.metadata.messageCount,
      ...(s.metadata.lastMessagePreview !== undefined && { lastMessagePreview: s.metadata.lastMessagePreview })
    }))
  }

  async getMessages(sessionId: string, limit?: number, offset?: number): Promise<Message[]> {
    const data = await this.storage.getItem(MESSAGES_KEY_PREFIX + sessionId)
    if (!data) return []

    try {
      let messages = JSON.parse(data) as Message[]

      if (offset !== undefined) {
        messages = messages.slice(offset)
      }

      if (limit !== undefined) {
        messages = messages.slice(0, limit)
      }

      return messages
    } catch {
      return []
    }
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const messages = await this.getMessages(sessionId)
    messages.push(message)
    await this.storage.setItem(MESSAGES_KEY_PREFIX + sessionId, JSON.stringify(messages))

    // 更新会话元数据
    const session = await this.get(sessionId)
    if (session) {
      const textContent = message.content
        .filter((c) => c.type === 'text')
        .map((c) => c.type === 'text' ? c.text : '')
        .join('')

      session.metadata.messageCount = messages.length
      session.metadata.lastMessagePreview = textContent.slice(0, 100)
      session.updatedAt = Date.now()
      await this.saveSession(session)
    }
  }

  async clearMessages(sessionId: string): Promise<void> {
    await this.storage.setItem(MESSAGES_KEY_PREFIX + sessionId, JSON.stringify([]))

    const session = await this.get(sessionId)
    if (session) {
      session.metadata.messageCount = 0
      session.metadata.lastMessagePreview = undefined
      session.updatedAt = Date.now()
      await this.saveSession(session)
    }
  }

  async count(params?: SessionQueryParams): Promise<number> {
    // 移除 limit 和 offset 以获取完整计数
    const { limit: _limit, offset: _offset, ...rest } = params ?? {}
    const snapshots = await this.query(Object.keys(rest).length > 0 ? rest : undefined)
    return snapshots.length
  }

  private async getAllSessions(): Promise<Session[]> {
    const data = await this.storage.getItem(SESSIONS_KEY)
    if (!data) return []

    try {
      return JSON.parse(data) as Session[]
    } catch {
      return []
    }
  }

  private async saveSession(session: Session): Promise<void> {
    const sessions = await this.getAllSessions()
    const index = sessions.findIndex((s) => s.id === session.id)

    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.push(session)
    }

    await this.storage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  }
}

/**
 * 创建会话仓储
 */
export function createSessionRepository(storage: StorageAdapter): SessionRepository {
  return new SessionRepositoryImpl(storage)
}
