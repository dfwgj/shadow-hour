/**
 * OpenAI 兼容适配器
 *
 * 支持 OpenAI API 及其兼容接口 (DeepSeek, Qwen, Moonshot 等)
 */

import type { LLMConfig } from "../types/config";
import type { Message, ContentPart, ToolCall } from "../types/message";
import type { ToolDefinition } from "../types/tool";
import type { LLMAdapter, ChatRequest, ChatResponse, StreamCallback, StreamController } from "./types";
import { streamRequest } from "@xierfloat-monorepo/http-stream";
import { getTextContent } from "./utils";

/** OpenAI 消息格式 */
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * OpenAI 兼容适配器实现
 */
export class OpenAIAdapter implements LLMAdapter {
  readonly name: string;
  readonly supportsStreaming: boolean;
  readonly supportsTools: boolean;
  readonly supportsVision: boolean;

  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.name = config.name;
    this.supportsStreaming = config.supportsStreaming ?? true;
    this.supportsTools = config.supportsTools ?? true;
    this.supportsVision = config.supportsVision ?? false;
  }

  /**
   * 非流式聊天
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.sendRequest(request);
    const data = (await response.json()) as {
      choices: Array<{
        message: OpenAIMessage;
        finish_reason: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
      };
    };

    const choice = data.choices[0];
    if (!choice) {
      throw new Error("No response from LLM");
    }

    return {
      message: this.parseAssistantMessage(choice.message),
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens
          }
        : undefined,
      stopReason: this.parseStopReason(choice.finish_reason)
    };
  }

  /**
   * 流式聊天
   */
  stream(request: ChatRequest, callback: StreamCallback): StreamController {
    const messages = this.convertMessages(request.messages, request.systemPrompt);
    const tools = request.tools ? this.convertTools(request.tools) : undefined;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      stream: true
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    if (request.stopSequences) {
      body.stop = request.stopSequences;
    }

    let messageId = "";
    let currentToolCallId = "";
    let buffer = "";
    let totalChunks = 0;
    let messageStopSent = false; // 防止重复发送 message_stop

    console.log("[OpenAIAdapter] Starting stream request to:", `${this.config.baseUrl}/chat/completions`);

    const { controller, promise } = streamRequest(
      {
        url: `${this.config.baseUrl}/chat/completions`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body,
        timeout: 60000
      },
      {
        onData: chunk => {
          totalChunks++;
          console.log(`[OpenAIAdapter] onData #${totalChunks}, chunk length:`, chunk.length);
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              if (!messageStopSent) {
                messageStopSent = true;
                callback({
                  type: "message_stop",
                  timestamp: Date.now(),
                  data: { stopReason: "end_turn" }
                });
              }
              return;
            }

            try {
              const parsed = JSON.parse(data) as {
                id?: string;
                choices: Array<{
                  delta: {
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

              const choice = parsed.choices[0];
              if (!choice) continue;

              // 消息开始
              if (parsed.id && !messageId) {
                messageId = parsed.id;
                callback({
                  type: "message_start",
                  timestamp: Date.now(),
                  data: { messageId, model: this.config.model }
                });
              }

              // 文本增量
              if (choice.delta.content) {
                console.log("[OpenAIAdapter] text_delta:", choice.delta.content.length, "chars");
                callback({
                  type: "text_delta",
                  timestamp: Date.now(),
                  data: { text: choice.delta.content }
                });
              }

              // 工具调用
              if (choice.delta.tool_calls) {
                for (const toolCall of choice.delta.tool_calls) {
                  if (toolCall.id) {
                    currentToolCallId = toolCall.id;
                    callback({
                      type: "tool_use_start",
                      timestamp: Date.now(),
                      data: {
                        toolCallId: toolCall.id,
                        toolName: toolCall.function?.name || ""
                      }
                    });
                  }

                  if (toolCall.function?.arguments) {
                    callback({
                      type: "tool_use_delta",
                      timestamp: Date.now(),
                      data: { partialJson: toolCall.function.arguments }
                    });
                  }
                }
              }

              // 结束原因
              if (choice.finish_reason) {
                if (currentToolCallId) {
                  callback({
                    type: "tool_use_stop",
                    timestamp: Date.now(),
                    data: { toolCallId: currentToolCallId }
                  });
                }
                if (!messageStopSent) {
                  messageStopSent = true;
                  callback({
                    type: "message_stop",
                    timestamp: Date.now(),
                    data: { stopReason: this.parseStopReason(choice.finish_reason) }
                  });
                }
              }
            } catch {
              // 忽略 JSON 解析错误
            }
          }
        },
        onError: error => {
          console.log("[OpenAIAdapter] onError:", error);
          callback({
            type: "stream_error",
            timestamp: Date.now(),
            data: {
              error: error instanceof Error ? error.message : String(error)
            }
          });
        },
        onComplete: () => {
          console.log("[OpenAIAdapter] onComplete, totalChunks:", totalChunks, "buffer:", buffer.length, "messageStopSent:", messageStopSent);
          // 处理 buffer 中剩余的数据
          if (buffer.trim()) {
            const line = buffer.trim();
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]" && !messageStopSent) {
                messageStopSent = true;
                callback({
                  type: "message_stop",
                  timestamp: Date.now(),
                  data: { stopReason: "end_turn" }
                });
                return;
              }
            }
          }
          // 兜底：确保 message_stop 被发送
          if (!messageStopSent) {
            console.log("[OpenAIAdapter] Emitting fallback message_stop");
            messageStopSent = true;
            callback({
              type: "message_stop",
              timestamp: Date.now(),
              data: { stopReason: "end_turn" }
            });
          }
        }
      }
    );

    console.log("[OpenAIAdapter] Stream request initiated");

    // 保存 promise 用于错误处理
    promise.catch(() => {
      // 错误已在 onError 中处理
    });

    return controller;
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        return { valid: false, error: `API validation failed: ${response.status}` };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * 估算 Token 数量 (简单估算)
   */
  estimateTokens(text: string): number {
    // 简单估算: 英文约 4 字符/token, 中文约 2 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  /**
   * 发送非流式请求
   */
  private async sendRequest(request: ChatRequest): Promise<Response> {
    const messages = this.convertMessages(request.messages, request.systemPrompt);
    const tools = request.tools ? this.convertTools(request.tools) : undefined;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      stream: false
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    if (request.stopSequences) {
      body.stop = request.stopSequences;
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    return response;
  }

  /**
   * 转换消息格式
   */
  private convertMessages(messages: Message[], systemPrompt?: string): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === "system") {
        result.push({ role: "system", content: getTextContent(msg.content) });
      } else if (msg.role === "user") {
        result.push({
          role: "user",
          content: this.convertContentParts(msg.content)
        });
      } else if (msg.role === "assistant") {
        const openaiMsg: OpenAIMessage = {
          role: "assistant",
          content: getTextContent(msg.content)
        };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          openaiMsg.tool_calls = msg.toolCalls.map(tc => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }));
        }
        result.push(openaiMsg);
      } else if (msg.role === "tool") {
        if (msg.toolResults) {
          for (const tr of msg.toolResults) {
            result.push({
              role: "tool",
              content: tr.content,
              tool_call_id: tr.toolCallId
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * 转换内容部件
   */
  private convertContentParts(parts: ContentPart[]): string | OpenAIContentPart[] {
    if (parts.length === 1 && parts[0]?.type === "text") {
      return parts[0].text;
    }

    return parts.map((part): OpenAIContentPart => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      } else if (part.type === "image") {
        return { type: "image_url", image_url: { url: part.url } };
      }
      // 文件类型转换为文本
      return { type: "text", text: part.extractedText || `[File: ${part.name}]` };
    });
  }

  /**
   * 转换工具定义
   */
  private convertTools(tools: ToolDefinition[]): OpenAITool[] {
    return tools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  /**
   * 解析助手消息
   */
  private parseAssistantMessage(msg: OpenAIMessage): Message {
    const toolCalls: ToolCall[] =
      msg.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        status: "pending" as const
      })) || [];

    return {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: msg.content ? [{ type: "text", text: String(msg.content) }] : [],
      timestamp: Date.now(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }

  /**
   * 解析停止原因
   */
  private parseStopReason(reason: string): ChatResponse["stopReason"] {
    switch (reason) {
      case "stop":
        return "end_turn";
      case "tool_calls":
        return "tool_use";
      case "length":
        return "max_tokens";
      default:
        return "end_turn";
    }
  }
}

/**
 * 创建 OpenAI 适配器
 */
export function createOpenAIAdapter(config: LLMConfig): LLMAdapter {
  return new OpenAIAdapter(config);
}
