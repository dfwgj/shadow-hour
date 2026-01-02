/**
 * 网页搜索工具
 * @author xierfloat
 * 支持多种搜索引擎：
 * - bing: Bing 中国搜索
 * - searxng: SearXNG 元搜索
 * - WechatSogou: 搜狗微信公众号搜索
 */

import type { SearchResult, SearchServiceConfig } from "./type";
import type { ToolHandler, ToolDefinition, ToolExecutionResult, WebSearchParams } from "../../../types/tool";
import { BingCNSearchService } from "./engines/bing/BingCNSearchService";
import { SearXNGSearchService } from "./engines/SearXNG/SearXNGSearchService";
import { WechatSogouSearchService } from "./engines/WechatSogou/WechatSogouSearchService";

/** 搜索服务接口 (由外部注入) */
export interface WebSearchService {
  search(query: string, limit?: number): Promise<SearchResult[]>;
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
      engine: {
        type: "string",
        description: "搜索引擎: bing(必应), searxng(元搜索), wechat(微信公众号)",
        enum: ["bing", "searxng", "wechat"],
        default: "bing"
      },
      limit: {
        type: "number",
        description: "返回结果数量限制",
        default: 10
      }
    },
    required: ["query"]
  },
  category: "search"
};

/** 默认配置 */
export interface WebSearchConfig {
  defaultEngine?: string;
  engine?: SearchServiceConfig["engine"][];
  searxng?: {
    baseUrl: string;
    language?: string;
    engines?: string[];
  };
}

/**
 * 创建网页搜索工具
 */
export function createWebSearchTools(config?: WebSearchConfig): ToolHandler[] {
  return [createWebSearchHandler(config)];
}

/**
 * 创建网页搜索工具处理器
 * @param config - 可选的默认配置
 */
export function createWebSearchHandler(config?: WebSearchConfig): ToolHandler {
  return {
    definition: webSearchDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const params = args as unknown as WebSearchParams;

      // 动态选择搜索引擎
      const engine = (params.engine || config?.defaultEngine || "bing") as string;
      const service = getSearchService(engine, config);

      const results = await service.search(params.query, params.limit);

      if (results.length === 0) {
        return {
          success: true,
          content: JSON.stringify(
            {
              message: "没有找到相关结果",
              query: params.query,
              engine,
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
            engine,
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
      const validEngines = ["bing", "searxng", "wechat"];
      if (args.engine && !validEngines.includes(args.engine as string)) {
        errors.push(`engine must be one of: ${validEngines.join(", ")}`);
      }
      return { valid: errors.length === 0, errors };
    }
  };
}

/**
 * 根据引擎名称获取搜索服务实例
 */
function getSearchService(engine: string, config?: WebSearchConfig): WebSearchService {
  switch (engine) {
    case "searxng":
      if (!config?.searxng) {
        throw new Error("SearXNG requires configuration with baseUrl");
      }
      return new SearXNGSearchService(config.searxng);
    case "wechat":
      return new WechatSogouSearchService();
    case "bing":
    default:
      return new BingCNSearchService();
  }
}

/**
 * 创建搜索服务 (兼容旧 API)
 * @deprecated 建议使用 createWebSearchHandler 并传入 engine 参数
 */
export function createSearchService(config?: SearchServiceConfig): WebSearchService {
  if (!config) {
    return new BingCNSearchService();
  }
  if (config.engine === "searxng" && config.searxng) {
    return new SearXNGSearchService(config.searxng);
  }
  if (config.engine === "bing") {
    return new BingCNSearchService();
  }
  if (config.engine === "wechat") {
    return new WechatSogouSearchService();
  }
  return new BingCNSearchService();
}
