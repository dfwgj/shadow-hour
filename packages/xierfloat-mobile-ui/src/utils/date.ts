/**
 * 日期工具函数
 */

import type { WeekDay, DateCell, WeekRow } from "../types/calendar";
import { solarToLunar } from "./lunar";

// 星期几映射
const WEEK_DAY_MAP: Record<WeekDay, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6
};

const WEEK_DAY_NAMES_CN = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 判断是否是同一天
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * 判断是否是今天
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * 判断是否是周末
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 增加/减少天数
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 获取星期名称数组
 */
export function getWeekDayNames(firstDay: WeekDay = "SU"): string[] {
  const startIndex = WEEK_DAY_MAP[firstDay];
  const names: string[] = [];
  for (let i = 0; i < 7; i++) {
    names.push(WEEK_DAY_NAMES_CN[(startIndex + i) % 7]);
  }
  return names;
}

/**
 * 生成月视图的日期网格
 */
export function generateMonthGrid(
  year: number,
  month: number,
  selectedDate: Date | undefined,
  firstDay: WeekDay = "SU",
  showLunar: boolean = true
): WeekRow[] {
  const firstDayOfMonth = new Date(year, month, 1);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const firstDayIndex = WEEK_DAY_MAP[firstDay];
  const daysFromPrevMonth = (firstDayWeekday - firstDayIndex + 7) % 7;
  const startDate = addDays(firstDayOfMonth, -daysFromPrevMonth);

  const weeks: WeekRow[] = [];
  let currentDate = new Date(startDate);

  for (let week = 0; week < 6; week++) {
    const days: DateCell[] = [];

    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(currentDate);

      days.push({
        date: cellDate,
        day: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
        isToday: isToday(cellDate),
        isSelected: selectedDate ? isSameDay(cellDate, selectedDate) : false,
        isWeekend: isWeekend(cellDate),
        lunar: showLunar ? solarToLunar(cellDate) : undefined
      });

      currentDate = addDays(currentDate, 1);
    }

    weeks.push({
      weekNumber: week + 1,
      days
    });
  }

  return weeks;
}

/**
 * 生成年视图的月份数据
 */
export function generateYearMonthData(year: number, month: number, firstDay: WeekDay = "SU"): (number | null)[] {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDayOfMonth.getDay();
  const firstDayIndex = WEEK_DAY_MAP[firstDay];

  const days: (number | null)[] = [];

  // 添加前面的空白
  const blankDays = (startWeekday - firstDayIndex + 7) % 7;
  for (let i = 0; i < blankDays; i++) {
    days.push(null);
  }

  // 添加日期
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return days;
}
