import { SearchResult } from "../../type";
export const parseResults = (html: string, limit: number): SearchResult[] => {
  const results = [];
  const algoBlocks = html.split(/<li[^>]*class="b_algo"[^>]*>/gi).slice(1);

  for (const block of algoBlocks) {
    if (results.length >= limit) break;

    // 匹配 <h2> 里的 <a href="...">标题</a>
    const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
    if (!titleMatch) continue;
    const url = decodeHtmlEntities(titleMatch[1] || "");
    const title = stripHtml(titleMatch[2] || "");
    // 跳过无效 URL
    if (!url || !title || !url.startsWith("http") || url.includes("bing.com") || url.includes("microsoft.com")) {
      continue;
    }
    // 提取摘要 - 从 b_caption 中的 p 标签
    let snippet = "";
    const captionMatch = block.match(/<div[^>]*class="b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    if (captionMatch) {
      snippet = stripHtml(captionMatch[1] || "");
    }
    results.push({
      title: title.substring(0, 100),
      url,
      snippet: snippet.substring(0, 200) || `来自 ${extractDomain(url)}`,
      source: extractDomain(url)
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
const extractDomain = (url: string) => {
  try {
    const match = url.match(/https?:\/\/([^/]+)/);
    return match ? match[1] || "" : "";
  } catch {
    return "";
  }
};
