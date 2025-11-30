<script lang="ts" setup>
/**
 * YearView - 年视图组件
 * 显示12个月的缩略日历
 */

import { computed, ref, watch } from "nativescript-vue";
import { type TouchGestureEventData, CoreTypes } from "@nativescript/core";
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
  }>(),
  {
    year: () => new Date().getFullYear(),
    firstDayOfWeek: "SU",
    showToday: true
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

// 监听年份变化，触发淡入淡出动画
watch(
  () => props.year,
  (newYear, oldYear) => {
    if (newYear !== oldYear) {
      setTimeout(() => {
        playFadeAnimation();
      }, 10);
    }
  }
);

// 播放淡入动画
function playFadeAnimation() {
  const view = contentRef.value?.nativeView;
  if (!view) return;

  view.opacity = 0;

  view.animate({
    opacity: 1,
    duration: 400,
    curve: CoreTypes.AnimationCurve.easeIn
  });
}
</script>

<template>
  <ScrollView @touch="onTouch">
    <StackLayout ref="contentRef" class="p-4 bg-gray-100">
      <!-- 月份网格 3x4 -->
      <GridLayout columns="*, *, *" rows="auto, auto, auto, auto">
        <StackLayout
          v-for="(monthData, index) in monthsData"
          :key="index"
          :col="index % 3"
          :row="Math.floor(index / 3)"
          :class="[
            'bg-white rounded-xl p-2 m-1',
            checkIsCurrentMonth(monthData.month) ? 'border-2 border-orange-500' : ''
          ]"
          @tap="onMonthTap(monthData.month)"
        >
          <!-- 月份标题 -->
          <Label
            :text="monthData.name"
            class="text-sm font-semibold"
            :class="checkIsCurrentMonth(monthData.month) ? 'text-orange-500' : 'text-gray-800'"
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
                'w-[14.28%] text-xs text-center py-0.5',
                checkIsToday(monthData.month, day) ? 'text-white bg-orange-500 rounded-lg' : '',
                !checkIsToday(monthData.month, day) ? 'text-gray-800' : ''
              ]"
              @tap="onDayTap(monthData.month, day)"
            />
          </WrapLayout>
        </StackLayout>
      </GridLayout>
    </StackLayout>
  </ScrollView>
</template>

<style scoped></style>
