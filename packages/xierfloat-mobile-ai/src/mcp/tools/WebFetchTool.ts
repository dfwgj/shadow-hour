/**
 * 网页内容抓取工具
 *
 * 从 URL 获取网页内容并提取纯文本
 */

import { Http } from "@nativescript/core";
import type { ToolHandler, ToolDefinition, ToolExecutionResult } from "../../types/tool";

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
  /** User-Agent */
  userAgent?: string;
}

/**
 * 网页内容抓取工具定义
 */
export const webFetchDefinition: ToolDefinition = {
  name: "web_fetch",
  displayName: "网页读取",
  description: "读取指定网页的内容，提取纯文本信息。可用于获取搜索结果页面的详细内容。",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "要读取的网页 URL"
      },
      maxLength: {
        type: "number",
        description: "返回的最大内容长度（字符数）",
        default: 5000
      }
    },
    required: ["url"]
  },
  category: "web"
};

/**
 * 网页内容抓取服务
 */
export class WebFetchService {
  private readonly config: WebFetchConfig;

  constructor(config?: WebFetchConfig) {
    this.config = {
      timeout: config?.timeout || 15000,
      maxLength: config?.maxLength || 10000,
      userAgent:
        config?.userAgent ||
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36"
    };
  }

  /**
   * 抓取网页内容
   */
  async fetch(url: string, maxLength?: number): Promise<WebFetchResult> {
    const limit = maxLength || this.config.maxLength || 10000;

    try {
      // 验证 URL
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return {
          url,
          title: "",
          content: "",
          length: 0,
          success: false,
          error: "Invalid URL: must start with http:// or https://"
        };
      }

      const response = await Http.request({
        url,
        method: "GET",
        headers: {
          "User-Agent": this.config.userAgent!,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        },
        timeout: this.config.timeout
      });

      if (response.statusCode !== 200) {
        return {
          url,
          title: "",
          content: "",
          length: 0,
          success: false,
          error: `HTTP ${response.statusCode}`
        };
      }

      const html = response.content?.toString() || "";
      const title = this.extractTitle(html);
      const content = this.extractContent(html, limit);

      return {
        url,
        title,
        content,
        length: content.length,
        success: true
      };
    } catch (error) {
      return {
        url,
        title: "",
        content: "",
        length: 0,
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * 批量抓取多个网页
   */
  async fetchMultiple(urls: string[], maxLength?: number): Promise<WebFetchResult[]> {
    const results = await Promise.all(urls.map(url => this.fetch(url, maxLength)));
    return results;
  }

  /**
   * 提取页面标题
   */
  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      return this.decodeHtmlEntities(titleMatch[1] || "").trim();
    }

    // 尝试 og:title
    const ogMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogMatch) {
      return this.decodeHtmlEntities(ogMatch[1] || "").trim();
    }

    return "";
  }

  /**
   * 提取页面主要内容
   */
  private extractContent(html: string, maxLength: number): string {
    let text = html;

    // 1. 移除脚本和样式
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

    // 2. 移除注释
    text = text.replace(/<!--[\s\S]*?-->/g, "");

    // 3. 移除导航、页头、页脚等非内容区域
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
    text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
    text = text.replace(/<aside[\s\S]*?<\/aside>/gi, "");

    // 4. 尝试提取主要内容区域
    const mainContent = this.extractMainContent(text);
    if (mainContent) {
      text = mainContent;
    }

    // 5. 移除所有 HTML 标签
    text = text.replace(/<[^>]+>/g, " ");

    // 6. 解码 HTML 实体
    text = this.decodeHtmlEntities(text);

    // 7. 清理空白字符
    text = text
      .replace(/\s+/g, " ") // 多个空白变成一个空格
      .replace(/\n\s*\n/g, "\n") // 多个换行变成一个
      .trim();

    // 8. 截断到最大长度
    if (text.length > maxLength) {
      // 尽量在句子边界截断
      const truncated = text.substring(0, maxLength);
      const lastPeriod = Math.max(
        truncated.lastIndexOf("。"),
        truncated.lastIndexOf("."),
        truncated.lastIndexOf("！"),
        truncated.lastIndexOf("？")
      );
      if (lastPeriod > maxLength * 0.8) {
        return truncated.substring(0, lastPeriod + 1) + "...";
      }
      return truncated + "...";
    }

    return text;
  }

  /**
   * 尝试提取主要内容区域
   */
  private extractMainContent(html: string): string | null {
    // 尝试常见的内容容器
    const selectors = [
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<main[^>]*>([\s\S]*?)<\/main>/gi,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*id="main"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const regex of selectors) {
      const match = regex.exec(html);
      if (match && match[1] && match[1].length > 200) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  }
}

/**
 * 创建网页抓取工具处理器
 */
export function createWebFetchHandler(service: WebFetchService): ToolHandler {
  return {
    definition: webFetchDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const url = args.url as string;
      const maxLength = (args.maxLength as number) || 5000;

      const result = await service.fetch(url, maxLength);

      if (!result.success) {
        return {
          success: false,
          content: JSON.stringify(
            {
              error: result.error,
              url: result.url
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
            url: result.url,
            title: result.title,
            content: result.content,
            length: result.length
          },
          null,
          2
        )
      };
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = [];
      if (!args.url) errors.push("url is required");
      if (typeof args.url === "string" && !args.url.startsWith("http")) {
        errors.push("url must start with http:// or https://");
      }
      return { valid: errors.length === 0, errors };
    }
  };
}

/**
 * 创建网页抓取工具
 */
export function createWebFetchTools(service?: WebFetchService): ToolHandler[] {
  const svc = service || new WebFetchService();
  return [createWebFetchHandler(svc)];
}
