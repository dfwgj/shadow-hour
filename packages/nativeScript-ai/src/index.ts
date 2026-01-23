/**
 * @xierfloat-monorepo/nativeScript-ai
 *
 * AI 智能体包 - 为移动应用提供 LLM 对话和 MCP 工具调用能力
 *
 * 主要特性:
 * - 多 LLM 提供商支持 (OpenAI, Claude, DeepSeek, Qwen 等)
 * - 流式响应
 * - MCP 协议工具调用
 * - 上下文管理和 Token 优化
 * - Vue Composables 集成
 *
 * @example
 * ```typescript
 * import { useChat, LLM_PRESETS } from '@xierfloat-monorepo/nativeScript-ai'
 *
 * const chat = useChat({
 *   config: {
 *     ...LLM_PRESETS['gpt-4o'],
 *     id: 'my-config',
 *     apiKey: 'sk-xxx'
 *   },
 *   useSchedulerPrompt: true
 * })
 *
 * // 发送消息
 * await chat.send('帮我安排明天的日程')
 * ```
 */

// ==================== Types ====================
export * from "./types";

// ==================== Engine ====================
export {
  EventBus,
  createEventBus,
  EventFilters,
  type IEventBus,
  type EventBusOptions,
  type EventFilter
} from "./engine";

export { MealyMachine, streamProcessor, createStreamMachine, StateTransitions } from "./engine";

// ==================== LLM ====================
export type {
  LLMAdapter,
  LLMAdapterFactory,
  LLMAdapterRegistry,
  ChatRequest,
  ChatResponse,
  StreamCallback,
  StreamController
} from "./llm";

export {
  OpenAIAdapter,
  createOpenAIAdapter,
  AnthropicAdapter,
  createAnthropicAdapter,
  SiliconFlowAdapter,
  createSiliconFlowAdapter,
  getAdapterRegistry,
  createLLMAdapter,
  registerAdapter
} from "./llm";

// ==================== MCP ====================
export { ToolRegistryImpl, getToolRegistry, createToolRegistry } from "./mcp";

export {
  // Web Search
  type WebSearchService,
  type SearchResult,
  type SearXNGConfig,
  webSearchDefinition,
  createWebSearchTools,
  SearXNGSearchService,

  // Web Fetch
  type WebFetchResult,
  type WebFetchConfig,
  type ContentType,
  webFetchDefinition,
  WebFetchService,
  createWebFetchTools
} from "./mcp";

// ==================== Context ====================
export { ContextManager, createContextManager, type ContextManagerConfig, type ContextWindow } from "./context";

// ==================== Prompt ====================
export {
  SCHEDULER_EXPERT_PROMPT,
  GENERAL_ASSISTANT_PROMPT,
  renderTemplate,
  getSchedulerPrompt,
  PromptTemplates,
  type PromptTemplateName
} from "./prompt";

// ==================== Storage ====================
export {
  type ConfigRepository,
  type SessionRepository,
  type StorageAdapter,
  MemoryStorageAdapter,
  createConfigRepository,
  createSessionRepository
} from "./storage";

// ==================== Composables ====================
export {
  useAgent,
  type AgentOptions,
  type UseAgentReturn,
  useChat,
  type ChatOptions,
  type UseChatReturn
} from "./composables";

// ==================== Skills ====================
export type {
  SkillMetadata,
  SkillContent,
  Skill,
  SkillSearchResult,
  SkillLoaderConfig,
  SkillRegistryConfig,
  SkillRawData,
  InlineSkillDefinition,
  SkillPackage
} from "./skills";

export {
  SkillLoadLevel,
  parseSkill,
  extractMetadata,
  skillToPrompt,
  skillsToPrompt,
  SkillRegistry,
  createSkillRegistry,
  getSkillRegistry,
  SkillLoader,
  createSkillLoader,
  getSkillLoader,
  loadSkill,
  loadSkills,
  searchSkills,
  getSkillsPrompt,
  // Builtin skills
  aigisBrainSkill,
  scheduleOptimizationSkill,
  meetingPreparationSkill,
  weeklyReviewSkill,
  timeEstimationSkill,
  builtinSkillPackage,
  builtinSkills
} from "./skills";
