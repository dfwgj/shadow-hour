/**
 * Chat Composable - 聊天 UI 状态管理
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import type { Message } from '../types/message'
import type { Session, SessionSnapshot } from '../types/session'
import type { LLMConfig } from '../types/config'
import type { SessionRepository } from '../types/session'
import type { ConfigRepository, StorageAdapter } from '../storage/ConfigRepository'
import { createSessionRepository } from '../storage/SessionRepository'
import { createConfigRepository, MemoryStorageAdapter } from '../storage/ConfigRepository'
import { useAgent, type AgentOptions, type UseAgentReturn } from './useAgent'
import { getSchedulerPrompt } from '../prompt/templates'

/** Chat 配置选项 */
export interface ChatOptions {
  /** 存储适配器 */
  storage?: StorageAdapter
  /** 默认系统提示词 */
  defaultSystemPrompt?: string
  /** 是否使用日程专家提示词 */
  useSchedulerPrompt?: boolean
  /** LLM 配置 */
  config?: LLMConfig
}

/** Chat Composable 返回类型 */
export interface UseChatReturn extends UseAgentReturn {
  /** 会话列表 */
  sessions: Ref<SessionSnapshot[]>
  /** 当前会话 ID */
  currentSessionId: Ref<string | null>
  /** LLM 配置列表 */
  configs: Ref<LLMConfig[]>
  /** 当前 LLM 配置 */
  currentConfig: Ref<LLMConfig | null>
  /** 是否正在加载 */
  isLoading: Ref<boolean>

  /** 创建新会话 */
  createSession: (title?: string) => Promise<Session>
  /** 切换会话 */
  switchSession: (id: string) => Promise<void>
  /** 删除会话 */
  deleteSession: (id: string) => Promise<void>
  /** 重命名会话 */
  renameSession: (id: string, title: string) => Promise<void>
  /** 刷新会话列表 */
  refreshSessions: () => Promise<void>
  /** 保存 LLM 配置 */
  saveConfig: (config: LLMConfig) => Promise<void>
  /** 删除 LLM 配置 */
  deleteConfig: (id: string) => Promise<void>
  /** 切换 LLM 配置 */
  switchConfig: (id: string) => Promise<void>
  /** 刷新配置列表 */
  refreshConfigs: () => Promise<void>
}

/**
 * Chat Composable
 */
export function useChat(options: ChatOptions = {}): UseChatReturn {
  // 存储
  const storage = options.storage ?? new MemoryStorageAdapter()
  const sessionRepo: SessionRepository = createSessionRepository(storage)
  const configRepo: ConfigRepository = createConfigRepository(storage)

  // 响应式状态
  const sessions = ref<SessionSnapshot[]>([])
  const currentSessionId = ref<string | null>(null)
  const configs = ref<LLMConfig[]>([])
  const currentConfig = ref<LLMConfig | null>(options.config ?? null)
  const isLoading = ref(false)

  // 系统提示词
  const systemPrompt = options.useSchedulerPrompt
    ? getSchedulerPrompt()
    : (options.defaultSystemPrompt ?? '')

  // Agent
  let agent: UseAgentReturn | null = null

  /**
   * 初始化 Agent
   */
  function initAgent(): UseAgentReturn {
    if (!currentConfig.value) {
      throw new Error('No LLM config available')
    }

    const agentOptions: AgentOptions = {
      config: currentConfig.value,
      systemPrompt
    }

    return useAgent(agentOptions)
  }

  /**
   * 获取或创建 Agent
   */
  function getAgent(): UseAgentReturn {
    if (!agent) {
      agent = initAgent()
    }
    return agent
  }

  /**
   * 创建新会话
   */
  async function createSession(title?: string): Promise<Session> {
    const session = await sessionRepo.create({
      title: title ?? '新对话',
      systemPrompt,
      configId: currentConfig.value?.id
    })

    await refreshSessions()
    currentSessionId.value = session.id

    // 清空 Agent
    getAgent().clear()

    return session
  }

  /**
   * 切换会话
   */
  async function switchSession(id: string): Promise<void> {
    isLoading.value = true

    try {
      const session = await sessionRepo.get(id)
      if (!session) {
        throw new Error(`Session not found: ${id}`)
      }

      currentSessionId.value = id

      // 加载消息
      const sessionMessages = await sessionRepo.getMessages(id)

      // 重新初始化 Agent
      agent = initAgent()
      agent.session.value = session

      // 恢复消息
      for (const msg of sessionMessages) {
        agent.messages.value = [...agent.messages.value, msg]
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 删除会话
   */
  async function deleteSession(id: string): Promise<void> {
    await sessionRepo.delete(id)
    await refreshSessions()

    if (currentSessionId.value === id) {
      currentSessionId.value = null
      getAgent().clear()
    }
  }

  /**
   * 重命名会话
   */
  async function renameSession(id: string, title: string): Promise<void> {
    await sessionRepo.update(id, { title })
    await refreshSessions()
  }

  /**
   * 刷新会话列表
   */
  async function refreshSessions(): Promise<void> {
    sessions.value = await sessionRepo.query({ status: 'active' })
  }

  /**
   * 保存 LLM 配置
   */
  async function saveConfig(config: LLMConfig): Promise<void> {
    await configRepo.save(config)
    await refreshConfigs()
  }

  /**
   * 删除 LLM 配置
   */
  async function deleteConfig(id: string): Promise<void> {
    await configRepo.delete(id)
    await refreshConfigs()

    if (currentConfig.value?.id === id) {
      currentConfig.value = configs.value[0] ?? null
    }
  }

  /**
   * 切换 LLM 配置
   */
  async function switchConfig(id: string): Promise<void> {
    const config = await configRepo.get(id)
    if (!config) {
      throw new Error(`Config not found: ${id}`)
    }

    currentConfig.value = config
    await configRepo.setDefault(id)

    // 更新 Agent 配置
    if (agent) {
      agent.updateConfig(config)
    }
  }

  /**
   * 刷新配置列表
   */
  async function refreshConfigs(): Promise<void> {
    configs.value = await configRepo.getAll()
  }

  // 监听消息变化，自动保存
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function setupMessageWatcher(): void {
    if (!agent) return

    watch(
      () => agent?.messages.value,
      async (newMessages) => {
        if (!currentSessionId.value || !newMessages) return

        // 防抖保存
        if (saveTimer) {
          clearTimeout(saveTimer)
        }

        saveTimer = setTimeout(async () => {
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage) {
            await sessionRepo.addMessage(currentSessionId.value!, lastMessage)
          }
        }, 500)
      },
      { deep: true }
    )
  }

  // 代理 Agent 方法
  const proxyAgent = (): UseAgentReturn => {
    const a = getAgent()
    setupMessageWatcher()
    return a
  }

  return {
    // Agent 状态
    get state() {
      return proxyAgent().state
    },
    get messages() {
      return proxyAgent().messages
    },
    get session() {
      return proxyAgent().session
    },
    get isProcessing() {
      return proxyAgent().isProcessing
    },
    get canSend() {
      return proxyAgent().canSend
    },
    get streamingText() {
      return proxyAgent().streamingText
    },
    get error() {
      return proxyAgent().error
    },

    // Agent 方法
    send: (content: string) => proxyAgent().send(content),
    abort: () => proxyAgent().abort(),
    clear: () => proxyAgent().clear(),
    regenerate: () => proxyAgent().regenerate(),
    subscribe: (handler) => proxyAgent().subscribe(handler),
    updateConfig: (config) => proxyAgent().updateConfig(config),
    updateSystemPrompt: (prompt) => proxyAgent().updateSystemPrompt(prompt),

    // Chat 状态
    sessions,
    currentSessionId,
    configs,
    currentConfig,
    isLoading,

    // Chat 方法
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    refreshSessions,
    saveConfig,
    deleteConfig,
    switchConfig,
    refreshConfigs
  }
}
