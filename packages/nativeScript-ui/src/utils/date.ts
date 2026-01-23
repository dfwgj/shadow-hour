/**
 * 日期工具函数
 * @author: DF蓝梦/xierfloat
 * @date 2025-12-1
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
    names.push(WEEK_DAY_NAMES_CN[(startIndex + i) % 7] || "");
  }
  return names;
}
/**
 * 获取日期所在的年周数（ISO 8601 标准）
 * 第一周是包含该年第一个周四的那一周
 */
export function getWeekOfYear(date: Date, firstDay: WeekDay = "MO"): number {
  const target = new Date(date);
  // 设置到本周的周四（ISO标准：周四决定周数归属）
  const dayOfWeek = target.getDay();
  const firstDayIndex = WEEK_DAY_MAP[firstDay];

  // 计算本周周四的日期
  // 从 firstDay 开始，周四是第 (4 - firstDayIndex + 7) % 7 天
  const thursdayOffset = (4 - firstDayIndex + 7) % 7;
  const currentDayOffset = (dayOfWeek - firstDayIndex + 7) % 7;
  const daysToThursday = thursdayOffset - currentDayOffset;

  target.setDate(target.getDate() + daysToThursday);

  // 获取该周四所在年份的第一天
  const yearStart = new Date(target.getFullYear(), 0, 1);

  // 计算从年初到该周四的天数
  const daysDiff = Math.floor((target.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));

  // 计算周数（从1开始）
  return Math.ceil((daysDiff + 1) / 7);
}

/**
 * 生成周视图的日期网格
 */
export function generateWeekGrid(
  month: number,
  selectedDate: Date,
  firstDay: WeekDay = "MO",
  showLunar: boolean = true
): WeekRow[] {
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const selectedDay = selectedDate.getDate();
  const firstDayIndex = WEEK_DAY_MAP[firstDay];
  const dayOfWeek = selectedDate.getDay(); // 0-6, 0表示周日
  const daysFromPrevMonth = (dayOfWeek - firstDayIndex + 7) % 7;
  const weekStartDate = new Date(selectedYear, selectedMonth, selectedDay - daysFromPrevMonth);
  const weekEndDate = addDays(weekStartDate, 6);

  // 计算该周是一年中的第几周
  const weekNumber = getWeekOfYear(weekStartDate, firstDay);

  const weeks: WeekRow[] = [];
  let currentDate = weekStartDate;
  while (currentDate <= weekEndDate) {
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
      weekNumber,
      days
    });
  }
  return weeks;
}

/**
 * 生成月视图的日期网格
 */
export function generateMonthGrid(
  year: number,
  month: number,
  selectedDate: Date | undefined,
  firstDay: WeekDay = "MO",
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
