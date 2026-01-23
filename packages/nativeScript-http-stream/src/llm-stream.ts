/**
 * LLM 流式响应处理
 * 提供便捷的 OpenAI 兼容 API 流式调用
 * @author: DF蓝梦/xierfloat
 * @date 2025-12-10
 */

import { streamRequest } from "./stream";
import type { StreamController } from "./types";

/**
 * OpenAI 兼容的聊天消息
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * LLM 请求选项
 */
export interface LLMStreamOptions {
  /** API 端点 URL */
  url: string;
  /** API Key */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 聊天消息 */
  messages: ChatMessage[];
  /** 可选工具列表 */
  tools?: ToolDefinition[];
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * LLM 流事件
 */
export interface LLMStreamEvent {
  /** 事件类型 */
  type: "text" | "tool_call" | "done" | "error";
  /** 文本增量（type=text 时） */
  text?: string;
  /** 工具调用（type=tool_call 时） */
  toolCall?: ToolCall;
  /** 错误信息（type=error 时） */
  error?: Error;
  /** 完成原因（type=done 时） */
  finishReason?: string;
}

/**
 * LLM 流回调
 */
export interface LLMStreamCallbacks {
  /** 收到事件时触发 */
  onEvent: (event: LLMStreamEvent) => void;
}

/**
 * LLM 流结果
 */
export interface LLMStreamResult {
  controller: StreamController;
  promise: Promise<void>;
}

/**
 * 解析 SSE data 行
 */
function parseSSEData(line: string): unknown | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6).trim();
  if (data === "[DONE]") return { done: true };

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * 发起 OpenAI 兼容的流式请求
 *
 * @example
 * ```typescript
 * const { controller, promise } = streamLLM(
 *   {
 *     url: "https://api.siliconflow.cn/v1/chat/completions",
 *     apiKey: "your-api-key",
 *     model: "Qwen/Qwen2.5-7B-Instruct",
 *     messages: [{ role: "user", content: "你好" }],
 *   },
 *   {
 *     onEvent: (event) => {
 *       if (event.type === "text") {
 *         console.log(event.text);
 *       }
 *     },
 *   }
 * );
 * ```
 */
export function streamLLM(options: LLMStreamOptions, callbacks: LLMStreamCallbacks): LLMStreamResult {
  // 构建请求体
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: true
  };

  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }
  if (options.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens;
  }
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }

  // 工具调用累积状态
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  return streamRequest(
    {
      url: options.url,
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body,
      timeout: options.timeout || 60000
    },
    {
      onData: line => {
        const parsed = parseSSEData(line);
        if (!parsed) return;

        // [DONE] 信号
        if ((parsed as { done?: boolean }).done) {
          // 发送累积的工具调用
          for (const tc of toolCalls.values()) {
            callbacks.onEvent({
              type: "tool_call",
              toolCall: {
                id: tc.id,
                type: "function",
                function: {
                  name: tc.name,
                  arguments: tc.arguments
                }
              }
            });
          }
          callbacks.onEvent({ type: "done", finishReason: "stop" });
          return;
        }

        const data = parsed as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: {
                  name?: string;
                  arguments?: string;
                };
              }>;
            };
            finish_reason?: string;
          }>;
        };

        const choice = data.choices?.[0];
        if (!choice) return;

        const delta = choice.delta;

        // 文本增量
        if (delta?.content) {
          callbacks.onEvent({
            type: "text",
            text: delta.content
          });
        }

        // 工具调用增量
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index;
            let existing = toolCalls.get(index);

            if (!existing) {
              existing = { id: tc.id || "", name: "", arguments: "" };
              toolCalls.set(index, existing);
            }

            if (tc.id) {
              existing.id = tc.id;
            }
            if (tc.function?.name) {
              existing.name = tc.function.name;
            }
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
            }
          }
        }

        // 完成原因
        if (choice.finish_reason) {
          // 如果是工具调用完成，先发送工具调用
          if (choice.finish_reason === "tool_calls") {
            for (const tc of toolCalls.values()) {
              callbacks.onEvent({
                type: "tool_call",
                toolCall: {
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.name,
                    arguments: tc.arguments
                  }
                }
              });
            }
          }
          callbacks.onEvent({
            type: "done",
            finishReason: choice.finish_reason
          });
        }
      },
      onError: error => {
        callbacks.onEvent({
          type: "error",
          error
        });
      },
      onComplete: () => {
        // 如果没有收到 done 事件，这里补发
      }
    }
  );
}
