/**
 * Agent Skills 类型定义
 *
 * 基于 Anthropic Agent Skills 协议的轻量级实现
 * @see https://docs.claude.com/en/docs/agents-and-tools/agent-skills
 */

/**
 * Skill 元数据（YAML frontmatter）
 */
export interface SkillMetadata {
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 版本号 */
  version?: string
  /** 作者 */
  author?: string
  /** 标签，用于分类和搜索 */
  tags?: string[]
  /** 优先级，数字越大优先级越高 */
  priority?: number
  /** 是否启用 */
  enabled?: boolean
}

/**
 * Skill 内容
 */
export interface SkillContent {
  /** SKILL.md 主体内容（不含 frontmatter） */
  main: string
  /** reference.md 参考资料（可选） */
  reference?: string
  /** 其他附加资源文件 */
  resources?: Record<string, string>
}

/**
 * 完整的 Skill 定义
 */
export interface Skill {
  /** 技能 ID（文件夹名） */
  id: string
  /** 元数据 */
  metadata: SkillMetadata
  /** 内容 */
  content: SkillContent
  /** 加载时间戳 */
  loadedAt: number
}

/**
 * Skill 加载级别（渐进式加载）
 */
export enum SkillLoadLevel {
  /** Level 1: 仅元数据 */
  METADATA = 1,
  /** Level 2: 元数据 + 主体内容 */
  CONTENT = 2,
  /** Level 3: 完整内容（含参考资料和资源） */
  FULL = 3
}

/**
 * Skill 搜索结果
 */
export interface SkillSearchResult {
  /** 技能 */
  skill: Skill
  /** 匹配得分（0-1） */
  score: number
  /** 匹配的字段 */
  matchedFields: string[]
}

/**
 * Skill 加载器配置
 */
export interface SkillLoaderConfig {
  /** 技能目录路径 */
  skillsDir?: string
  /** 是否自动加载 */
  autoLoad?: boolean
  /** 默认加载级别 */
  defaultLoadLevel?: SkillLoadLevel
}

/**
 * Skill 注册表配置
 */
export interface SkillRegistryConfig {
  /** 最大缓存技能数 */
  maxCacheSize?: number
  /** 是否启用搜索索引 */
  enableSearchIndex?: boolean
}

/**
 * Skill 原始数据（从文件解析）
 */
export interface SkillRawData {
  /** 文件夹名/ID */
  id: string
  /** SKILL.md 原始内容 */
  skillMd: string
  /** reference.md 原始内容（可选） */
  referenceMd?: string
  /** 其他资源文件 */
  resources?: Record<string, string>
}
