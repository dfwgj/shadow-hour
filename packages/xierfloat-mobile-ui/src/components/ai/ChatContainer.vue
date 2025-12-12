<template>
  <GridLayout class="chat-container" rows="auto, *, auto">
    <!-- 顶部标题栏 -->
    <StackLayout row="0" class="header">
      <Label :text="currentSession?.title || 'AI 助手'" class="header-title" />
      <Label text="日程专家" class="header-subtitle" />
    </StackLayout>

    <!-- 消息列表 -->
    <ScrollView row="1" class="message-list" ref="scrollView">
      <StackLayout class="messages">
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :is-streaming="isProcessing && message.role === 'assistant'"
        />

        <!-- 正在输入指示器 -->
        <StackLayout v-if="isProcessing" class="typing-indicator">
          <ActivityIndicator busy="true" />
          <Label :text="`${currentTask || '助手正在思考'}...`" class="typing-text" />
        </StackLayout>
      </StackLayout>
    </ScrollView>

    <!-- 输入区域 -->
    <StackLayout row="2" class="input-area">
      <GridLayout columns="*, auto" class="input-container">
        <TextField
          col="0"
          v-model="inputText"
          @returnPress="handleSend"
          hint="输入消息..."
          class="input-field"
          :enabled="canSend && !isProcessing"
        />

        <Button
          col="1"
          @tap="handleSend"
          text="发送"
          class="send-button"
          :enabled="canSend && inputText.trim() && !isProcessing"
        />
      </GridLayout>

      <!-- 快捷操作 -->
      <ScrollView orientation="horizontal" class="quick-actions">
        <StackLayout orientation="horizontal">
          <Button
            v-for="action in quickActions"
            :key="action.label"
            :text="action.label"
            @tap="handleQuickAction(action)"
            class="quick-button"
          />
        </StackLayout>
      </ScrollView>
    </StackLayout>
  </GridLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useChat } from '@xierfloat-monorepo/mobile-ai'
import type { Message } from '@xierfloat-monorepo/mobile-ai/types'
import ChatMessage from './ChatMessage.vue'

// Props
interface Props {
  sessionId?: string
}

const props = withDefaults(defineProps<Props>(), {
  sessionId: ''
})

// 初始化聊天
const chat = useChat({
  config: {
    // 默认使用 OpenAI 配置，实际中需从存储读取
    id: 'default',
    name: 'GPT-4',
    provider: 'openai',
    apiKey: 'sk-", // 需要用户配置
    model: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 4096,
    temperature: 0.7,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false
  },
  useSchedulerPrompt: true
})

// 响应式数据
const inputText = ref('')
const scrollView = ref()
const currentTask = ref('')

// Computed
const messages = computed(() => chat.messages.value)
const isProcessing = computed(() => chat.isProcessing.value)
const canSend = computed(() => chat.canSend.value)
const currentSession = computed(() => chat.session.value)

// 快捷操作
const quickActions = [
  { label: '查看今天日程', prompt: '帮我查看今天的日程安排' },
  { label: '创建会议', prompt: '帮我创建一个会议' },
  { label: '设置提醒', prompt: '设置一个提醒' },
  { label: '搜索信息', prompt: '搜索相关信息' }
]

// 方法
const handleSend = async () => {
  if (!inputText.value.trim() || !canSend.value || isProcessing.value) {
    return
  }

  const text = inputText.value.trim()
  inputText.value = ''

  try {
    await chat.send(text)
    await scrollToBottom()
  } catch (error) {
    console.error('发送消息失败:', error)
    // 显示错误提示
  }
}

const handleQuickAction = async (action: { label: string; prompt: string }) => {
  inputText.value = action.prompt
  await handleSend()
}

const scrollToBottom = async () => {
  await nextTick()
  if (scrollView.value?.nativeView) {
    scrollView.value.nativeView.scrollToVerticalOffset(
      scrollView.value.nativeView.scrollableHeight,
      false
    )
  }
}

// 监听消息变化，自动滚动到底部
watch(messages, () => {
  scrollToBottom()
}, { deep: true })

// 监听流事件，更新任务状态
chat.subscribe((event) => {
  switch (event.type) {
    case 'thinking':
      currentTask.value = '思考中'
      break
    case 'responding':
      currentTask.value = '生成回复'
      break
    case 'tool_calling':
      currentTask.value = `调用工具: ${event.data.toolName}`
      break
    case 'text_delta':
      currentTask.value = '回复中'
      break
  }
})

// 初始化
onMounted(async () => {
  if (props.sessionId) {
    await chat.switchSession(props.sessionId)
  } else {
    // 创建新会话
    await chat.createSession('新对话')
  }
})
</script>

<style scoped>
.chat-container {
  height: 100%;
  background-color: #f5f5f5;
}

.header {
  background-color: #ffffff;
  padding: 16;
  border-bottom-width: 1;
  border-bottom-color: #e0e0e0;
}

.header-title {
  font-size: 18;
  font-weight: bold;
  color: #333333;
}

.header-subtitle {
  font-size: 14;
  color: #666666;
  margin-top: 4;
}

.message-list {
  padding: 8;
}

.messages {
  spacing: 8;
}

.typing-indicator {
  orientation: horizontal;
  horizontal-align: center;
  padding: 16;
  spacing: 8;
}

.typing-text {
  font-size: 14;
  color: #666666;
}

.input-area {
  background-color: #ffffff;
  border-top-width: 1;
  border-top-color: #e0e0e0;
  padding: 16;
}

.input-container {
  spacing: 8;
}

.input-field {
  padding: 12;
  border-width: 1;
  border-color: #e0e0e0;
  border-radius: 8;
  font-size: 16;
}

.send-button {
  padding: 12 24;
  background-color: #2196f3;
  color: white;
  border-radius: 8;
  font-weight: bold;
}

.quick-actions {
  margin-top: 12;
  height: 40;
}

.quick-button {
  padding: 8 16;
  margin-right: 8;
  background-color: #f0f0f0;
  border-radius: 20;
  font-size: 14;
}
</style>