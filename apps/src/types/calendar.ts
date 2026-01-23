/**
 * RFC5545 iCalendar 类型定义
 * @see https://datatracker.ietf.org/doc/html/rfc5545
 * @author DF蓝梦/xierfloat
 * @date 2025-11-29
 */

// 从 packages 重新导出基础类型
export type { WeekDay, LunarDate, WeekRow, MonthData } from '@xierfloat-monorepo/nativeScript-ui'

// 事件状态
export type EventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'

// 重复频率
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

// 提醒动作类型
export type AlarmAction = 'DISPLAY' | 'AUDIO' | 'EMAIL'

// 提醒触发类型
export interface AlarmTrigger {
  minutes: number // 负数表示事件前，正数表示事件后
}

// 提醒/闹钟 (VALARM)
export interface VAlarm {
  action: AlarmAction
  trigger: AlarmTrigger
  description?: string
}

// 重复规则 (RRULE)
export interface RecurrenceRule {
  freq: RecurrenceFrequency
  interval?: number
  count?: number
  until?: Date
  byDay?: import('@xierfloat-monorepo/nativeScript-ui').WeekDay[]
  byMonthDay?: number[]
  byMonth?: number[]
}

// 日历事件 (VEVENT)
export interface CalendarEvent {
  uid: string
  dtStart: Date
  summary: string
  dtEnd?: Date
  description?: string
  location?: string
  status?: EventStatus
  rrule?: RecurrenceRule
  alarms?: VAlarm[]
  created?: Date
  lastModified?: Date
  lunar?: import('@xierfloat-monorepo/nativeScript-ui').LunarDate
}

// 日历视图类型
export type CalendarViewType = 'month' | 'week' | 'day'

// 日历订阅源
export interface CalendarSubscription {
  id: string
  name: string
  url: string
  color: string
  enabled: boolean
  lastSync?: Date
}

// 应用设置
export interface CalendarSettings {
  firstDayOfWeek: import('@xierfloat-monorepo/nativeScript-ui').WeekDay
  showLunar: boolean
  showWeekNumber: boolean
  defaultView: CalendarViewType
  defaultReminder: number
}

// 默认设置
export const DEFAULT_SETTINGS: CalendarSettings = {
  firstDayOfWeek: 'SU',
  showLunar: true,
  showWeekNumber: false,
  defaultView: 'month',
  defaultReminder: 30
}
