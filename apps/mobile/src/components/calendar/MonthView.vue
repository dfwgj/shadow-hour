<template>
  <BaseMonthView
    :year="currentDate.getFullYear()"
    :month="currentDate.getMonth()"
    :selected-date="selectedDate"
    :first-day-of-week="firstDayOfWeek"
    :show-lunar="showLunar"
    :show-outside-days="true"
    @select="onDateSelect"
  />
</template>
<script lang="ts" setup>
/**
 * 月视图组件 - 使用 UI 组件库
 * 作为组件库的包装层，连接全局状态
 */

import { MonthView as BaseMonthView } from "@xierfloat-monorepo/mobile-ui";
import { useCalendar } from "../../composables/useCalendar";

const { currentDate, selectedDate, firstDayOfWeek, showLunar, selectDate } = useCalendar();

// 处理日期选中
function onDateSelect(date: Date) {
  selectDate(date);
}
</script>
