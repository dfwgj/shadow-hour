/**
 * 解析 Markdown 文本，转换为可读格式
 * @author  DF蓝梦/xierfloat
 * @date 2025-12-30
 */
export function parseMarkdown(text: string): string {
  if (!text) return "";

  return (
    text
      // 移除 AI 思考过程标签 <think>...</think>
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      // 移除未闭合的 <think> 标签（流式输出时可能出现）
      .replace(/<think>[\s\S]*/gi, "")
      // 代码块
      .replace(/```[\s\S]*?```/g, match => {
        const code = match.replace(/```\w*\n?/g, "").trim();
        return `\n📝 ${code}\n`;
      })
      // 行内代码
      .replace(/`([^`]+)`/g, "「$1」")
      // 粗体
      .replace(/\*\*([^*]+)\*\*/g, "【$1】")
      // 斜体
      .replace(/\*([^*]+)\*/g, "$1")
      // 标题
      .replace(/^### (.+)$/gm, "▸ $1")
      .replace(/^## (.+)$/gm, "▹ $1")
      .replace(/^# (.+)$/gm, "◆ $1")
      // 无序列表
      .replace(/^[-*] (.+)$/gm, "• $1")
      // 有序列表
      .replace(/^\d+\. (.+)$/gm, "○ $1")
      // 链接
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // 清理多余空行
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}