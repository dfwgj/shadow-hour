<script lang="ts" setup>
/**
 * 月视图组件 - 参考原型设计
 * 显示日历网格和农历信息
 */

import { computed } from 'nativescript-vue'
import { useCalendar } from '../../composables/useCalendar'
import type { DateCell } from '../../types/calendar'

const {
  weekDayNames,
  monthGrid,
  selectDate
} = useCalendar()

// 处理日期点击
function onDateTap(cell: DateCell) {
  selectDate(cell.date)
}

// 获取农历显示文本
function getLunarText(cell: DateCell): string {
  if (!cell.lunar) return ''

  // 优先显示节气
  if (cell.lunar.term) {
    return cell.lunar.term
  }

  // 其次显示节日
  if (cell.lunar.festival) {
    return cell.lunar.festival
  }

  // 如果是初一，显示月份名
  if (cell.lunar.day === 1) {
    return cell.lunar.lunarMonthName
  }

  // 显示农历日期
  return cell.lunar.lunarDayName
}

// 判断是否是特殊日期（节气或节日）
function isSpecialDay(cell: DateCell): boolean {
  if (!cell.lunar) return false
  return !!(cell.lunar.term || cell.lunar.festival)
}

// 计算显示的周数（只显示当月需要的周数）
const displayWeeks = computed(() => {
  // 找出最后一个包含当月日期的周
  let lastWeekIndex = 5
  for (let i = 5; i >= 0; i--) {
    const week = monthGrid.value[i]
    if (week && week.days.some((day: DateCell) => day.isCurrentMonth)) {
      lastWeekIndex = i
      break
    }
  }
  return monthGrid.value.slice(0, lastWeekIndex + 1)
})
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
      <GridLayout
        v-for="week in displayWeeks"
        :key="week.weekNumber"
        columns="*, *, *, *, *, *, *"
        class="h-14 mb-2"
      >
        <StackLayout
          v-for="(cell, dayIndex) in week.days"
          :key="dayIndex"
          :col="dayIndex"
          :class="['items-center justify-center rounded-2xl', cell.isSelected ? 'bg-orange-500' : '']"
          @tap="onDateTap(cell)"
        >
          <!-- 日期数字 -->
          <Label
            :text="cell.day.toString()"
            :class="[
              'text-lg font-medium text-center mb-0.5',
              !cell.isCurrentMonth ? 'opacity-30' : '',
              cell.isSelected ? 'text-white' : 'text-gray-800'
            ]"
          />
          <!-- 农历日期 -->
          <Label
            :text="getLunarText(cell)"
            :class="[
              'text-xs text-center',
              !cell.isCurrentMonth ? 'opacity-30' : '',
              cell.isSelected ? 'text-white' : (isSpecialDay(cell) && cell.isCurrentMonth ? 'text-orange-500' : 'text-gray-500')
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
