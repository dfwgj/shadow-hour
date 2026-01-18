<template>
  <Page actionBarHidden="true">
    <!-- 使用外层 GridLayout 实现弹窗覆盖 -->
    <GridLayout rows="*" columns="*">
      <!-- 主内容 -->
      <GridLayout row="0" col="0" rows="auto, auto, *, auto, auto">
        <!-- 状态栏占位 -->
        <StackLayout row="0" :height="statusBarHeight" class="bg-white" />

        <!-- 头部 -->
        <GridLayout row="1" columns="auto, *, auto, auto, auto" class="bg-white p-3 border-b border-gray-100">
          <Label col="0" text="←" class="text-2xl text-gray-600 p-2" @tap="goBack" />
          <StackLayout col="1" class="horizontal-center">
            <Label text="智能安排" class="text-lg font-bold text-gray-800" />
            <Label :text="currentModelName" class="text-xs text-gray-500 mt-1" />
          </StackLayout>
          <Label col="2" text="＋" class="text-xl text-gray-600 p-2" @tap="createNewSession" />
          <Label col="3" text="📋" class="text-xl text-gray-600 p-2" @tap="toggleHistory" />
          <Label col="4" text="⚙" class="text-xl text-gray-600 p-2" @tap="openConfig" />
        </GridLayout>

        <!-- 消息列表 -->
        <ScrollView row="2" ref="scrollViewRef" class="bg-gray-50">
          <StackLayout class="p-4">
            <!-- 欢迎消息 -->
            <StackLayout v-if="messages.length === 0" class="p-8">
              <Label text="👋" class="text-6xl text-center" />
              <Label text="你好！我是智能日程助手" class="text-xl font-bold text-center text-gray-800 mt-4" />
              <Label
                text="我可以帮你安排日程、设置提醒、查询日程信息"
                class="text-sm text-gray-500 text-center mt-2"
                textWrap="true"
              />

              <!-- API Key 未配置提示 -->
              <StackLayout v-if="!hasApiKey" class="bg-yellow-50 rounded-xl p-4 mt-6">
                <GridLayout columns="auto, *">
                  <Label col="0" text="⚠️" class="text-xl mr-2" />
                  <StackLayout col="1">
                    <Label text="请先配置 API Key" class="text-yellow-800 font-medium" />
                    <Label text="点击右上角设置按钮进行配置" class="text-yellow-600 text-sm" />
                  </StackLayout>
                </GridLayout>
              </StackLayout>

              <!-- 快捷操作 -->
              <Label v-if="hasApiKey" text="试试这些：" class="text-sm text-gray-600 mt-8 mb-2" />
              <StackLayout v-if="hasApiKey">
                <Label
                  v-for="suggestion in suggestions"
                  :key="suggestion"
                  :text="suggestion"
                  class="bg-white p-3 rounded-xl text-gray-700 mb-2"
                  @tap="sendQuickMessage(suggestion)"
                />
              </StackLayout>
            </StackLayout>

            <!-- 消息列表 -->
            <StackLayout
              v-for="message in messages"
              :key="message.id"
              :class="['mb-4', message.role === 'user' ? 'items-end' : 'items-start']"
            >
              <StackLayout
                :class="[
                  'rounded-2xl p-3 max-w-[85%]',
                  message.role === 'user' ? 'bg-purple-100 rounded-tr-sm' : 'bg-white rounded-tl-sm'
                ]"
              >
                <Label :text="message.role === 'user' ? '你' : 'AI 助手'" class="text-xs text-gray-500 mb-1" />
                <Label
                  :text="message.role === 'user' ? message.content : parseMarkdown(message.content)"
                  :class="message.role === 'user' ? 'text-purple-900' : 'text-gray-800'"
                  textWrap="true"
                />
              </StackLayout>
            </StackLayout>

            <!-- 流式输出中 -->
            <StackLayout v-if="streamingText" class="items-start mb-4">
              <StackLayout class="bg-white rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                <Label text="AI 助手" class="text-xs text-gray-500 mb-1" />
                <Label :text="parseMarkdown(streamingText)" class="text-gray-800" textWrap="true" />
                <Label text="▌" class="text-purple-500" />
              </StackLayout>
            </StackLayout>

            <!-- 加载中 -->
            <StackLayout v-if="isProcessing && !streamingText" class="items-start mb-4">
              <StackLayout class="bg-white rounded-2xl rounded-tl-sm p-3">
                <ActivityIndicator busy="true" class="h-6 w-6" />
                <Label text="思考中..." class="text-sm text-gray-500 mt-1" />
              </StackLayout>
            </StackLayout>

            <!-- 错误提示 -->
            <StackLayout v-if="errorMessage" class="bg-red-50 rounded-xl p-4 mb-4">
              <GridLayout columns="auto, *">
                <Label col="0" text="❌" class="text-xl mr-2" />
                <StackLayout col="1">
                  <Label text="出错了" class="text-red-800 font-medium" />
                  <Label :text="errorMessage" class="text-red-600 text-sm" textWrap="true" />
                </StackLayout>
              </GridLayout>
            </StackLayout>
          </StackLayout>
        </ScrollView>

        <!-- 输入区域 -->
        <StackLayout row="3" class="bg-white border-t border-gray-100 p-3">
          <GridLayout columns="*, auto" class="bg-gray-100 rounded-full px-4">
            <TextField
              col="0"
              v-model="inputText"
              :hint="hasApiKey ? '输入消息...' : '请先配置 API Key'"
              class="text-base py-3"
              @returnPress="sendMessage"
              :editable="!isProcessing"
            />
            <Label
              col="1"
              :text="isProcessing ? '⏹' : '➤'"
              :class="['text-2xl p-2', canSend ? 'text-purple-500' : 'text-gray-400']"
              @tap="isProcessing ? abort() : sendMessage()"
            />
          </GridLayout>
        </StackLayout>

        <!-- 底部安全区域 -->
        <StackLayout row="4" :height="bottomSafeArea" class="bg-white" />
      </GridLayout>

      <!-- 历史记录抽屉 -->
      <GridLayout v-show="showHistoryModal" row="0" col="0" rows="*" columns="*, 280">
        <!-- 左侧遮罩 -->
        <StackLayout col="0" backgroundColor="rgba(0,0,0,0.4)" @tap="closeHistory" />

        <!-- 右侧抽屉 -->
        <GridLayout col="1" rows="auto, *, auto" backgroundColor="#1f2937">
          <!-- 抽屉头部 -->
          <GridLayout row="0" columns="auto, *, auto" padding="16" :marginTop="statusBarHeight">
            <Label col="0" text="←" fontSize="20" color="#9ca3af" @tap="closeHistory" />
            <Label col="1" text="历史对话" fontSize="16" fontWeight="bold" color="#ffffff" textAlignment="center" />
            <Label col="2" text="＋" fontSize="20" color="#9ca3af" @tap="createNewAndClose" />
          </GridLayout>

          <!-- 会话列表 -->
          <ScrollView row="1">
            <StackLayout padding="12">
              <Label
                v-if="historyList.length === 0"
                text="暂无历史对话"
                color="#6b7280"
                textAlignment="center"
                padding="32"
              />
              <StackLayout
                v-for="(item, index) in historyList"
                :key="index"
                :backgroundColor="item.id === currentSessionId ? '#374151' : 'transparent'"
                borderRadius="8"
                padding="12"
                marginBottom="4"
                @tap="onSessionTap(item.id)"
              >
                <GridLayout columns="*, auto">
                  <StackLayout col="0">
                    <Label :text="item.title" color="#ffffff" fontSize="14" fontWeight="500" textWrap="true" />
                    <Label :text="getTimeStr(item.updatedAt)" color="#6b7280" fontSize="12" marginTop="4" />
                  </StackLayout>
                  <Label
                    col="1"
                    text="×"
                    color="#6b7280"
                    fontSize="18"
                    padding="4"
                    verticalAlignment="center"
                    @tap="onDeleteTap(item.id)"
                  />
                </GridLayout>
              </StackLayout>
            </StackLayout>
          </ScrollView>

          <!-- 底部信息 -->
          <StackLayout row="2" padding="16" borderTopWidth="1" borderTopColor="#374151">
            <Label :text="historyList.length + ' 个对话'" color="#6b7280" fontSize="12" textAlignment="center" />
          </StackLayout>
        </GridLayout>
      </GridLayout>
    </GridLayout>
  </Page>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch, nextTick, $navigateTo, $navigateBack } from "nativescript-vue";
import { Screen, Application, Utils, ApplicationSettings, Dialogs } from "@nativescript/core";
import { Toast } from "@xierfloat-monorepo/mobile-ui";
import { streamRequest, type StreamController } from "@xierfloat-monorepo/http-stream";
import AIConfig from "./AIConfig.vue";
import { initializeMCPTools, getToolDefinitions, executeTool } from "../services/mcpTools";
import {
  chatHistoryService,
  type ChatSessionItem,
  type ChatMessage as HistoryChatMessage
} from "../services/chatHistory";

// 硅基流动配置常量
const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/messages";
const DEFAULT_MODEL = "zai-org/GLM-4.6V"; // 免费模型

// 系统提示词
const SYSTEM_PROMPT = `你是一个智能日程助手，专门帮助用户管理日程和时间。

你可以使用以下工具：

【日程管理】
- calendar_query: 查询日程（参数: startDate, endDate, keyword, limit）
- calendar_create: 创建单个日程（必需: title, startTime；可选: endTime, description, location, reminder）
- calendar_batch_create: 批量创建日程（必需: events 数组，每个元素包含 title 和 startTime）
- calendar_update: 更新日程（必需: id）
- calendar_delete: 删除单个日程（必需: id）
- calendar_batch_delete: 批量删除日程（必需: ids 数组）

【通知提醒】
- notification_send: 立即发送通知（必需: title, body）
- notification_schedule: 调度提醒（必需: title, body, scheduledAt）

【实用工具】
- get_current_datetime: 获取当前日期和时间（无参数）
- web_search: 联网搜索信息（必需: query；可选: limit）
- web_fetch: 读取网页内容（必需: url）

重要提示：
- 在创建日程前，先用 get_current_datetime 获取当前时间
- 时间格式使用 ISO 格式，如：2025-12-30T10:00:00
- 批量操作时使用 batch_create 或 batch_delete 更高效
- 操作完成后用自然语言告知用户结果

回复要求：简洁友好，时间明确，必要时询问用户`;

// 消息类型
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool_result";
  content: string;
  timestamp: number;
  toolUseId?: string; // 工具调用 ID（仅 tool_result 使用）
}

// 消息列表
const messages = ref<ChatMessage[]>([]);
const inputText = ref("");
const streamingText = ref("");
const isProcessing = ref(false);
const errorMessage = ref("");
const scrollViewRef = ref();
const streamController = ref<StreamController | null>(null);
const isAborted = ref(false);
const toolsReady = ref(false);
const sessionId = ref(`session_${Date.now()}`);
const enableTools = ref(true); // 是否启用工具（某些免费模型可能不支持）

// 历史记录相关
const showHistoryModal = ref(false);
const sessionList = ref<ChatSessionItem[]>([]);
const historyList = ref<ChatSessionItem[]>([]);
const currentSessionId = ref<string | null>(null);

// 简化的时间格式化
function getTimeStr(timestamp: number | undefined): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 状态栏高度
const statusBarHeight = ref(24);
const bottomSafeArea = ref(0);

// API 配置
const apiKey = ref("");
const model = ref(DEFAULT_MODEL);

// 计算属性
const hasApiKey = computed(() => !!apiKey.value);

const canSend = computed(() => {
  return hasApiKey.value && inputText.value.trim() && !isProcessing.value;
});

const currentModelName = computed(() => {
  if (!hasApiKey.value) return "未配置";
  const modelName = model.value.split("/").pop() || model.value;
  return modelName;
});

// 简单 Markdown 解析（转为可读文本）
function parseMarkdown(text: string): string {
  if (!text) return "";

  return (
    text
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

// 快捷建议
const suggestions = ["帮我查看今天的日程", "明天下午3点安排一个会议", "提醒我下周一上午10点开会", "查询本周的所有日程"];

onMounted(() => {
  // 获取状态栏高度
  if (Application.android) {
    const resourceId = Utils.android
      .getApplicationContext()
      .getResources()
      .getIdentifier("status_bar_height", "dimen", "android");
    if (resourceId > 0) {
      const height = Utils.android.getApplicationContext().getResources().getDimensionPixelSize(resourceId);
      statusBarHeight.value = height / Screen.mainScreen.scale;
    }
  }

  // 加载配置
  loadConfig();

  // 初始化 MCP 工具
  try {
    initializeMCPTools();
    toolsReady.value = true;
    console.log("[AIChat] MCP 工具已初始化");
  } catch (error) {
    console.error("[AIChat] MCP 工具初始化失败:", error);
  }

  // 加载上次的对话
  loadLastSession();
});

// 加载上次的对话
function loadLastSession() {
  try {
    const session = chatHistoryService.getOrCreateCurrentSession();
    currentSessionId.value = session.id;
    sessionId.value = session.id;
    messages.value = session.messages as ChatMessage[];
    console.log("[AIChat] 加载会话:", session.id, "消息数:", session.messages.length);

    if (session.messages.length > 0) {
      nextTick(() => scrollToBottom());
    }
  } catch (error) {
    console.error("[AIChat] 加载会话失败:", error);
  }
}

// 保存当前对话
function saveCurrentSession() {
  if (!currentSessionId.value) return;

  chatHistoryService.updateSessionMessages(currentSessionId.value, messages.value as HistoryChatMessage[]);
}

// 监听消息变化，自动保存
watch(
  messages,
  () => {
    saveCurrentSession();
  },
  { deep: true }
);

// 创建新会话
function createNewSession() {
  // 先保存当前会话
  saveCurrentSession();

  // 创建新会话
  const session = chatHistoryService.createSession();
  currentSessionId.value = session.id;
  sessionId.value = session.id;
  messages.value = [];

  Toast.success("已创建新对话");
}

// 创建新会话并关闭抽屉
function createNewAndClose() {
  createNewSession();
  closeHistory();
}

// 切换历史记录显示
function toggleHistory() {
  if (showHistoryModal.value) {
    showHistoryModal.value = false;
  } else {
    try {
      const list = chatHistoryService.getSessionList();
      sessionList.value = list;
      historyList.value = list;
      showHistoryModal.value = true;
      console.log("[AIChat] 显示历史记录, 共", list.length, "条");
    } catch (e) {
      console.error("[AIChat] 获取历史记录失败:", e);
      historyList.value = [];
      showHistoryModal.value = true;
    }
  }
}

// 关闭历史记录
function closeHistory() {
  showHistoryModal.value = false;
}

// 防止事件冒泡的标志
let isDeleting = false;

// 点击会话项
function onSessionTap(id: string) {
  // 如果正在删除，忽略此事件
  if (isDeleting) {
    isDeleting = false;
    return;
  }
  loadSession(id);
}

// 点击删除按钮
function onDeleteTap(id: string) {
  isDeleting = true;
  confirmDeleteSession(id);
}

// 加载指定会话
function loadSession(id: string) {
  // 先保存当前会话
  saveCurrentSession();

  // 加载选中的会话
  const session = chatHistoryService.getSession(id);
  if (session) {
    currentSessionId.value = session.id;
    sessionId.value = session.id;
    messages.value = session.messages as ChatMessage[];
    chatHistoryService.setCurrentSessionId(id);

    closeHistory();
    nextTick(() => scrollToBottom());
    Toast.success("已加载对话");
  } else {
    Toast.error("对话不存在");
  }
}

// 确认删除会话
function confirmDeleteSession(id: string) {
  Dialogs.confirm({
    title: "删除对话",
    message: "确定要删除这个对话吗？删除后无法恢复。",
    okButtonText: "删除",
    cancelButtonText: "取消"
  }).then((result: boolean) => {
    if (result) {
      deleteSession(id);
    }
  });
}

// 删除会话
function deleteSession(id: string) {
  chatHistoryService.deleteSession(id);
  const list = chatHistoryService.getSessionList();
  sessionList.value = list;
  historyList.value = list;

  // 如果删除的是当前会话，创建新会话
  if (id === currentSessionId.value) {
    createNewSession();
  }

  Toast.success("已删除对话");
}

// 格式化时间
function formatTime(timestamp: number | undefined): string {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  if (diff < 60000) {
    return "刚刚";
  } else if (diff < 3600000) {
    return Math.floor(diff / 60000) + "分钟前";
  } else if (diff < 86400000) {
    return Math.floor(diff / 3600000) + "小时前";
  } else if (date.toDateString() === new Date(now.getTime() - 86400000).toDateString()) {
    return "昨天";
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

// 加载配置
function loadConfig() {
  apiKey.value = ApplicationSettings.getString("siliconflow_api_key", "");
  model.value = ApplicationSettings.getString("siliconflow_model", DEFAULT_MODEL);
}

// 返回
function goBack() {
  $navigateBack();
}

// 打开配置
function openConfig() {
  $navigateTo(AIConfig, {
    transition: {
      name: "slide",
      duration: 200
    }
  });
}

// 发送消息
async function sendMessage() {
  if (!inputText.value.trim() || isProcessing.value || !hasApiKey.value) return;

  const text = inputText.value.trim();
  inputText.value = "";
  errorMessage.value = "";

  // 添加用户消息
  const userMessage: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: "user",
    content: text,
    timestamp: Date.now()
  };
  messages.value.push(userMessage);

  await scrollToBottom();

  // 调用 AI
  isProcessing.value = true;
  streamingText.value = "";

  try {
    await callSiliconFlowAPI(text);
  } catch (error: any) {
    console.error("AI 调用失败:", error);
    errorMessage.value = error.message || "请求失败，请稍后重试";
    Toast.error("AI 响应失败");
  } finally {
    isProcessing.value = false;
    streamController.value = null;
  }
}

// 调用硅基流动 API（流式）
async function callSiliconFlowAPI(userInput: string, toolResults?: Array<{ tool_use_id: string; content: string }>) {
  // 构建消息，包含系统提示
  const apiMessages: any[] = [
    { role: "user", content: SYSTEM_PROMPT },
    { role: "assistant", content: "好的，我是你的智能日程助手，随时为你服务！" }
  ];

  // 添加历史消息
  for (const m of messages.value) {
    if (m.role === "tool_result") {
      // 工具结果消息
      apiMessages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: (m as any).toolUseId, content: m.content }]
      });
    } else {
      apiMessages.push({ role: m.role, content: m.content });
    }
  }

  // 如果有工具结果，添加到消息
  if (toolResults && toolResults.length > 0) {
    apiMessages.push({
      role: "user",
      content: toolResults.map(tr => ({
        type: "tool_result",
        tool_use_id: tr.tool_use_id,
        content: tr.content
      }))
    });
  }

  console.log("[AIChat] Calling Silicon Flow API (stream)...");

  // 构建请求体
  const requestBody: any = {
    model: model.value || DEFAULT_MODEL,
    messages: apiMessages,
    max_tokens: 4096,
    stream: true, // 启用流式
    temperature: 0.7
  };

  // 如果工具已准备好且启用，添加工具定义
  if (toolsReady.value && enableTools.value) {
    const tools = getToolDefinitions();
    if (tools.length > 0) {
      requestBody.tools = tools;
      console.log(`[AIChat] 已加载 ${tools.length} 个工具`);
    }
  }

  console.log("[AIChat] 发送流式请求...");

  // 重置状态
  isAborted.value = false;
  streamingText.value = "";
  let fullContent = "";
  let toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  let buffer = "";

  // 工具调用累积状态
  const toolCallsMap: Map<number, { id: string; name: string; arguments: string }> = new Map();

  return new Promise<void>((resolve, reject) => {
    const { controller, promise } = streamRequest(
      {
        url: SILICONFLOW_API_URL,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.value}`,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          Accept: "text/event-stream"
        },
        body: requestBody,
        timeout: 60000
      },
      {
        onData: chunk => {
          // Worker 逐行发送，每个 chunk 就是一行
          const line = chunk.trim();

          // 跳过空行和 event: 行
          if (!line || line.startsWith("event:")) return;

          // 处理 data: 行（兼容有无空格）
          if (!line.startsWith("data:")) return;
          const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();

          if (data === "[DONE]") {
            // 流结束
            console.log("[AIChat] 流式响应完成");
            return;
          }

          try {
            const parsed = JSON.parse(data);

            // Anthropic 格式
            if (parsed.type === "content_block_delta") {
              if (parsed.delta?.type === "text_delta" && parsed.delta?.text) {
                fullContent += parsed.delta.text;
                streamingText.value = fullContent;
                scrollToBottom();
              } else if (parsed.delta?.type === "input_json_delta" && parsed.delta?.partial_json !== undefined) {
                // 工具参数增量 - 使用 parsed.index 获取正确的工具
                const tool = toolCallsMap.get(parsed.index);
                if (tool) {
                  tool.arguments += parsed.delta.partial_json;
                }
              }
            } else if (parsed.type === "content_block_start") {
              if (parsed.content_block?.type === "tool_use") {
                const index = parsed.index || toolCallsMap.size;
                toolCallsMap.set(index, {
                  id: parsed.content_block.id,
                  name: parsed.content_block.name,
                  arguments: ""
                });
                console.log("[AIChat] 检测到工具调用:", parsed.content_block.name);
              }
            }

            // OpenAI 格式
            if (parsed.choices?.[0]?.delta) {
              const delta = parsed.choices[0].delta;

              // 文本增量
              if (delta.content) {
                fullContent += delta.content;
                streamingText.value = fullContent;
                scrollToBottom();
              }

              // 工具调用增量
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const index = tc.index;
                  let existing = toolCallsMap.get(index);

                  if (!existing) {
                    existing = { id: tc.id || "", name: "", arguments: "" };
                    toolCallsMap.set(index, existing);
                  }

                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name = tc.function.name;
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                }
              }
            }
          } catch {
            // 忽略解析错误
          }
        },
        onError: error => {
          console.error("[AIChat] 流式请求错误:", error);

          // 如果是工具不支持错误，禁用工具重试
          if (enableTools.value && error.message?.includes("tool")) {
            console.log("[AIChat] 可能是工具不支持，禁用工具重试...");
            enableTools.value = false;
            callSiliconFlowAPI(userInput, toolResults).then(resolve).catch(reject);
            return;
          }

          reject(error);
        },
        onComplete: async () => {
          console.log("[AIChat] 流式请求完成");

          // 收集工具调用
          for (const tc of toolCallsMap.values()) {
            if (tc.name) {
              try {
                toolUses.push({
                  id: tc.id,
                  name: tc.name,
                  input: tc.arguments ? JSON.parse(tc.arguments) : {}
                });
              } catch (e) {
                console.error("[AIChat] 解析工具参数失败:", e);
              }
            }
          }

          // 保存完整消息
          if (fullContent) {
            const aiMessage: ChatMessage = {
              id: `msg_${Date.now()}`,
              role: "assistant",
              content: fullContent,
              timestamp: Date.now()
            };
            messages.value.push(aiMessage);
            streamingText.value = "";
          }

          // 处理工具调用
          if (toolUses.length > 0) {
            try {
              await handleToolCalls(toolUses);
            } catch (e) {
              reject(e);
              return;
            }
          }

          resolve();
        }
      }
    );

    // 保存控制器用于中断
    streamController.value = controller;

    // 错误处理
    promise.catch(reject);
  });
}

// 处理工具调用
async function handleToolCalls(toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>) {
  console.log(`[AIChat] 处理 ${toolUses.length} 个工具调用`);

  const toolResults: Array<{ tool_use_id: string; content: string }> = [];

  for (const toolUse of toolUses) {
    console.log(`[AIChat] 执行工具: ${toolUse.name}`, toolUse.input);

    // 显示工具调用状态
    streamingText.value = `🔧 正在执行: ${getToolDisplayName(toolUse.name)}...`;
    await scrollToBottom();

    try {
      const result = await executeTool(toolUse.name, toolUse.input, sessionId.value);

      if (result.success) {
        console.log(`[AIChat] 工具执行成功: ${toolUse.name}`);
        toolResults.push({
          tool_use_id: toolUse.id,
          content: result.content
        });
      } else {
        console.error(`[AIChat] 工具执行失败: ${toolUse.name}`, result.error);
        toolResults.push({
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: result.error || "工具执行失败" })
        });
      }
    } catch (error: any) {
      console.error(`[AIChat] 工具执行异常: ${toolUse.name}`, error);
      toolResults.push({
        tool_use_id: toolUse.id,
        content: JSON.stringify({ error: error.message || "工具执行异常" })
      });
    }
  }

  streamingText.value = "";

  // 将工具调用和结果保存到消息历史（用于上下文）
  const toolMessage: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: "assistant",
    content: `[已执行 ${toolUses.length} 个操作]`,
    timestamp: Date.now()
  };
  messages.value.push(toolMessage);

  // 继续对话，让 AI 根据工具结果生成回复
  await callSiliconFlowAPI("", toolResults);
}

// 获取工具显示名称
function getToolDisplayName(name: string): string {
  const displayNames: Record<string, string> = {
    calendar_query: "查询日程",
    calendar_create: "创建日程",
    calendar_batch_create: "批量创建日程",
    calendar_update: "更新日程",
    calendar_delete: "删除日程",
    calendar_batch_delete: "批量删除日程",
    notification_send: "发送通知",
    notification_schedule: "调度通知",
    notification_cancel: "取消通知",
    notification_list: "查询通知",
    get_current_datetime: "获取当前时间",
    web_search: "联网搜索",
    web_fetch: "读取网页"
  };
  return displayNames[name] || name;
}

// 快捷消息
function sendQuickMessage(text: string) {
  inputText.value = text;
  sendMessage();
}

// 中断
function abort() {
  // 设置中断标志
  isAborted.value = true;

  // 中断流式请求
  if (streamController.value) {
    try {
      streamController.value.abort();
    } catch (e) {
      console.log("[AIChat] Abort failed:", e);
    }
    streamController.value = null;
  }

  isProcessing.value = false;

  // 如果有流式内容，保存为消息
  if (streamingText.value) {
    const aiMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: streamingText.value + "\n\n[已中断]",
      timestamp: Date.now()
    };
    messages.value.push(aiMessage);
  }
  streamingText.value = "";
}

// 滚动到底部
async function scrollToBottom() {
  await nextTick();
  if (scrollViewRef.value?.nativeView) {
    scrollViewRef.value.nativeView.scrollToVerticalOffset(scrollViewRef.value.nativeView.scrollableHeight, false);
  }
}
</script>

<style scoped></style>
