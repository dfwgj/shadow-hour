<script lang="ts" setup>
/**
 * YearView - 年视图组件
 * 显示12个月的缩略日历
 * @author xierfloat
 */

import { computed, ref } from "nativescript-vue";
import { type TouchGestureEventData, CoreTypes, Screen } from "@nativescript/core";
import type { WeekDay, MonthData } from "../../types/calendar";
import { generateYearMonthData, getWeekDayNames } from "../../utils/date";

// Props 定义
const props = withDefaults(
  defineProps<{
    /** 显示哪一年 */
    year?: number;
    /** 选中的日期（高亮显示） */
    selectedDate?: Date;
    /** 一周起始日 */
    firstDayOfWeek?: WeekDay;
    /** 是否高亮今天 */
    showToday?: boolean;
    /** 自定义颜色 */
    color?: string;
  }>(),
  {
    year: () => new Date().getFullYear(),
    firstDayOfWeek: "MO",
    showToday: true,
    color: "#F97316"
  }
);

// Emits 定义
const emit = defineEmits<{
  /** 点击某天时触发 */
  (e: "select", date: Date): void;
  /** 点击月份标题时触发 */
  (e: "monthTap", month: number): void;
  /** 左右滑动切换年份 */
  (e: "swipe", direction: "left" | "right"): void;
}>();

// 处理 touch 手势实现左右滑动
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchActive = ref(false);
const MIN_SWIPE_DISTANCE = 30;

function onTouch(args: TouchGestureEventData) {
  if (args.action === "down") {
    touchStartX.value = args.getX();
    touchStartY.value = args.getY();
    touchActive.value = true;
  } else if (args.action === "cancel" && touchActive.value) {
    // ScrollView 接管时会触发 cancel，此时判断是否为水平滑动
    const deltaX = args.getX() - touchStartX.value;
    const deltaY = args.getY() - touchStartY.value;
    touchActive.value = false;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
      if (deltaX < 0) {
        emit("swipe", "left");
      } else {
        emit("swipe", "right");
      }
    }
  } else if (args.action === "up" && touchActive.value) {
    const deltaX = args.getX() - touchStartX.value;
    const deltaY = args.getY() - touchStartY.value;
    touchActive.value = false;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
      if (deltaX < 0) {
        emit("swipe", "left");
      } else {
        emit("swipe", "right");
      }
    }
  }
}

// 月份名称
const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// 星期标题
const weekDayLabels = computed(() => getWeekDayNames(props.firstDayOfWeek));

// 12个月的数据
const monthsData = computed<MonthData[]>(() => {
  return monthNames.map((name, index) => ({
    name,
    month: index,
    days: generateYearMonthData(props.year, index, props.firstDayOfWeek)
  }));
});

// 今天的信息
const today = new Date();
const todayYear = today.getFullYear();
const todayMonth = today.getMonth();
const todayDate = today.getDate();

// 判断是否是今天
function checkIsToday(month: number, day: number | null): boolean {
  if (!props.showToday || day === null) return false;
  return props.year === todayYear && month === todayMonth && day === todayDate;
}

// 判断是否是当前月份（今年+本月）
function checkIsCurrentMonth(month: number): boolean {
  return props.year === todayYear && month === todayMonth;
}

// 点击月份
function onMonthTap(month: number) {
  emit("monthTap", month);
}

// 点击日期
function onDayTap(month: number, day: number | null) {
  if (day === null) return;
  const date = new Date(props.year, month, day);
  emit("select", date);
}

// 动画相关
const contentRef = ref();
const screenWidth = Screen.mainScreen.widthDIPs;
const isAnimating = ref(false);

// 播放完整的滑动动画（退出 + 进入）
async function playSlideAnimation(direction: "left" | "right", onMiddle?: () => void): Promise<void> {
  const view = contentRef.value?.nativeView;
  if (!view || isAnimating.value) return;

  isAnimating.value = true;

  // 退出方向：向左滑则当前内容向左退出，向右滑则向右退出
  const exitX = direction === "left" ? -screenWidth * 0.3 : screenWidth * 0.3;
  const enterX = direction === "left" ? screenWidth * 0.3 : -screenWidth * 0.3;
  const duration = 150;

  // 第一阶段：退出动画
  await view.animate({
    translate: { x: exitX, y: 0 },
    opacity: 0,
    duration,
    curve: CoreTypes.AnimationCurve.easeIn
  });

  // 中间回调：更新数据
  onMiddle?.();

  // 设置进入起始位置
  view.translateX = enterX;

  // 第二阶段：进入动画
  await view.animate({
    translate: { x: 0, y: 0 },
    opacity: 1,
    duration,
    curve: CoreTypes.AnimationCurve.easeOut
  });

  isAnimating.value = false;
}

// 暴露方法给父组件调用
defineExpose({
  playSlideAnimation
});
</script>

<template>
  <ScrollView @touch="onTouch">
    <StackLayout ref="contentRef" class="p-2 bg-transparent">
      <!-- 月份网格 3x4 -->
      <GridLayout columns="*, *, *" rows="auto, auto, auto, auto">
        <StackLayout
          v-for="(monthData, index) in monthsData"
          :key="index"
          :col="index % 3"
          :row="Math.floor(index / 3)"
          class="bg-white rounded-xl p-2 m-1"
          :style="checkIsCurrentMonth(monthData.month) ? { borderWidth: 2, borderColor: props.color } : {}"
          @tap="onMonthTap(monthData.month)"
        >
          <!-- 月份标题 -->
          <Label
            :text="monthData.name"
            class="text-sm font-semibold"
            :style="{ color: checkIsCurrentMonth(monthData.month) ? props.color : '#1f2937' }"
          />

          <!-- 星期标题 -->
          <GridLayout columns="*, *, *, *, *, *, *" class="mb-1">
            <Label
              v-for="(weekDay, wIndex) in weekDayLabels"
              :key="wIndex"
              :col="wIndex"
              :text="weekDay"
              class="text-xs text-gray-500 text-center"
            />
          </GridLayout>

          <!-- 日期网格 -->
          <WrapLayout orientation="horizontal">
            <Label
              v-for="(day, dayIndex) in monthData.days"
              :key="dayIndex"
              :text="day !== null ? day.toString() : ''"
              :class="[
                'w-[14%] text-mxs text-center py-0.5',
                checkIsToday(monthData.month, day) ? 'text-white rounded-lg' : 'text-gray-800'
              ]"
              :style="checkIsToday(monthData.month, day) ? { backgroundColor: props.color } : {}"
              @tap="onDayTap(monthData.month, day)"
            />
          </WrapLayout>
        </StackLayout>
      </GridLayout>
    </StackLayout>
  </ScrollView>
</template>

<style scoped></style>
