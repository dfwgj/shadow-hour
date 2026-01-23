/**
 * LLM 适配器共享工具函数 - 提供通用的 LLM 相关功能
 * @author DF蓝梦/xierfloat
 * @date 2025-12-22
 */

import type { ContentPart } from '../types/message'

/**
 * 从内容部分数组中提取纯文本内容
 */
export function getTextContent(parts: ContentPart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('')
}
