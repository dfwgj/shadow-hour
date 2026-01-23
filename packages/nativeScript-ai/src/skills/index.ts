/**
 * Agent Skills 模块
 *
 * 基于 Anthropic Agent Skills 协议的轻量级实现
 *
 * @example
 * ```typescript
 * import { loadSkill, searchSkills, getSkillsPrompt } from '@xierfloat-monorepo/nativeScript-ai'
 *
 * // 加载技能
 * loadSkill({
 *   id: 'schedule-optimization',
 *   skillMd: `---
 * name: 日程优化
 * description: 分析并优化日程安排
 * tags: [日程, 优化]
 * ---
 *
 * # 日程优化技能
 *
 * ## 功能
 * - 分析日程密度
 * - 识别时间冲突
 * - 提供优化建议
 * `
 * })
 *
 * // 搜索相关技能
 * const skills = searchSkills('帮我优化日程')
 *
 * // 获取技能 Prompt 注入到系统提示词
 * const skillPrompt = getSkillsPrompt('帮我优化日程', 3)
 * ```
 */

// Types
export type {
  SkillMetadata,
  SkillContent,
  Skill,
  SkillSearchResult,
  SkillLoaderConfig,
  SkillRegistryConfig,
  SkillRawData
} from './types'

export { SkillLoadLevel } from './types'

// Parser
export { parseSkill, extractMetadata, skillToPrompt, skillsToPrompt } from './SkillParser'

// Registry
export { SkillRegistry, createSkillRegistry, getSkillRegistry } from './SkillRegistry'

// Loader
export type { InlineSkillDefinition, SkillPackage } from './SkillLoader'

export {
  SkillLoader,
  createSkillLoader,
  getSkillLoader,
  loadSkill,
  loadSkills,
  searchSkills,
  getSkillsPrompt
} from './SkillLoader'

// Builtin Skills
export {
  aigisBrainSkill,
  scheduleOptimizationSkill,
  meetingPreparationSkill,
  weeklyReviewSkill,
  timeEstimationSkill,
  builtinSkillPackage,
  builtinSkills
} from './builtinSkills'
