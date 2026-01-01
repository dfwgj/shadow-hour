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
const abortController = ref<any>(null);
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
    abortController.value = null;
  }
}

// 调用硅基流动 API
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

  console.log("Calling Silicon Flow API...");

  // 构建请求体
  const requestBody: any = {
    model: model.value || DEFAULT_MODEL,
    messages: apiMessages,
    max_tokens: 4096,
    stream: false,
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

  console.log("[AIChat] 发送请求...");

  // 使用 Promise.race 实现超时
  const fetchPromise = fetch(SILICONFLOW_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.value}`,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(requestBody)
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("请求超时(60秒)，请稍后重试")), 60000);
  });

  const response = await Promise.race([fetchPromise, timeoutPromise]);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[AIChat] API 错误:", response.status, errorText);

    // 如果是因为工具不支持导致的错误，尝试禁用工具重试
    if (enableTools.value && (errorText.includes("tool") || response.status === 400)) {
      console.log("[AIChat] 可能是工具不支持，禁用工具重试...");
      enableTools.value = false;
      return callSiliconFlowAPI(userInput, toolResults);
    }

    throw new Error(errorText || `API 错误: ${response.status}`);
  }

  const responseText = await response.text();
  console.log("[AIChat] 收到响应:", responseText.substring(0, 500));

  let fullContent = "";
  let toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

  try {
    const json = JSON.parse(responseText);

    if (Array.isArray(json.content)) {
      for (const block of json.content) {
        if (block.type === "text" && block.text) {
          fullContent += block.text;
        } else if (block.type === "tool_use") {
          // 收集工具调用
          console.log("[AIChat] 检测到工具调用:", block.name);
          toolUses.push({
            id: block.id,
            name: block.name,
            input: block.input || {}
          });
        }
      }
      if (!fullContent && toolUses.length === 0) {
        const hasThinking = json.content.some((b: any) => b.type === "thinking");
        if (hasThinking) {
          fullContent = "抱歉，AI 正在思考中但未生成最终回复，请重试或换个问法。";
        }
      }
    } else if (json.choices?.[0]?.message?.content) {
      // OpenAI 格式响应
      fullContent = json.choices[0].message.content;

      // 检查 OpenAI 格式的工具调用
      const toolCalls = json.choices?.[0]?.message?.tool_calls;
      if (toolCalls && Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
          console.log("[AIChat] 检测到工具调用(OpenAI格式):", tc.function?.name);
          toolUses.push({
            id: tc.id,
            name: tc.function?.name,
            input: JSON.parse(tc.function?.arguments || "{}")
          });
        }
      }
    } else if (json.error) {
      throw new Error(json.error.message || JSON.stringify(json.error));
    }
  } catch (e: any) {
    console.error("[AIChat] 解析响应失败:", e);
    if (e.message && !responseText.startsWith("{")) {
      fullContent = responseText;
    } else {
      throw e;
    }
  }

  // 先显示文本内容
  if (fullContent) {
    await fakeStreamOutput(fullContent);
  }

  // 处理工具调用
  if (toolUses.length > 0) {
    await handleToolCalls(toolUses);
  }
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

// 假流式输出
async function fakeStreamOutput(content: string) {
  streamingText.value = "";
  const chunkSize = 3; // 每次显示字符数
  const delay = 20; // 延迟毫秒

  for (let i = 0; i < content.length; i += chunkSize) {
    if (isAborted.value) {
      break;
    }
    streamingText.value += content.slice(i, i + chunkSize);
    scrollToBottom();
    await new Promise(r => setTimeout(r, delay));
  }

  // 完成后添加到消息列表
  const finalContent = streamingText.value;
  if (finalContent) {
    const aiMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: isAborted.value ? finalContent + "\n\n[已中断]" : finalContent,
      timestamp: Date.now()
    };
    messages.value.push(aiMessage);
  }
  streamingText.value = "";
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

  // 尝试中断 XMLHttpRequest
  if (abortController.value) {
    try {
      if (typeof abortController.value.abort === "function") {
        abortController.value.abort();
      }
    } catch (e) {
      console.log("Abort failed:", e);
    }
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
