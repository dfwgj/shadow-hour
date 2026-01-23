/**
 * 微信搜狗搜索服务
 * @author DF蓝梦/xierfloat
 * @date 2025-12-25
 */
import { WebSearchService } from "../../WebSearchTool";
import { Http } from "@nativescript/core";
import type { SearchResult } from "../../type";
import { parseResults } from "./decodeHtmlSogou";

export class WechatSogouSearchService implements WebSearchService {
  private readonly searchUrl = "https://weixin.sogou.com/weixin";
  async search(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const url = `${this.searchUrl}?query=${encodeURIComponent(query)}&ie=utf8&type=2&s_from=input`;
      const response = await Http.request({
        url,
        method: "GET",
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
          Connection: "keep-alive",
          Referer: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(query)}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0"
        },
        timeout: 15000
      });
      if (String(response.statusCode) === "200") {
        const html = String(response.content || "");
        return parseResults(html, limit);
      }
      return [];
    } catch (error) {
      console.error("[WechatSogou] Search error:", error);
      return [];
    }
  }
}
