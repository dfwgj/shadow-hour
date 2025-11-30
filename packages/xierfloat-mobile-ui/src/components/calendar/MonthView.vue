<script lang="ts" setup>
/**
 * MonthView - 月视图组件
 * 显示月份日历网格，支持农历
 */

import { computed } from "nativescript-vue";
import type { WeekDay, DateCell } from "../../types/calendar";
import { generateMonthGrid, getWeekDayNames } from "../../utils/date";
import { getLunarDayText, isSpecialDay } from "../../utils/lunar";

// Props 定义
const props = withDefaults(
  defineProps<{
    /** 年份 */
    year?: number;
    /** 月份 (0-11) */
    month?: number;
    /** 选中的日期 */
    selectedDate?: Date;
    /** 一周起始日 */
    firstDayOfWeek?: WeekDay;
    /** 显示农历 */
    showLunar?: boolean;
    /** 显示上/下月日期 */
    showOutsideDays?: boolean;
  }>(),
  {
    year: () => new Date().getFullYear(),
    month: () => new Date().getMonth(),
    firstDayOfWeek: "SU",
    showLunar: true,
    showOutsideDays: true
  }
);

// Emits 定义
const emit = defineEmits<{
  /** 点击某天时触发 */
  (e: "select", date: Date): void;
}>();

// 星期标题
const weekDayNames = computed(() => getWeekDayNames(props.firstDayOfWeek));

// 月视图网格数据
const monthGrid = computed(() =>
  generateMonthGrid(props.year, props.month, props.selectedDate, props.firstDayOfWeek, props.showLunar)
);

// 计算显示的周数（只显示当月需要的周数）
const displayWeeks = computed(() => {
  let lastWeekIndex = 5;
  for (let i = 5; i >= 0; i--) {
    const week = monthGrid.value[i];
    if (week && week.days.some((day: DateCell) => day.isCurrentMonth)) {
      lastWeekIndex = i;
      break;
    }
  }
  return monthGrid.value.slice(0, lastWeekIndex + 1);
});

// 获取农历显示文本
function getLunarText(cell: DateCell): string {
  if (!cell.lunar) return "";
  return getLunarDayText(cell.lunar);
}

// 判断是否是特殊日期（节气或节日）
function checkIsSpecialDay(cell: DateCell): boolean {
  if (!cell.lunar) return false;
  return isSpecialDay(cell.lunar);
}

// 处理日期点击
function onDateTap(cell: DateCell) {
  emit("select", cell.date);
}

// 判断是否应该显示该日期
function shouldShowDay(cell: DateCell): boolean {
  return props.showOutsideDays || cell.isCurrentMonth;
}
</script>

<template>
  <StackLayout class="bg-white rounded-b-3xl">
    <!-- 星期标题行 -->
    <GridLayout columns="*, *, *, *, *, *, *" class="pt-4 px-4 pb-2">
      <Label
        v-for="(name, index) in weekDayNames"
        :key="index"
        :col="index"
        :text="name"
        class="text-center text-xs text-gray-500"
      />
    </GridLayout>

    <!-- 日期网格 -->
    <StackLayout class="px-4">
      <GridLayout v-for="week in displayWeeks" :key="week.weekNumber" columns="*, *, *, *, *, *, *" class="h-14 mb-2">
        <StackLayout
          v-for="(cell, dayIndex) in week.days"
          :key="dayIndex"
          :col="dayIndex"
          :class="['items-center justify-center rounded-2xl', cell.isSelected ? 'bg-orange-500' : '']"
          @tap="onDateTap(cell)"
        >
          <!-- 日期数字 -->
          <Label
            v-if="shouldShowDay(cell)"
            :text="cell.day.toString()"
            :class="[
              'text-lg font-medium text-center mb-0.5',
              !cell.isCurrentMonth ? 'opacity-30' : '',
              cell.isSelected ? 'text-white' : 'text-gray-800'
            ]"
          />
          <!-- 农历日期 -->
          <Label
            v-if="showLunar && shouldShowDay(cell)"
            :text="getLunarText(cell)"
            :class="[
              'text-xs text-center',
              !cell.isCurrentMonth ? 'opacity-30' : '',
              cell.isSelected
                ? 'text-white'
                : checkIsSpecialDay(cell) && cell.isCurrentMonth
                  ? 'text-orange-500'
                  : 'text-gray-500'
            ]"
          />
        </StackLayout>
      </GridLayout>
    </StackLayout>

    <!-- 底部拖动手柄 -->
    <StackLayout class="py-2 pb-4 items-center">
      <StackLayout class="w-8 h-1 bg-gray-300 rounded" />
    </StackLayout>
  </StackLayout>
</template>
