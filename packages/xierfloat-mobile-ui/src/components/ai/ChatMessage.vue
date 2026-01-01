<template>
  <StackLayout class="message-wrapper" :class="messageClass">
    <!-- 消息内容 -->
    <StackLayout class="message-content">
      <!-- 角色标签 -->
      <Label :text="roleText" class="role-text" />

      <!-- 工具调用 -->
      <StackLayout v-if="message.toolCalls && message.toolCalls.length > 0" class="tool-calls">
        <StackLayout v-for="toolCall in message.toolCalls" :key="toolCall.id" class="tool-call">
          <Label :text="`🔧 ${toolCall.name}`" class="tool-name" />
          <Label v-if="toolCall.status === 'pending'" text="执行中..." class="tool-status" textWrap="true" />
          <Label v-else-if="toolCall.status === 'completed'" text="✅ 已完成" class="tool-status success" />
          <Label
            v-else-if="toolCall.status === 'error' || toolCall.status === 'executing'"
            text="❌ 失败"
            class="tool-status error"
          />
        </StackLayout>
      </StackLayout>

      <!-- 文本内容 -->
      <Label v-if="displayText" :text="displayText" class="message-text" textWrap="true" />

      <!-- 流式输入光标 -->
      <Label v-if="isStreaming" text="|" class="cursor" />

      <!-- 工具结果 -->
      <StackLayout v-if="message.toolResults && message.toolResults.length > 0" class="tool-results">
        <StackLayout v-for="result in message.toolResults" :key="result.toolCallId" class="tool-result">
          <Label text="结果:" class="result-label" />
          <Label
            :text="formatResultContent(result.content)"
            class="result-content"
            textWrap="true"
            @tap="toggleExpand(result.toolCallId)"
          />
        </StackLayout>
      </StackLayout>

      <!-- 时间戳 -->
      <Label :text="formatTime(message.timestamp)" class="timestamp" />
    </StackLayout>
  </StackLayout>
</template>

<script setup lang="ts">
import { computed, ref } from "nativescript-vue";
import type { Message } from "@xierfloat-monorepo/mobile-ai";

// Props
interface Props {
  message: Message;
  isStreaming?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
});

// 响应式数据
const expandedResults = ref<Set<string>>(new Set());

// Computed
const messageClass = computed(() => ({
  "user-message": props.message.role === "user",
  "assistant-message": props.message.role === "assistant",
  "tool-message": props.message.role === "tool"
}));

const roleText = computed(() => {
  switch (props.message.role) {
    case "user":
      return "你";
    case "assistant":
      return "AI 助手";
    case "tool":
      return "工具结果";
    case "system":
      return "系统";
    default:
      return "";
  }
});

const displayText = computed(() => {
  const textParts = props.message.content.filter(p => p.type === "text");
  if (textParts.length === 0) return "";
  return textParts.map(p => p.text).join("");
});

// 方法
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) {
    return "刚刚";
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} 分钟前`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    if (hours === 1) return "1 小时前";
    return `${hours} 小时前`;
  } else {
    return date.toLocaleDateString();
  }
};

const formatResultContent = (content: string): string => {
  try {
    const parsed = JSON.parse(content);
    if (parsed.message) {
      return parsed.message;
    }
    return content;
  } catch {
    return content;
  }
};

const toggleExpand = (toolCallId: string) => {
  if (expandedResults.value.has(toolCallId)) {
    expandedResults.value.delete(toolCallId);
  } else {
    expandedResults.value.add(toolCallId);
  }
};
</script>

<style scoped>
.message-wrapper {
  orientation: horizontal;
  margin: 8 0;
  spacing: 12;
}

.user-message {
  horizontal-align: right;
}

.user-message .message-content {
  align-items: flex-end;
}

.assistant-message {
  horizontal-align: left;
}

.tool-message {
  horizontal-align: center;
}

.avatar {
  background-color: #f0f0f0;
}

.message-content {
  max-width: 70%;
}

.user-message .message-content {
  background-color: #e3f2fd;
  border-radius: 16 16 4 16;
  padding: 12;
}

.assistant-message .message-content {
  background-color: #ffffff;
  border-radius: 16 16 16 4;
  padding: 12;
  box-shadow: 0 2 4 0 rgba(0, 0, 0, 0.1);
}

.role-text {
  font-size: 12;
  color: #666666;
  margin-bottom: 4;
}

.tool-calls {
  margin: 8 0;
}

.tool-call {
  background-color: #f5f5f5;
  border-radius: 8;
  padding: 8;
  margin: 4 0;
}

.tool-name {
  font-size: 14;
  font-weight: bold;
  color: #333333;
}

.tool-status {
  font-size: 12;
  color: #666666;
}

.tool-status.success {
  color: #4caf50;
}

.tool-status.error {
  color: #f44336;
}

.message-text {
  font-size: 16;
  line-height: 1.5;
  color: #333333;
}

.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

.tool-results {
  margin: 8 0;
}

.tool-result {
  background-color: #f5f5f5;
  border-radius: 8;
  padding: 8;
  margin: 4 0;
}

.result-label {
  font-size: 12;
  color: #666666;
  margin-bottom: 4;
}

.result-content {
  font-size: 14;
  color: #333333;
}

.timestamp {
  font-size: 12;
  color: #999999;
  margin-top: 4;
}
</style>
