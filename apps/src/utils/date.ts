/**
 * 日期工具函数
 * @author xierfloat
 * @date 2025-11-29
 */

import type { WeekDay } from '../types/calendar'

// 从 packages 重新导出农历和通用日期工具
export { solarToLunar, getLunarDayText, isSpecialDay } from '@xierfloat-monorepo/mobile-ui'
export { isSameDay, isToday, isWeekend, addDays, getWeekDayNames } from '@xierfloat-monorepo/mobile-ui'

// 星期几映射
const WEEK_DAY_MAP: Record<WeekDay, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
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
 * 获取月份名称
 */
export function getMonthName(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
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
 * 获取某周的起始日期
 */
export function getWeekStart(date: Date, firstDay: WeekDay = 'MO'): Date {
  const result = new Date(date)
  const day = result.getDay()
  const firstDayIndex = WEEK_DAY_MAP[firstDay]
  const diff = (day - firstDayIndex + 7) % 7
  result.setDate(result.getDate() - diff)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * 获取某周的结束日期
 */
export function getWeekEnd(date: Date, firstDay: WeekDay = 'MO'): Date {
  const result = new Date(getWeekStart(date, firstDay))
  result.setDate(result.getDate() + 6)
  return result
}
