/**
 * LLM 配置存储仓储
 */

import type { LLMConfig } from '../types/config'

/** 配置仓储接口 */
export interface ConfigRepository {
  /** 获取所有配置 */
  getAll(): Promise<LLMConfig[]>
  /** 获取单个配置 */
  get(id: string): Promise<LLMConfig | null>
  /** 保存配置 */
  save(config: LLMConfig): Promise<void>
  /** 删除配置 */
  delete(id: string): Promise<void>
  /** 获取默认配置 */
  getDefault(): Promise<LLMConfig | null>
  /** 设置默认配置 */
  setDefault(id: string): Promise<void>
}

/** 存储适配器接口 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/** 内存存储适配器 */
export class MemoryStorageAdapter implements StorageAdapter {
  private data = new Map<string, string>()

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value)
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key)
  }
}

const CONFIG_STORAGE_KEY = 'llm_configs'
const DEFAULT_CONFIG_KEY = 'default_llm_config_id'

/**
 * 配置仓储实现
 */
export class ConfigRepositoryImpl implements ConfigRepository {
  private storage: StorageAdapter

  constructor(storage: StorageAdapter) {
    this.storage = storage
  }

  async getAll(): Promise<LLMConfig[]> {
    const data = await this.storage.getItem(CONFIG_STORAGE_KEY)
    if (!data) return []

    try {
      return JSON.parse(data) as LLMConfig[]
    } catch {
      return []
    }
  }

  async get(id: string): Promise<LLMConfig | null> {
    const configs = await this.getAll()
    return configs.find((c) => c.id === id) ?? null
  }

  async save(config: LLMConfig): Promise<void> {
    const configs = await this.getAll()
    const index = configs.findIndex((c) => c.id === config.id)

    const now = Date.now()
    const updatedConfig = {
      ...config,
      updatedAt: now,
      createdAt: config.createdAt ?? now
    }

    if (index >= 0) {
      configs[index] = updatedConfig
    } else {
      configs.push(updatedConfig)
    }

    await this.storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configs))
  }

  async delete(id: string): Promise<void> {
    const configs = await this.getAll()
    const filtered = configs.filter((c) => c.id !== id)
    await this.storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(filtered))

    // 如果删除的是默认配置，清除默认设置
    const defaultId = await this.storage.getItem(DEFAULT_CONFIG_KEY)
    if (defaultId === id) {
      await this.storage.removeItem(DEFAULT_CONFIG_KEY)
    }
  }

  async getDefault(): Promise<LLMConfig | null> {
    const defaultId = await this.storage.getItem(DEFAULT_CONFIG_KEY)
    if (!defaultId) {
      // 返回第一个配置作为默认
      const configs = await this.getAll()
      return configs[0] ?? null
    }
    return this.get(defaultId)
  }

  async setDefault(id: string): Promise<void> {
    const config = await this.get(id)
    if (!config) {
      throw new Error(`Config not found: ${id}`)
    }

    // 更新所有配置的 isDefault 标记
    const configs = await this.getAll()
    for (const c of configs) {
      c.isDefault = c.id === id
    }
    await this.storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configs))
    await this.storage.setItem(DEFAULT_CONFIG_KEY, id)
  }
}

/**
 * 创建配置仓储
 */
export function createConfigRepository(storage: StorageAdapter): ConfigRepository {
  return new ConfigRepositoryImpl(storage)
}
