/**
 * 日历核心组合式函数
 * 管理日历状态：当前日期、选中日期、视图类型等
 */

import { ref, computed } from 'nativescript-vue'
import type {
  CalendarViewType,
  WeekDay,
  WeekRow,
  DateCell,
  CalendarEvent
} from '../types/calendar'
import {
  generateMonthGrid,
  generateWeekDays,
  addMonths,
  addDays,
  getMonthName,
  getWeekDayNames,
  getWeekStart,
  getWeekEnd,
  formatDate
} from '../utils/date'

// 全局状态（单例模式）
const currentDate = ref(new Date())        // 当前显示的日期（用于导航）
const selectedDate = ref(new Date())       // 用户选中的日期
const viewType = ref<CalendarViewType>('month')
const events = ref<CalendarEvent[]>([])    // 所有事件
const firstDayOfWeek = ref<WeekDay>('SU')  // 一周的第一天
const showLunar = ref(true)                // 是否显示农历

/**
 * 日历组合式函数
 */
export function useCalendar() {
  // ===== 计算属性 =====

  // 月份标题
  const monthTitle = computed(() => getMonthName(currentDate.value))

  // 周标题（周视图用）
  const weekTitle = computed(() => {
    const start = getWeekStart(currentDate.value, firstDayOfWeek.value)
    const end = getWeekEnd(currentDate.value, firstDayOfWeek.value)
    const startMonth = start.getMonth() + 1
    const endMonth = end.getMonth() + 1

    if (startMonth === endMonth) {
      return `${start.getFullYear()}年${startMonth}月 第${getWeekNumber(currentDate.value)}周`
    }
    return `${startMonth}月${start.getDate()}日 - ${endMonth}月${end.getDate()}日`
  })

  // 日标题
  const dayTitle = computed(() => {
    const d = selectedDate.value
    const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekDay}`
  })

  // 当前标题（根据视图类型）
  const title = computed(() => {
    switch (viewType.value) {
      case 'month':
        return monthTitle.value
      case 'week':
        return weekTitle.value
      case 'day':
        return dayTitle.value
    }
  })

  // 星期名称
  const weekDayNames = computed(() => getWeekDayNames(firstDayOfWeek.value))

  // 月视图网格数据
  const monthGrid = computed(() =>
    generateMonthGrid(
      currentDate.value,
      selectedDate.value,
      events.value,
      firstDayOfWeek.value
    )
  )

  // 周视图数据
  const weekDays = computed(() =>
    generateWeekDays(
      currentDate.value,
      selectedDate.value,
      events.value,
      firstDayOfWeek.value
    )
  )

  // 选中日期的事件
  const selectedDateEvents = computed(() =>
    events.value.filter((event: CalendarEvent) => {
      const eventDate = formatDate(event.dtStart)
      const selected = formatDate(selectedDate.value)
      return eventDate === selected
    })
  )

  // ===== 方法 =====

  // 导航：上一个（月/周/日）
  function goToPrevious() {
    switch (viewType.value) {
      case 'month':
        currentDate.value = addMonths(currentDate.value, -1)
        break
      case 'week':
        currentDate.value = addDays(currentDate.value, -7)
        break
      case 'day':
        selectedDate.value = addDays(selectedDate.value, -1)
        currentDate.value = selectedDate.value
        break
    }
  }

  // 导航：下一个（月/周/日）
  function goToNext() {
    switch (viewType.value) {
      case 'month':
        currentDate.value = addMonths(currentDate.value, 1)
        break
      case 'week':
        currentDate.value = addDays(currentDate.value, 7)
        break
      case 'day':
        selectedDate.value = addDays(selectedDate.value, 1)
        currentDate.value = selectedDate.value
        break
    }
  }

  // 回到今天
  function goToToday() {
    const today = new Date()
    currentDate.value = today
    selectedDate.value = today
  }

  // 选择日期
  function selectDate(date: Date) {
    selectedDate.value = date
    // 如果选择的日期不在当前月，更新当前日期
    if (date.getMonth() !== currentDate.value.getMonth()) {
      currentDate.value = new Date(date)
    }
  }

  // 切换视图
  function setViewType(type: CalendarViewType) {
    viewType.value = type
  }

  // 添加事件
  function addEvent(event: CalendarEvent) {
    events.value.push(event)
  }

  // 更新事件
  function updateEvent(uid: string, updates: Partial<CalendarEvent>) {
    const index = events.value.findIndex((e: CalendarEvent) => e.uid === uid)
    if (index !== -1) {
      events.value[index] = { ...events.value[index], ...updates }
    }
  }

  // 删除事件
  function deleteEvent(uid: string) {
    const index = events.value.findIndex((e: CalendarEvent) => e.uid === uid)
    if (index !== -1) {
      events.value.splice(index, 1)
    }
  }

  // 获取周数
  function getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }

  // 设置一周的第一天
  function setFirstDayOfWeek(day: WeekDay) {
    firstDayOfWeek.value = day
  }

  // 切换农历显示
  function toggleLunar() {
    showLunar.value = !showLunar.value
  }

  return {
    // 状态
    currentDate,
    selectedDate,
    viewType,
    events,
    firstDayOfWeek,
    showLunar,

    // 计算属性
    title,
    monthTitle,
    weekTitle,
    dayTitle,
    weekDayNames,
    monthGrid,
    weekDays,
    selectedDateEvents,

    // 方法
    goToPrevious,
    goToNext,
    goToToday,
    selectDate,
    setViewType,
    addEvent,
    updateEvent,
    deleteEvent,
    setFirstDayOfWeek,
    toggleLunar
  }
}
