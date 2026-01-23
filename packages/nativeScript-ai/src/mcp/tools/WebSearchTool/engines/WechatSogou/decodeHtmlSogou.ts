/**
 * 解析搜狗微信搜索结果 HTML
 * @author DF蓝梦/xierfloat
 * @date 2025-12-25
 */
import { SearchResult } from "../../type";
import { Http } from "@nativescript/core";

export const parseResults = async (html: string, limit: number = 5): Promise<SearchResult[]> => {
  const results: SearchResult[] = [];

  // 搜狗微信结构: <ul class="news-list"> 下的 <li> 标签
  const listBlocks = html.split(/<li[^>]*id="sogou_vr_[^"]*"[^>]*>/gi).slice(1);

  for (const block of listBlocks) {
    if (results.length >= limit) break;

    //  提取标题和 URL - 结构: <h3><a href="/link?url=...">标题</a></h3>
    const titleMatch = block.match(/<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i);
    if (!titleMatch) continue;

    let url = decodeHtmlEntities(titleMatch[1] || "");
    const title = stripHtml(titleMatch[2] || "");

    if (!url || !title) continue;

    //   搜狗的 URL 是相对路径，需要加前缀
    if (url.startsWith("/link?")) {
      url = await getRealUrl("https:weixin.sogou.com" + url);
    }
    let snippet = "";
    const snippetMatch = block.match(/<p[^>]*class="txt-info"[^>]*>([\s\S]*?)<\/p>/i);
    if (snippetMatch) {
      snippet = stripHtml(snippetMatch[1] || "");
    }

    //  提取来源 (公众号名称) - <span class="all-time-y2">来源</span>
    let source = "";
    const sourceMatch = block.match(/<span[^>]*class="all-time-y2"[^>]*>([\s\S]*?)<\/span>/i);
    if (sourceMatch) {
      source = stripHtml(sourceMatch[1] || "");
    }

    results.push({
      title: title.substring(0, 100),
      url,
      snippet: snippet.substring(0, 200) || `来自微信公众号`,
      source: source || "微信公众号"
    });
  }

  return results;
};

const decodeHtmlEntities = (text: string) => {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
};
const stripHtml = (html: string) => {
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
};
const getRealUrl = async (url: string) => {
  const response = await Http.request({
    url,
    method: "GET",
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      Pragma: "no-cache",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0",
      Cookie:
        "ABTEST=0|1767257950|v1; SUID=0836251B9CA6A20B00000000687F9A8D; IPLOC=CN4400;  SUV=1753193101802725; SNUID=8BD871AE0C0B4507F13D14940DC05545; ariaDefaultTheme=undefined"
    },
    timeout: 15000
  });
  if (response.statusCode !== 200) {
    console.error("[SogouWeixin] HTTP error:", response.statusCode);
    return "";
  }
  const scriptContent = response.content?.toString() || "";
  const urlParts: string[] = [];
  let startIndex = 0;
  const pattern = "url += '";
  while (true) {
    const partStart = scriptContent.indexOf(pattern, startIndex);
    if (partStart === -1) break;
    const valueStart = partStart + pattern.length;
    const partEnd = scriptContent.indexOf("'", valueStart);
    if (partEnd === -1) break;
    const part = scriptContent.substring(valueStart, partEnd);
    urlParts.push(part);
    startIndex = partEnd + 1;
  }
  if (urlParts.length === 0) {
    console.error("[SogouWeixin] No url parts found");
    return "暂无链接";
  }
  // 拼接并去掉 @ 符号
  const fullUrl = urlParts.join("").replace(/@/g, "");
  return fullUrl;
};
