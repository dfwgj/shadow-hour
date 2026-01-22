# xierfloat-mobile-ui 组件库深度解析

> 本文档深入分析 `@xierfloat-monorepo/mobile-ui` 组件库的实现，涵盖日历组件、Toast 通知系统、工具函数和主题系统等核心内容。

## 目录

1. [包概述与架构](#1-包概述与架构)
2. [日历组件详解](#2-日历组件详解)
3. [Toast 通知系统](#3-toast-通知系统)
4. [卡片组件](#4-卡片组件)
5. [工具函数](#5-工具函数)
6. [类型定义](#6-类型定义)
7. [主题系统](#7-主题系统)
8. [组件 API 参考](#8-组件-api-参考)
9. [使用示例](#9-使用示例)

---

## 1. 包概述与架构

### 1.1 设计目的

`xierfloat-mobile-ui` 是一个专为 NativeScript Vue 3 设计的移动端 UI 组件库，主要用于日历和事件管理应用。

### 1.2 核心特性

| 特性 | 说明 |
|------|------|
| 原生组件 | 基于 NativeScript 原生 UI |
| Vue 3 支持 | Composition API + TypeScript |
| 农历支持 | 完整的农历转换和节日显示 |
| 主题系统 | 支持浅色/深色模式切换 |
| 手势交互 | 滑动手势导航 |

### 1.3 包结构

```
packages/xierfloat-mobile-ui/
├── src/
│   ├── components/           # Vue 组件
│   │   ├── calendar/        # 日历视图
│   │   │   ├── MonthView.vue
│   │   │   ├── YearView.vue
│   │   │   ├── WeekView.vue
│   │   │   ├── WeekScheduleGrid.vue
│   │   │   └── index.ts
│   │   ├── card/            # 卡片组件
│   │   │   ├── EventCard.vue
│   │   │   └── index.ts
│   │   └── toast/           # Toast 通知
│   │       ├── ToastContainer.vue
│   │       ├── ToastService.ts
│   │       ├── types.ts
│   │       └── index.ts
│   ├── types/               # 类型定义
│   │   └── calendar.ts
│   ├── utils/               # 工具函数
│   │   ├── date.ts
│   │   └── lunar.ts
│   ├── theme/               # 主题配置
│   │   └── index.ts
│   └── index.ts             # 主导出文件
├── package.json
└── tsconfig.json
```

### 1.4 导出 API

```typescript
// index.ts

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

// 主题导出
export {
  uiColors,
  useUITheme,
  setDarkMode,
  getIsDarkMode,
  configureLightColors,
  configureDarkColors,
  configureTheme,
  resetTheme,
  defaultLightColors,
  defaultDarkColors
} from "./theme";
export type { UIThemeColors } from "./theme";
```

---

## 2. 日历组件详解

### 2.1 MonthView - 月视图

月历网格显示组件，展示完整的月份日历。

**核心特性：**
- 6周 × 7天的网格布局
- 触摸滑动手势检测（左/右）
- 月份切换滑动动画
- 农历支持及特殊日子高亮
- 可选显示上/下月日期

**实现细节：**

```typescript
// MonthView.vue
const monthGrid = computed(() =>
  generateMonthGrid(
    props.year,
    props.month,
    props.selectedDate,
    props.firstDayOfWeek,
    props.showLunar
  )
);
```

**手势处理：**

```typescript
const MIN_SWIPE_DISTANCE = 30;

function onTouch(args: TouchGestureEventData) {
  if (args.action === "down") {
    touchStartX.value = args.getX();
    touchStartY.value = args.getY();
    touchActive.value = true;
  } else if (args.action === "up" && touchActive.value) {
    const deltaX = args.getX() - touchStartX.value;
    const deltaY = args.getY() - touchStartY.value;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
      emit("swipe", deltaX < 0 ? "left" : "right");
    }
  }
}
```

**滑动动画：**

```typescript
async function playSlideAnimation(
  direction: "left" | "right",
  onMiddle?: () => void
): Promise<void> {
  const view = contentRef.value?.nativeView;
  if (!view || isAnimating.value) return;

  isAnimating.value = true;
  const exitX = direction === "left" ? -screenWidth * 0.3 : screenWidth * 0.3;
  const enterX = direction === "left" ? screenWidth * 0.3 : -screenWidth * 0.3;

  // 退出动画
  await view.animate({
    translate: { x: exitX, y: 0 },
    opacity: 0,
    duration: 150,
    curve: CoreTypes.AnimationCurve.easeIn
  });

  // 更新数据
  onMiddle?.();

  // 设置入场位置
  view.translateX = enterX;

  // 入场动画
  await view.animate({
    translate: { x: 0, y: 0 },
    opacity: 1,
    duration: 150,
    curve: CoreTypes.AnimationCurve.easeOut
  });

  isAnimating.value = false;
}
```

### 2.2 YearView - 年视图

显示 12 个月份的 3×4 网格概览。

**核心特性：**
- 3 列 × 4 行月份网格
- 当前月份边框高亮
- 今日高亮
- 滑动手势年份导航

**布局结构：**

```vue
<GridLayout columns="*, *, *" rows="auto, auto, auto, auto">
  <FlexboxLayout
    v-for="(month, index) in yearMonths"
    :key="index"
    :row="Math.floor(index / 3)"
    :col="index % 3"
  >
    <!-- 月份小日历 -->
  </FlexboxLayout>
</GridLayout>
```

### 2.3 WeekView - 周视图

显示单周的详细日历。

**核心特性：**
- 左侧周数显示（ISO 标准）
- 7 天列带小时行
- 农历支持
- 滑动手势周导航

### 2.4 WeekScheduleGrid - 周日程表

带时间轴和事件的周日程网格。

**核心特性：**
- 左侧 0-24 小时时间轴
- 7 天列
- 事件渲染与重叠检测
- 多事件处理（显示计数）
- 动态列宽计算
- 基于时长的事件高度

**事件重叠检测：**

```typescript
function getOverlappingEvents(
  dayIndex: number,
  startHour: number,
  endHour: number
): CalendarEvent[] {
  const dayEvents = getEventsForDay(dayIndex);
  return dayEvents.filter((event) => {
    const eventStart = ensureDate(event.dtStart);
    const eventEnd = event.dtEnd
      ? ensureDate(event.dtEnd)
      : new Date(eventStart.getTime() + 3600000);
    const eventStartHour = eventStart.getHours() + eventStart.getMinutes() / 60;
    const eventEndHour = eventEnd.getHours() + eventEnd.getMinutes() / 60;
    return eventStartHour < endHour && eventEndHour > startHour;
  });
}
```

**事件渲染逻辑：**

```typescript
const renderEvents = computed<RenderEvent[]>(() => {
  const result: RenderEvent[] = [];
  const processedSlots = new Set<string>();

  weekDates.value.forEach((date, dayIndex) => {
    const dayEvents = getEventsForDay(dayIndex).sort(
      (a, b) => ensureDate(a.dtStart).getTime() - ensureDate(b.dtStart).getTime()
    );

    dayEvents.forEach((event) => {
      const startHour = Math.floor(eventStart.getHours());
      const slotKey = `${dayIndex}-${startHour}`;

      // 检查是否有多个事件
      const overlapping = getOverlappingEvents(dayIndex, startHour, startHour + 1);

      if (overlapping.length > 1 && !processedSlots.has(slotKey)) {
        // 显示 +N 计数
        result.push({
          type: "multi",
          dayIndex,
          top: startHour * hourHeight,
          height: hourHeight,
          count: overlapping.length,
          events: overlapping
        });
        processedSlots.add(slotKey);
      } else if (overlapping.length === 1) {
        // 单个事件
        result.push({
          type: "single",
          dayIndex,
          event,
          top: eventStartHour * hourHeight,
          height: Math.max((eventEndHour - eventStartHour) * hourHeight, 20)
        });
      }
    });
  });

  return result;
});
```

---

## 3. Toast 通知系统

### 3.1 架构设计

Toast 系统使用**代理模式**和队列管理：

```typescript
class ToastServiceProxy implements IToastService {
  private queue: Array<{ method: keyof IToastService; args: unknown[] }> = [];
  private retryCount = 0;
  private readonly MAX_RETRIES = 5;
  private readonly MAX_QUEUE_SIZE = 10;

  private getService(): IToastService | null {
    return (globalThis as any).__toastService;
  }

  private execute<K extends keyof IToastService>(
    method: K,
    ...args: Parameters<IToastService[K]>
  ): void {
    const service = this.getService();
    if (service) {
      (service[method] as (...args: any[]) => void)(...args);
      this.retryCount = 0;
    } else {
      // 服务未就绪，加入队列
      if (this.queue.length >= this.MAX_QUEUE_SIZE) {
        this.queue.shift(); // 队列满时丢弃最旧的
      }
      this.queue.push({ method, args });
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        setTimeout(() => this.flushQueue(), 100);
      }
    }
  }

  private flushQueue(): void {
    const service = this.getService();
    if (service && this.queue.length > 0) {
      const pending = [...this.queue];
      this.queue = [];
      this.retryCount = 0;
      for (const { method, args } of pending) {
        (service[method] as (...args: any[]) => void)(...args);
      }
    }
  }

  show(options: ToastOptions | string): void {
    this.execute("show", options);
  }

  success(message: string, options?: Partial<ToastOptions>): void {
    this.execute("success", message, options);
  }

  error(message: string, options?: Partial<ToastOptions>): void {
    this.execute("error", message, options);
  }

  warning(message: string, options?: Partial<ToastOptions>): void {
    this.execute("warning", message, options);
  }

  info(message: string, options?: Partial<ToastOptions>): void {
    this.execute("info", message, options);
  }

  closeAll(): void {
    this.execute("closeAll");
  }
}

export const Toast: IToastService = new ToastServiceProxy();
```

### 3.2 ToastContainer 组件

```vue
<template>
  <GridLayout rows="*" columns="*">
    <FlexboxLayout
      v-for="toast in toasts"
      :key="toast.id"
      :ref="(el: any) => setToastRef(toast.id, el)"
      row="0"
      col="0"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="32%"
      height="14%"
      :verticalAlignment="
        toast.position === 'top'
          ? 'top'
          : toast.position === 'bottom'
            ? 'bottom'
            : 'center'
      "
      horizontalAlignment="center"
      :marginTop="toast.position === 'top' ? 60 : 0"
      :marginBottom="toast.position === 'bottom' ? 60 : 0"
      class="rounded-2xl p-4"
      :style="{ backgroundColor: getTypeBgColor(toast.type) }"
      @tap="removeToast(toast.id)"
    >
      <!-- 图标 -->
      <FlexboxLayout
        width="32"
        height="32"
        alignItems="center"
        justifyContent="center"
        borderRadius="16"
        :style="{ backgroundColor: getTypeColor(toast.type) }"
      >
        <Label
          :text="getTypeIcon(toast.type)"
          class="text-white text-lg font-bold"
        />
      </FlexboxLayout>
      <!-- 消息 -->
      <Label
        :text="toast.message"
        class="text-lg mt-2"
        :style="{ color: getTypeColor(toast.type) }"
        textWrap="true"
        textAlignment="center"
      />
    </FlexboxLayout>
  </GridLayout>
</template>
```

### 3.3 Toast 类型与颜色

| 类型 | 背景色 | 图标色 | 图标 |
|------|--------|--------|------|
| success | #F0F9EB | #67C23A | ✓ |
| error | #FEF0F0 | #F56C6C | ✕ |
| warning | #FDF6EC | #E6A23C | ! |
| info | #ECF5FF | #409EFF | i |

### 3.4 动画配置

```typescript
// 入场动画
view.opacity = 0;
view.translateY = -20;
view.animate({
  opacity: 1,
  translate: { x: 0, y: 0 },
  duration: 250,
  curve: CoreTypes.AnimationCurve.easeOut
});

// 退场动画
view.animate({
  opacity: 0,
  translate: { x: 0, y: -20 },
  duration: 250,
  curve: CoreTypes.AnimationCurve.easeIn
});
```

---

## 4. 卡片组件

### 4.1 EventCard - 事件卡片

带滑动删除功能的事件信息卡片。

**核心特性：**
- 左侧颜色条指示事件颜色
- 事件标题和时间显示
- 左滑显示删除按钮
- 平滑的开/关动画

**实现细节：**

```typescript
// 触摸处理
function onTouchAction(args: TouchGestureEventData) {
  const action = args.action;

  if (action === "down") {
    touchStartX = args.getX();
  } else if (action === "move") {
    const deltaX = args.getX() - touchStartX;
    // 只允许左滑
    if (deltaX < 0) {
      const translateX = Math.max(deltaX, -props.deleteWidth);
      cardTranslateX.value = translateX;
    }
  } else if (action === "up" || action === "cancel") {
    // 判断是否打开删除按钮
    if (cardTranslateX.value < -props.deleteWidth / 2) {
      openDelete();
    } else {
      closeDelete();
    }
  }
}

function openDelete() {
  cardRef.value?.nativeView?.animate({
    translate: { x: -props.deleteWidth, y: 0 },
    duration: 200,
    curve: CoreTypes.AnimationCurve.easeOut
  });
  isDeleteOpen.value = true;
}

function closeDelete() {
  cardRef.value?.nativeView?.animate({
    translate: { x: 0, y: 0 },
    duration: 200,
    curve: CoreTypes.AnimationCurve.easeOut
  });
  isDeleteOpen.value = false;
}
```

---

## 5. 工具函数

### 5.1 日期工具 (date.ts)

```typescript
/**
 * 判断两个日期是否同一天
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * 判断是否今天
 */
function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * 判断是否周末
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 日期加减天数
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 获取星期名称数组
 */
function getWeekDayNames(firstDay: WeekDay = "SU"): string[] {
  const names = ["日", "一", "二", "三", "四", "五", "六"];
  const startIndex = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(firstDay);
  return [...names.slice(startIndex), ...names.slice(0, startIndex)];
}

/**
 * 获取 ISO 周数
 */
function getWeekOfYear(date: Date, firstDay: WeekDay = "MO"): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * 生成周网格数据
 */
function generateWeekGrid(
  month: number,
  selectedDate: Date | null,
  firstDay: WeekDay,
  showLunar: boolean
): WeekRow[] {
  // 实现...
}

/**
 * 生成月网格数据
 */
function generateMonthGrid(
  year: number,
  month: number,
  selectedDate: Date | null,
  firstDay: WeekDay,
  showLunar: boolean
): WeekRow[] {
  // 实现...
}

/**
 * 生成年视图月份数据
 */
function generateYearMonthData(
  year: number,
  month: number,
  firstDay: WeekDay
): (number | null)[] {
  // 实现...
}
```

### 5.2 农历工具 (lunar.ts)

```typescript
/**
 * 公历转农历
 */
function solarToLunar(date: Date): LunarDate {
  // 完整实现农历转换算法
  // 包含闰月处理、干支计算等
}

/**
 * 获取农历日期显示文本
 * 优先级：节日 > 节气 > 日期
 */
function getLunarDayText(lunar: LunarDate): string {
  if (lunar.festival) return lunar.festival;
  if (lunar.term) return lunar.term;
  return lunar.lunarDayName;
}

/**
 * 判断是否特殊日期（节日或节气）
 */
function isSpecialDay(lunar: LunarDate): boolean {
  return !!(lunar.festival || lunar.term);
}

// 数据表
const LUNAR_INFO: number[];        // 1900-2100 农历数据
const TIAN_GAN: string[];          // 天干
const DI_ZHI: string[];            // 地支
const ZODIAC: string[];            // 生肖
const LUNAR_MONTH_NAMES: string[]; // 农历月名
const LUNAR_DAY_NAMES: string[];   // 农历日名
const SOLAR_TERMS: string[];       // 二十四节气
const LUNAR_FESTIVALS: Record<string, string>;  // 农历节日
const SOLAR_FESTIVALS: Record<string, string>;  // 公历节日
```

---

## 6. 类型定义

### 6.1 日历类型

```typescript
// types/calendar.ts

/**
 * 星期枚举（ISO 8601）
 */
type WeekDay = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

/**
 * 农历日期
 */
interface LunarDate {
  year: number;           // 农历年
  month: number;          // 农历月 (1-12)
  day: number;            // 农历日
  isLeapMonth: boolean;   // 是否闰月
  yearGanZhi: string;     // 年干支 (如 "甲子")
  monthGanZhi: string;    // 月干支
  dayGanZhi: string;      // 日干支
  zodiac: string;         // 生肖 (如 "鼠")
  lunarMonthName: string; // 农历月名 (如 "正月")
  lunarDayName: string;   // 农历日名 (如 "初一")
  term?: string;          // 节气
  festival?: string;      // 节日
}

/**
 * 日历单元格
 */
interface DateCell {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  lunar?: LunarDate;
}

/**
 * 周行数据
 */
interface WeekRow {
  weekNumber: number;
  days: DateCell[];
}

/**
 * 月份数据（年视图用）
 */
interface MonthData {
  name: string;
  month: number;              // 0-11
  days: (number | null)[];    // null 为空白格
}
```

### 6.2 Toast 类型

```typescript
// components/toast/types.ts

type ToastType = "success" | "error" | "warning" | "info";
type ToastPosition = "top" | "center" | "bottom";

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;              // 毫秒，0 = 不自动关闭
  position?: ToastPosition;
  showClose?: boolean;
  onClose?: () => void;
}

interface ToastInstance {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  position: ToastPosition;
  showClose: boolean;
  visible: boolean;
  onClose?: () => void;
}

interface IToastService {
  show(options: ToastOptions | string): void;
  success(message: string, options?: Partial<ToastOptions>): void;
  error(message: string, options?: Partial<ToastOptions>): void;
  warning(message: string, options?: Partial<ToastOptions>): void;
  info(message: string, options?: Partial<ToastOptions>): void;
  closeAll(): void;
}
```

### 6.3 事件类型

```typescript
interface CalendarEvent {
  uid: string;
  dtStart: Date;
  summary: string;
  dtEnd?: Date;
  description?: string;
  location?: string;
  color?: string;
}
```

---

## 7. 主题系统

### 7.1 颜色配置

```typescript
// theme/index.ts

const defaultLightColors: UIThemeColors = {
  bgPrimary: "#FFFFFF",
  bgSecondary: "#F9FAFB",
  bgTertiary: "#F3F4F6",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  primary: "#F97316",       // 橙色主色
  success: "#10B981",       // 绿色
  warning: "#F59E0B",       // 琥珀色
  error: "#EF4444",         // 红色
  info: "#3B82F6",          // 蓝色
  border: "#E5E7EB",
  today: "#F97316",
  holiday: "#EF4444"
};

const defaultDarkColors: UIThemeColors = {
  bgPrimary: "#111827",
  bgSecondary: "#1F2937",
  bgTertiary: "#374151",
  textPrimary: "#F9FAFB",
  textSecondary: "#D1D5DB",
  textTertiary: "#9CA3AF",
  primary: "#FB923C",
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",
  border: "#4B5563",
  today: "#FB923C",
  holiday: "#F87171"
};
```

### 7.2 主题 API

```typescript
/**
 * 使用主题 Hook
 */
function useUITheme(): {
  colors: ComputedRef<UIThemeColors>;
  isDark: Ref<boolean>;
  setDarkMode: (dark: boolean) => void;
} {
  // 实现...
}

/**
 * 设置深色模式
 */
function setDarkMode(dark: boolean): void;

/**
 * 获取当前是否深色模式
 */
function getIsDarkMode(): boolean;

/**
 * 配置浅色主题颜色
 */
function configureLightColors(colors: Partial<UIThemeColors>): void;

/**
 * 配置深色主题颜色
 */
function configureDarkColors(colors: Partial<UIThemeColors>): void;

/**
 * 完整配置主题
 */
function configureTheme(config: {
  light?: Partial<UIThemeColors>;
  dark?: Partial<UIThemeColors>;
}): void;

/**
 * 重置主题为默认
 */
function resetTheme(): void;
```

---

## 8. 组件 API 参考

### 8.1 MonthView

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| year | Number | 当前年 | 显示年份 |
| month | Number | 当前月 | 月份 (0-11) |
| today | Date | new Date() | 今日参考 |
| selectedDate | Date | null | 选中日期 |
| firstDayOfWeek | WeekDay | "MO" | 周起始日 |
| showLunar | Boolean | true | 显示农历 |
| showOutsideDays | Boolean | true | 显示上下月 |
| color | String | "#F97316" | 主色调 |

**事件：**
```typescript
emit("select", date: Date)           // 点击日期
emit("swipe", direction: "left" | "right")  // 滑动检测
```

**暴露方法：**
```typescript
playSlideAnimation(direction: "left" | "right", onMiddle?: () => void): Promise<void>
```

### 8.2 YearView

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| year | Number | 当前年 | 显示年份 |
| selectedDate | Date | undefined | 选中日期高亮 |
| firstDayOfWeek | WeekDay | "MO" | 周起始日 |
| showToday | Boolean | true | 高亮今日 |
| color | String | "#F97316" | 主色调 |

**事件：**
```typescript
emit("select", date: Date)
emit("monthTap", month: number)
emit("swipe", direction: "left" | "right")
```

### 8.3 WeekScheduleGrid

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| selectedDate | Date | new Date() | 周参考日期 |
| firstDayOfWeek | WeekDay | "MO" | 周起始日 |
| events | CalendarEvent[] | [] | 事件数据 |
| color | String | "#F97316" | 默认事件颜色 |
| hourHeight | Number | 60 | 每小时单元格高度 |
| timeColumnWidth | Number | 36 | 时间列宽度 |

**事件：**
```typescript
emit("event-tap", event: CalendarEvent)
emit("cell-tap", date: Date, hour: number)
emit("multi-event", date: Date, hour: number, events: CalendarEvent[])
```

### 8.4 EventCard

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | String | 必填 | 事件标题 |
| startTime | Date | 必填 | 开始时间 |
| endTime | Date | undefined | 结束时间 |
| color | String | "#3B82F6" | 左侧颜色条 |
| deleteWidth | Number | 80 | 删除按钮宽度 |

**事件：**
```typescript
emit("tap")        // 卡片点击
emit("delete")     // 删除按钮点击
```

---

## 9. 使用示例

### 9.1 基础日历使用

```vue
<template>
  <Page>
    <MonthView
      ref="monthViewRef"
      :year="currentYear"
      :month="currentMonth"
      :selected-date="selectedDate"
      first-day-of-week="MO"
      :show-lunar="true"
      color="#3B82F6"
      @select="onDateSelect"
      @swipe="onSwipe"
    />
  </Page>
</template>

<script setup lang="ts">
import { ref } from "nativescript-vue";
import { MonthView } from "@xierfloat-monorepo/mobile-ui";

const monthViewRef = ref<InstanceType<typeof MonthView>>();
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth());
const selectedDate = ref(new Date());

function onDateSelect(date: Date) {
  selectedDate.value = date;
}

async function onSwipe(direction: "left" | "right") {
  await monthViewRef.value?.playSlideAnimation(direction, () => {
    if (direction === "left") {
      if (currentMonth.value === 11) {
        currentMonth.value = 0;
        currentYear.value++;
      } else {
        currentMonth.value++;
      }
    } else {
      if (currentMonth.value === 0) {
        currentMonth.value = 11;
        currentYear.value--;
      } else {
        currentMonth.value--;
      }
    }
  });
}
</script>
```

### 9.2 周日程表使用

```vue
<template>
  <Page>
    <WeekScheduleGrid
      :selected-date="selectedDate"
      :events="events"
      :hour-height="60"
      color="#F97316"
      @event-tap="onEventTap"
      @cell-tap="onCellTap"
      @multi-event="onMultiEvent"
    />
  </Page>
</template>

<script setup lang="ts">
import { ref } from "nativescript-vue";
import { WeekScheduleGrid, type CalendarEvent } from "@xierfloat-monorepo/mobile-ui";

const selectedDate = ref(new Date());
const events = ref<CalendarEvent[]>([
  {
    uid: "1",
    summary: "会议",
    dtStart: new Date(2024, 0, 15, 9, 0),
    dtEnd: new Date(2024, 0, 15, 10, 0),
    color: "#3B82F6"
  },
  {
    uid: "2",
    summary: "午餐",
    dtStart: new Date(2024, 0, 15, 12, 0),
    dtEnd: new Date(2024, 0, 15, 13, 0),
    color: "#10B981"
  }
]);

function onEventTap(event: CalendarEvent) {
  console.log("Event tapped:", event.summary);
}

function onCellTap(date: Date, hour: number) {
  console.log("Cell tapped:", date, hour);
}

function onMultiEvent(date: Date, hour: number, events: CalendarEvent[]) {
  console.log("Multiple events:", events.length);
}
</script>
```

### 9.3 Toast 通知使用

```typescript
import { Toast, useToast } from "@xierfloat-monorepo/mobile-ui";

// 方式 1: 直接调用
Toast.success("保存成功");
Toast.error("操作失败");
Toast.warning("请注意");
Toast.info("提示信息");

// 方式 2: Composable
const toast = useToast();
toast.success("完成");

// 方式 3: 完整配置
Toast.show({
  message: "自定义消息",
  type: "success",
  duration: 5000,
  position: "center",
  showClose: true,
  onClose: () => console.log("已关闭")
});

// 关闭所有
Toast.closeAll();
```

### 9.4 事件卡片使用

```vue
<template>
  <StackLayout>
    <EventCard
      v-for="event in events"
      :key="event.uid"
      :title="event.summary"
      :start-time="event.dtStart"
      :end-time="event.dtEnd"
      :color="event.color"
      @tap="onEventTap(event)"
      @delete="onEventDelete(event)"
    />
  </StackLayout>
</template>

<script setup lang="ts">
import { EventCard } from "@xierfloat-monorepo/mobile-ui";

function onEventTap(event) {
  console.log("Tap:", event.summary);
}

function onEventDelete(event) {
  console.log("Delete:", event.uid);
}
</script>
```

### 9.5 农历工具使用

```typescript
import { solarToLunar, getLunarDayText, isSpecialDay } from "@xierfloat-monorepo/mobile-ui";

const date = new Date(2024, 0, 1); // 2024年1月1日
const lunar = solarToLunar(date);

console.log(lunar.lunarMonthName); // "腊月"
console.log(lunar.lunarDayName);   // "二十"
console.log(lunar.yearGanZhi);     // "癸卯"
console.log(lunar.zodiac);         // "兔"

// 获取显示文本（优先显示节日/节气）
const displayText = getLunarDayText(lunar); // "元旦" 或 "二十"

// 检查是否特殊日期
if (isSpecialDay(lunar)) {
  console.log("这是特殊日子！");
}
```

---

## 总结

`xierfloat-mobile-ui` 组件库提供了完整的日历和事件管理解决方案：

| 特性 | 组件/工具 | 说明 |
|------|----------|------|
| 滑动导航 | MonthView, YearView, WeekView | 水平滑动切换月份/年份 |
| 滑动动画 | 所有日历组件 | 平滑的退出/进入过渡 |
| 农历支持 | MonthView, WeekView + lunar.ts | 中国农历转换及节日显示 |
| 事件调度 | WeekScheduleGrid | 24小时时间网格及事件显示 |
| 重叠检测 | WeekScheduleGrid | 多事件显示及计数指示 |
| Toast 通知 | ToastContainer | 带队列管理的集中式通知系统 |
| 主题系统 | theme/index.ts | 浅色/深色模式及自定义颜色 |
| 滑动删除 | EventCard | 滑动显示删除操作 |
| ISO 周数 | WeekView | ISO 8601 标准周计算 |

这个组件库为 NativeScript Vue 3 移动应用提供了生产就绪的日历和通知系统，具有丰富的自定义能力、触摸友好的交互和完整的日期/农历支持。
