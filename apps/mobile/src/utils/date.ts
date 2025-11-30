/**
 * 日期工具函数
 * @author xierfloat
 * @date 2025-11-29
 */

import type { WeekDay, DateCell, WeekRow, CalendarEvent } from '../types/calendar'
import { solarToLunar, getLunarDayText, isSpecialDay } from './lunar'

// 重新导出农历工具函数
export { solarToLunar, getLunarDayText, isSpecialDay } from './lunar'

// 星期几映射
const WEEK_DAY_MAP: Record<WeekDay, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
}

const WEEK_DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 获取某月的第一天
 */
export function getFirstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * 获取某月的最后一天
 */
export function getLastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * 获取某月的天数
 */
export function getDaysInMonth(date: Date): number {
  return getLastDayOfMonth(date).getDate()
}

/**
 * 判断是否是同一天
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * 判断是否是今天
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/**
 * 判断是否是周末
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化时间为 HH:mm
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`
}

/**
 * 获取月份名称
 */
export function getMonthName(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

/**
 * 获取星期名称数组
 */
export function getWeekDayNames(firstDay: WeekDay = 'SU'): string[] {
  const startIndex = WEEK_DAY_MAP[firstDay]
  const names: string[] = []
  for (let i = 0; i < 7; i++) {
    names.push(WEEK_DAY_NAMES[(startIndex + i) % 7])
  }
  return names
}

/**
 * 增加/减少月份
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * 增加/减少天数
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * 获取某周的起始日期
 */
export function getWeekStart(date: Date, firstDay: WeekDay = 'SU'): Date {
  const result = new Date(date)
  const day = result.getDay()
  const firstDayIndex = WEEK_DAY_MAP[firstDay]
  const diff = (day - firstDayIndex + 7) % 7
  result.setDate(result.getDate() - diff)
  return result
}

/**
 * 获取某周的结束日期
 */
export function getWeekEnd(date: Date, firstDay: WeekDay = 'SU'): Date {
  const start = getWeekStart(date, firstDay)
  return addDays(start, 6)
}

/**
 * 生成月视图的日期网格
 * 返回6周 x 7天的网格数据
 */
export function generateMonthGrid(
  date: Date,
  selectedDate: Date,
  events: CalendarEvent[],
  firstDay: WeekDay = 'SU'
): WeekRow[] {
  const year = date.getFullYear()
  const month = date.getMonth()

  // 获取本月第一天
  const firstDayOfMonth = new Date(year, month, 1)

  // 获取本月第一天是星期几
  const firstDayWeekday = firstDayOfMonth.getDay()
  const firstDayIndex = WEEK_DAY_MAP[firstDay]

  // 计算需要显示的上个月的天数
  const daysFromPrevMonth = (firstDayWeekday - firstDayIndex + 7) % 7

  // 日历起始日期
  const startDate = addDays(firstDayOfMonth, -daysFromPrevMonth)

  const weeks: WeekRow[] = []
  let currentDate = new Date(startDate)

  // 生成6周的数据
  for (let week = 0; week < 6; week++) {
    const days: DateCell[] = []

    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(currentDate)

      // 获取当天的事件
      const dayEvents = events.filter(event =>
        isSameDay(event.dtStart, cellDate)
      )

      days.push({
        date: cellDate,
        day: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
        isToday: isToday(cellDate),
        isSelected: isSameDay(cellDate, selectedDate),
        isWeekend: isWeekend(cellDate),
        events: dayEvents,
        lunar: solarToLunar(cellDate)
      })

      currentDate = addDays(currentDate, 1)
    }

    weeks.push({
      weekNumber: week + 1,
      days
    })
  }

  return weeks
}

/**
 * 生成周视图的日期数组
 */
export function generateWeekDays(
  date: Date,
  selectedDate: Date,
  events: CalendarEvent[],
  firstDay: WeekDay = 'SU'
): DateCell[] {
  const weekStart = getWeekStart(date, firstDay)
  const days: DateCell[] = []

  for (let i = 0; i < 7; i++) {
    const cellDate = addDays(weekStart, i)
    const dayEvents = events.filter(event =>
      isSameDay(event.dtStart, cellDate)
    )

    days.push({
      date: cellDate,
      day: cellDate.getDate(),
      isCurrentMonth: true,
      isToday: isToday(cellDate),
      isSelected: isSameDay(cellDate, selectedDate),
      isWeekend: isWeekend(cellDate),
      events: dayEvents,
      lunar: solarToLunar(cellDate)
    })
  }

  return days
}

/**
 * 生成唯一ID (用于事件)
 */
export function generateUID(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `${timestamp}-${random}@nscalendar`
}

/**
 * 获取两个日期之间的天数差
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay))
}
