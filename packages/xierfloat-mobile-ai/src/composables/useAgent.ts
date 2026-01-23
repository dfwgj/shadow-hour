/**
 * Agent Composable - 核心 Agent 状态管理
 */

import { ref, computed, type Ref, type ComputedRef } from "nativescript-vue";
import type { AgentState, AgentEvent } from "../types/event";
import type { Message } from "../types/message";
import type { LLMConfig } from "../types/config";
import type { ToolDefinition, ToolContext } from "../types/tool";
import type { Session } from "../types/session";
import type { LLMAdapter, StreamController } from "../llm/types";
import { createLLMAdapter } from "../llm/AdapterRegistry";
import { createEventBus, type IEventBus } from "../engine/EventBus";
import { createStreamMachine, StateTransitions } from "../engine/MealyMachine";
import { createContextManager, type ContextManager } from "../context/ContextManager";
import { getToolRegistry } from "../mcp/ToolRegistry";

/** Agent 配置选项 */
export interface AgentOptions {
  /** LLM 配置 */
  config: LLMConfig;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 可用工具 */
  tools?: ToolDefinition[];
  /** 上下文配置 */
  contextConfig?: {
    maxTokens?: number;
    reserveRecentMessages?: number;
  };
  /** 事件回调 */
  onEvent?: (event: AgentEvent) => void;
}

/** Agent Composable 返回类型 */
export interface UseAgentReturn {
  /** 当前状态 */
  state: Ref<AgentState>;
  /** 消息列表 */
  messages: Ref<Message[]>;
  /** 当前会话 */
  session: Ref<Session | null>;
  /** 是否正在处理 */
  isProcessing: ComputedRef<boolean>;
  /** 是否可以发送 */
  canSend: ComputedRef<boolean>;
  /** 当前响应文本 (流式) */
  streamingText: Ref<string>;
  /** 错误信息 */
  error: Ref<string | null>;

  /** 发送消息 */
  send: (content: string) => Promise<void>;
  /** 中断当前响应 */
  abort: () => void;
  /** 清空对话 */
  clear: () => void;
  /** 重新生成最后一条响应 */
  regenerate: () => Promise<void>;
  /** 订阅事件 */
  subscribe: (handler: (event: AgentEvent) => void) => () => void;
  /** 更新配置 */
  updateConfig: (config: LLMConfig) => void;
  /** 更新系统提示词 */
  updateSystemPrompt: (prompt: string) => void;
}

/**
 * Agent Composable
 */
export function useAgent(options: AgentOptions): UseAgentReturn {
  // 响应式状态
  const state = ref<AgentState>("idle");
  const messages = ref<Message[]>([]);
  const session = ref<Session | null>(null);
  const streamingText = ref("");
  const error = ref<string | null>(null);

  // 内部状态
  let adapter: LLMAdapter = createLLMAdapter(options.config);
  let systemPrompt = options.systemPrompt ?? "";
  const tools = options.tools ?? [];
  const eventBus: IEventBus = createEventBus();
  const contextManager: ContextManager = createContextManager(options.contextConfig);
  const stateMachine = createStreamMachine();
  let streamController: StreamController | null = null;

  // 计算属性
  const isProcessing = computed(() => StateTransitions.isProcessing(state.value));
  const canSend = computed(() => StateTransitions.canStartConversation(state.value));

  // 订阅事件
  if (options.onEvent) {
    eventBus.on(options.onEvent);
  }

  /**
   * 发送消息
   */
  async function send(content: string): Promise<void> {
    if (!canSend.value) {
      console.warn("[useAgent] Cannot send message in current state:", state.value);
      return;
    }

    error.value = null;
    streamingText.value = "";

    // 创建用户消息
    const userMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role: "user",
      content: [{ type: "text", text: content }],
      timestamp: Date.now()
    };

    messages.value = [...messages.value, userMessage];

    // 发送到 LLM
    await processLLMRequest();
  }

  /**
   * 处理 LLM 请求
   */
  async function processLLMRequest(): Promise<void> {
    state.value = "thinking";
    console.log("[useAgent] Processing LLM request...");

    // 获取上下文窗口
    const contextWindow = contextManager.getContextWindow(messages.value, systemPrompt);
    console.log("[useAgent] Context messages count:", contextWindow.messages.length);

    // 获取工具定义
    const toolDefinitions = tools.length > 0 ? tools : getToolRegistry().getDefinitions();
    console.log(`[useAgent] Using ${toolDefinitions.length} tools`);

    try {
      // 流式请求
      console.log("[useAgent] Starting stream request...");
      streamController = adapter.stream(
        {
          messages: contextWindow.messages,
          systemPrompt,
          tools: toolDefinitions
        },
        streamEvent => {
          // 调试: 原始流事件
          console.log("[useAgent] Raw stream event:", streamEvent.type);

          // 通过状态机处理流事件
          const outputs = stateMachine.process(streamEvent);
          console.log("[useAgent] State machine outputs:", outputs.length, outputs.map(o => o.type));

          // 发布所有输出事件
          for (const event of outputs) {
            eventBus.emit(event);

            // 更新状态
            if (event.type === "state_change") {
              console.log("[useAgent] State change:", event.data.previous, "->", event.data.current);
              state.value = event.data.current;
            }

            // 累积文本
            if (event.type === "text_delta") {
              streamingText.value += event.data.text;
              console.log("[useAgent] Text delta, total length:", streamingText.value.length);
            }

            // 调试日志
            if (event.type === "message_stop") {
              console.log("[useAgent] Received message_stop event, stopReason:", event.data.stopReason);
            }
          }
        }
      );
      console.log("[useAgent] Stream controller created");

      // 等待流完成
      console.log("[useAgent] Waiting for stream to complete...");
      await waitForStreamComplete();
      console.log("[useAgent] Stream completed, streamingText length:", streamingText.value.length);

      // 检查是否有工具调用
      const machineState = stateMachine.getState();
      console.log("[useAgent] Machine state after stream:", machineState.current, "pendingToolCalls:", machineState.pendingToolCalls.length);
      if (machineState.pendingToolCalls.length > 0) {
        console.log("[useAgent] Executing tool calls:", machineState.pendingToolCalls.map(tc => tc.name));
        await executeToolCalls(machineState.pendingToolCalls);
      } else {
        // 创建助手消息
        console.log("[useAgent] No tool calls, finalizing message");
        finalizeAssistantMessage();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      state.value = "error";
    }
  }

  /**
   * 等待流完成（带超时）
   */
  function waitForStreamComplete(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        console.warn("[useAgent] Stream timeout after 60s");
        reject(new Error("Stream timeout"));
      }, 60000);

      const unsubscribe = eventBus.on(event => {
        if (event.type === "message_stop" || event.type === "stream_error") {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  /**
   * 执行工具调用
   */
  async function executeToolCalls(
    pendingCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  ): Promise<void> {
    console.log("[useAgent] executeToolCalls started, calls:", pendingCalls.length);
    // 先保存助手消息 (包含工具调用)
    const assistantMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: streamingText.value ? [{ type: "text", text: streamingText.value }] : [],
      timestamp: Date.now(),
      toolCalls: pendingCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
        status: "pending" as const
      }))
    };
    messages.value = [...messages.value, assistantMessage];

    // 执行工具调用
    const toolRegistry = getToolRegistry();
    const results: Array<{ toolCallId: string; content: string; isError?: boolean }> = [];

    const context: ToolContext = {
      sessionId: session.value?.id ?? "default"
    };

    for (const call of pendingCalls) {
      const result = await toolRegistry.execute(call.name, call.arguments, context);
      results.push({
        toolCallId: call.id,
        content: result.success ? result.content : (result.error ?? "Unknown error"),
        isError: !result.success
      });
    }

    // 创建工具结果消息
    const toolMessage: Message = {
      id: `msg_${Date.now()}_tool`,
      role: "tool",
      content: [],
      timestamp: Date.now(),
      toolResults: results
    };
    messages.value = [...messages.value, toolMessage];
    console.log("[useAgent] Tool results added to messages, total messages:", messages.value.length);

    // 重置状态机
    stateMachine.reset({
      current: "idle",
      accumulatedText: "",
      pendingToolCalls: []
    });
    streamingText.value = "";
    console.log("[useAgent] State machine reset, continuing LLM request...");

    // 继续 LLM 请求
    await processLLMRequest();
    console.log("[useAgent] executeToolCalls completed");
  }

  /**
   * 完成助手消息
   */
  function finalizeAssistantMessage(): void {
    if (!streamingText.value) return;

    const assistantMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: [{ type: "text", text: streamingText.value }],
      timestamp: Date.now()
    };
    messages.value = [...messages.value, assistantMessage];

    streamingText.value = "";
    state.value = "idle";

    // 重置状态机
    stateMachine.reset({
      current: "idle",
      accumulatedText: "",
      pendingToolCalls: []
    });
  }

  /**
   * 中断响应
   */
  function abort(): void {
    if (streamController) {
      streamController.abort();
      streamController = null;
    }

    // 保存当前累积的文本
    if (streamingText.value) {
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: [{ type: "text", text: streamingText.value + " [已中断]" }],
        timestamp: Date.now()
      };
      messages.value = [...messages.value, assistantMessage];
    }

    streamingText.value = "";
    state.value = "interrupted";

    // 重置状态机
    stateMachine.reset({
      current: "interrupted",
      accumulatedText: "",
      pendingToolCalls: []
    });
  }

  /**
   * 清空对话
   */
  function clear(): void {
    messages.value = [];
    streamingText.value = "";
    error.value = null;
    state.value = "idle";

    stateMachine.reset({
      current: "idle",
      accumulatedText: "",
      pendingToolCalls: []
    });
  }

  /**
   * 重新生成最后一条响应
   */
  async function regenerate(): Promise<void> {
    // 移除最后一条助手消息
    const lastMessage = messages.value[messages.value.length - 1];
    if (lastMessage?.role === "assistant") {
      messages.value = messages.value.slice(0, -1);
    }

    // 重新处理
    await processLLMRequest();
  }

  /**
   * 订阅事件
   */
  function subscribe(handler: (event: AgentEvent) => void): () => void {
    return eventBus.on(handler);
  }

  /**
   * 更新配置
   */
  function updateConfig(config: LLMConfig): void {
    adapter = createLLMAdapter(config);
  }

  /**
   * 更新系统提示词
   */
  function updateSystemPrompt(prompt: string): void {
    systemPrompt = prompt;
  }

  return {
    state,
    messages,
    session,
    isProcessing,
    canSend,
    streamingText,
    error,
    send,
    abort,
    clear,
    regenerate,
    subscribe,
    updateConfig,
    updateSystemPrompt
  };
}
