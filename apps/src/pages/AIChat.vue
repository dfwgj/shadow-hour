<script lang="ts" setup>
/**
 * 智能体聊天页面
 * 管理智能体的聊天会话、历史记录等
 * @author: DF蓝梦/xierfloat
 * @date 2025-12-10
 */
import { ref, computed, onMounted, watch, nextTick, shallowRef, $navigateTo, $navigateBack } from "nativescript-vue";
import { Screen, Application, Utils, ApplicationSettings, Dialogs } from "@nativescript/core";
import { Toast, ToastContainer } from "@xierfloat-monorepo/nativeScript-ui";
import {
  useAgent,
  loadSkills,
  getSkillsPrompt,
  getSkillRegistry,
  getToolRegistry,
  type LLMConfig,
  type Message
} from "@xierfloat-monorepo/nativeScript-ai";
import { appSkills } from "@/services/skills";
import AIConfig from "./AIConfig.vue";
import HistoryDrawer from "../components/HistoryDrawer.vue";
import { parseMarkdown } from "@/utils/markdown";
import { initializeMCPTools } from "../services/mcp";
import {
  chatHistoryService,
  type ChatSessionItem,
  type ChatMessage as HistoryChatMessage
} from "../services/chatHistory";
import systemPrompt from "@/assets/prompt/system_prompt.md";

const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
const DEFAULT_MODEL = "moonshotai/Kimi-K2-Instruct-0905";

// 系统提示词
const SYSTEM_PROMPT = systemPrompt;

// Agent 实例
const agent = shallowRef<ReturnType<typeof useAgent> | null>(null);

// UI 状态
const inputText = ref("");
const scrollViewRef = ref();
const skillsReady = ref(false);
const sessionId = ref(`session_${Date.now()}`);

// 历史记录相关
const showHistoryModal = ref(false);
const sessionList = ref<ChatSessionItem[]>([]);
const historyList = ref<ChatSessionItem[]>([]);
const currentSessionId = ref<string | null>(null);

// 状态栏高度
const statusBarHeight = ref(24);
const bottomSafeArea = ref(0);

// API 配置
const apiKey = ref("");
const model = ref(DEFAULT_MODEL);

// 计算属性
const hasApiKey = computed(() => !!apiKey.value);

const isProcessing = computed(() => agent.value?.isProcessing.value ?? false);

const currentStreamingText = computed(() => agent.value?.streamingText.value ?? "");

const errorMessage = computed(() => agent.value?.error.value ?? null);

const canSendMessage = computed(() => {
  return hasApiKey.value && inputText.value.trim() && !isProcessing.value;
});

const currentModelName = computed(() => {
  if (!hasApiKey.value) return "未配置";
  const modelName = model.value.split("/").pop() || model.value;
  return modelName;
});

// 显示的消息列表 - 转换 SDK 消息格式为 UI 格式
const displayMessages = computed(() => {
  if (!agent.value) return [];

  return agent.value.messages.value
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: getTextFromMessage(m),
      timestamp: m.timestamp,
      toolCalls: m.toolCalls
    }));
});

// 从 Message 中提取文本内容
function getTextFromMessage(message: Message): string {
  if (!message.content || message.content.length === 0) return "";
  return message.content
    .filter(part => part.type === "text")
    .map(part => (part as { type: "text"; text: string }).text)
    .join("");
}

// 获取消息显示文本
function getMessageDisplayText(message: { content: string; toolCalls?: any[] }): string {
  if (message.toolCalls?.length) {
    const toolNames = message.toolCalls.map(t => getToolDisplayName(t.name)).join("、");
    const toolText = `🔧 已调用: ${toolNames}`;
    if (message.content) {
      return parseMarkdown(message.content) + "\n\n" + toolText;
    }
    return toolText;
  }
  return parseMarkdown(message.content || "");
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

// 快捷建议
const suggestions = ["帮我查看今天的日程", "明天下午3点安排一个会议", "提醒我下周一上午10点开会", "查询本周的所有日程"];

// 初始化或更新 Agent
function initAgent() {
  if (!apiKey.value) return;

  // 获取增强的系统提示词
  let enhancedPrompt = SYSTEM_PROMPT;
  if (skillsReady.value) {
    const stats = getSkillRegistry().getStats();
    console.log(`[AIChat] Skills 已加载: ${stats.fullLoaded} 个技能`);
  }

  // 创建 LLM 配置
  const llmConfig: LLMConfig = {
    id: "siliconflow-config",
    name: "SiliconFlow",
    provider: "siliconflow",
    apiKey: apiKey.value,
    baseUrl: SILICONFLOW_BASE_URL,
    model: model.value || DEFAULT_MODEL,
    maxTokens: 4096,
    temperature: 0.7,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false
  };

  // 获取工具定义
  const tools = getToolRegistry().getDefinitions();

  // 创建 Agent
  agent.value = useAgent({
    config: llmConfig,
    systemPrompt: enhancedPrompt,
    tools,
    onEvent: event => {
      // 处理事件
      if (event.type === "text_delta") {
        nextTick(() => scrollToBottom());
      }
    }
  });

  console.log("[AIChat] Agent 已初始化");
}

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
    console.log("[AIChat] MCP 工具已初始化");
  } catch (error) {
    console.error("[AIChat] MCP 工具初始化失败:", error);
  }

  // 初始化 Skills（从前端 assets/skills 加载）
  try {
    loadSkills(appSkills);
    skillsReady.value = true;
    console.log("[AIChat] Skills 已加载:", appSkills.length, "个技能");
  } catch (error) {
    console.error("[AIChat] Skills 初始化失败:", error);
  }

  // 初始化 Agent
  initAgent();

  // 加载上次的对话
  loadLastSession();
});

// 加载上次的对话
function loadLastSession() {
  try {
    const session = chatHistoryService.getOrCreateCurrentSession();
    currentSessionId.value = session.id;
    sessionId.value = session.id;

    // 恢复历史消息到 Agent
    if (agent.value && session.messages.length > 0) {
      const sdkMessages: Message[] = session.messages.map(m => {
        const msg: Message = {
          id: m.id,
          role: m.role as "user" | "assistant" | "tool",
          content: [{ type: "text" as const, text: m.content }],
          timestamp: m.timestamp
        };
        // 恢复 toolCalls
        if (m.toolCalls && m.toolCalls.length > 0) {
          msg.toolCalls = m.toolCalls;
        }
        return msg;
      });
      agent.value.messages.value = sdkMessages;
      console.log("[AIChat] 加载会话:", session.id, "消息数:", session.messages.length);
      nextTick(() => scrollToBottom());
    }
  } catch (error) {
    console.error("[AIChat] 加载会话失败:", error);
  }
}

// 保存当前对话
function saveCurrentSession() {
  if (!currentSessionId.value || !agent.value) return;

  // 调试：检查原始消息
  const allMessages = agent.value.messages.value;
  console.log("[AIChat] 保存前检查消息数:", allMessages.length);
  allMessages.forEach(m => {
    console.log("[AIChat] 消息:", m.id, "role:", m.role, "hasToolCalls:", !!m.toolCalls?.length);
  });

  // 转换 SDK 消息为历史消息格式
  const historyMessages: HistoryChatMessage[] = allMessages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => {
      const msg: HistoryChatMessage = {
        id: m.id,
        role: m.role as "user" | "assistant",
        content: getTextFromMessage(m),
        timestamp: m.timestamp
      };
      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.toolCalls = m.toolCalls;
        console.log("[AIChat] 保存消息包含 toolCalls:", m.id, m.toolCalls.length);
      }
      return msg;
    });

  chatHistoryService.updateSessionMessages(currentSessionId.value, historyMessages);
}

// 监听消息变化，自动保存
watch(
  () => agent.value?.messages.value,
  () => {
    saveCurrentSession();
  },
  { deep: true }
);

// 创建新会话
function createNewSession() {
  saveCurrentSession();

  const session = chatHistoryService.createSession();
  currentSessionId.value = session.id;
  sessionId.value = session.id;

  // 清空 Agent 消息
  if (agent.value) {
    agent.value.clear();
  }

  Toast.success("已创建新对话");
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

// 加载指定会话
function loadSession(id: string) {
  saveCurrentSession();

  const session = chatHistoryService.getSession(id);
  if (session) {
    currentSessionId.value = session.id;
    sessionId.value = session.id;
    chatHistoryService.setCurrentSessionId(id);

    // 调试：检查加载的消息是否包含 toolCalls
    session.messages.forEach(m => {
      if (m.toolCalls && m.toolCalls.length > 0) {
        console.log("[AIChat] 加载消息包含 toolCalls:", m.id, m.toolCalls.length);
      }
    });

    // 恢复历史消息到 Agent
    if (agent.value) {
      const sdkMessages: Message[] = session.messages.map(m => {
        const msg: Message = {
          id: m.id,
          role: m.role as "user" | "assistant" | "tool",
          content: [{ type: "text" as const, text: m.content }],
          timestamp: m.timestamp
        };
        if (m.toolCalls && m.toolCalls.length > 0) {
          msg.toolCalls = m.toolCalls;
        }
        return msg;
      });
      agent.value.messages.value = sdkMessages;
    }

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

  if (id === currentSessionId.value) {
    createNewSession();
  }

  Toast.success("已删除对话");
}

// 加载配置
function loadConfig() {
  apiKey.value = ApplicationSettings.getString("siliconflow_api_key", "");
  model.value = ApplicationSettings.getString("siliconflow_model", DEFAULT_MODEL);
}

// 页面导航到时重新加载配置
function onNavigatedTo() {
  const oldApiKey = apiKey.value;
  const oldModel = model.value;

  loadConfig();

  // 如果配置变化，重新初始化 Agent
  if (oldApiKey !== apiKey.value || oldModel !== model.value) {
    initAgent();
  }
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
  if (!inputText.value.trim() || isProcessing.value || !hasApiKey.value || !agent.value) return;

  const text = inputText.value.trim();
  inputText.value = "";

  // 动态注入相关技能到系统提示词
  if (skillsReady.value) {
    const skillPrompt = getSkillsPrompt(text, 2);
    if (skillPrompt) {
      agent.value.updateSystemPrompt(`${SYSTEM_PROMPT}\n\n${skillPrompt}`);
    }
  }

  await scrollToBottom();

  try {
    await agent.value.send(text);
  } catch (error: any) {
    console.error("[AIChat] AI 调用失败:", error);
    Toast.error("AI 响应失败");
  }
}

// 快捷消息
function sendQuickMessage(text: string) {
  inputText.value = text;
  sendMessage();
}

// 中断
function handleAbort() {
  if (agent.value) {
    agent.value.abort();
  }
}

// 滚动到底部
async function scrollToBottom() {
  await nextTick();
  if (scrollViewRef.value?.nativeView) {
    scrollViewRef.value.nativeView.scrollToVerticalOffset(scrollViewRef.value.nativeView.scrollableHeight, false);
  }
}
</script>
<template>
  <Page actionBarHidden="true" @navigatedTo="onNavigatedTo">
    <!-- 使用外层 GridLayout 实现弹窗覆盖 -->
    <GridLayout rows="*" columns="*">
      <!-- 主内容 -->
      <GridLayout row="0" col="0" rows="auto, auto, *, auto, auto">
        <!-- 状态栏占位 -->
        <StackLayout row="0" :height="statusBarHeight" class="bg-theme-card" />
        <!-- 头部 -->
        <GridLayout row="1" columns="auto, *, auto, auto, auto" class="bg-theme-card p-3 border-b border-theme-light">
          <Label col="0" text="←" class="text-2xl text-theme-secondary p-2" @tap="goBack" />
          <StackLayout col="1" class="horizontal-center">
            <Label text="智能助手埃癸斯" class="text-lg font-bold text-theme-primary" />
            <Label :text="currentModelName" class="text-xs text-theme-secondary mt-1" />
          </StackLayout>
          <Label v-if="hasApiKey" col="2" text="＋" class="text-3xl text-theme-secondary p-2" @tap="createNewSession" />
          <Label v-if="hasApiKey" col="3" text="💬" class="text-xl text-theme-secondary p-2" @tap="toggleHistory" />
          <Label col="4" text="⚙" class="text-3xl text-theme-secondary p-2" @tap="openConfig" />
        </GridLayout>

        <!-- 消息列表 -->
        <ScrollView row="2" ref="scrollViewRef" class="bg-theme-secondary">
          <StackLayout class="p-4">
            <!-- 欢迎消息 -->
            <StackLayout v-if="displayMessages.length === 0" class="p-8">
              <Image src="res://welcome_wave" class="w-24 h-24" horizontalAlignment="center" stretch="aspectFit" />
              <Label text="你好！我是智能助手埃癸斯" class="text-xl font-bold text-center text-theme-primary mt-4" />
              <Label
                text="我可以帮你安排日程、查询日程信息、提供日程建议"
                class="text-sm text-theme-secondary text-center mt-2"
                textWrap="true"
              />

              <!-- API Key 未配置提示 -->
              <StackLayout v-if="!hasApiKey" class="bg-theme-primary rounded-xl p-4 mt-6">
                <GridLayout columns="auto, *">
                  <Label col="0" text="⚠️" class="text-xl mr-2" />
                  <StackLayout col="1">
                    <Label text="请先配置 API Key" class="text-theme-primary font-medium" />
                    <Label text="点击右上角设置按钮进行配置" class="text-theme-primary text-sm" />
                  </StackLayout>
                </GridLayout>
              </StackLayout>

              <!-- 快捷操作 -->
              <Label v-if="hasApiKey" text="试试这些：" class="text-sm text-theme-secondary mt-8 mb-2" />
              <StackLayout v-if="hasApiKey">
                <Label
                  v-for="suggestion in suggestions"
                  :key="suggestion"
                  :text="suggestion"
                  class="bg-theme-card p-3 rounded-xl text-theme-primary mb-2"
                  @tap="sendQuickMessage(suggestion)"
                />
              </StackLayout>
            </StackLayout>

            <!-- 消息列表 -->
            <StackLayout
              v-for="message in displayMessages"
              :key="message.id"
              :class="['mb-4', message.role === 'user' ? 'items-end' : 'items-start']"
            >
              <StackLayout
                :class="[
                  'rounded-2xl p-3 max-w-[85%]',
                  message.role === 'user' ? 'rounded-tr-sm' : 'bg-theme-card rounded-tl-sm'
                ]"
                :style="message.role === 'user' ? 'background-color: rgba(59, 130, 246, 0.15)' : ''"
              >
                <Label :text="message.role === 'user' ? '你' : '埃癸斯'" class="text-xs text-theme-tertiary mb-1" />
                <Label
                  :text="getMessageDisplayText(message)"
                  :class="message.role === 'user' ? 'text-theme-brand' : 'text-theme-primary'"
                  textWrap="true"
                />
              </StackLayout>
            </StackLayout>

            <!-- 流式输出中 -->
            <StackLayout v-if="currentStreamingText" class="items-start mb-4">
              <StackLayout class="bg-theme-card rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                <Label text="埃癸斯" class="text-xs text-theme-tertiary mb-1" />
                <Label :text="parseMarkdown(currentStreamingText)" class="text-theme-primary" textWrap="true" />
                <Label text="▌" class="text-theme-brand" />
              </StackLayout>
            </StackLayout>

            <!-- 加载中 -->
            <StackLayout v-if="isProcessing && !currentStreamingText" class="items-start mb-4">
              <StackLayout class="bg-theme-card rounded-2xl rounded-tl-sm p-3">
                <Label text="思考中..." class="text-sm text-theme-secondary mt-1" />
              </StackLayout>
            </StackLayout>

            <!-- 错误提示 -->
            <StackLayout v-if="errorMessage" class="bg-[var(--error-light)] rounded-xl p-4 mb-4">
              <GridLayout columns="auto, *">
                <Label col="0" text="❌" class="text-xl mr-2" />
                <StackLayout col="1">
                  <Label text="出错了" class="text-theme-error font-medium" />
                  <Label :text="errorMessage" class="text-theme-error text-sm" textWrap="true" />
                </StackLayout>
              </GridLayout>
            </StackLayout>
          </StackLayout>
        </ScrollView>

        <!-- 输入区域 -->
        <StackLayout v-if="hasApiKey" row="3" class="bg-theme-secondary p-3">
          <GridLayout columns="*, auto" class="bg-theme-card rounded-2xl px-4 border-2 border-[var(--primary)]">
            <TextView
              col="0"
              v-model="inputText"
              hint="输入消息..."
              class="text-base py-3"
              @returnPress="sendMessage"
              :editable="!isProcessing"
              height="80"
              lineHeight="2"
            />

            <Label
              col="1"
              :text="isProcessing ? '■' : '↑'"
              width="40"
              height="40"
              textAlignment="center"
              verticalAlignment="middle"
              :class="[
                'text-2xl  bg-theme-card rounded-full  border-2 border-[var(--primary)]',
                canSendMessage ? 'text-theme-brand' : 'text-theme-tertiary'
              ]"
              @tap="isProcessing ? handleAbort() : sendMessage()"
            />
          </GridLayout>
        </StackLayout>

        <!-- 底部安全区域 -->
        <StackLayout row="4" :height="bottomSafeArea" class="bg-theme-card" />
      </GridLayout>

      <!-- 历史记录抽屉组件 -->
      <HistoryDrawer
        row="0"
        col="0"
        :visible="showHistoryModal"
        :history-list="historyList"
        :current-session-id="currentSessionId"
        :status-bar-height="statusBarHeight"
        @close="closeHistory"
        @session-tap="loadSession"
        @delete-tap="confirmDeleteSession"
      />
      <!-- Toast 容器 (覆盖层) -->
      <ToastContainer row="0" col="0" />
    </GridLayout>
  </Page>
</template>
<style scoped></style>
