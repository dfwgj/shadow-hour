/**
 * SearXNG 搜索服务
 * 完全开源的元搜索引擎
 * 支持自建实例，返回干净的 JSON 数据
 * 部署文档: https://docs.searxng.org/admin/installation.html
 * API 文档: https://docs.searxng.org/dev/search_api.html
 *
 */
import type { WebSearchService } from "../../WebSearchTool";
import type { SearchResult, SearXNGConfig, SearXNGResult } from "../../type";
import { Http } from "@nativescript/core";

export class SearXNGSearchService implements WebSearchService {
  private readonly config: SearXNGConfig;
  constructor(config: SearXNGConfig | string) {
    if (typeof config === "string") {
      this.config = { baseUrl: config };
    } else {
      this.config = config;
    }
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const { baseUrl, language, categories, engines, timeRange, safesearch, timeout } = this.config;
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
        const trimmed = content.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
          console.error("[SearXNG] Response is not JSON, got HTML instead");
          console.error("[SearXNG] First 100 chars:", trimmed.substring(0, 100));
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
