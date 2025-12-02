<template>
  <Frame>
    <Page actionBarHidden="true">
      <!-- 使用外层 GridLayout 实现弹窗覆盖 -->
      <GridLayout rows="*" columns="*">
        <!-- 主内容 -->
        <GridLayout row="0" col="0" rows="auto, auto, auto, *, auto" class="bg-gray-100">
          <!-- 状态栏占位 -->
          <StackLayout row="0" :height="statusBarHeight" />
          <!-- 头部标题 -->
          <StackLayout row="1" class="bg-white p-3">
            <Label :text="headerTitle" class="text-2xl font-bold text-gray-800" />
          </StackLayout>

          <!-- 视图切换器 -->
          <GridLayout row="2" columns="*, *, *, *" class="bg-gray-100 mx-4 rounded-3xl p-1 mt-2">
            <Label
              v-for="(tab, index) in viewTabs"
              :key="tab.type"
              :col="index"
              :text="tab.label"
              :class="[
                'text-center py-2 text-sm text-gray-800 rounded-2xl',
                currentView === tab.type ? 'bg-white font-medium' : ''
              ]"
              @tap="switchView(tab.type)"
            />
          </GridLayout>

          <!-- 主内容区 -->
          <ScrollView row="3">
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
                color="#F97316"
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
                  @select="onDateSelect"
                  @swipe="onSwipe"
                />
                <!-- 今日信息 -->
                <GridLayout columns="*, auto" class="py-3 px-4">
                  <Label col="0" :text="todayInfo" class="text-sm text-gray-500" />
                </GridLayout>
                <!-- 事件卡片 -->
                <StackLayout class="px-4" v-if="eventList.length > 0">
                  <EventCard
                    v-for="event in eventList"
                    :key="event.uid"
                    :title="event.summary"
                    :start-time="event.dtStart"
                    :end-time="event.dtEnd"
                    color="#F97316"
                    class="mb-3"
                    @tap="onEventTap(event)"
                    @delete="onDeleteEvent(event.uid)"
                  />
                </StackLayout>
                <Label v-else text="暂无事件" class="text-base text-gray-500 text-center p-12" />
              </StackLayout>
              <!-- 周视图 -->
              <StackLayout v-else-if="currentView === 'week'">
                <WeekView
                  class="m-4"
                  ref="weekViewRef"
                  :month="currentDate.getMonth()"
                  :selected-date="selectedDate"
                  :first-day-of-week="firstDayOfWeek"
                  :show-lunar="showLunar"
                  :show-outside-days="true"
                  @select="onDateSelect"
                  @swipe="onWeekSwipe"
                />
              </StackLayout>
              <!-- 日程视图占位 -->
              <Label
                v-else-if="currentView === 'schedule'"
                text="日程视图开发中..."
                class="text-base text-gray-500 text-center p-12"
              />
            </StackLayout>
          </ScrollView>

          <!-- 底部导航 -->
          <GridLayout row="4" columns="*, *" class="h-16 bg-white border-t border-gray-100">
            <StackLayout col="0" class="horizontal-center vertical-center" @tap="switchNav('calendar')">
              <Label
                text="日程"
                :class="['text-sm text-center', currentNav === 'calendar' ? 'text-orange-500' : 'text-gray-500']"
              />
            </StackLayout>
            <StackLayout col="1" class="horizontal-center vertical-center" @tap="switchNav('today')">
              <Label
                text="智能安排"
                :class="['text-sm text-center', currentNav === 'today' ? 'text-orange-500' : 'text-gray-500']"
              />
            </StackLayout>
          </GridLayout>

          <GridLayout row="2" rowSpan="2" columns="*, auto" rows="*, auto" class="pointer-events-none">
            <StackLayout
              col="1"
              row="1"
              class="w-14 h-14 bg-white rounded-full m-4"
              androidElevation="4"
              boxShadow="0 4 10 rgba(0,0,0,0.15)"
              @tap="openAddEvent"
            >
              <Label text="+" class="text-4xl text-orange-500 text-center" style="line-height: 56" />
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
import { ref, computed, onMounted, watch } from "nativescript-vue";
import { Screen, Application, Utils, CoreTypes } from "@nativescript/core";
import { useCalendar } from "../composables/useCalendar";
import { solarToLunar, getYearInfo } from "../utils/lunar";
import { MonthView, YearView, WeekView, EventCard, Toast, ToastContainer } from "@xierfloat-monorepo/mobile-ui";
import AddEventModal from "../components/AddEventModal.vue";
import { CalendarEvent } from "~/types/calendar";
import { Dialogs } from "@nativescript/core";

const monthViewRef = ref<InstanceType<typeof MonthView> | null>(null);
const yearViewRef = ref<InstanceType<typeof YearView> | null>(null);
const weekViewRef = ref<InstanceType<typeof WeekView> | null>(null);
// 视图类型
type ViewType = "year" | "month" | "week" | "schedule";
const currentView = ref<ViewType>("month");

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
  loadEventsByDate
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
});

// 头部标题
const headerTitle = computed(() => {
  const d = currentDate.value;
  if (currentView.value === "year") {
    return `${d.getFullYear()}年`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
});

// 今日信息
const todayInfo = computed(() => {
  const d = selectedDate.value;
  const lunar = solarToLunar(d);
  return `${d.getMonth() + 1}月${d.getDate()}日 农历${lunar.lunarMonthName}${lunar.lunarDayName}`;
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

function switchView(type: ViewType) {
  if (type === currentView.value || isAnimating.value) return;

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
  currentNav.value = type;
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
// 处理日期选中
async function onDateSelect(date: Date) {
  selectDate(date);
  // 加载选中日期的事件
  await getEvents();
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
  weekViewRef.value?.playSlideAnimation(direction, () => {
    const days = direction === "left" ? 7 : -7;
    selectedDate.value = addDays(selectedDate.value, days);
    // 同步更新 currentDate
    currentDate.value = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), 1);
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
      await deleteEvent(uid);
      Toast.success("删除成功");
      await getEvents();
    }
  } catch (error) {
    Toast.error("删除失败");
    console.error("删除事件失败:", error);
  }
}
// 提交新建日程
async function handleAddEventSubmit(eventData: { summary: string; description: string; dtStart: Date; dtEnd: Date }) {
  try {
    await addEvent({
      summary: eventData.summary,
      description: eventData.description,
      dtStart: eventData.dtStart,
      dtEnd: eventData.dtEnd,
      alarms: [{ action: "DISPLAY", trigger: { minutes: -30 } }]
    });

    showAddEventModal.value = false;
    Toast.success("添加成功");
  } catch (error) {
    Toast.error("添加失败");
    console.error("添加事件失败:", error);
  } finally {
    await getEvents();
  }
}

// 更新日程
async function handleUpdateEvent(eventData: {
  uid: string;
  summary: string;
  description: string;
  dtStart: Date;
  dtEnd: Date;
}) {
  try {
    await updateEvent(eventData.uid, {
      summary: eventData.summary,
      description: eventData.description,
      dtStart: eventData.dtStart,
      dtEnd: eventData.dtEnd
    });

    showAddEventModal.value = false;
    editingEvent.value = null;
    Toast.success("更新成功");
    console.log("事件已更新:", eventData.uid);
  } catch (error) {
    console.error("更新事件失败:", error);
  } finally {
    await getEvents();
  }
}
</script>

<style scoped></style>
