/**
 * 网页搜索服务实现
 *
 * 使用浏览器打开搜索页面，简化实现
 */

import { openUrl } from '@nativescript/core/utils'
import type { IWebSearchService, SearchResult } from '~/models/interfaces'

export class BrowserSearchService implements IWebSearchService {
  private searchEngines = {
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    baidu: 'https://www.baidu.com/s?wd=',
    duckduckgo: 'https://duckduckgo.com/?q='
  }

  private currentEngine = 'google'

  /**
   * 搜索
   */
  async search(query: string, limit = 5): Promise<SearchResult[]> {
    // 移动端简化实现：在浏览器中打开搜索
    // 实际应用中可以使用搜索 API 或 WebView

    const encodedQuery = encodeURIComponent(query)
    const searchUrl = this.searchEngines[this.currentEngine as keyof typeof this.searchEngines] + encodedQuery

    // 在浏览器中打开搜索
    await openUrl(searchUrl)

    // 返回模拟结果，提示用户查看浏览器
    return [{
      title: '搜索结果',
      url: searchUrl,
      snippet: `已在浏览器中打开 "${query}" 的搜索结果`,
      source: this.currentEngine
    }]
  }

  /**
   * 设置搜索引擎
   */
  setSearchEngine(engine: keyof typeof this.searchEngines): void {
    if (this.searchEngines[engine]) {
      this.currentEngine = engine
    }
  }

  /**
   * 获取支持的搜索引擎
   */
  getSupportedEngines(): string[] {
    return Object.keys(this.searchEngines)
  }
}

/**
 * 创建搜索服务实例
 */
export function createSearchService(): BrowserSearchService {
  return new BrowserSearchService()
}