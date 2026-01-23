/** 内容类型 */
export type ContentType = "html" | "json" | "text" | "pdf" | "unknown";

/** 网页抓取结果 */
export interface WebFetchResult {
  url: string;
  /** 页面标题 */
  title: string;
  /** 处理后的内容 (Markdown 或原始文本) */
  content: string;
  /** 内容长度 (字节) */
  length: number;
  /** 检测到的内容类型 */
  contentType: ContentType;
  /** 是否成功 */
  success: boolean;
  /** 是否被截断 */
  truncated: boolean;
  /** 错误信息 */
  error?: string;
}

/** 网页抓取配置 */
export interface WebFetchConfig {
  /** 请求超时 (毫秒)，默认 15000 */
  timeout?: number;
  /** 最大内容长度 (字节)，默认 100KB */
  maxBytes?: number;
}

/** 100KB 限制 */
export const MAX_CONTENT_BYTES = 100 * 1024;
