import { WebSearchService } from "../../WebSearchTool";
import { Http } from "@nativescript/core";
import type { SearchResult } from "../../type";
import { parseResults } from "./decodeHtmlBing";
/**
 * Bing 中文搜索服务
 */
export class BingCNSearchService implements WebSearchService {
  private readonly searchUrl = "https://cn.bing.com/search";
  async search(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const url = `${this.searchUrl}?q=${encodeURIComponent(query)}&form=QBRE&lq=0&sc=1-6&count=${limit}`;
      const response = await Http.request({
        url,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        timeout: 15000
      });

      if (response.statusCode === 200) {
        const html = response.content?.toString() || "";
        return parseResults(html, limit);
      }
      return [];
    } catch (error) {
      console.error("[BingCN] Search error:", error);
      return [];
    }
  }
}
