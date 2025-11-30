<template>
  <BaseYearView
    :year="year"
    :selected-date="selectedDate"
    :first-day-of-week="firstDayOfWeek"
    :show-today="true"
    @select="onDateSelect"
    @month-tap="onMonthTap"
    @swipe="onSwipe"
  />
</template>

<script lang="ts" setup>
/**
 * 年视图组件 - 使用 UI 组件库
 * 作为组件库的包装层，连接全局状态
 */

import { YearView as BaseYearView } from "@xierfloat-monorepo/mobile-ui";
import { useCalendar } from "../../composables/useCalendar";
import { computed } from "nativescript-vue";

const emit = defineEmits<{
  (e: "switchToMonth"): void;
}>();

const { currentDate, selectedDate, firstDayOfWeek, selectDate } = useCalendar();
const year = computed(() => currentDate.value.getFullYear());

// 处理日期选中
function onDateSelect(date: Date) {
  selectDate(date);
}

// 处理月份点击（切换到月视图）
function onMonthTap(month: number) {
  const newDate = new Date(currentDate.value.getFullYear(), month, 1);
  currentDate.value = newDate;
  emit("switchToMonth");
}

// 处理左右滑动切换年份
function onSwipe(direction: "left" | "right") {
  const newYear = direction === "left" ? year.value + 1 : year.value - 1;
  const newDate = new Date(newYear, currentDate.value.getMonth(), 1);
  currentDate.value = newDate;
}
</script>
