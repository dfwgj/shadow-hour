/** 网页抓取结果 */
export interface WebFetchResult {
  url: string;
  title: string;
  content: string;
  /** 提取的纯文本长度 */
  length: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/** 网页抓取配置 */
export interface WebFetchConfig {
  /** 请求超时 (毫秒) */
  timeout?: number;
  /** 最大内容长度 (字符) */
  maxLength?: number;
}
