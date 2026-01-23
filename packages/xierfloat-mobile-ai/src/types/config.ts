/**
 * LLM 配置类型
 */

/** 支持的 LLM 提供商 */
export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'qwen'
  | 'ollama'
  | 'moonshot'
  | 'zhipu'
  | 'siliconflow'
  | 'custom'

/** LLM 配置 */
export interface LLMConfig {
  /** 配置唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 提供商类型 */
  provider: LLMProvider
  /** API 密钥 */
  apiKey: string
  /** API 端点 (可选，用于自定义或代理) */
  baseUrl?: string
  /** 模型 ID */
  model: string
  /** 最大 Token 数 */
  maxTokens?: number
  /** 温度参数 (0-2) */
  temperature?: number
  /** 是否为默认配置 */
  isDefault?: boolean
  /** 是否支持视觉/图片 */
  supportsVision?: boolean
  /** 是否支持工具调用 */
  supportsTools?: boolean
  /** 是否支持流式响应 */
  supportsStreaming?: boolean
  /** 创建时间 */
  createdAt?: number
  /** 更新时间 */
  updatedAt?: number
}

/** 预设模型配置模板 */
export interface LLMConfigPreset extends Omit<LLMConfig, 'id' | 'apiKey' | 'isDefault'> {
  /** 预设描述 */
  description?: string
}

/** 内置预设配置 */
export const LLM_PRESETS: Record<string, LLMConfigPreset> = {
  'gpt-4o': {
    name: 'GPT-4o',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    description: 'OpenAI 最新多模态模型'
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    description: 'OpenAI 轻量级多模态模型'
  },
  'claude-3-5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    description: 'Anthropic 高性能模型'
  },
  'deepseek-chat': {
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    description: 'DeepSeek 对话模型'
  },
  'qwen-turbo': {
    name: '通义千问 Turbo',
    provider: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-turbo',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    description: '阿里云通义千问'
  },
  'qwen-vl-plus': {
    name: '通义千问 VL Plus',
    provider: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-plus',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: true,
    supportsTools: false,
    supportsStreaming: true,
    description: '阿里云多模态模型'
  },
  'moonshot-v1-8k': {
    name: 'Moonshot v1 8K',
    provider: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    description: 'Kimi 智能助手'
  },
  'siliconflow-glm4': {
    name: '硅基流动 GLM-4',
    provider: 'siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'THUDM/glm-4-9b-chat',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    description: '硅基流动托管的 GLM-4 模型'
  },
  'siliconflow-qwen': {
    name: '硅基流动 Qwen2.5',
    provider: 'siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    description: '硅基流动托管的通义千问模型'
  }
}
