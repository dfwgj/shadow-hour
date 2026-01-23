/**
 * @xierfloat-monorepo/nativeScript-http-stream
 * @version 1.0.0
 * @author: DF蓝梦/xierfloat
 * @date 2025-1-10
 * NativeScript 流式 HTTP 客户端，因为 NativeScript 不支持 Fetch API 的流式响应，
 * 所以需要使用自定义的实现。
 * 支持 SSE (Server-Sent Events) 和分块传输
 *
 * @example
 * ```typescript
 * import { streamRequest, sseConnect } from "@xierfloat-monorepo/nativeScript-http-stream";
 *
 * // 流式请求（例如 OpenAI API）
 * const { controller, promise } = streamRequest(
 *   {
 *     url: "https://api.openai.com/v1/chat/completions",
 *     method: "POST",
 *     headers: {
 *       "Authorization": "Bearer YOUR_API_KEY",
 *       "Content-Type": "application/json",
 *     },
 *     body: {
 *       model: "gpt-4",
 *       messages: [{ role: "user", content: "Hello!" }],
 *       stream: true,
 *     },
 *   },
 *   {
 *     onData: (chunk) => console.log("Chunk:", chunk),
 *     onComplete: () => console.log("Done!"),
 *     onError: (err) => console.error("Error:", err),
 *   }
 * );
 *
 * // 取消请求
 * controller.abort();
 *
 * // SSE 连接
 * const sse = sseConnect(
 *   { url: "https://example.com/events" },
 *   {
 *     onEvent: (event) => console.log("Event:", event.data),
 *     onOpen: () => console.log("Connected"),
 *     onClose: () => console.log("Disconnected"),
 *   }
 * );
 * ```
 */

// 导出基础类型
export type {
  StreamRequestOptions,
  StreamCallbacks,
  StreamController,
  StreamResult,
  SSEEvent,
  SSECallbacks
} from "./types";

// 导出 LLM 流式类型
export type {
  ChatMessage,
  ToolCall,
  ToolDefinition,
  LLMStreamOptions,
  LLMStreamEvent,
  LLMStreamCallbacks,
  LLMStreamResult
} from "./llm-stream";

// 导出平台特定实现
// NativeScript 会根据平台自动选择 .android.ts 或 .ios.ts
export { streamRequest, sseConnect } from "./stream";

// 导出 LLM 便捷 API
export { streamLLM } from "./llm-stream";
