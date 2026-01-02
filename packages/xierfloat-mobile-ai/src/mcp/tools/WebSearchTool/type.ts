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
  engine: "bing" | "searxng" | "wechat";
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
