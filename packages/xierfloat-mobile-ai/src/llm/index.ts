/**
 * LLM 适配层模块
 */

export type {
  LLMAdapter,
  LLMAdapterFactory,
  LLMAdapterRegistry,
  ChatRequest,
  ChatResponse,
  StreamCallback,
  StreamController
} from './types'

export { OpenAIAdapter, createOpenAIAdapter } from './OpenAIAdapter'
export { AnthropicAdapter, createAnthropicAdapter } from './AnthropicAdapter'
export {
  getAdapterRegistry,
  createLLMAdapter,
  registerAdapter
} from './AdapterRegistry'
