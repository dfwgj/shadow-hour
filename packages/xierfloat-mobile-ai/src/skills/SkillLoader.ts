/**
 * Skill 加载器
 *
 * 支持从多种来源加载技能：
 * - 内联定义（代码中直接定义）
 * - 远程 URL
 * - 本地文件系统（需要平台支持）
 */

import type { Skill, SkillRawData, SkillLoaderConfig, SkillLoadLevel, SkillMetadata } from './types'
import { SkillRegistry, getSkillRegistry } from './SkillRegistry'
import { parseSkill, extractMetadata } from './SkillParser'

/**
 * 内联技能定义（简化格式）
 */
export interface InlineSkillDefinition {
  /** 技能 ID */
  id: string
  /** SKILL.md 内容 */
  skillMd: string
  /** reference.md 内容（可选） */
  referenceMd?: string
}

/**
 * 技能包定义（用于批量加载）
 */
export interface SkillPackage {
  /** 包名称 */
  name: string
  /** 版本 */
  version: string
  /** 包含的技能 */
  skills: InlineSkillDefinition[]
}

/**
 * Skill 加载器
 */
export class SkillLoader {
  private registry: SkillRegistry
  private config: Required<SkillLoaderConfig>
  private loadedSources: Set<string> = new Set()

  constructor(config: SkillLoaderConfig = {}, registry?: SkillRegistry) {
    this.registry = registry || getSkillRegistry()
    this.config = {
      skillsDir: config.skillsDir ?? './skills',
      autoLoad: config.autoLoad ?? false,
      defaultLoadLevel: config.defaultLoadLevel ?? 2 // CONTENT level
    }
  }

  /**
   * 获取关联的注册表
   */
  getRegistry(): SkillRegistry {
    return this.registry
  }

  /**
   * 加载单个内联技能
   */
  loadInline(definition: InlineSkillDefinition): Skill {
    const rawData: SkillRawData = {
      id: definition.id,
      skillMd: definition.skillMd,
      referenceMd: definition.referenceMd
    }

    return this.registry.register(rawData)
  }

  /**
   * 批量加载内联技能
   */
  loadInlineBatch(definitions: InlineSkillDefinition[]): Skill[] {
    return definitions.map(def => this.loadInline(def))
  }

  /**
   * 加载技能包
   */
  loadPackage(pkg: SkillPackage): Skill[] {
    const sourceKey = `package:${pkg.name}@${pkg.version}`

    if (this.loadedSources.has(sourceKey)) {
      console.log(`[SkillLoader] Package already loaded: ${sourceKey}`)
      return pkg.skills.map(s => this.registry.get(s.id)).filter((s): s is Skill => !!s)
    }

    const skills = this.loadInlineBatch(pkg.skills)
    this.loadedSources.add(sourceKey)

    console.log(`[SkillLoader] Loaded package: ${pkg.name} with ${skills.length} skills`)
    return skills
  }

  /**
   * 从 URL 加载技能
   *
   * @param url SKILL.md 文件的 URL
   * @param id 技能 ID（可选，默认从 URL 推断）
   */
  async loadFromUrl(url: string, id?: string): Promise<Skill> {
    const skillId = id || this.extractIdFromUrl(url)
    const sourceKey = `url:${url}`

    if (this.loadedSources.has(sourceKey)) {
      const existing = this.registry.get(skillId)
      if (existing) return existing
    }

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch skill: ${response.status}`)
      }

      const skillMd = await response.text()
      const skill = this.loadInline({ id: skillId, skillMd })

      this.loadedSources.add(sourceKey)
      return skill
    } catch (error) {
      console.error(`[SkillLoader] Failed to load skill from URL: ${url}`, error)
      throw error
    }
  }

  /**
   * 从 URL 提取技能 ID
   */
  private extractIdFromUrl(url: string): string {
    const parts = url.split('/')
    const filename = parts[parts.length - 1]

    // 如果是 SKILL.md，使用上级目录名
    if (filename === 'SKILL.md') {
      return parts[parts.length - 2] || 'unknown'
    }

    // 否则使用文件名（去除扩展名）
    return filename.replace(/\.[^.]+$/, '')
  }

  /**
   * 预加载技能元数据（仅 Level 1）
   */
  preloadMetadata(id: string, skillMd: string): SkillMetadata {
    return this.registry.registerMetadata(id, skillMd)
  }

  /**
   * 检查技能是否已加载
   */
  isLoaded(id: string): boolean {
    return this.registry.has(id)
  }

  /**
   * 获取已加载的来源列表
   */
  getLoadedSources(): string[] {
    return Array.from(this.loadedSources)
  }

  /**
   * 卸载技能
   */
  unload(id: string): boolean {
    return this.registry.remove(id)
  }

  /**
   * 卸载所有技能
   */
  unloadAll(): void {
    this.registry.clear()
    this.loadedSources.clear()
  }
}

/**
 * 创建 Skill 加载器
 */
export function createSkillLoader(config?: SkillLoaderConfig, registry?: SkillRegistry): SkillLoader {
  return new SkillLoader(config, registry)
}

// 全局单例
let globalLoader: SkillLoader | null = null

/**
 * 获取全局 Skill 加载器
 */
export function getSkillLoader(): SkillLoader {
  if (!globalLoader) {
    globalLoader = new SkillLoader()
  }
  return globalLoader
}

/**
 * 快捷函数：加载内联技能
 */
export function loadSkill(definition: InlineSkillDefinition): Skill {
  return getSkillLoader().loadInline(definition)
}

/**
 * 快捷函数：批量加载内联技能
 */
export function loadSkills(definitions: InlineSkillDefinition[]): Skill[] {
  return getSkillLoader().loadInlineBatch(definitions)
}

/**
 * 快捷函数：搜索技能
 */
export function searchSkills(query: string, limit = 5): Skill[] {
  return getSkillLoader()
    .getRegistry()
    .search(query, limit)
    .map(r => r.skill)
}

/**
 * 快捷函数：获取相关技能的 Prompt
 */
export function getSkillsPrompt(userInput: string, maxSkills = 3): string {
  return getSkillLoader().getRegistry().getRelevantSkillsPrompt(userInput, maxSkills)
}
