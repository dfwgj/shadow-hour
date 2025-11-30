<script lang="ts" setup>
/**
 * 年视图组件
 * 显示12个月的缩略日历
 * @author xierfloat
 */

import { computed } from 'nativescript-vue'
import { useCalendar } from '../../composables/useCalendar'

const { currentDate, selectDate } = useCalendar()

// 月份名称
const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 当前年份
const currentYear = computed(() => currentDate.value.getFullYear())

// 获取某月的日历数据
function getMonthData(month: number) {
  const year = currentYear.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay() 

  // 生成日期数组
  const days: (number | null)[] = []

  // 添加前面的空白（周一开始）
  const blankDays = startWeekday === 0 ? 6 : startWeekday - 1
  for (let i = 0; i < blankDays; i++) {
    days.push(null)
  }

  // 添加日期
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  return days
}

// 12个月的数据
const monthsData = computed(() => {
  return monthNames.map((name, index) => ({
    name,
    month: index,
    days: getMonthData(index)
  }))
})

// 判断是否是今天
function isToday(month: number, day: number | null): boolean {
  if (day === null) return false
  const today = new Date()
  return (
    today.getFullYear() === currentYear.value &&
    today.getMonth() === month &&
    today.getDate() === day
  )
}

// 点击月份
function onMonthTap(month: number) {
  const newDate = new Date(currentYear.value, month, 1)
  selectDate(newDate)
}

// 点击日期
function onDayTap(month: number, day: number | null) {
  if (day === null) return
  const newDate = new Date(currentYear.value, month, day)
  selectDate(newDate)
}
</script>

<template>
  <ScrollView>
    <StackLayout class="p-4 bg-gray-100">

      <!-- 月份网格 3x4 -->
      <GridLayout columns="*, *, *" rows="auto, auto, auto, auto">
        <StackLayout
          v-for="(monthData, index) in monthsData"
          :key="index"
          :col="index % 3"
          :row="Math.floor(index / 3)"
          class="bg-white rounded-xl p-3 m-1"
          @tap="onMonthTap(monthData.month)"
        >
          <!-- 月份标题 -->
          <Label :text="monthData.name" class="text-sm font-semibold text-gray-800 mb-2" />

          <!-- 星期标题 -->
          <GridLayout columns="*, *, *, *, *, *, *" class="mb-1">
            <Label col="0" text="一" class="text-2xs text-gray-500 text-center" />
            <Label col="1" text="二" class="text-2xs text-gray-500 text-center" />
            <Label col="2" text="三" class="text-2xs text-gray-500 text-center" />
            <Label col="3" text="四" class="text-2xs text-gray-500 text-center" />
            <Label col="4" text="五" class="text-2xs text-gray-500 text-center" />
            <Label col="5" text="六" class="text-2xs text-gray-500 text-center" />
            <Label col="6" text="日" class="text-2xs text-gray-500 text-center" />
          </GridLayout>

          <!-- 日期网格 -->
          <WrapLayout orientation="horizontal">
            <Label
              v-for="(day, dayIndex) in monthData.days"
              :key="dayIndex"
              :text="day !== null ? day.toString() : ''"
              :class="[
                'w-[14.28%] text-xs text-center py-0.5',
                isToday(monthData.month, day) ? 'text-white bg-orange-500 rounded-lg' : 'text-gray-800'
              ]"
              @tap="onDayTap(monthData.month, day)"
            />
          </WrapLayout>
        </StackLayout>
      </GridLayout>
    </StackLayout>
  </ScrollView>
</template>

<style scoped>
.text-2xs {
  font-size: 8;
}
</style>
