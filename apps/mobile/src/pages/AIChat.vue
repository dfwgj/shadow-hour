<template>
  <Page actionBarHidden="true">
    <GridLayout rows="auto, auto, *, auto, auto">
      <!-- 状态栏占位 -->
      <StackLayout row="0" :height="statusBarHeight" class="bg-white" />

      <!-- 头部 -->
      <GridLayout row="1" columns="auto, *, auto" class="bg-white p-3 border-b border-gray-100">
          <Label col="0" text="←" class="text-2xl text-gray-600 p-2" @tap="goBack" />
          <StackLayout col="1" class="horizontal-center">
            <Label text="智能安排" class="text-lg font-bold text-gray-800" />
            <Label text="AI 日程助手" class="text-xs text-gray-500 mt-1" />
          </StackLayout>
          <Label col="2" text="⚙" class="text-xl text-gray-600 p-2" @tap="openConfig" />
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

              <!-- 快捷操作 -->
              <Label text="试试这些：" class="text-sm text-gray-600 mt-8 mb-2" />
              <StackLayout>
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
            <StackLayout v-for="message in messages" :key="message.id" class="mb-4">
              <!-- 用户消息 -->
              <StackLayout v-if="message.role === 'user'" class="items-end">
                <StackLayout class="bg-orange-500 rounded-2xl rounded-tr-sm p-3 max-w-[80%]">
                  <Label :text="getMessageText(message)" class="text-white" textWrap="true" />
                </StackLayout>
                <Label :text="formatTime(message.timestamp)" class="text-xs text-gray-400 mt-1" />
              </StackLayout>

              <!-- AI 消息 -->
              <StackLayout v-else-if="message.role === 'assistant'" class="items-start">
                <GridLayout columns="auto, *" class="max-w-[85%]">
                  <Label col="0" text="🤖" class="text-2xl mr-2" />
                  <StackLayout col="1" class="bg-white rounded-2xl rounded-tl-sm p-3">
                    <Label :text="getMessageText(message)" class="text-gray-800" textWrap="true" />
                  </StackLayout>
                </GridLayout>
                <Label :text="formatTime(message.timestamp)" class="text-xs text-gray-400 mt-1 ml-10" />
              </StackLayout>

              <!-- 工具调用 -->
              <StackLayout v-else-if="message.role === 'tool'" class="items-start ml-10">
                <StackLayout class="bg-blue-50 rounded-xl p-3 max-w-[80%]">
                  <Label text="🔧 工具执行结果" class="text-xs text-blue-600 mb-1" />
                  <Label :text="getToolResultText(message)" class="text-sm text-gray-700" textWrap="true" />
                </StackLayout>
              </StackLayout>
            </StackLayout>

            <!-- 流式输出中 -->
            <StackLayout v-if="streamingText" class="items-start mb-4">
              <GridLayout columns="auto, *" class="max-w-[85%]">
                <Label col="0" text="🤖" class="text-2xl mr-2" />
                <StackLayout col="1" class="bg-white rounded-2xl rounded-tl-sm p-3">
                  <Label :text="streamingText" class="text-gray-800" textWrap="true" />
                  <Label text="|" class="text-orange-500 animate-pulse" />
                </StackLayout>
              </GridLayout>
            </StackLayout>

            <!-- 加载中 -->
            <StackLayout v-if="isProcessing && !streamingText" class="items-start mb-4">
              <GridLayout columns="auto, *" class="max-w-[85%]">
                <Label col="0" text="🤖" class="text-2xl mr-2" />
                <StackLayout col="1" class="bg-white rounded-2xl rounded-tl-sm p-3">
                  <ActivityIndicator busy="true" class="h-6 w-6" />
                  <Label text="思考中..." class="text-sm text-gray-500 mt-1" />
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
              hint="输入消息..."
              class="text-base py-3"
              @returnPress="sendMessage"
              :editable="!isProcessing"
            />
            <Label
              col="1"
              :text="isProcessing ? '⏹' : '➤'"
              :class="[
                'text-2xl p-2',
                canSend && inputText.trim() ? 'text-orange-500' : 'text-gray-400'
              ]"
              @tap="isProcessing ? abort() : sendMessage()"
            />
          </GridLayout>
        </StackLayout>

        <!-- 底部安全区域 -->
        <StackLayout row="4" :height="bottomSafeArea" class="bg-white" />
      </GridLayout>
    </Page>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch, nextTick, $navigateTo, $navigateBack } from 'nativescript-vue'
import { Screen, Application, Utils } from '@nativescript/core'
import type { Message } from '@xierfloat-monorepo/mobile-ai/types'
import AIConfig from './AIConfig.vue'

// 模拟 AI 响应（实际应使用 useChat）
const messages = ref<Message[]>([])
const inputText = ref('')
const streamingText = ref('')
const isProcessing = ref(false)
const canSend = ref(true)
const scrollViewRef = ref()

// 状态栏高度
const statusBarHeight = ref(24)
const bottomSafeArea = ref(0)

// 快捷建议
const suggestions = [
  '帮我查看今天的日程',
  '明天下午3点安排一个会议',
  '提醒我下周一上午10点开会',
  '查询本周的所有日程'
]

onMounted(() => {
  // 获取状态栏高度
  if (Application.android) {
    const resourceId = Utils.android
      .getApplicationContext()
      .getResources()
      .getIdentifier('status_bar_height', 'dimen', 'android')
    if (resourceId > 0) {
      const height = Utils.android.getApplicationContext().getResources().getDimensionPixelSize(resourceId)
      statusBarHeight.value = height / Screen.mainScreen.scale
    }
  }
})

// 返回
function goBack() {
  $navigateBack()
}

// 打开配置
function openConfig() {
  $navigateTo(AIConfig, {
    transition: {
      name: 'slide',
      duration: 200
    }
  })
}

// 发送消息
async function sendMessage() {
  if (!inputText.value.trim() || isProcessing.value) return

  const text = inputText.value.trim()
  inputText.value = ''

  // 添加用户消息
  const userMessage: Message = {
    id: `msg_${Date.now()}`,
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now()
  }
  messages.value.push(userMessage)

  await scrollToBottom()

  // 模拟 AI 响应
  isProcessing.value = true

  try {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 模拟流式输出
    const response = generateMockResponse(text)
    for (let i = 0; i < response.length; i++) {
      streamingText.value += response[i]
      await new Promise(resolve => setTimeout(resolve, 30))
      await scrollToBottom()
    }

    // 添加 AI 消息
    const aiMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: [{ type: 'text', text: streamingText.value }],
      timestamp: Date.now()
    }
    messages.value.push(aiMessage)
    streamingText.value = ''
  } finally {
    isProcessing.value = false
  }
}

// 快捷消息
function sendQuickMessage(text: string) {
  inputText.value = text
  sendMessage()
}

// 中断
function abort() {
  isProcessing.value = false
  streamingText.value = ''
}

// 滚动到底部
async function scrollToBottom() {
  await nextTick()
  if (scrollViewRef.value?.nativeView) {
    scrollViewRef.value.nativeView.scrollToVerticalOffset(
      scrollViewRef.value.nativeView.scrollableHeight,
      false
    )
  }
}

// 获取消息文本
function getMessageText(message: Message): string {
  const textParts = message.content.filter(p => p.type === 'text')
  return textParts.map(p => (p as { type: 'text'; text: string }).text).join('')
}

// 获取工具结果文本
function getToolResultText(message: Message): string {
  if (!message.toolResults || message.toolResults.length === 0) return ''
  try {
    const result = JSON.parse(message.toolResults[0].content)
    return result.message || message.toolResults[0].content
  } catch {
    return message.toolResults[0].content
  }
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 模拟 AI 响应
function generateMockResponse(input: string): string {
  if (input.includes('今天') && input.includes('日程')) {
    return '好的，让我帮你查看今天的日程安排：\n\n📅 今天的日程：\n• 09:00 - 团队晨会\n• 14:00 - 产品评审会\n• 16:30 - 客户电话会议\n\n你还有3个待办事项需要处理。需要我帮你安排新的日程吗？'
  }
  if (input.includes('会议') || input.includes('安排')) {
    return '好的，我来帮你创建日程。\n\n请确认以下信息：\n📌 会议\n🕐 时间：明天下午 3:00\n⏱ 时长：1小时\n\n需要我设置提前提醒吗？'
  }
  if (input.includes('提醒')) {
    return '提醒已设置！✅\n\n我会在活动开始前15分钟通知你。\n\n还有其他需要帮助的吗？'
  }
  if (input.includes('本周') || input.includes('查询')) {
    return '这是本周的日程概览：\n\n📆 周一：2个会议\n📆 周二：1个会议，2个待办\n📆 周三：3个会议\n📆 周四：空闲\n📆 周五：1个会议\n\n本周共有7个日程安排。需要查看具体详情吗？'
  }
  return '我理解你的需求。作为你的智能日程助手，我可以帮你：\n\n• 创建和管理日程\n• 设置事件提醒\n• 查询日程安排\n• 智能安排时间\n\n请告诉我你想做什么？'
}
</script>

<style scoped>
.animate-pulse {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>