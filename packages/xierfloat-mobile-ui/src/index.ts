/**
 * @xierfloat/mobile-ui
 * NativeScript Vue 3 UI Components
 */

// 类型导出
export type { WeekDay, LunarDate, DateCell, WeekRow, MonthData } from "./types/calendar";

// 工具函数导出
export { solarToLunar, getLunarDayText, isSpecialDay } from "./utils/lunar";

export {
  isSameDay,
  isToday,
  isWeekend,
  addDays,
  getWeekDayNames,
  getWeekOfYear,
  generateWeekGrid,
  generateMonthGrid,
  generateYearMonthData
} from "./utils/date";

// 组件导出
export { YearView, MonthView, WeekView, WeekScheduleGrid } from "./components/calendar";
export { EventCard } from "./components/card";
export { ToastContainer, Toast, useToast } from "./components/toast";
export type { ToastType, ToastPosition, ToastOptions, ToastInstance, IToastService } from "./components/toast";

// AI 聊天组件
export { ChatContainer, ChatMessage, ConfigEditor, ConfigList } from "./components/ai";
