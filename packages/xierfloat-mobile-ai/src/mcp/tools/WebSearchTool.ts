/**
 * 网页搜索工具
 */

import { setTimeout } from '@nativescript/core/utils'
import type {
  ToolHandler,
  ToolDefinition,
  ToolContext,
  ToolExecutionResult,
  WebSearchParams
} from '../../types/tool'

/** 搜索服务接口 (由外部注入) */
export interface WebSearchService {
  search(query: string, limit?: number): Promise<SearchResult[]>
}

/** 搜索结果 */
export interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
}

/**
 * 网页搜索工具定义
 */
export const webSearchDefinition: ToolDefinition = {
  name: 'web_search',
  displayName: '网页搜索',
  description: '搜索互联网获取相关信息。可用于查询天气、新闻、知识等。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询词'
      },
      limit: {
        type: 'number',
        description: '返回结果数量限制',
        default: 5
      }
    },
    required: ['query']
  },
  category: 'search'
}

/**
 * 创建网页搜索工具处理器
 */
export function createWebSearchHandler(service: WebSearchService): ToolHandler {
  return {
    definition: webSearchDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolExecutionResult> {
      const params = args as unknown as WebSearchParams
      const results = await service.search(params.query, params.limit)

      if (results.length === 0) {
        return {
          success: true,
          content: JSON.stringify({
            message: '没有找到相关结果',
            query: params.query,
            results: []
          }, null, 2)
        }
      }

      return {
        success: true,
        content: JSON.stringify({
          query: params.query,
          count: results.length,
          results: results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            source: r.source
          }))
        }, null, 2)
      }
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = []
      if (!args.query) errors.push('query is required')
      if (typeof args.query === 'string' && args.query.trim().length === 0) {
        errors.push('query cannot be empty')
      }
      return { valid: errors.length === 0, errors }
    }
  }
}

/**
 * 创建网页搜索工具
 */
export function createWebSearchTools(service: WebSearchService): ToolHandler[] {
  return [createWebSearchHandler(service)]
}

/**
 * 模拟搜索服务 (开发/测试用)
 */
export class MockWebSearchService implements WebSearchService {
  async search(query: string, limit = 5): Promise<SearchResult[]> {
    // 模拟搜索延迟
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 返回模拟结果
    const mockResults: SearchResult[] = [
      {
        title: `${query} - 相关结果 1`,
        url: 'https://example.com/result1',
        snippet: `这是关于 "${query}" 的第一条搜索结果摘要...`,
        source: 'example.com'
      },
      {
        title: `${query} 百科`,
        url: 'https://wiki.example.com/' + encodeURIComponent(query),
        snippet: `${query} 是指...这里是百科词条的简要说明。`,
        source: 'wiki.example.com'
      },
      {
        title: `如何了解 ${query}`,
        url: 'https://blog.example.com/how-to',
        snippet: `想要了解 ${query}？本文将为您详细介绍...`,
        source: 'blog.example.com'
      }
    ]

    return mockResults.slice(0, limit)
  }
}
