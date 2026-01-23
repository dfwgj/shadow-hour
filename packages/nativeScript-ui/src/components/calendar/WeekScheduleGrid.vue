<script setup lang="ts">
/**
 * WeekScheduleGrid - 周日程网格组件
 * 左侧时间轴(0-24小时)，顶部7天，网格显示事件
 * 支持跨时间段事件显示
 * @author: DF蓝梦/xierfloat
 * @Date 2025-12-1
 */
import { computed, PropType, ref } from "nativescript-vue";
import { WeekDay } from "../../types/calendar";
import { addDays } from "../../utils/date";
import { Screen } from "@nativescript/core";

// 事件类型
export interface CalendarEvent {
  uid: string;
  dtStart: Date;
  summary: string;
  dtEnd?: Date;
  description?: string;
  location?: string;
  color?: string;
}

// 渲染用的事件信息
interface RenderEvent {
  event: CalendarEvent;
  dayIndex: number;
  top: number;
  height: number;
  isMulti: boolean;
  multiCount?: number;
}

const props = defineProps({
  selectedDate: {
    type: Date,
    default: () => new Date()
  },
  firstDayOfWeek: {
    type: String as PropType<WeekDay>,
    default: "MO"
  },
  events: {
    type: Array as PropType<CalendarEvent[]>,
    default: () => []
  },
  color: {
    type: String,
    default: "#F97316"
  },
  hourHeight: {
    type: Number,
    default: 60
  },
  timeColumnWidth: {
    type: Number,
    default: 36
  }
});

const emit = defineEmits<{
  (e: "event-tap", event: CalendarEvent): void;
  (e: "cell-tap", date: Date, hour: number): void;
  (e: "multi-event", date: Date, hour: number, events: CalendarEvent[]): void;
}>();

// 列宽度（动态计算）
const columnWidth = ref(0);

// 计算本周的起始日期
const weekStartDate = computed(() => {
  const date = props.selectedDate;
  const dayOfWeek = date.getDay();
  const firstDayIndex = props.firstDayOfWeek === "SU" ? 0 : 1;
  const daysFromStart = (dayOfWeek - firstDayIndex + 7) % 7;
  return addDays(date, -daysFromStart);
});

// 本周的7天日期
const weekDates = computed(() => {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(weekStartDate.value, i));
  }
  return dates;
});

// 时间轴（0-23小时）
const hours = Array.from({ length: 24 }, (_, i) => i);

// 总高度
const totalHeight = computed(() => 24 * props.hourHeight);

// 格式化小时显示
function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

// 确保日期是 Date 对象
function ensureDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

// 判断两个日期是否是同一天
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// 获取某天的所有事件（用于检测重叠）
function getEventsForDay(dayIndex: number): CalendarEvent[] {
  const date = weekDates.value[dayIndex];
  if (!date) return [];
  return props.events.filter((event) => {
    const eventDate = ensureDate(event.dtStart);
    return isSameDay(eventDate, date);
  });
}

// 检测某个时间段是否有多个事件重叠
function getOverlappingEvents(dayIndex: number, startHour: number, endHour: number): CalendarEvent[] {
  const dayEvents = getEventsForDay(dayIndex);
  return dayEvents.filter((event) => {
    const eventStart = ensureDate(event.dtStart);
    const eventEnd = event.dtEnd ? ensureDate(event.dtEnd) : new Date(eventStart.getTime() + 3600000);
    const eventStartHour = eventStart.getHours() + eventStart.getMinutes() / 60;
    const eventEndHour = eventEnd.getHours() + eventEnd.getMinutes() / 60;
    // 检查是否有重叠
    return eventStartHour < endHour && eventEndHour > startHour;
  });
}

// 计算需要渲染的事件列表（处理重叠情况）
const renderEvents = computed<RenderEvent[]>(() => {
  const result: RenderEvent[] = [];
  const processedSlots = new Set<string>(); // 记录已处理的时间槽

  weekDates.value.forEach((date, dayIndex) => {
    const dayEvents = getEventsForDay(dayIndex);

    // 按开始时间排序
    const sortedEvents = [...dayEvents].sort((a, b) => {
      return ensureDate(a.dtStart).getTime() - ensureDate(b.dtStart).getTime();
    });

    sortedEvents.forEach((event) => {
      const eventStart = ensureDate(event.dtStart);
      const eventEnd = event.dtEnd ? ensureDate(event.dtEnd) : new Date(eventStart.getTime() + 3600000);
      const startHour = eventStart.getHours() + eventStart.getMinutes() / 60;
      const endHour = eventEnd.getHours() + eventEnd.getMinutes() / 60;

      // 生成时间槽 key（按小时）
      const slotKey = `${dayIndex}-${Math.floor(startHour)}`;

      // 获取重叠事件
      const overlapping = getOverlappingEvents(dayIndex, startHour, endHour);

      if (overlapping.length > 1) {
        // 多事件重叠，只在第一次遇到时添加一个"多日程"块
        if (!processedSlots.has(slotKey)) {
          processedSlots.add(slotKey);
          // 计算多事件块的范围（取所有重叠事件的最小开始和最大结束）
          let minStart = startHour;
          let maxEnd = endHour;
          overlapping.forEach((e) => {
            const eStart = ensureDate(e.dtStart);
            const eEnd = e.dtEnd ? ensureDate(e.dtEnd) : new Date(eStart.getTime() + 3600000);
            const eStartHour = eStart.getHours() + eStart.getMinutes() / 60;
            const eEndHour = eEnd.getHours() + eEnd.getMinutes() / 60;
            minStart = Math.min(minStart, eStartHour);
            maxEnd = Math.max(maxEnd, eEndHour);
          });

          result.push({
            event,
            dayIndex,
            top: minStart * props.hourHeight,
            height: Math.max((maxEnd - minStart) * props.hourHeight, props.hourHeight * 0.5),
            isMulti: true,
            multiCount: overlapping.length
          });
        }
      } else {
        // 单个事件，正常渲染
        const duration = endHour - startHour;
        result.push({
          event,
          dayIndex,
          top: startHour * props.hourHeight,
          height: Math.max(duration * props.hourHeight, props.hourHeight * 0.5),
          isMulti: false
        });
      }
    });
  });

  return result;
});

// 获取事件的左偏移
function getEventLeft(dayIndex: number): number {
  return props.timeColumnWidth + dayIndex * columnWidth.value + 2;
}

// 获取事件宽度
function getEventWidth(): number {
  return columnWidth.value - 4;
}

// 处理单元格点击
function handleCellTap(date: Date, hour: number) {
  const dayIndex = weekDates.value.findIndex((d) => isSameDay(d, date));
  if (dayIndex === -1) return;

  const overlapping = getOverlappingEvents(dayIndex, hour, hour + 1);

  if (overlapping.length === 0) {
    emit("cell-tap", date, hour);
  } else if (overlapping.length === 1) {
    emit("event-tap", overlapping[0]!);
  } else {
    emit("multi-event", date, hour, overlapping);
  }
}

// 处理事件点击
function handleEventTap(renderEvent: RenderEvent) {
  if (renderEvent.isMulti) {
    const date = weekDates.value[renderEvent.dayIndex];
    if (!date) return;
    const hour = Math.floor(renderEvent.top / props.hourHeight);
    const overlapping = getOverlappingEvents(renderEvent.dayIndex, hour, hour + 1);
    emit("multi-event", date, hour, overlapping);
  } else {
    emit("event-tap", renderEvent.event);
  }
}

// 布局加载后计算列宽
function onGridLoaded(args: any) {
  const view = args.object;
  const screenWidth = Screen.mainScreen.widthDIPs;
  // 减去左右边距(mx-4 = 16*2 = 32)和时间列宽度
  const availableWidth = screenWidth - 32 - props.timeColumnWidth;
  columnWidth.value = availableWidth / 7;
}
</script>

<template>
  <ScrollView>
    <GridLayout
      rows="auto"
      columns="auto, *"
      :height="totalHeight"
      @loaded="onGridLoaded"
    >
      <!-- 左侧时间轴 -->
      <StackLayout col="0" :width="timeColumnWidth">
        <StackLayout
          v-for="hour in hours"
          :key="'time-' + hour"
          :height="hourHeight"
          class="border-b border-gray-200"
        >
          <Label
            :text="formatHour(hour)"
            class="text-xs text-gray-400 text-right pr-1"
            verticalAlignment="top"
          />
        </StackLayout>
      </StackLayout>

      <!-- 右侧网格区域 -->
      <GridLayout col="1" rows="*" columns="*">
        <!-- 背景网格 -->
        <StackLayout>
          <GridLayout
            v-for="hour in hours"
            :key="'grid-row-' + hour"
            :columns="'*, '.repeat(6) + '*'"
            :height="hourHeight"
            class="border-b border-gray-200"
          >
            <StackLayout
              v-for="(date, dayIndex) in weekDates"
              :key="'cell-' + hour + '-' + dayIndex"
              :col="dayIndex"
              :class="['bg-white', dayIndex !== 6 ? 'border-r border-gray-200' : '']"
              @tap="handleCellTap(date, hour)"
            />
          </GridLayout>
        </StackLayout>

        <!-- 事件层（绝对定位） -->
        <AbsoluteLayout>
          <StackLayout
            v-for="(re, index) in renderEvents"
            :key="'event-' + index"
            :left="getEventLeft(re.dayIndex) - timeColumnWidth"
            :top="re.top"
            :width="getEventWidth()"
            :height="re.height"
            :style="{ backgroundColor: re.isMulti ? '#EF4444' : (re.event.color || color) }"
            class="rounded"
            @tap="handleEventTap(re)"
          >
            <Label
              :text="re.isMulti ? `多日程(${re.multiCount})` : re.event.summary"
              class="text-xs text-white p-1"
              textWrap="true"
            />
          </StackLayout>
        </AbsoluteLayout>
      </GridLayout>
    </GridLayout>
  </ScrollView>
</template>
