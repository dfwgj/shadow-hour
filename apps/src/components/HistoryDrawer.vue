<script lang="ts" setup>
/**
 * 历史记录抽屉组件
 * 管理历史记录抽屉状态：显示/隐藏、会话列表等
 * 提供会话项点击功能：切换当前会话、删除会话等
 * @author: DF蓝梦/xierfloat
 * @date 2025-12-10
 */
import { useTheme } from "../composables/useTheme";
const { getColor } = useTheme();

// NativeScript 视频路径需要使用 ~ 前缀指向 app 资源目录
const video = "~/assets/videos/cycle.mp4";

// 会话项类型
interface SessionItem {
  id: string;
  title: string;
  updatedAt?: number;
}

// Props
defineProps<{
  visible: boolean;
  historyList: SessionItem[];
  currentSessionId: string | null;
  statusBarHeight: number;
}>();

// Emits
const emit = defineEmits<{
  (e: "close"): void;
  (e: "sessionTap", id: string): void;
  (e: "deleteTap", id: string): void;
}>();

// 防止事件冒泡的标志
let isDeleting = false;

// 点击会话项
function onSessionTap(id: string) {
  // 如果正在删除，忽略此事件
  if (isDeleting) {
    isDeleting = false;
    return;
  }
  emit("sessionTap", id);
}

// 点击删除按钮
function onDeleteTap(id: string) {
  isDeleting = true;
  emit("deleteTap", id);
}

// 时间格式化
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
</script>
<template>
  <!-- 历史记录抽屉 -->
  <GridLayout v-show="visible" rows="*" columns="*, 280">
    <!-- 左侧遮罩 -->
    <StackLayout col="0" backgroundColor="rgba(0,0,0,0.4)" @tap="$emit('close')" />
    <!-- 右侧抽屉 -->
    <GridLayout col="1" rows="*" columns="*">
      <!-- 最底层：白色背景填补视频上部分空缺 -->
      <StackLayout row="0" col="0" backgroundColor="#FFFDFF" />
      <!-- 视频背景层：靠底部 -->
      <VideoPlayer
        row="0"
        col="0"
        :src="video"
        autoplay="true"
        loop="true"
        muted="true"
        controls="false"
        stretch="aspectFill"
        verticalAlignment="bottom"
      />
      <!-- 内容层 -->
      <GridLayout row="0" col="0" rows="auto, *, auto">
        <!-- 抽屉头部 -->
        <GridLayout row="0" columns="auto, *, auto" padding="16" :marginTop="statusBarHeight">
          <Label col="0" text="←" fontSize="20" :color="getColor('primary')" @tap="$emit('close')" />
          <Label
            col="1"
            text="历史对话"
            fontSize="16"
            fontWeight="bold"
            :color="getColor('primary')"
            textAlignment="center"
          />
        </GridLayout>

        <!-- 会话列表 -->
        <ScrollView row="1">
          <StackLayout padding="12">
            <Label
              v-if="historyList.length === 0"
              text="暂无历史对话"
              :color="getColor('primary')"
              textAlignment="center"
              padding="32"
            />
            <StackLayout
              v-for="(item, index) in historyList"
              :key="index"
              :backgroundColor="item.id === currentSessionId ? 'rgba(255, 253, 255)' : 'transparent'"
              class="rounded-xl shadow-md p-3 mb-2 border border-[var(--primary)]"
              @tap="onSessionTap(item.id)"
            >
              <GridLayout columns="*, auto">
                <StackLayout col="0">
                  <Label
                    :text="item.title"
                    :color="getColor('primary')"
                    fontSize="14"
                    fontWeight="500"
                    textWrap="true"
                  />
                  <Label :text="getTimeStr(item.updatedAt)" :color="getColor('primary')" fontSize="12" marginTop="4" />
                </StackLayout>
                <Label
                  col="1"
                  text="×"
                  class="text-theme-error"
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
        <StackLayout row="2" padding="16" borderTopWidth="1" :borderTopColor="getColor('border')">
          <Label
            :text="historyList.length + ' 个对话'"
            class="text-theme-inverse"
            fontSize="12"
            textAlignment="center"
          />
        </StackLayout>
      </GridLayout>
    </GridLayout>
  </GridLayout>
</template>
<style scoped></style>
