/**
 * 网页搜索工具
 *
 * 支持多种搜索引擎：
 * - DuckDuckGo Instant Answer API
 * - Bing Web Search API
 * - 自定义搜索服务
 */

import { Http } from "@nativescript/core";
import type { ToolHandler, ToolDefinition, ToolExecutionResult, WebSearchParams } from "../../types/tool";

/** 搜索服务接口 (由外部注入) */
export interface WebSearchService {
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

/** 搜索结果 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

/** 搜索服务配置 */
export interface SearchServiceConfig {
  /** 搜索引擎类型 */
  engine: "duckduckgo" | "bing" | "bing-cn" | "searxng";
  /** API Key (Bing API 需要) */
  apiKey?: string;
  /** 自定义端点 (SearXNG) */
  endpoint?: string;
  /** SearXNG 配置 */
  searxng?: SearXNGConfig;
}

/** SearXNG 配置 */
export interface SearXNGConfig {
  /** SearXNG 实例 URL (必需) */
  baseUrl: string;
  /** 搜索语言 (默认: zh-CN) */
  language?: string;
  /** 搜索类别: general, images, news, videos, files, it, science, music 等 */
  categories?: string[];
  /** 指定搜索引擎: google, bing, duckduckgo, wikipedia 等 */
  engines?: string[];
  /** 时间范围: day, week, month, year */
  timeRange?: "day" | "week" | "month" | "year";
  /** 安全搜索: 0=关闭, 1=中等, 2=严格 */
  safesearch?: 0 | 1 | 2;
  /** 请求超时 (毫秒) */
  timeout?: number;
}

/** SearXNG API 返回的原始结果 */
export interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  engines: string[];
  parsed_url: string[];
  positions: number[];
  score: number;
  category: string;
  pretty_url?: string;
  publishedDate?: string;
  thumbnail?: string;
  img_src?: string;
}

/**
 * 网页搜索工具定义
 */
export const webSearchDefinition: ToolDefinition = {
  name: "web_search",
  displayName: "网页搜索",
  description: "搜索互联网获取相关信息。可用于查询天气、新闻、知识等。",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索查询词"
      },
      limit: {
        type: "number",
        description: "返回结果数量限制",
        default: 5
      }
    },
    required: ["query"]
  },
  category: "search"
};

/**
 * 创建网页搜索工具处理器
 */
export function createWebSearchHandler(service: WebSearchService): ToolHandler {
  return {
    definition: webSearchDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const params = args as unknown as WebSearchParams;
      const results = await service.search(params.query, params.limit);

      if (results.length === 0) {
        return {
          success: true,
          content: JSON.stringify(
            {
              message: "没有找到相关结果",
              query: params.query,
              results: []
            },
            null,
            2
          )
        };
      }

      return {
        success: true,
        content: JSON.stringify(
          {
            query: params.query,
            count: results.length,
            results: results.map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              source: r.source
            }))
          },
          null,
          2
        )
      };
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = [];
      if (!args.query) errors.push("query is required");
      if (typeof args.query === "string" && args.query.trim().length === 0) {
        errors.push("query cannot be empty");
      }
      return { valid: errors.length === 0, errors };
    }
  };
}

/**
 * 创建网页搜索工具
 */
export function createWebSearchTools(service: WebSearchService): ToolHandler[] {
  return [createWebSearchHandler(service)];
}

/**
 * Bing 搜索服务
 *
 * 使用 Bing Web Search API v7
 * 需要 Azure API Key
 */
export class BingSearchService implements WebSearchService {
  private readonly endpoint = "https://api.bing.microsoft.com/v7.0/search";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const url = `${this.endpoint}?q=${encodeURIComponent(query)}&count=${limit}&mkt=zh-CN`;
      const response = await Http.request({
        url,
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey
        },
        timeout: 10000
      });

      if (response.statusCode === 200) {
        const data = JSON.parse(response.content?.toString() || "{}");
        const webPages = data.webPages?.value || [];

        return webPages.map((page: { name: string; url: string; snippet: string; displayUrl: string }) => ({
          title: page.name,
          url: page.url,
          snippet: page.snippet,
          source: this.extractDomain(page.displayUrl || page.url)
        }));
      }

      throw new Error(`Bing API error: ${response.statusCode}`);
    } catch (error) {
      console.error("[Bing] Search error:", error);
      return [];
    }
  }

  private extractDomain(url: string): string {
    try {
      const match = url.match(/https?:\/\/([^/]+)/);
      return match ? match[1] || "" : url;
    } catch {
      return url;
    }
  }
}

/**
 * Bing 中国搜索服务 (无需 API Key)
 *
 * 解析 cn.bing.com 的 HTML 搜索结果
 * 适合国内网络环境
 */
export class BingCNSearchService implements WebSearchService {
  private readonly searchUrl = "https://cn.bing.com/search";

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const url = `${this.searchUrl}?q=${encodeURIComponent(query)}&count=${limit}`;
      const response = await Http.request({
        url,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "zh-CN,zh;q=0.9"
        },
        timeout: 15000
      });

      if (response.statusCode === 200) {
        const html = response.content?.toString() || "";
        return this.parseResults(html, limit);
      }

      return [];
    } catch (error) {
      console.error("[BingCN] Search error:", error);
      return [];
    }
  }

  private parseResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];

    // 方法1: 分割 b_algo 块后逐个解析
    const algoBlocks = html.split(/<li[^>]*class="b_algo"[^>]*>/gi).slice(1);

    for (const block of algoBlocks) {
      if (results.length >= limit) break;

      // 提取 URL 和标题
      const linkMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const url = this.decodeHtmlEntities(linkMatch[1] || "");
      const title = this.stripHtml(linkMatch[2] || "");

      // 跳过相对 URL 和 Bing 内部链接
      if (!url || !title || !url.startsWith("http") || url.includes("bing.com") || url.includes("microsoft.com")) {
        continue;
      }

      // 提取摘要 (在 <p> 或 class="b_caption" 中)
      let snippet = "";
      const snippetMatch = block.match(/<p[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      if (snippetMatch) {
        snippet = this.stripHtml(snippetMatch[1] || "");
      }

      results.push({
        title: title.substring(0, 100),
        url,
        snippet: snippet.substring(0, 200) || `来自 ${this.extractDomain(url)}`,
        source: this.extractDomain(url)
      });
    }

    // 方法2: 备用 - 匹配 cite 标签获取真实 URL
    if (results.length === 0) {
      // 匹配 <cite>url</cite> ... <a href="...">title</a> 模式
      const blocks = html.split(/<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>/gi).slice(1);
      for (const block of blocks) {
        if (results.length >= limit) break;

        const citeMatch = block.match(/<cite[^>]*>(https?:\/\/[^<]+)<\/cite>/i);
        const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);

        if (citeMatch && titleMatch) {
          const url = this.decodeHtmlEntities(citeMatch[1]);
          const title = this.stripHtml(titleMatch[1]);

          if (url && title && !url.includes("bing.com")) {
            results.push({
              title: title.substring(0, 100),
              url,
              snippet: `来自 ${this.extractDomain(url)} 的搜索结果`,
              source: this.extractDomain(url)
            });
          }
        }
      }
    }

    return results;
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, "")
      .replace(/<strong[^>]*>/gi, "")
      .replace(/<\/strong>/gi, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private extractDomain(url: string): string {
    try {
      const match = url.match(/https?:\/\/([^/]+)/);
      return match ? match[1] || "" : "";
    } catch {
      return "";
    }
  }
}

/**
 * SearXNG 搜索服务
 *
 * 完全开源的元搜索引擎
 * 支持自建实例，返回干净的 JSON 数据
 *
 * 部署文档: https://docs.searxng.org/admin/installation.html
 * API 文档: https://docs.searxng.org/dev/search_api.html
 *
 * 重要: 使用前需要在 SearXNG settings.yml 中启用 JSON 格式:
 * ```yaml
 * search:
 *   formats:
 *     - html
 *     - json
 * ```
 */
export class SearXNGSearchService implements WebSearchService {
  private readonly config: SearXNGConfig;

  constructor(config: SearXNGConfig | string) {
    // 支持直接传入 URL 字符串或完整配置
    if (typeof config === "string") {
      this.config = { baseUrl: config };
    } else {
      this.config = config;
    }
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const { baseUrl, language, categories, engines, timeRange, safesearch, timeout } = this.config;

    // 手动构建 URL，避免 URLSearchParams 的兼容性问题
    const queryParams: string[] = [`q=${encodeURIComponent(query)}`, "format=json"];

    if (language) queryParams.push(`language=${encodeURIComponent(language)}`);
    if (categories?.length) queryParams.push(`categories=${encodeURIComponent(categories.join(","))}`);
    if (engines?.length) queryParams.push(`engines=${encodeURIComponent(engines.join(","))}`);
    if (timeRange) queryParams.push(`time_range=${encodeURIComponent(timeRange)}`);
    if (safesearch !== undefined) queryParams.push(`safesearch=${safesearch}`);

    const url = `${baseUrl.replace(/\/$/, "")}/search?${queryParams.join("&")}`;

    console.log("[SearXNG] Request URL:", url);

    try {
      const response = await Http.request({
        url,
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36"
        },
        timeout: timeout || 15000
      });

      console.log("[SearXNG] Response status:", response.statusCode);

      if (response.statusCode === 200) {
        const content = response.content?.toString() || "{}";
        console.log("[SearXNG] Response length:", content.length);
        console.log("[SearXNG] Response preview:", content.substring(0, 300));

        // 检查是否为 JSON
        const trimmed = content.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
          console.error("[SearXNG] Response is not JSON, got HTML instead");
          console.error("[SearXNG] First 100 chars:", trimmed.substring(0, 100));
          // 返回空结果而不是抛出错误
          return [];
        }

        try {
          const data = JSON.parse(content);
          return this.parseResults(data, limit);
        } catch (parseError) {
          console.error("[SearXNG] JSON parse error:", parseError);
          return [];
        }
      }

      // 错误处理
      if (response.statusCode === 403) {
        console.error("[SearXNG] JSON format disabled. Enable it in settings.yml");
      } else if (response.statusCode === 429) {
        console.error("[SearXNG] Rate limited. Wait before next request.");
      } else {
        console.error(`[SearXNG] HTTP ${response.statusCode}`);
        const content = response.content?.toString() || "";
        console.error("[SearXNG] Error response:", content.substring(0, 200));
      }

      return [];
    } catch (error) {
      console.error("[SearXNG] Search error:", error);
      return [];
    }
  }

  /**
   * 解析 SearXNG JSON 响应
   */
  private parseResults(
    data: {
      results?: SearXNGResult[];
      answers?: string[];
      corrections?: string[];
      infoboxes?: Array<{ infobox: string; content: string; urls: Array<{ title: string; url: string }> }>;
    },
    limit: number
  ): SearchResult[] {
    const results: SearchResult[] = [];

    // 1. 处理主搜索结果
    if (data.results && Array.isArray(data.results)) {
      for (const r of data.results) {
        if (results.length >= limit) break;

        results.push({
          title: r.title || "",
          url: r.url || "",
          snippet: r.content || "",
          source: r.engines?.join(", ") || r.engine || this.extractDomain(r.url)
        });
      }
    }

    // 2. 如果有直接答案，添加到开头
    if (data.answers && data.answers.length > 0) {
      results.unshift({
        title: "直接答案",
        url: "",
        snippet: data.answers[0] || "",
        source: "SearXNG"
      });
    }

    // 3. 如果有信息框 (infobox)，添加相关信息
    if (data.infoboxes && data.infoboxes.length > 0) {
      const infobox = data.infoboxes[0];
      if (infobox && results.length < limit) {
        results.push({
          title: infobox.infobox || "相关信息",
          url: infobox.urls?.[0]?.url || "",
          snippet: infobox.content?.substring(0, 200) || "",
          source: "Wikipedia/Infobox"
        });
      }
    }

    return results.slice(0, limit);
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string {
    try {
      const match = url.match(/https?:\/\/([^/]+)/);
      return match ? match[1] || "" : "";
    } catch {
      return "";
    }
  }

  /**
   * 检查 SearXNG 实例是否可用
   */
  async checkHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      const response = await Http.request({
        url: `${this.config.baseUrl.replace(/\/$/, "")}/config`,
        method: "GET",
        headers: { Accept: "application/json" },
        timeout: 5000
      });

      if (response.statusCode === 200) {
        const data = JSON.parse(response.content?.toString() || "{}");
        return {
          ok: true,
          version: data.version || "unknown"
        };
      }

      return { ok: false, error: `HTTP ${response.statusCode}` };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }
}

/**
 * 创建搜索服务
 *
 * @param config - 搜索服务配置
 *
 * @example
 * ```typescript
 * // 使用 SearXNG (推荐自建实例)
 * const service = createSearchService({
 *   engine: 'searxng',
 *   searxng: {
 *     baseUrl: 'http://localhost:8888',
 *     language: 'zh-CN',
 *     engines: ['google', 'bing', 'duckduckgo']
 *   }
 * })
 *
 * // 或简写
 * const service = createSearchService({
 *   engine: 'searxng',
 *   endpoint: 'http://localhost:8888'
 * })
 * ```
 */
export function createSearchService(config?: SearchServiceConfig): WebSearchService {
  if (!config) {
    // 默认使用 Mock，需要用户显式配置搜索服务
    console.warn("[Search] No config provided, using MockWebSearchService");
    return new MockWebSearchService();
  }

  switch (config.engine) {
    case "searxng":
      // 优先使用 searxng 配置对象
      if (config.searxng) {
        return new SearXNGSearchService(config.searxng);
      }
      // 兼容旧的 endpoint 配置
      if (config.endpoint) {
        return new SearXNGSearchService(config.endpoint);
      }
      throw new Error("SearXNG requires baseUrl in searxng config or endpoint");

    case "bing":
      if (!config.apiKey) {
        throw new Error("Bing API search requires API key");
      }
      return new BingSearchService(config.apiKey);

    case "bing-cn":
      return new BingCNSearchService();

    case "duckduckgo":
      // DuckDuckGo 暂未实现，使用 Mock
      console.warn("[WebSearch] DuckDuckGo not implemented, using mock");
      return new MockWebSearchService();

    default:
      return new MockWebSearchService();
  }
}

/**
 * 模拟搜索服务 (开发/测试用)
 */
export class MockWebSearchService implements WebSearchService {
  async search(query: string, limit = 5): Promise<SearchResult[]> {
    // 返回模拟结果
    const mockResults: SearchResult[] = [
      {
        title: `${query} - 相关结果 1`,
        url: "https://example.com/result1",
        snippet: `这是关于 "${query}" 的第一条搜索结果摘要...`,
        source: "example.com"
      },
      {
        title: `${query} 百科`,
        url: "https://wiki.example.com/" + encodeURIComponent(query),
        snippet: `${query} 是指...这里是百科词条的简要说明。`,
        source: "wiki.example.com"
      },
      {
        title: `如何了解 ${query}`,
        url: "https://blog.example.com/how-to",
        snippet: `想要了解 ${query}？本文将为您详细介绍...`,
        source: "blog.example.com"
      }
    ];

    return mockResults.slice(0, limit);
  }
}
