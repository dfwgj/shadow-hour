/**
 * 农历转换工具
 * 基于香港天文台农历算法
 */

import type { LunarDate } from "../types/calendar";

// 农历数据表 1900-2100
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0,
  0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54,
  0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7,
  0x0c950, 0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, 0x06ca0, 0x0b550,
  0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570,
  0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540,
  0x0b6a0, 0x195a6, 0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, 0x04af5,
  0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50,
  0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0,
  0x15176, 0x052b0, 0x0a930, 0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2,
  0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6,
  0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, 0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0,
  0x055d4, 0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, 0x0b273, 0x06930,
  0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, 0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0,
  0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, 0x0d520
];

// 天干
const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

// 地支
const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// 生肖
const ZODIAC = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];

// 农历月份名
const LUNAR_MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];

// 农历日期名
const LUNAR_DAY_NAMES = [
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十"
];

// 节气名称
const SOLAR_TERMS = [
  "小寒",
  "大寒",
  "立春",
  "雨水",
  "惊蛰",
  "春分",
  "清明",
  "谷雨",
  "立夏",
  "小满",
  "芒种",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "处暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至"
];

// 节气偏移（从1900年开始）
const SOLAR_TERM_INFO = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
  353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
];

// 传统节日
const LUNAR_FESTIVALS: Record<string, string> = {
  "1-1": "春节",
  "1-15": "元宵节",
  "5-5": "端午节",
  "7-7": "七夕",
  "7-15": "中元节",
  "8-15": "中秋节",
  "9-9": "重阳节",
  "12-8": "腊八节",
  "12-23": "小年",
  "12-30": "除夕"
};

// 公历节日
const SOLAR_FESTIVALS: Record<string, string> = {
  "1-1": "元旦",
  "2-14": "情人节",
  "3-8": "妇女节",
  "5-1": "劳动节",
  "5-4": "青年节",
  "6-1": "儿童节",
  "10-1": "国庆节",
  "12-25": "圣诞节"
};

function getLunarYearDays(year: number): number {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += LUNAR_INFO[year - 1900] & i ? 1 : 0;
  }
  return sum + getLeapDays(year);
}

function getLeapMonth(year: number): number {
  return LUNAR_INFO[year - 1900] & 0xf;
}

function getLeapDays(year: number): number {
  if (getLeapMonth(year)) {
    return LUNAR_INFO[year - 1900] & 0x10000 ? 30 : 29;
  }
  return 0;
}

function getLunarMonthDays(year: number, month: number): number {
  return LUNAR_INFO[year - 1900] & (0x10000 >> month) ? 30 : 29;
}

function getGanZhi(offset: number): string {
  return TIAN_GAN[offset % 10] + DI_ZHI[offset % 12];
}

function getYearGanZhi(year: number): string {
  return getGanZhi(year - 4);
}

function getSolarTerm(year: number, month: number, day: number): string | undefined {
  const baseDate = new Date(1900, 0, 6, 2, 5, 0);
  const termIndex = (month - 1) * 2;

  for (let i = 0; i < 2; i++) {
    const idx = termIndex + i;
    if (idx >= SOLAR_TERM_INFO.length) continue;

    const termTime = new Date(baseDate.getTime() + SOLAR_TERM_INFO[idx] * 60000);

    if (termTime.getFullYear() === year && termTime.getMonth() === month - 1 && termTime.getDate() === day) {
      return SOLAR_TERMS[idx];
    }
  }

  return undefined;
}

/**
 * 公历转农历
 */
export function solarToLunar(date: Date): LunarDate {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const baseDate = new Date(1900, 0, 31);
  let offset = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);

  let lunarYear = 1900;
  let temp = 0;
  for (let i = 1900; i < 2101 && offset > 0; i++) {
    temp = getLunarYearDays(i);
    offset -= temp;
    lunarYear++;
  }
  if (offset < 0) {
    offset += temp;
    lunarYear--;
  }

  const leapMonth = getLeapMonth(lunarYear);
  let isLeapMonth = false;

  let lunarMonth = 1;
  for (let i = 1; i < 13 && offset > 0; i++) {
    if (leapMonth > 0 && i === leapMonth + 1 && !isLeapMonth) {
      --i;
      isLeapMonth = true;
      temp = getLeapDays(lunarYear);
    } else {
      temp = getLunarMonthDays(lunarYear, i);
    }

    if (isLeapMonth && i === leapMonth + 1) {
      isLeapMonth = false;
    }

    offset -= temp;
    if (!isLeapMonth) {
      lunarMonth++;
    }
  }

  if (offset === 0 && leapMonth > 0 && lunarMonth === leapMonth + 1) {
    if (isLeapMonth) {
      isLeapMonth = false;
    } else {
      isLeapMonth = true;
      --lunarMonth;
    }
  }

  if (offset < 0) {
    offset += temp;
    --lunarMonth;
  }

  const lunarDay = offset + 1;

  const yearGanZhi = getYearGanZhi(lunarYear);
  const zodiac = ZODIAC[(lunarYear - 4) % 12];
  const term = getSolarTerm(year, month, day);

  const lunarFestivalKey = `${lunarMonth}-${lunarDay}`;
  const lunarFestival = LUNAR_FESTIVALS[lunarFestivalKey];

  const solarFestivalKey = `${month}-${day}`;
  const solarFestival = SOLAR_FESTIVALS[solarFestivalKey];

  const festival = term || lunarFestival || solarFestival;

  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeapMonth,
    yearGanZhi,
    monthGanZhi: "",
    dayGanZhi: "",
    zodiac,
    lunarMonthName: (isLeapMonth ? "闰" : "") + LUNAR_MONTH_NAMES[lunarMonth - 1] + "月",
    lunarDayName: LUNAR_DAY_NAMES[lunarDay - 1],
    term,
    festival
  };
}

/**
 * 获取农历日期的显示文本
 */
export function getLunarDayText(lunar: LunarDate): string {
  if (lunar.term) return lunar.term;
  if (lunar.festival) return lunar.festival;
  if (lunar.day === 1) return lunar.lunarMonthName;
  return lunar.lunarDayName;
}

/**
 * 判断日期是否是节气或节日
 */
export function isSpecialDay(lunar: LunarDate): boolean {
  return !!(lunar.term || lunar.festival);
}
