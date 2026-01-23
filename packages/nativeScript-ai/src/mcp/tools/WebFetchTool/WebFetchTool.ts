/**
 * 网页内容抓取工具
 * 从 URL 获取内容，HTML 转 Markdown，其他格式直接透传
 * @author DF蓝梦/xierfloat
 * @date 2025-12-25
 */
import { Http } from "@nativescript/core";
import TurndownService from "turndown";
import type { ToolHandler, ToolDefinition, ToolExecutionResult } from "../../../types/tool";
import type { WebFetchResult, WebFetchConfig, ContentType } from "./type";
import { MAX_CONTENT_BYTES } from "./type";

// Re-export types
export type { WebFetchResult, WebFetchConfig, ContentType };

/**
 * 网页内容抓取工具定义
 */
export const webFetchDefinition: ToolDefinition = {
  name: "web_fetch",
  displayName: "网页读取",
  description: "读取指定网页的内容。HTML 页面会转换为 Markdown 格式，JSON/纯文本直接返回。",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "要读取的网页 URL"
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
  private readonly turndown: TurndownService;

  constructor(config?: WebFetchConfig) {
    this.config = {
      timeout: config?.timeout ?? 15000,
      maxBytes: config?.maxBytes ?? MAX_CONTENT_BYTES
    };

    // 配置 Turndown
    this.turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-"
    });

    // 移除 script、style、noscript 标签
    this.turndown.remove(["script", "style", "noscript", "nav", "footer", "aside"]);
  }

  /**
   * 抓取网页内容
   */
  async fetch(url: string): Promise<WebFetchResult> {
    const maxBytes = this.config.maxBytes ?? MAX_CONTENT_BYTES;

    try {
      // 验证 URL
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return this.errorResult(url, "Invalid URL: must start with http:// or https://");
      }

      const response = await Http.request({
        url,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        },
        timeout: this.config.timeout ?? 15000
      });

      if (response.statusCode !== 200) {
        return this.errorResult(url, `HTTP ${response.statusCode}`);
      }

      const rawContent = response.content?.toString() ?? "";
      const headerVal = response.headers?.["Content-Type"] || response.headers?.["content-type"] || "";
      const contentTypeHeader = Array.isArray(headerVal) ? headerVal[0] || "" : headerVal;
      const contentType = this.detectContentType(contentTypeHeader, rawContent);

      // PDF 暂不支持
      if (contentType === "pdf") {
        return this.errorResult(url, "PDF files are not supported yet");
      }

      // 根据类型处理内容
      let processed: string;
      let title = "";

      if (contentType === "html") {
        title = this.extractTitle(rawContent);
        processed = this.htmlToMarkdown(rawContent);
      } else if (contentType === "json") {
        // JSON 格式化后透传
        try {
          const parsed = JSON.parse(rawContent);
          processed = JSON.stringify(parsed, null, 2);
        } catch {
          processed = rawContent;
        }
      } else {
        // 纯文本直接透传
        processed = rawContent;
      }

      // 100KB 截断
      const bytes = new TextEncoder().encode(processed);
      const truncated = bytes.length > maxBytes;

      if (truncated) {
        // 按字节截断，找到合适的字符边界
        const truncatedBytes = bytes.slice(0, maxBytes);
        processed = new TextDecoder().decode(truncatedBytes);
        // 避免截断在多字节字符中间导致乱码，去掉最后可能的残缺字符
        processed = processed.replace(/[\uD800-\uDBFF]$/, "");
        processed += "\n\n[warning: content truncated at 100KB]";
      }

      return {
        url,
        title,
        content: processed,
        length: truncated ? maxBytes : bytes.length,
        contentType,
        success: true,
        truncated
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error("[WebFetchService] Fetch error:", errorMsg);
      return this.errorResult(url, errorMsg);
    }
  }

  /**
   * 检测内容类型
   */
  private detectContentType(header: string, content: string): ContentType {
    const lower = header.toLowerCase();

    if (lower.includes("application/pdf")) {
      return "pdf";
    }
    if (lower.includes("application/json")) {
      return "json";
    }
    if (lower.includes("text/html") || lower.includes("application/xhtml")) {
      return "html";
    }
    if (lower.includes("text/plain")) {
      return "text";
    }

    // 尝试从内容推断
    const trimmed = content.trim();
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<head")) {
      return "html";
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // 不是有效 JSON
      }
    }

    return "text";
  }

  /**
   * HTML 转 Markdown
   */
  private htmlToMarkdown(html: string): string {
    // 先清理一些常见的非内容区域
    let cleaned = html;

    // 移除 head 标签内容（保留 body）
    cleaned = cleaned.replace(/<head[\s\S]*?<\/head>/gi, "");

    // 移除注释
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

    // 使用 Turndown 转换
    const markdown = this.turndown.turndown(cleaned);

    // 清理多余空行
    return markdown.replace(/\n{3,}/g, "\n\n").trim();
  }

  /**
   * 提取页面标题
   */
  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch?.[1]) {
      return this.decodeHtmlEntities(titleMatch[1]).trim();
    }

    // 尝试 og:title
    const ogMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogMatch?.[1]) {
      return this.decodeHtmlEntities(ogMatch[1]).trim();
    }

    return "";
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

  /**
   * 创建错误结果
   */
  private errorResult(url: string, error: string): WebFetchResult {
    return {
      url,
      title: "",
      content: "",
      length: 0,
      contentType: "unknown",
      success: false,
      truncated: false,
      error
    };
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
      const result = await service.fetch(url);

      if (!result.success) {
        return {
          success: false,
          content: JSON.stringify({ error: result.error, url: result.url }, null, 2),
          error: result.error || "Unknown error"
        };
      }

      return {
        success: true,
        content: JSON.stringify(
          {
            url: result.url,
            title: result.title,
            contentType: result.contentType,
            content: result.content,
            length: result.length,
            truncated: result.truncated
          },
          null,
          2
        )
      };
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = [];
      if (!args.url) {
        errors.push("url is required");
      }
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
  const svc = service ?? new WebFetchService();
  return [createWebFetchHandler(svc)];
}
