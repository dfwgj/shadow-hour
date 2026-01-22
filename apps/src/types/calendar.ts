/**
 * RFC5545 iCalendar 类型定义
 * @see https://datatracker.ietf.org/doc/html/rfc5545
 * @author xierfloat
 * @date 2025-11-29
 */

// 事件状态
export type EventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'

// 重复频率
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

// 星期几 (RFC5545: SU, MO, TU, WE, TH, FR, SA)
export type WeekDay = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'

// 提醒动作类型
export type AlarmAction = 'DISPLAY' | 'AUDIO' | 'EMAIL'

// 提醒触发类型
export interface AlarmTrigger {
  // 负数表示事件前，正数表示事件后（单位：分钟）
  minutes: number
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
  interval?: number      // 间隔，默认1
  count?: number         // 重复次数
  until?: Date           // 结束日期
  byDay?: WeekDay[]      // 按星期几
  byMonthDay?: number[]  // 按月中的第几天
  byMonth?: number[]     // 按月份
}

// 日历事件 (VEVENT)
export interface CalendarEvent {
  // 必需属性
  uid: string            // 唯一标识符
  dtStart: Date          // 开始时间
  summary: string        // 标题/摘要

  // 可选属性
  dtEnd?: Date           // 结束时间
  description?: string   // 详细描述
  location?: string      // 地点
  status?: EventStatus   // 状态

  // 重复规则
  rrule?: RecurrenceRule

  // 提醒
  alarms?: VAlarm[]

  // 元数据
  created?: Date         // 创建时间
  lastModified?: Date    // 最后修改时间

  // 扩展：农历信息
  lunar?: LunarDate
}

// 农历日期
export interface LunarDate {
  year: number           // 农历年
  month: number          // 农历月 (1-12)
  day: number            // 农历日
  isLeapMonth: boolean   // 是否闰月
  yearGanZhi: string     // 年干支 (如：甲子)
  monthGanZhi: string    // 月干支
  dayGanZhi: string      // 日干支
  zodiac: string         // 生肖
  lunarMonthName: string // 农历月名 (如：正月)
  lunarDayName: string   // 农历日名 (如：初一)
  term?: string          // 节气 (如果是节气日)
  festival?: string      // 节日 (如：春节)
}

// 日历视图类型
export type CalendarViewType = 'month' | 'week' | 'day'

// 日期单元格（用于渲染日历）
export interface DateCell {
  date: Date
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  isWeekend: boolean
  events: CalendarEvent[]
  lunar?: LunarDate
}

// 周数据（用于渲染日历网格）
export interface WeekRow {
  weekNumber: number
  days: DateCell[]
}

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
  firstDayOfWeek: WeekDay  // 一周的第一天
  showLunar: boolean       // 显示农历
  showWeekNumber: boolean  // 显示周数
  defaultView: CalendarViewType
  defaultReminder: number  // 默认提醒时间（分钟）
}

// 默认设置
export const DEFAULT_SETTINGS: CalendarSettings = {
  firstDayOfWeek: 'SU',
  showLunar: true,
  showWeekNumber: false,
  defaultView: 'month',
  defaultReminder: 30
}
