<template>
  <GridLayout rows="*" columns="*" class="rounded-2xl">
    <!-- 删除按钮（底层，固定在右侧） -->
    <GridLayout row="0" col="0" columns="*, auto">
      <StackLayout
        col="1"
        class="w-16 h-16 my-2 rounded-full flex bg-white justify-center items-center"
        verticalAlignment="center"
        @tap="onDelete"
      >
        <Image src="res://del" class="w-6 h-6" horizontalAlignment="center" />
      </StackLayout>
    </GridLayout>

    <!-- 卡片主体（上层，可滑动） -->
    <GridLayout
      row="0"
      col="0"
      ref="cardRef"
      columns="auto, *"
      class="bg-white rounded-2xl p-4"
      @tap="onCardTap"
      @touch="onTouch"
    >
      <!-- 左侧色条 -->
      <StackLayout col="0" class="w-1 h-10 rounded mr-3" :style="{ backgroundColor: color }" />
      <!-- 右侧内容 -->
      <StackLayout col="1">
        <Label :text="title" class="text-base font-medium text-gray-800 mb-1" />
        <Label :text="timeText" class="text-xs text-gray-500" />
      </StackLayout>
    </GridLayout>
  </GridLayout>
</template>

<script lang="ts" setup>
/**
 * 事件卡片组件
 * 支持左滑显示删除按钮
 * @author xierfloat
 */

import { ref, computed } from "nativescript-vue";
import { CoreTypes } from "@nativescript/core";
import type { TouchGestureEventData } from "@nativescript/core";

/**
 * 组件属性
 */
export interface EventCardProps {
  /** 事件标题 */
  title: string;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 左侧色条颜色 */
  color?: string;
  /** 删除按钮宽度 */
  deleteWidth?: number;
}

const props = withDefaults(defineProps<EventCardProps>(), {
  color: "#3B82F6",
  deleteWidth: 80
});

const emit = defineEmits<{
  (e: "tap"): void;
  (e: "delete"): void;
}>();

// 卡片引用
const cardRef = ref<any>(null);

// 滑动状态
const touchStartX = ref(0);
const touchStartY = ref(0);
const currentTranslateX = ref(0);
const isOpen = ref(false);
const isDragging = ref(false);

// 最小滑动距离
const MIN_SWIPE_DISTANCE = 20;

/**
 * 格式化时间为 HH:mm 格式
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 时间文本
 */
const timeText = computed(() => {
  const start = formatTime(props.startTime);
  const end = formatTime(props.endTime || props.startTime);
  return `${start} - ${end}`;
});

/**
 * 触摸事件处理
 */
function onTouch(args: TouchGestureEventData) {
  const card = cardRef.value?.nativeView;
  if (!card) return;

  switch (args.action) {
    case "down":
      touchStartX.value = args.getX();
      touchStartY.value = args.getY();
      isDragging.value = false;
      break;

    case "move": {
      const deltaX = args.getX() - touchStartX.value;
      const deltaY = args.getY() - touchStartY.value;

      // 判断是否为水平滑动
      if (!isDragging.value && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isDragging.value = true;
      }

      if (isDragging.value) {
        // 计算新的位移
        let newTranslate = isOpen.value ? -props.deleteWidth + deltaX : deltaX;

        // 限制范围：最大向左滑动 deleteWidth，不能向右滑动超过 0
        newTranslate = Math.max(-props.deleteWidth, Math.min(0, newTranslate));

        card.translateX = newTranslate;
        currentTranslateX.value = newTranslate;
      }
      break;
    }

    case "up":
    case "cancel": {
      if (isDragging.value) {
        const deltaX = args.getX() - touchStartX.value;

        // 判断最终状态
        if (isOpen.value) {
          // 当前是打开状态，向右滑动超过阈值则关闭
          if (deltaX > MIN_SWIPE_DISTANCE) {
            closeCard(card);
          } else {
            openCard(card);
          }
        } else {
          // 当前是关闭状态，向左滑动超过阈值则打开
          if (deltaX < -MIN_SWIPE_DISTANCE) {
            openCard(card);
          } else {
            closeCard(card);
          }
        }
      }
      isDragging.value = false;
      break;
    }
  }
}

/**
 * 打开卡片（显示删除按钮）
 */
function openCard(card: any) {
  card.animate({
    translate: { x: -props.deleteWidth, y: 0 },
    duration: 200,
    curve: CoreTypes.AnimationCurve.easeOut
  });
  isOpen.value = true;
  currentTranslateX.value = -props.deleteWidth;
}

/**
 * 关闭卡片（隐藏删除按钮）
 */
function closeCard(card: any) {
  card.animate({
    translate: { x: 0, y: 0 },
    duration: 200,
    curve: CoreTypes.AnimationCurve.easeOut
  });
  isOpen.value = false;
  currentTranslateX.value = 0;
}

/**
 * 卡片点击
 */
function onCardTap() {
  if (isDragging.value) return;

  const card = cardRef.value?.nativeView;
  if (isOpen.value && card) {
    closeCard(card);
  } else {
    emit("tap");
  }
}

/**
 * 删除按钮点击
 */
function onDelete() {
  emit("delete");
}
</script>
