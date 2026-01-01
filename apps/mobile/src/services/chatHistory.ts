/**
 * AI 对话历史持久化服务
 * @author xierfloat
 */

import { ApplicationSettings } from "@nativescript/core";

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool_result";
  content: string;
  timestamp: number;
  toolUseId?: string;
}

/** 会话信息 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/** 会话列表项（不包含完整消息） */
export interface ChatSessionItem {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  createdAt: number;
  updatedAt: number;
}

// 存储键
const SESSIONS_KEY = "ai_chat_sessions";
const CURRENT_SESSION_KEY = "ai_chat_current_session";
const SESSION_PREFIX = "ai_chat_session_";

/**
 * 聊天历史服务
 */
class ChatHistoryService {
  private static instance: ChatHistoryService;

  private constructor() {}

  static getInstance(): ChatHistoryService {
    if (!ChatHistoryService.instance) {
      ChatHistoryService.instance = new ChatHistoryService();
    }
    return ChatHistoryService.instance;
  }

  /**
   * 获取所有会话列表（不含完整消息）
   */
  getSessionList(): ChatSessionItem[] {
    const sessionsJson = ApplicationSettings.getString(SESSIONS_KEY, "[]");
    try {
      return JSON.parse(sessionsJson);
    } catch {
      return [];
    }
  }

  /**
   * 保存会话列表
   */
  private saveSessionList(sessions: ChatSessionItem[]): void {
    ApplicationSettings.setString(SESSIONS_KEY, JSON.stringify(sessions));
  }

  /**
   * 获取当前会话 ID
   */
  getCurrentSessionId(): string | null {
    return ApplicationSettings.getString(CURRENT_SESSION_KEY, "") || null;
  }

  /**
   * 设置当前会话 ID
   */
  setCurrentSessionId(sessionId: string): void {
    ApplicationSettings.setString(CURRENT_SESSION_KEY, sessionId);
  }

  /**
   * 创建新会话
   */
  createSession(title?: string): ChatSession {
    const id = `session_${Date.now()}`;
    const now = Date.now();

    const session: ChatSession = {
      id,
      title: title || this.generateTitle(now),
      messages: [],
      createdAt: now,
      updatedAt: now
    };

    // 保存会话详情
    this.saveSession(session);

    // 更新会话列表
    const sessions = this.getSessionList();
    sessions.unshift({
      id: session.id,
      title: session.title,
      messageCount: 0,
      lastMessage: "",
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });
    this.saveSessionList(sessions);

    // 设置为当前会话
    this.setCurrentSessionId(id);

    console.log("[ChatHistory] 创建新会话:", id);
    return session;
  }

  /**
   * 生成会话标题
   */
  private generateTitle(timestamp: number): string {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${month}月${day}日 ${hour}:${minute}`;
  }

  /**
   * 获取会话详情
   */
  getSession(sessionId: string): ChatSession | null {
    const key = SESSION_PREFIX + sessionId;
    const sessionJson = ApplicationSettings.getString(key, "");
    if (!sessionJson) return null;

    try {
      return JSON.parse(sessionJson);
    } catch {
      return null;
    }
  }

  /**
   * 保存会话详情
   */
  saveSession(session: ChatSession): void {
    const key = SESSION_PREFIX + session.id;
    ApplicationSettings.setString(key, JSON.stringify(session));
  }

  /**
   * 更新会话消息
   */
  updateSessionMessages(sessionId: string, messages: ChatMessage[]): void {
    const session = this.getSession(sessionId);
    if (!session) {
      console.warn("[ChatHistory] 会话不存在:", sessionId);
      return;
    }

    session.messages = messages;
    session.updatedAt = Date.now();

    // 更新标题（使用第一条用户消息）
    if (messages.length > 0 && session.title.includes("月") && session.title.includes("日")) {
      const firstUserMessage = messages.find(m => m.role === "user");
      if (firstUserMessage) {
        session.title = firstUserMessage.content.substring(0, 20) + (firstUserMessage.content.length > 20 ? "..." : "");
      }
    }

    this.saveSession(session);

    // 更新会话列表
    const sessions = this.getSessionList();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      const lastMsg = messages[messages.length - 1];
      sessions[index] = {
        ...sessions[index],
        title: session.title,
        messageCount: messages.length,
        lastMessage: lastMsg ? lastMsg.content.substring(0, 50) : "",
        updatedAt: session.updatedAt
      };
      // 将更新的会话移到最前面
      const [updated] = sessions.splice(index, 1);
      sessions.unshift(updated);
      this.saveSessionList(sessions);
    }

    console.log("[ChatHistory] 会话已更新:", sessionId, "消息数:", messages.length);
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): void {
    // 删除会话详情
    const key = SESSION_PREFIX + sessionId;
    ApplicationSettings.remove(key);

    // 更新会话列表
    const sessions = this.getSessionList();
    const filtered = sessions.filter(s => s.id !== sessionId);
    this.saveSessionList(filtered);

    // 如果删除的是当前会话，清除当前会话 ID
    if (this.getCurrentSessionId() === sessionId) {
      ApplicationSettings.remove(CURRENT_SESSION_KEY);
    }

    console.log("[ChatHistory] 会话已删除:", sessionId);
  }

  /**
   * 获取或创建当前会话
   */
  getOrCreateCurrentSession(): ChatSession {
    const currentId = this.getCurrentSessionId();

    if (currentId) {
      const session = this.getSession(currentId);
      if (session) {
        console.log("[ChatHistory] 加载现有会话:", currentId);
        return session;
      }
    }

    // 没有当前会话，创建新的
    return this.createSession();
  }

  /**
   * 清空所有会话
   */
  clearAll(): void {
    const sessions = this.getSessionList();
    for (const session of sessions) {
      ApplicationSettings.remove(SESSION_PREFIX + session.id);
    }
    ApplicationSettings.remove(SESSIONS_KEY);
    ApplicationSettings.remove(CURRENT_SESSION_KEY);
    console.log("[ChatHistory] 已清空所有会话");
  }
}

// 导出单例
export const chatHistoryService = ChatHistoryService.getInstance();
