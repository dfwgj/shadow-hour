<script setup lang="ts">
/**
 * Toast 容器组件
 * 管理所有 Toast 的显示
 * @author xierfloat
 */

import { ref, onMounted, onUnmounted, nextTick } from "nativescript-vue";
import { CoreTypes } from "@nativescript/core";
import type { ToastInstance, ToastOptions, ToastType, ToastPosition } from "./types";

// Toast 列表
const toasts = ref<ToastInstance[]>([]);

// Toast 视图引用
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toastRefs = ref<Map<string, any>>(new Map());

// 生成唯一 ID
let idCounter = 0;
function generateId(): string {
  return `toast-${++idCounter}-${Date.now()}`;
}

// 默认配置
const DEFAULT_DURATION = 1500;
const DEFAULT_POSITION: ToastPosition = "center";
const ANIMATION_DURATION = 250;

/**
 * 设置 Toast 引用
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setToastRef(id: string, el: any) {
  if (el) {
    toastRefs.value.set(id, el);
    // 入场动画
    nextTick(() => {
      const view = el.nativeView;
      if (view) {
        view.opacity = 0;
        view.translateY = -20;
        view.animate({
          opacity: 1,
          translate: { x: 0, y: 0 },
          duration: ANIMATION_DURATION,
          curve: CoreTypes.AnimationCurve.easeOut
        });
      }
    });
  } else {
    toastRefs.value.delete(id);
  }
}

/**
 * 添加 Toast
 */
function addToast(options: ToastOptions | string): void {
  const opts: ToastOptions = typeof options === "string" ? { message: options } : options;

  const toast: ToastInstance = {
    id: generateId(),
    message: opts.message,
    type: opts.type || "info",
    duration: opts.duration ?? DEFAULT_DURATION,
    position: opts.position || DEFAULT_POSITION,
    showClose: opts.showClose ?? false,
    visible: true,
    onClose: opts.onClose
  };

  toasts.value.push(toast);

  // 自动关闭
  if (toast.duration > 0) {
    setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration);
  }
}

/**
 * 移除 Toast
 */
function removeToast(id: string): void {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    const toast = toasts.value[index];
    if (!toast || !toast.visible) return;

    toast.visible = false;

    // 清理函数
    const cleanup = () => {
      const idx = toasts.value.findIndex(t => t.id === id);
      if (idx !== -1) {
        const removed = toasts.value.splice(idx, 1)[0];
        removed?.onClose?.();
      }
      toastRefs.value.delete(id);
    };

    // 获取视图引用执行退场动画
    const el = toastRefs.value.get(id);
    if (el?.nativeView) {
      el.nativeView
        .animate({
          opacity: 0,
          translate: { x: 0, y: -20 },
          duration: ANIMATION_DURATION,
          curve: CoreTypes.AnimationCurve.easeIn
        })
        .then(cleanup)
        .catch(cleanup); // 动画失败也要清理
    } else {
      cleanup();
    }
  }
}

/**
 * 关闭所有 Toast
 */
function closeAll(): void {
  const ids = toasts.value.map(t => t.id);
  ids.forEach(id => removeToast(id));
}

// 快捷方法
function success(message: string, options?: Partial<ToastOptions>): void {
  addToast({ ...options, message, type: "success" });
}

function error(message: string, options?: Partial<ToastOptions>): void {
  addToast({ ...options, message, type: "error" });
}

function warning(message: string, options?: Partial<ToastOptions>): void {
  addToast({ ...options, message, type: "warning" });
}

function info(message: string, options?: Partial<ToastOptions>): void {
  addToast({ ...options, message, type: "info" });
}

// 类型对应的淡背景色
function getTypeBgColor(type: ToastType): string {
  const colors: Record<ToastType, string> = {
    success: "#F0F9EB",
    error: "#FEF0F0",
    warning: "#FDF6EC",
    info: "#ECF5FF"
  };
  return colors[type];
}

// 类型对应的深颜色（图标背景、文字）
function getTypeColor(type: ToastType): string {
  const colors: Record<ToastType, string> = {
    success: "#67C23A",
    error: "#F56C6C",
    warning: "#E6A23C",
    info: "#409EFF"
  };
  return colors[type];
}

// 类型对应的图标（使用 Unicode）
function getTypeIcon(type: ToastType): string {
  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    warning: "!",
    info: "i"
  };
  return icons[type];
}

// 暴露方法供外部使用
defineExpose({
  show: addToast,
  success,
  error,
  warning,
  info,
  closeAll
});

// 全局事件监听
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let eventHandler: any = null;

onMounted(() => {
  // 监听全局 Toast 事件
  eventHandler = {
    show: addToast,
    success,
    error,
    warning,
    info,
    closeAll
  };
  // 注册到全局
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__toastService = eventHandler;
});

onUnmounted(() => {
  // 清理全局服务
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__toastService = null;
  // 清理所有 Toast 数据
  toasts.value = [];
  toastRefs.value.clear();
});
</script>

<template>
  <FlexboxLayout
    v-for="toast in toasts"
    :key="toast.id"
    :ref="(el: any) => setToastRef(toast.id, el)"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    width="32%"
    height="14%"
    :verticalAlignment="toast.position === 'top' ? 'top' : toast.position === 'bottom' ? 'bottom' : 'center'"
    horizontalAlignment="center"
    :marginTop="toast.position === 'top' ? 60 : 0"
    :marginBottom="toast.position === 'bottom' ? 60 : 0"
    class="rounded-2xl p-4"
    :style="{ backgroundColor: getTypeBgColor(toast.type) }"
    @tap="removeToast(toast.id)"
  >
    <!-- 图标 -->
    <FlexboxLayout
      width="32"
      height="32"
      alignItems="center"
      justifyContent="center"
      borderRadius="16"
      :style="{ backgroundColor: getTypeColor(toast.type) }"
    >
      <Label :text="getTypeIcon(toast.type)" class="text-white text-lg font-bold" />
    </FlexboxLayout>
    <!-- 消息 -->
    <Label
      :text="toast.message"
      class="text-lg mt-2"
      :style="{ color: getTypeColor(toast.type) }"
      textWrap="true"
      textAlignment="center"
    />
  </FlexboxLayout>
</template>
