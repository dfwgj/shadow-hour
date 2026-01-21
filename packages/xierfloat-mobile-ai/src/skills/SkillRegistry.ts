/**
 * Skill 注册表
 *
 * 管理技能的注册、检索和搜索
 */

import type { Skill, SkillMetadata, SkillSearchResult, SkillRegistryConfig, SkillRawData } from './types'
import { parseSkill, extractMetadata, skillsToPrompt } from './SkillParser'

/**
 * 计算两个字符串的相似度（简单实现）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  // 完全匹配
  if (s1 === s2) return 1

  // 包含匹配
  if (s1.includes(s2) || s2.includes(s1)) return 0.8

  // 分词匹配
  const words1 = s1.split(/\s+/)
  const words2 = s2.split(/\s+/)
  let matchCount = 0

  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1.includes(w2) || w2.includes(w1)) {
        matchCount++
        break
      }
    }
  }

  return matchCount / Math.max(words1.length, words2.length)
}

/**
 * Skill 注册表实现
 */
export class SkillRegistry {
  /** 技能缓存 */
  private skills: Map<string, Skill> = new Map()

  /** 元数据缓存（用于快速搜索） */
  private metadataIndex: Map<string, SkillMetadata> = new Map()

  /** 配置 */
  private config: Required<SkillRegistryConfig>

  constructor(config: SkillRegistryConfig = {}) {
    this.config = {
      maxCacheSize: config.maxCacheSize ?? 100,
      enableSearchIndex: config.enableSearchIndex ?? true
    }
  }

  /**
   * 注册一个技能（从原始数据）
   */
  register(rawData: SkillRawData): Skill {
    const skill = parseSkill(rawData)
    return this.registerSkill(skill)
  }

  /**
   * 注册一个已解析的技能
   */
  registerSkill(skill: Skill): Skill {
    // 检查缓存大小
    if (this.skills.size >= this.config.maxCacheSize) {
      // 移除最早加载的技能
      const oldest = Array.from(this.skills.entries()).sort((a, b) => a[1].loadedAt - b[1].loadedAt)[0]
      if (oldest) {
        this.skills.delete(oldest[0])
        this.metadataIndex.delete(oldest[0])
      }
    }

    this.skills.set(skill.id, skill)
    this.metadataIndex.set(skill.id, skill.metadata)

    return skill
  }

  /**
   * 批量注册技能
   */
  registerBatch(rawDataList: SkillRawData[]): Skill[] {
    return rawDataList.map(raw => this.register(raw))
  }

  /**
   * 仅注册元数据（Level 1 加载）
   */
  registerMetadata(id: string, skillMd: string): SkillMetadata {
    const metadata = extractMetadata(skillMd, id)
    this.metadataIndex.set(id, metadata)
    return metadata
  }

  /**
   * 获取技能
   */
  get(id: string): Skill | undefined {
    return this.skills.get(id)
  }

  /**
   * 获取技能元数据
   */
  getMetadata(id: string): SkillMetadata | undefined {
    return this.metadataIndex.get(id)
  }

  /**
   * 获取所有技能
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  /**
   * 获取所有技能元数据
   */
  getAllMetadata(): Array<{ id: string; metadata: SkillMetadata }> {
    return Array.from(this.metadataIndex.entries()).map(([id, metadata]) => ({ id, metadata }))
  }

  /**
   * 检查技能是否已注册
   */
  has(id: string): boolean {
    return this.skills.has(id) || this.metadataIndex.has(id)
  }

  /**
   * 移除技能
   */
  remove(id: string): boolean {
    this.metadataIndex.delete(id)
    return this.skills.delete(id)
  }

  /**
   * 清空所有技能
   */
  clear(): void {
    this.skills.clear()
    this.metadataIndex.clear()
  }

  /**
   * 按标签搜索技能
   */
  searchByTags(tags: string[]): Skill[] {
    const results: Skill[] = []
    const tagsLower = tags.map(t => t.toLowerCase())

    for (const skill of this.skills.values()) {
      const skillTags = (skill.metadata.tags || []).map(t => t.toLowerCase())
      const hasMatch = tagsLower.some(tag => skillTags.includes(tag))

      if (hasMatch) {
        results.push(skill)
      }
    }

    return results.sort((a, b) => (b.metadata.priority ?? 0) - (a.metadata.priority ?? 0))
  }

  /**
   * 语义搜索技能
   *
   * @param query 搜索查询
   * @param limit 返回结果数量限制
   * @param threshold 最低匹配分数阈值
   */
  search(query: string, limit = 5, threshold = 0.3): SkillSearchResult[] {
    const results: SkillSearchResult[] = []
    const queryLower = query.toLowerCase()

    for (const skill of this.skills.values()) {
      if (!skill.metadata.enabled) continue

      const matchedFields: string[] = []
      let maxScore = 0

      // 匹配名称
      const nameScore = calculateSimilarity(skill.metadata.name, queryLower)
      if (nameScore > 0) {
        matchedFields.push('name')
        maxScore = Math.max(maxScore, nameScore)
      }

      // 匹配描述
      const descScore = calculateSimilarity(skill.metadata.description, queryLower)
      if (descScore > 0) {
        matchedFields.push('description')
        maxScore = Math.max(maxScore, descScore * 0.8) // 描述权重稍低
      }

      // 匹配标签
      for (const tag of skill.metadata.tags || []) {
        const tagScore = calculateSimilarity(tag, queryLower)
        if (tagScore > 0) {
          matchedFields.push(`tag:${tag}`)
          maxScore = Math.max(maxScore, tagScore * 0.9)
        }
      }

      // 匹配内容
      if (skill.content.main.toLowerCase().includes(queryLower)) {
        matchedFields.push('content')
        maxScore = Math.max(maxScore, 0.5)
      }

      if (maxScore >= threshold) {
        // 加入优先级因素
        const finalScore = maxScore + (skill.metadata.priority ?? 0) * 0.01

        results.push({
          skill,
          score: finalScore,
          matchedFields
        })
      }
    }

    // 按得分排序并限制数量
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /**
   * 根据用户输入自动选择相关技能并生成 Prompt
   */
  getRelevantSkillsPrompt(userInput: string, maxSkills = 3, includeReference = false): string {
    const results = this.search(userInput, maxSkills)

    if (results.length === 0) {
      return ''
    }

    const skills = results.map(r => r.skill)
    return skillsToPrompt(skills, includeReference)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalSkills: number
    metadataOnly: number
    fullLoaded: number
    enabledSkills: number
  } {
    const metadataOnly = this.metadataIndex.size - this.skills.size
    const enabledSkills = Array.from(this.skills.values()).filter(s => s.metadata.enabled).length

    return {
      totalSkills: this.metadataIndex.size,
      metadataOnly,
      fullLoaded: this.skills.size,
      enabledSkills
    }
  }
}

/**
 * 创建 Skill 注册表实例
 */
export function createSkillRegistry(config?: SkillRegistryConfig): SkillRegistry {
  return new SkillRegistry(config)
}

// 全局单例
let globalRegistry: SkillRegistry | null = null

/**
 * 获取全局 Skill 注册表
 */
export function getSkillRegistry(): SkillRegistry {
  if (!globalRegistry) {
    globalRegistry = new SkillRegistry()
  }
  return globalRegistry
}
