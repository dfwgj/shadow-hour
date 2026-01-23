/**
 * 日历组件类型定义
 * @author: DF蓝梦/xierfloat
 * @date 2025-12-1
 */

// 星期几 (RFC5545: SU, MO, TU, WE, TH, FR, SA)
export type WeekDay = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

// 农历日期
export interface LunarDate {
  year: number; // 农历年
  month: number; // 农历月 (1-12)
  day: number; // 农历日
  isLeapMonth: boolean; // 是否闰月
  yearGanZhi: string; // 年干支 (如：甲子)
  monthGanZhi: string; // 月干支
  dayGanZhi: string; // 日干支
  zodiac: string; // 生肖
  lunarMonthName: string; // 农历月名 (如：正月)
  lunarDayName: string; // 农历日名 (如：初一)
  term?: string; // 节气 (如果是节气日)
  festival?: string; // 节日 (如：春节)
}

// 日期单元格
export interface DateCell {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  lunar?: LunarDate | undefined;
}

// 周数据（用于渲染日历网格）
export interface WeekRow {
  weekNumber: number;
  days: DateCell[];
}

// 月份数据（用于年视图）
export interface MonthData {
  name: string;
  month: number; // 0-11
  days: (number | null)[];
}
