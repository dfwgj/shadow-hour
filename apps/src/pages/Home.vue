<template>
  <Frame>
    <Page actionBarHidden="true">
      <GridLayout rows="*" columns="*">
        <!-- 主内容 -->
        <GridLayout row="0" col="0" rows="auto, auto, auto, *, auto" class="bg-theme-secondary">
          <!-- 状态栏占位 -->
          <StackLayout row="0" :height="statusBarHeight" />
          <!-- 头部标题 -->
          <FlexboxLayout row="1" orientation="horizontal" justifyContent="space-between" class="bg-theme-card p-4">
            <Label :text="headerTitle" class="text-2xl font-bold text-theme-primary" />
            <Label
              text="+"
              @tap="openAddEvent"
              :class="[getBrandClass('text'), 'text-4xl text-center']"
              verticalAlignment="center"
            />
          </FlexboxLayout>

          <!-- 视图切换器 -->
          <GridLayout row="2" columns="*, *, *, *" class="bg-theme-secondary mx-4 rounded-3xl p-1 mt-2">
            <Label
              v-for="(tab, index) in viewTabs"
              :key="tab.type"
              :col="index"
              :text="tab.label"
              :class="[
                'text-center py-2 text-sm text-theme-primary rounded-2xl ',
                currentView === tab.type ? 'bg-theme-card font-medium ' : ''
              ]"
              @tap="switchView(tab.type)"
            />
          </GridLayout>

          <!-- 主内容区 - 非周视图使用 ScrollView -->
          <ScrollView row="3" v-if="currentView !== 'week'">
            <StackLayout ref="contentRef">
              <!-- 年视图 -->
              <YearView
                v-if="currentView === 'year'"
                class="m-4"
                ref="yearViewRef"
                :year="currentDate.getFullYear()"
                :selected-date="selectedDate"
                :first-day-of-week="firstDayOfWeek"
                :show-today="true"
                :color="getColor('primary')"
                @select="onDateSelect"
                @month-tap="onYearMonthTap"
                @swipe="onYearSwipe"
              />
              <!-- 月视图 -->
              <StackLayout v-else-if="currentView === 'month'">
                <MonthView
                  class="m-4"
                  ref="monthViewRef"
                  :year="currentDate.getFullYear()"
                  :month="currentDate.getMonth()"
                  :selected-date="selectedDate"
                  :first-day-of-week="firstDayOfWeek"
                  :show-lunar="showLunar"
                  :show-outside-days="true"
                  :color="getColor('primary')"
                  @select="onDateSelect"
                  @swipe="onSwipe"
                />
                <!-- 今日信息 -->
                <GridLayout columns="*, auto" class="py-3 px-4">
                  <Label col="0" :text="todayInfo" class="text-sm text-theme-secondary" />
                </GridLayout>
                <!-- 事件卡片 -->
                <StackLayout class="px-4" v-if="eventList.length > 0">
                  <EventCard
                    v-for="event in eventList"
                    :key="event.uid"
                    :title="event.summary"
                    :start-time="event.dtStart"
                    :end-time="event.dtEnd"
                    :color="getColor('primary')"
                    class="mb-3"
                    @tap="onEventTap(event)"
                    @delete="onDeleteEvent(event.uid)"
                  />
                </StackLayout>
                <Label v-else text="暂无日程" class="text-base text-theme-secondary text-center p-12" />
              </StackLayout>
              <!-- 日程视图 -->
              <StackLayout v-else-if="currentView === 'schedule'">
                <!-- 今日信息 -->
                <GridLayout columns="*, auto" class="py-3 px-4">
                  <Label col="0" :text="todayScheduleInfo" class="text-sm text-theme-secondary" />
                </GridLayout>
                <!-- 事件卡片 -->
                <StackLayout class="px-4" v-if="todayEvents.length > 0">
                  <EventCard
                    v-for="event in todayEvents"
                    :key="event.uid"
                    :title="event.summary"
                    :start-time="event.dtStart"
                    :end-time="event.dtEnd"
                    :color="getColor('primary')"
                    class="mb-3"
                    @tap="onScheduleEventTap(event)"
                    @delete="onDeleteTodayEvent(event.uid)"
                  />
                </StackLayout>
                <Label v-else text="今日暂无日程" class="text-base text-theme-secondary text-center p-12" />
              </StackLayout>
            </StackLayout>
          </ScrollView>

          <!-- 周视图 - 单独布局，WeekView 固定 + WeekScheduleGrid 滚动 -->
          <GridLayout v-else row="3" rows="auto, *">
            <!-- WeekView 固定在顶部 -->
            <WeekView
              row="0"
              class="m-4"
              ref="weekViewRef"
              :month="currentDate.getMonth()"
              :selected-date="selectedDate"
              :first-day-of-week="firstDayOfWeek"
              :show-lunar="showLunar"
              :show-outside-days="true"
              :color="getColor('primary')"
              @select="onDateSelect"
              @swipe="onWeekSwipe"
            />
            <!-- WeekScheduleGrid 独立滚动 -->
            <WeekScheduleGrid
              row="1"
              class="mx-4 bg-theme-card"
              :selected-date="selectedDate"
              :first-day-of-week="firstDayOfWeek"
              :events="weekEvents"
              :hour-height="40"
              :color="getColor('primary')"
              @event-tap="onEventTap"
              @cell-tap="onCellTap"
              @multi-event="onMultiEvent"
            />
          </GridLayout>

          <!-- 底部导航 -->
          <GridLayout row="4" columns="*, *" class="h-16 bg-theme-card border-t border-theme-light">
            <StackLayout col="0" horizontalAlignment="center" verticalAlignment="center" @tap="switchNav('calendar')">
              <Label
                text="日程"
                :class="[
                  'text-md text-center',
                  currentNav === 'calendar' ? getBrandClass('text') : 'text-theme-secondary'
                ]"
              />
            </StackLayout>
            <StackLayout col="1" horizontalAlignment="center" verticalAlignment="center" @tap="switchNav('today')">
              <Label
                text="智能安排"
                :class="['text-md text-center', currentNav === 'today' ? 'text-theme-brand' : 'text-theme-secondary']"
              />
            </StackLayout>
          </GridLayout>
        </GridLayout>

        <AddEventModal
          row="0"
          col="0"
          :visible="showAddEventModal"
          :selected-date="selectedDate"
          :event="editingEvent"
          @close="closeAddEventModal"
          @submit="handleAddEventSubmit"
          @update="handleUpdateEvent"
        />

        <!-- Toast 容器 -->
        <ToastContainer row="0" col="0" />
      </GridLayout>
    </Page>
  </Frame>
</template>
<script lang="ts" setup>
import { ref, computed, onMounted, $navigateTo, onUnmounted } from "nativescript-vue";
import { Screen, Application, Utils, CoreTypes } from "@nativescript/core";
import { useCalendar } from "../composables/useCalendar";
import { solarToLunar } from "../utils/lunar";
import { notificationService } from "../services/notification";
import {
  MonthView,
  YearView,
  WeekView,
  EventCard,
  Toast,
  ToastContainer,
  WeekScheduleGrid
} from "@xierfloat-monorepo/mobile-ui";
import AddEventModal from "../components/AddEventModal.vue";
import AIChat from "./AIChat.vue";
import { CalendarEvent } from "~/types/calendar";
import { Dialogs } from "@nativescript/core";
import { useTheme } from "../composables/useTheme";
const { getBrandClass, getColor, initTheme, destroyTheme } = useTheme();
const monthViewRef = ref<InstanceType<typeof MonthView> | null>(null);
const yearViewRef = ref<InstanceType<typeof YearView> | null>(null);
const weekViewRef = ref<InstanceType<typeof WeekView> | null>(null);
// 视图类型
type ViewType = "year" | "month" | "week" | "schedule";
const currentView = ref<ViewType>("month");
// 周视图的事件（需要加载整周的事件）
const weekEvents = ref<CalendarEvent[]>([]);

// 日程视图的事件（只显示今天的事件）
const todayEvents = ref<CalendarEvent[]>([]);

// 点击空白格子（创建事件）
function onCellTap(date: Date, hour: number) {
  // 设置开始时间为点击的日期和小时
  const startDate = new Date(date);
  startDate.setHours(hour, 0, 0, 0);
  selectedDate.value = startDate;
  openAddEvent();
}

// 多日程提示
function onMultiEvent(date: Date, hour: number) {
  Toast.info("存在多日程，请去日程页面修改");
}
// 底部导航
type NavType = "calendar" | "today" | "todo";
const currentNav = ref<NavType>("calendar");

// 新增日程弹窗
const showAddEventModal = ref(false);

// 当前编辑的事件（null 表示新增模式）
const editingEvent = ref<CalendarEvent | null>(null);

// 日程列表
const eventList = ref<CalendarEvent[]>([]);

const {
  selectedDate,
  currentDate,
  firstDayOfWeek,
  showLunar,
  selectDate,
  init,
  addEvent,
  updateEvent,
  deleteEvent,
  loadEventsByDate,
  loadEventsByWeek
} = useCalendar();

// 状态栏高度
const statusBarHeight = ref(24);

// 初始化数据库和获取状态栏高度
onMounted(async () => {
  // 初始化数据库
  await init();
  // 获取状态栏高度
  if (Application.android) {
    const resourceId = Utils.android
      .getApplicationContext()
      .getResources()
      .getIdentifier("status_bar_height", "dimen", "android");
    if (resourceId > 0) {
      const height = Utils.android.getApplicationContext().getResources().getDimensionPixelSize(resourceId);
      statusBarHeight.value = height / Screen.mainScreen.scale;
    }
  }
  // 加载当前日期的事件
  await getEvents();

  // 请求通知权限
  const hasPermission = await notificationService.requestPermission();
  if (!hasPermission) {
    console.log("[Home] 用户未授权通知权限");
  }
});

// 头部标题
const headerTitle = computed(() => {
  const d = currentDate.value;
  if (currentView.value === "year") {
    return `${d.getFullYear()}年`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
});

// 今日信息（月视图用）
const todayInfo = computed(() => {
  const d = selectedDate.value;
  const lunar = solarToLunar(d);
  return `${d.getMonth() + 1}月${d.getDate()}日 农历${lunar.lunarMonthName}${lunar.lunarDayName}`;
});

// 日程视图日期信息（始终显示今天）
const todayScheduleInfo = computed(() => {
  const today = new Date();
  const lunar = solarToLunar(today);
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `今天 ${today.getMonth() + 1}月${today.getDate()}日 ${weekDays[today.getDay()]} 农历${lunar.lunarMonthName}${lunar.lunarDayName}`;
});

// 视图
const viewTabs = [
  { type: "year" as ViewType, label: "年" },
  { type: "month" as ViewType, label: "月" },
  { type: "week" as ViewType, label: "周" },
  { type: "schedule" as ViewType, label: "日程" }
];

// 内容区域引用
const contentRef = ref();
const isAnimating = ref(false);

async function switchView(type: ViewType) {
  if (type === currentView.value || isAnimating.value) return;

  // 如果切换到周视图，先加载周事件
  if (type === "week") {
    await getWeekEvents();
  }
  // 如果切换到日程视图，加载今天的事件
  if (type === "schedule") {
    await getTodayEvents();
  }

  const view = contentRef.value?.nativeView;
  if (!view) {
    currentView.value = type;
    return;
  }

  isAnimating.value = true;

  // 先淡出
  view
    .animate({
      opacity: 0,
      duration: 10,
      curve: CoreTypes.AnimationCurve.easeIn
    })
    .then(() => {
      currentView.value = type;
      setTimeout(() => {
        view
          .animate({
            opacity: 1,
            duration: 150,
            curve: CoreTypes.AnimationCurve.easeOut
          })
          .then(() => {
            isAnimating.value = false;
          });
      }, 10);
    });
}

// 底部导航切换
function switchNav(type: NavType) {
  if (type === "today") {
    // 跳转到 AI 聊天页面
    navigateToAIChat();
    return;
  }
  currentNav.value = type;
}
onMounted(() => {
  // 初始化主题，会自动检测并应用午夜颜色
  initTheme();
});

onUnmounted(() => {
  // 清理定时器
  destroyTheme();
});
// 跳转到 AI 聊天页面
function navigateToAIChat() {
  $navigateTo(AIChat, {
    transition: {
      name: "slide",
      duration: 200
    }
  });
}

// 打开新建日程弹窗
function openAddEvent() {
  editingEvent.value = null;
  showAddEventModal.value = true;
}

// 点击事件卡片，打开查看/编辑弹窗
function onEventTap(event: CalendarEvent) {
  editingEvent.value = event;
  showAddEventModal.value = true;
}

// 日程视图点击事件
function onScheduleEventTap(event: CalendarEvent) {
  editingEvent.value = event;
  showAddEventModal.value = true;
}

// 日程视图删除事件
async function onDeleteTodayEvent(uid: string) {
  try {
    const confirmed = await Dialogs.confirm({
      title: "确认删除",
      message: "确定删除该事件吗？",
      okButtonText: "删除",
      cancelButtonText: "取消"
    });
    if (confirmed) {
      // 取消该事件的通知
      await notificationService.cancelEventReminder(uid);
      await deleteEvent(uid);
      Toast.success("删除成功");
      await getTodayEvents();
    }
  } catch (error) {
    Toast.error("删除失败");
    console.error("删除事件失败:", error);
  }
}

// 关闭新建日程弹窗
function closeAddEventModal() {
  showAddEventModal.value = false;
  editingEvent.value = null;
}

async function getEvents() {
  try {
    const events = await loadEventsByDate(selectedDate.value);
    eventList.value = events;
    console.log("从数据库获取的事件:", events);
  } catch (error) {
    console.error("获取事件失败:", error);
  }
}

// 加载今天的事件（日程视图用）
async function getTodayEvents() {
  try {
    const today = new Date();
    const events = await loadEventsByDate(today);
    todayEvents.value = events;
    console.log("从数据库获取今天的事件:", events);
  } catch (error) {
    console.error("获取今天事件失败:", error);
  }
}

// 加载周视图事件
async function getWeekEvents() {
  try {
    const events = await loadEventsByWeek(selectedDate.value);
    weekEvents.value = events;
    console.log("从数据库获取的周事件:", events);
  } catch (error) {
    console.error("获取周事件失败:", error);
  }
}
// 处理日期选中
async function onDateSelect(date: Date) {
  selectDate(date);
  // 加载选中日期的事件
  await getEvents();
  // 如果是周视图，同时加载周事件
  if (currentView.value === "week") {
    await getWeekEvents();
  }
}
// 处理月视图左右滑动切换月份
function onSwipe(direction: "left" | "right") {
  monthViewRef.value?.playSlideAnimation(direction, () => {
    const current = currentDate.value;
    const newMonth = direction === "left" ? current.getMonth() + 1 : current.getMonth() - 1;
    currentDate.value = new Date(current.getFullYear(), newMonth, 1);
  });
}
// 处理周视图左右滑动切换周数
import { addDays } from "@xierfloat-monorepo/mobile-ui";
function onWeekSwipe(direction: "left" | "right") {
  weekViewRef.value?.playSlideAnimation(direction, async () => {
    const days = direction === "left" ? 7 : -7;
    selectedDate.value = addDays(selectedDate.value, days);
    // 同步更新 currentDate
    currentDate.value = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), 1);
    // 重新加载周事件
    await getWeekEvents();
  });
}
// 处理年视图中月份点击（切换到月视图）
function onYearMonthTap(month: number) {
  const newDate = new Date(currentDate.value.getFullYear(), month, 1);
  currentDate.value = newDate;
  switchView("month");
}

// 处理年视图左右滑动切换年份
function onYearSwipe(direction: "left" | "right") {
  yearViewRef.value?.playSlideAnimation(direction, () => {
    const current = currentDate.value;
    const newYear = direction === "left" ? current.getFullYear() + 1 : current.getFullYear() - 1;
    currentDate.value = new Date(newYear, current.getMonth(), 1);
  });
}

// 删除事件
async function onDeleteEvent(uid: string) {
  try {
    const confirmed = await Dialogs.confirm({
      title: "确认删除",
      message: "确定删除该事件吗？",
      okButtonText: "删除",
      cancelButtonText: "取消"
    });
    if (confirmed) {
      // 取消该事件的通知
      await notificationService.cancelEventReminder(uid);
      await deleteEvent(uid);
      Toast.success("删除成功");
      await getEvents();
      if (currentView.value === "week") {
        await getWeekEvents();
      }
    }
  } catch (error) {
    Toast.error("删除失败");
    console.error("删除事件失败:", error);
  }
}
// 提交新建日程
async function handleAddEventSubmit(eventData: {
  summary: string;
  description: string;
  dtStart: Date;
  dtEnd: Date;
  enableReminder: boolean;
  reminderMinutes: number;
}) {
  try {
    // 构建 alarms 数组
    const alarms = eventData.enableReminder
      ? [{ action: "DISPLAY" as const, trigger: { minutes: -eventData.reminderMinutes } }]
      : [];

    const newEvent = await addEvent({
      summary: eventData.summary,
      description: eventData.description,
      dtStart: eventData.dtStart,
      dtEnd: eventData.dtEnd,
      alarms
    });

    // 如果开启了提醒，调度本地通知
    if (eventData.enableReminder && newEvent) {
      const scheduled = await notificationService.scheduleEventReminder(
        newEvent.uid,
        eventData.summary,
        eventData.dtStart,
        eventData.reminderMinutes
      );
      if (scheduled) {
        console.log("[Home] 已调度提醒通知");
      }
    }

    showAddEventModal.value = false;
    Toast.success("添加成功");
  } catch (error) {
    Toast.error("添加失败");
    console.error("添加事件失败:", error);
  } finally {
    await getEvents();
    if (currentView.value === "week") {
      await getWeekEvents();
    }
    if (currentView.value === "schedule") {
      await getTodayEvents();
    }
  }
}

// 更新日程
async function handleUpdateEvent(eventData: {
  uid: string;
  summary: string;
  description: string;
  dtStart: Date;
  dtEnd: Date;
  enableReminder: boolean;
  reminderMinutes: number;
}) {
  try {
    // 构建 alarms 数组
    const alarms = eventData.enableReminder
      ? [{ action: "DISPLAY" as const, trigger: { minutes: -eventData.reminderMinutes } }]
      : [];

    await updateEvent(eventData.uid, {
      summary: eventData.summary,
      description: eventData.description,
      dtStart: eventData.dtStart,
      dtEnd: eventData.dtEnd,
      alarms
    });

    // 先取消旧的通知
    await notificationService.cancelEventReminder(eventData.uid);

    // 如果开启了提醒，重新调度通知
    if (eventData.enableReminder) {
      const scheduled = await notificationService.scheduleEventReminder(
        eventData.uid,
        eventData.summary,
        eventData.dtStart,
        eventData.reminderMinutes
      );
      if (scheduled) {
        console.log("[Home] 已重新调度提醒通知");
      }
    }

    showAddEventModal.value = false;
    editingEvent.value = null;
    Toast.success("更新成功");
    console.log("事件已更新:", eventData.uid);
  } catch (error) {
    console.error("更新事件失败:", error);
  } finally {
    await getEvents();
    if (currentView.value === "week") {
      await getWeekEvents();
    }
    if (currentView.value === "schedule") {
      await getTodayEvents();
    }
  }
}
</script>

<style scoped></style>
