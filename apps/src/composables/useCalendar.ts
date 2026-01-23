/**
 * 日历核心组合式函数
 * 管理日历状态：当前日期、选中日期、视图类型等
 */

import { ref, computed } from "nativescript-vue";
import type { CalendarViewType, WeekDay, CalendarEvent } from "../types/calendar";
import {
  addMonths,
  addDays,
  getMonthName,
  getWeekDayNames,
  getWeekStart,
  getWeekEnd,
  formatDate
} from "../utils/date";
import {
  initDatabase,
  addEvent as dbAddEvent,
  updateEvent as dbUpdateEvent,
  deleteEvent as dbDeleteEvent,
  getAllEvents,
  getEventsByDate,
  getEventsByDateRange
} from "../services/database/index";

// 全局状态（单例模式）
const currentDate = ref(new Date()); // 当前显示的日期（用于导航）
const selectedDate = ref(new Date()); // 用户选中的日期
const viewType = ref<CalendarViewType>("month");
const events = ref<CalendarEvent[]>([]); // 所有事件
const firstDayOfWeek = ref<WeekDay>("MO"); // 一周的第一天
const showLunar = ref(true); // 是否显示农历
const isLoading = ref(false); // 加载状态
const isInitialized = ref(false); // 数据库是否已初始化

/**
 * 日历组合式函数
 */
export function useCalendar() {
  // ===== 计算属性 =====

  // 月份标题
  const monthTitle = computed(() => getMonthName(currentDate.value));

  // 周标题（周视图用）
  const weekTitle = computed(() => {
    const start = getWeekStart(currentDate.value, firstDayOfWeek.value);
    const end = getWeekEnd(currentDate.value, firstDayOfWeek.value);
    const startMonth = start.getMonth() + 1;
    const endMonth = end.getMonth() + 1;

    if (startMonth === endMonth) {
      return `${start.getFullYear()}年${startMonth}月 第${getWeekNumber(currentDate.value)}周`;
    }
    return `${startMonth}月${start.getDate()}日 - ${endMonth}月${end.getDate()}日`;
  });

  // 日标题
  const dayTitle = computed(() => {
    const d = selectedDate.value;
    const weekDay = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekDay}`;
  });

  // 当前标题（根据视图类型）
  const title = computed(() => {
    switch (viewType.value) {
      case "month":
        return monthTitle.value;
      case "week":
        return weekTitle.value;
      case "day":
        return dayTitle.value;
    }
  });

  // 星期名称
  const weekDayNames = computed(() => getWeekDayNames(firstDayOfWeek.value));

  // 选中日期的事件
  const selectedDateEvents = computed(() =>
    events.value.filter((event: CalendarEvent) => {
      const eventDate = formatDate(event.dtStart);
      const selected = formatDate(selectedDate.value);
      return eventDate === selected;
    })
  );

  // ===== 方法 =====

  // 导航：上一个（月/周/日）
  function goToPrevious() {
    switch (viewType.value) {
      case "month":
        currentDate.value = addMonths(currentDate.value, -1);
        break;
      case "week":
        currentDate.value = addDays(currentDate.value, -7);
        break;
      case "day":
        selectedDate.value = addDays(selectedDate.value, -1);
        currentDate.value = selectedDate.value;
        break;
    }
  }

  // 导航：下一个（月/周/日）
  function goToNext() {
    switch (viewType.value) {
      case "month":
        currentDate.value = addMonths(currentDate.value, 1);
        break;
      case "week":
        currentDate.value = addDays(currentDate.value, 7);
        break;
      case "day":
        selectedDate.value = addDays(selectedDate.value, 1);
        currentDate.value = selectedDate.value;
        break;
    }
  }

  // 回到今天
  function goToToday() {
    const today = new Date();
    currentDate.value = today;
    selectedDate.value = today;
  }

  // 选择日期
  function selectDate(date: Date) {
    selectedDate.value = date;
    // 如果选择的日期不在当前月，更新当前日期
    if (date.getMonth() !== currentDate.value.getMonth()) {
      currentDate.value = new Date(date);
    }
  }

  // 切换视图
  function setViewType(type: CalendarViewType) {
    viewType.value = type;
  }

  // 初始化数据库并加载事件
  async function init() {
    if (isInitialized.value) return;

    try {
      isLoading.value = true;
      await initDatabase();
      await loadAllEvents();
      isInitialized.value = true;
      console.log("[useCalendar] 初始化完成");
    } catch (error) {
      console.error("[useCalendar] 初始化失败:", error);
    } finally {
      isLoading.value = false;
    }
  }

  // 加载所有事件
  async function loadAllEvents() {
    try {
      events.value = await getAllEvents();
      console.log(`[useCalendar] 已加载 ${events.value.length} 个事件`);
    } catch (error) {
      console.error("[useCalendar] 加载事件失败:", error);
    }
  }

  // 加载指定日期的事件
  async function loadEventsByDate(date: Date) {
    try {
      return await getEventsByDate(date);
    } catch (error) {
      console.error("[useCalendar] 加载日期事件失败:", error);
      return [];
    }
  }

  // 加载指定周的事件
  async function loadEventsByWeek(date: Date) {
    try {
      const weekStart = getWeekStart(date, firstDayOfWeek.value);
      const weekEnd = getWeekEnd(date, firstDayOfWeek.value);
      // weekEnd 需要加一天，因为查询是 dt_start < endDate
      const weekEndPlusOne = addDays(weekEnd, 1);
      return await getEventsByDateRange(weekStart, weekEndPlusOne);
    } catch (error) {
      console.error("[useCalendar] 加载周事件失败:", error);
      return [];
    }
  }

  // 添加事件
  async function addEvent(event: Omit<CalendarEvent, "uid" | "created" | "lastModified">) {
    try {
      isLoading.value = true;
      const newEvent = await dbAddEvent(event);
      events.value.push(newEvent);
      console.log("[useCalendar] 事件已添加:", newEvent.uid);
      return newEvent;
    } catch (error) {
      console.error("[useCalendar] 添加事件失败:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  // 更新事件
  async function updateEvent(uid: string, updates: Partial<CalendarEvent>) {
    try {
      isLoading.value = true;
      await dbUpdateEvent(uid, updates);
      const index = events.value.findIndex((e: CalendarEvent) => e.uid === uid);
      if (index !== -1) {
        events.value[index] = { ...events.value[index], ...updates };
      }
      console.log("[useCalendar] 事件已更新:", uid);
    } catch (error) {
      console.error("[useCalendar] 更新事件失败:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  // 删除事件
  async function deleteEvent(uid: string) {
    try {
      isLoading.value = true;
      await dbDeleteEvent(uid);
      const index = events.value.findIndex((e: CalendarEvent) => e.uid === uid);
      if (index !== -1) {
        events.value.splice(index, 1);
      }
      console.log("[useCalendar] 事件已删除:", uid);
    } catch (error) {
      console.error("[useCalendar] 删除事件失败:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  // 获取周数
  function getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  // 设置一周的第一天
  function setFirstDayOfWeek(day: WeekDay) {
    firstDayOfWeek.value = day;
  }

  // 切换农历显示
  function toggleLunar() {
    showLunar.value = !showLunar.value;
  }

  return {
    // 状态
    currentDate,
    selectedDate,
    viewType,
    events,
    firstDayOfWeek,
    showLunar,
    isLoading,
    isInitialized,

    // 计算属性
    title,
    monthTitle,
    weekTitle,
    dayTitle,
    weekDayNames,
    selectedDateEvents,

    // 方法
    init,
    loadAllEvents,
    loadEventsByDate,
    loadEventsByWeek,
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
  };
}
