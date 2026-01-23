/**
 * Skill 解析器
 *
 * 解析 SKILL.md 文件，提取 YAML frontmatter 和 Markdown 内容
 */

import type { SkillMetadata, Skill, SkillRawData, SkillContent } from './types'

/**
 * 解析 YAML frontmatter
 *
 * 格式：
 * ```
 * ---
 * name: 技能名称
 * description: 技能描述
 * ---
 * ```
 */
function parseYamlFrontmatter(content: string): { metadata: Partial<SkillMetadata>; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    // 没有 frontmatter，整个内容作为 body
    return {
      metadata: {},
      body: content.trim()
    }
  }

  const yamlContent = match[1]
  const body = match[2]?.trim() ?? ''

  // 简单的 YAML 解析（不引入外部依赖）
  const metadata: Partial<SkillMetadata> = {}
  const lines = yamlContent ? yamlContent.split('\n') : []

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()

    // 处理数组格式 [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1)
      const items = arrayContent.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''))
      ;(metadata as Record<string, unknown>)[key] = items
    }
    // 处理数字
    else if (!isNaN(Number(value))) {
      ;(metadata as Record<string, unknown>)[key] = Number(value)
    }
    // 处理布尔值
    else if (value === 'true' || value === 'false') {
      ;(metadata as Record<string, unknown>)[key] = value === 'true'
    }
    // 处理字符串（移除引号）
    else {
      value = value.replace(/^["']|["']$/g, '')
      ;(metadata as Record<string, unknown>)[key] = value
    }
  }

  return { metadata, body }
}

/**
 * 验证元数据必填字段
 */
function validateMetadata(metadata: Partial<SkillMetadata>, id: string): SkillMetadata {
  if (!metadata.name) {
    metadata.name = id // 使用 ID 作为默认名称
  }
  if (!metadata.description) {
    metadata.description = ''
  }

  return {
    name: metadata.name,
    description: metadata.description,
    ...(metadata.version !== undefined && { version: metadata.version }),
    ...(metadata.author !== undefined && { author: metadata.author }),
    tags: metadata.tags || [],
    priority: metadata.priority ?? 0,
    enabled: metadata.enabled ?? true
  }
}

/**
 * 解析 Skill 原始数据为完整的 Skill 对象
 */
export function parseSkill(rawData: SkillRawData): Skill {
  // 解析 SKILL.md
  const { metadata: rawMetadata, body } = parseYamlFrontmatter(rawData.skillMd)

  // 验证并补全元数据
  const metadata = validateMetadata(rawMetadata, rawData.id)

  // 构建内容对象
  const content: SkillContent = {
    main: body,
    reference: rawData.referenceMd,
    resources: rawData.resources
  }

  return {
    id: rawData.id,
    metadata,
    content,
    loadedAt: Date.now()
  }
}

/**
 * 从 SKILL.md 内容快速提取元数据（不解析完整内容）
 */
export function extractMetadata(skillMd: string, id: string): SkillMetadata {
  const { metadata } = parseYamlFrontmatter(skillMd)
  return validateMetadata(metadata, id)
}

/**
 * 将 Skill 转换为 Prompt 文本
 *
 * @param skill 技能对象
 * @param includeReference 是否包含参考资料
 */
export function skillToPrompt(skill: Skill, includeReference = false): string {
  const parts: string[] = []

  // 技能标题
  parts.push(`## 技能: ${skill.metadata.name}`)

  if (skill.metadata.description) {
    parts.push(`> ${skill.metadata.description}`)
  }

  parts.push('')

  // 主体内容
  parts.push(skill.content.main)

  // 参考资料
  if (includeReference && skill.content.reference) {
    parts.push('')
    parts.push('---')
    parts.push('### 参考资料')
    parts.push(skill.content.reference)
  }

  return parts.join('\n')
}

/**
 * 将多个 Skill 合并为一个 Prompt
 */
export function skillsToPrompt(skills: Skill[], includeReference = false): string {
  if (skills.length === 0) return ''

  const parts: string[] = ['# 已加载的技能\n']

  for (const skill of skills) {
    parts.push(skillToPrompt(skill, includeReference))
    parts.push('\n---\n')
  }

  return parts.join('\n')
}
