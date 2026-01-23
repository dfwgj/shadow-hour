/**
 * Anthropic Claude 适配器
 */

import type { LLMConfig } from "../types/config";
import type { Message, ContentPart, ToolCall } from "../types/message";
import type { ToolDefinition } from "../types/tool";
import type { LLMAdapter, ChatRequest, ChatResponse, StreamCallback, StreamController } from "./types";
import { streamRequest } from "@xierfloat-monorepo/http-stream";
import { getTextContent } from "./utils";

/** Anthropic 消息格式 */
interface AnthropicMessage {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Anthropic Claude 适配器实现
 */
export class AnthropicAdapter implements LLMAdapter {
  readonly name: string;
  readonly supportsStreaming = true;
  readonly supportsTools = true;
  readonly supportsVision = true;

  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.name = config.name;
  }

  /**
   * 非流式聊天
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.sendRequest(request);
    const data = (await response.json()) as {
      id: string;
      content: AnthropicContentBlock[];
      stop_reason: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    };

    return {
      message: this.parseAssistantMessage(data.id, data.content),
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      },
      stopReason: this.parseStopReason(data.stop_reason)
    };
  }

  /**
   * 流式聊天
   */
  stream(request: ChatRequest, callback: StreamCallback): StreamController {
    const messages = this.convertMessages(request.messages);
    const tools = request.tools ? this.convertTools(request.tools) : undefined;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      stream: true
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    if (request.stopSequences) {
      body.stop_sequences = request.stopSequences;
    }

    let buffer = "";
    let currentToolId = "";

    const { controller, promise } = streamRequest(
      {
        url: `${this.config.baseUrl}/messages`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body,
        timeout: 60000
      },
      {
        onData: chunk => {
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const event = JSON.parse(data) as {
                type: string;
                message?: { id: string };
                index?: number;
                content_block?: AnthropicContentBlock;
                delta?: { type: string; text?: string; partial_json?: string; stop_reason?: string };
              };

              switch (event.type) {
                case "message_start":
                  if (event.message) {
                    callback({
                      type: "message_start",
                      timestamp: Date.now(),
                      data: { messageId: event.message.id, model: this.config.model }
                    });
                  }
                  break;

                case "content_block_start":
                  if (event.content_block?.type === "tool_use") {
                    currentToolId = event.content_block.id;
                    callback({
                      type: "tool_use_start",
                      timestamp: Date.now(),
                      data: {
                        toolCallId: event.content_block.id,
                        toolName: event.content_block.name
                      }
                    });
                  }
                  break;

                case "content_block_delta":
                  if (event.delta?.type === "text_delta" && event.delta.text) {
                    callback({
                      type: "text_delta",
                      timestamp: Date.now(),
                      data: { text: event.delta.text }
                    });
                  } else if (event.delta?.type === "input_json_delta" && event.delta.partial_json) {
                    callback({
                      type: "tool_use_delta",
                      timestamp: Date.now(),
                      data: { partialJson: event.delta.partial_json }
                    });
                  }
                  break;

                case "content_block_stop":
                  if (currentToolId) {
                    callback({
                      type: "tool_use_stop",
                      timestamp: Date.now(),
                      data: { toolCallId: currentToolId }
                    });
                    currentToolId = "";
                  }
                  break;

                case "message_delta":
                  if (event.delta?.stop_reason) {
                    callback({
                      type: "message_stop",
                      timestamp: Date.now(),
                      data: { stopReason: this.parseStopReason(event.delta.stop_reason) }
                    });
                  }
                  break;

                case "message_stop":
                  // 消息已经结束
                  break;
              }
            } catch {
              // 忽略 JSON 解析错误
            }
          }
        },
        onError: error => {
          callback({
            type: "stream_error",
            timestamp: Date.now(),
            data: {
              error: error instanceof Error ? error.message : String(error)
            }
          });
        },
        onComplete: () => {
          // 流完成
        }
      }
    );

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
      // Anthropic 没有专门的验证端点，尝试发送空请求
      const response = await fetch(`${this.config.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }]
        })
      });

      // 即使请求失败，只要不是 401 就说明 API Key 有效
      if (response.status === 401) {
        return { valid: false, error: "Invalid API key" };
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
   * 估算 Token 数量
   */
  estimateTokens(text: string): number {
    // Claude 使用自己的 tokenizer，这里做简单估算
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 发送非流式请求
   */
  private async sendRequest(request: ChatRequest): Promise<Response> {
    const messages = this.convertMessages(request.messages);
    const tools = request.tools ? this.convertTools(request.tools) : undefined;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      stream: false
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    if (request.stopSequences) {
      body.stop_sequences = request.stopSequences;
    }

    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    return response;
  }

  /**
   * 转换消息格式
   */
  private convertMessages(messages: Message[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        // 系统消息单独处理
        continue;
      }

      if (msg.role === "user") {
        result.push({
          role: "user",
          content: this.convertContentParts(msg.content)
        });
      } else if (msg.role === "assistant") {
        const content: AnthropicContentBlock[] = [];

        // 添加文本内容
        const text = getTextContent(msg.content);
        if (text) {
          content.push({ type: "text", text });
        }

        // 添加工具调用
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments
            });
          }
        }

        if (content.length > 0) {
          result.push({ role: "assistant", content });
        }
      } else if (msg.role === "tool") {
        // 工具结果作为 user 消息
        if (msg.toolResults) {
          const content: AnthropicContentBlock[] = msg.toolResults.map(tr => ({
            type: "tool_result" as const,
            tool_use_id: tr.toolCallId,
            content: tr.content,
            is_error: tr.isError
          }));
          result.push({ role: "user", content });
        }
      }
    }

    return result;
  }

  /**
   * 转换内容部件
   */
  private convertContentParts(parts: ContentPart[]): AnthropicContentBlock[] {
    return parts.map((part): AnthropicContentBlock => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      } else if (part.type === "image") {
        // 从 URL 提取 base64 数据
        const match = part.url.match(/^data:([^;]+);base64,(.+)$/);
        if (match && match[1] && match[2]) {
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: match[1],
              data: match[2]
            }
          };
        }
        // 非 base64 URL 转为文本描述
        return { type: "text", text: `[Image: ${part.alt || part.url}]` };
      }
      // 文件类型转换为文本
      return { type: "text", text: part.extractedText || `[File: ${part.name}]` };
    });
  }

  /**
   * 转换工具定义
   */
  private convertTools(tools: ToolDefinition[]): AnthropicTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
  }

  /**
   * 解析助手消息
   */
  private parseAssistantMessage(id: string, content: AnthropicContentBlock[]): Message {
    const textParts: ContentPart[] = [];
    const toolCalls: ToolCall[] = [];

    for (const block of content) {
      if (block.type === "text") {
        textParts.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
          status: "pending"
        });
      }
    }

    return {
      id,
      role: "assistant",
      content: textParts,
      timestamp: Date.now(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }

  /**
   * 解析停止原因
   */
  private parseStopReason(reason: string): ChatResponse["stopReason"] {
    switch (reason) {
      case "end_turn":
        return "end_turn";
      case "tool_use":
        return "tool_use";
      case "max_tokens":
        return "max_tokens";
      case "stop_sequence":
        return "stop_sequence";
      default:
        return "end_turn";
    }
  }
}

/**
 * 创建 Anthropic 适配器
 */
export function createAnthropicAdapter(config: LLMConfig): LLMAdapter {
  return new AnthropicAdapter(config);
}
