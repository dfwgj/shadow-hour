<script lang="ts" setup>
/**
 * 日历应用主页 - 参考原型设计
 */
import { ref, computed, onMounted, watch } from "nativescript-vue";
import { Screen, Application, Utils, CoreTypes } from "@nativescript/core";
import { useCalendar } from "../composables/useCalendar";
import { solarToLunar, getYearInfo } from "../utils/lunar";
import MonthView from "../components/calendar/MonthView.vue";
import YearView from "../components/calendar/YearView.vue";

// 视图类型
type ViewType = "year" | "month" | "week" | "schedule";
const currentView = ref<ViewType>("month");

// 底部导航
type NavType = "calendar" | "today" | "todo";
const currentNav = ref<NavType>("calendar");

const { selectedDate, currentDate, selectedDateEvents, goToPrevious, goToNext, goToToday } = useCalendar();

// 状态栏高度
const statusBarHeight = ref(24);

// 获取状态栏高度
onMounted(() => {
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
});

// 头部标题（根据视图类型显示不同内容）
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

// 年份信息（用于黄历卡片）
const yearInfo = computed(() => {
  return getYearInfo(selectedDate.value);
});

// 农历日期信息
const lunarDayInfo = computed(() => {
  const lunar = solarToLunar(selectedDate.value);
  return lunar.lunarDayName;
});

// 视图切换
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
      duration: 150,
      curve: CoreTypes.AnimationCurve.easeIn
    })
    .then(() => {
      // 切换视图
      currentView.value = type;
      // 淡入
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

// 打开新建日程页面
function openAddEvent() {
  console.log("Open add event page");
}
</script>

<template>
  <Frame>
    <Page actionBarHidden="true">
      <GridLayout rows="auto, auto, auto, *, auto, auto" class="bg-gray-100">
        <!-- 状态栏占位 -->
        <StackLayout row="0" :height="statusBarHeight" class="bg-white" />

        <!-- 头部标题 -->
        <StackLayout row="1" class="bg-white p-4">
          <Label :text="headerTitle" class="text-2xl font-bold text-gray-800" />
        </StackLayout>

        <!-- 视图切换器 -->
        <GridLayout row="2" columns="*, *, *, *" class="bg-gray-100 mx-4 rounded-3xl p-1">
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
            <!-- 月视图 -->
            <StackLayout v-if="currentView === 'month' || currentView === 'week'">
              <MonthView />

              <!-- 今日信息 -->
              <GridLayout columns="*, auto" class="py-3 px-4 bg-white">
                <Label col="0" :text="todayInfo" class="text-sm text-gray-500" />
                <Label col="1" text="›" class="text-lg text-gray-500" />
              </GridLayout>

              <!-- 事件卡片 -->
              <StackLayout class="px-4">
                <!-- 示例事件卡片 -->
                <GridLayout columns="auto, *" class="bg-white rounded-2xl p-4 mb-3">
                  <StackLayout col="0" class="w-1 h-10 bg-blue-500 rounded mr-3" />
                  <StackLayout col="1" class="vertical-center">
                    <Label text="【示例】会议提醒" class="text-base font-medium text-gray-800 mb-1" />
                    <Label text="14:00 - 15:00" class="text-xs text-gray-500" />
                  </StackLayout>
                </GridLayout>
              </StackLayout>
            </StackLayout>

            <!-- 年视图 -->
            <YearView v-else-if="currentView === 'year'" @switch-to-month="switchView('month')" />

            <!-- 日程视图占位 -->
            <Label
              v-else-if="currentView === 'schedule'"
              text="日程视图开发中..."
              class="text-base text-gray-500 text-center p-12"
            />
          </StackLayout>
        </ScrollView>

        <!-- FAB 浮动按钮 -->
        <AbsoluteLayout row="4" class="h-0">
          <StackLayout class="w-14 h-14 bg-white rounded-full mr-6 -mt-20" @tap="openAddEvent">
            <Label text="+" class="text-3xl text-orange-500 text-center vertical-center" />
          </StackLayout>
        </AbsoluteLayout>

        <!-- 底部导航 -->
        <GridLayout row="5" columns="*, *" class="h-16 bg-white border-t border-gray-100">
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
      </GridLayout>
    </Page>
  </Frame>
</template>

<style scoped>
.vertical-center {
  vertical-align: center;
}
</style>
