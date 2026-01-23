/**
 * LLM 适配器注册表
 */

import type { LLMConfig, LLMProvider } from '../types/config'
import type { LLMAdapter, LLMAdapterFactory, LLMAdapterRegistry } from './types'
import { createOpenAIAdapter } from './OpenAIAdapter'
import { createAnthropicAdapter } from './AnthropicAdapter'
import { createSiliconFlowAdapter } from './SiliconFlowAdapter'

/**
 * 适配器注册表实现
 */
class AdapterRegistryImpl implements LLMAdapterRegistry {
  private factories = new Map<string, LLMAdapterFactory>()

  constructor() {
    // 注册内置适配器
    this.registerBuiltinAdapters()
  }

  /**
   * 注册适配器工厂
   */
  register(provider: string, factory: LLMAdapterFactory): void {
    this.factories.set(provider, factory)
  }

  /**
   * 获取适配器工厂
   */
  get(provider: string): LLMAdapterFactory | undefined {
    return this.factories.get(provider)
  }

  /**
   * 创建适配器实例
   */
  create(config: LLMConfig): LLMAdapter {
    const factory = this.factories.get(config.provider)
    if (!factory) {
      throw new Error(`Unknown LLM provider: ${config.provider}`)
    }
    return factory(config)
  }

  /**
   * 获取所有已注册的提供商
   */
  providers(): string[] {
    return Array.from(this.factories.keys())
  }

  /**
   * 注册内置适配器
   */
  private registerBuiltinAdapters(): void {
    // OpenAI 及其兼容接口
    const openaiCompatible: LLMProvider[] = [
      'openai',
      'deepseek',
      'qwen',
      'moonshot',
      'zhipu',
      'ollama',
      'custom'
    ]

    for (const provider of openaiCompatible) {
      this.factories.set(provider, createOpenAIAdapter)
    }

    // Anthropic
    this.factories.set('anthropic', createAnthropicAdapter)

    // SiliconFlow (使用 Anthropic 格式 + Bearer Token)
    this.factories.set('siliconflow', createSiliconFlowAdapter)
  }
}

// 全局单例
let registry: LLMAdapterRegistry | null = null

/**
 * 获取适配器注册表实例
 */
export function getAdapterRegistry(): LLMAdapterRegistry {
  if (!registry) {
    registry = new AdapterRegistryImpl()
  }
  return registry
}

/**
 * 创建 LLM 适配器
 */
export function createLLMAdapter(config: LLMConfig): LLMAdapter {
  return getAdapterRegistry().create(config)
}

/**
 * 注册自定义适配器
 */
export function registerAdapter(provider: string, factory: LLMAdapterFactory): void {
  getAdapterRegistry().register(provider, factory)
}
