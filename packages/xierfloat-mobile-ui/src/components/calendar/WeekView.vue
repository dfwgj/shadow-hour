<script setup lang="ts">
/**
 * WeekView - 周视图组件
 * 显示当前周的日期
 * @author xierfloat
 * @Date 2025-12-2
 */
import { DateCell, WeekDay } from "@/types/calendar";
import { computed, PropType, ref } from "nativescript-vue";
import { type TouchGestureEventData, CoreTypes, Screen } from "@nativescript/core";
import { generateWeekGrid, getWeekDayNames } from "../../utils/date";
import { getLunarDayText, isSpecialDay } from "../../utils/lunar";
//Props 定义
const props = defineProps({
  // 定义属性
  // 月份（0-11）
  month: {
    type: Number,
    default: () => new Date().getMonth()
  },
  // 今天的日期
  today: {
    type: Date,
    default: () => new Date()
  },
  // 选中的日期
  selectedDate: {
    type: Date,
    default: () => null
  },
  // 每周的第一天（默认周一）
  firstDayOfWeek: {
    type: String as PropType<WeekDay>,
    default: () => "MO"
  },
  // 是否显示农历
  showLunar: {
    type: Boolean,
    default: () => true
  },
  // 是否显示超出月份范围的日期（默认显示）
  showOutsideDays: {
    type: Boolean,
    default: () => true
  },
  // 选中日期的颜色（默认橙色）
  color: {
    type: String,
    default: () => "#F97316"
  }
});
// Emits 定义
const emit = defineEmits<{
  /** 点击某天时触发 */
  (e: "select", date: Date): void;
  /** 左右滑动切换周 */
  (e: "swipe", direction: "left" | "right"): void;
}>();
// 处理 touch 手势实现左右滑动
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchActive = ref(false);
const MIN_SWIPE_DISTANCE = 30;

function onTouch(args: TouchGestureEventData) {
  if (args.action === "down") {
    touchStartX.value = args.getX();
    touchStartY.value = args.getY();
    touchActive.value = true;
  } else if (args.action === "cancel" && touchActive.value) {
    // ScrollView 接管时会触发 cancel，此时判断是否为水平滑动
    const deltaX = args.getX() - touchStartX.value;
    const deltaY = args.getY() - touchStartY.value;
    touchActive.value = false;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
      emit("swipe", deltaX < 0 ? "left" : "right");
    }
  } else if (args.action === "up" && touchActive.value) {
    const deltaX = args.getX() - touchStartX.value;
    const deltaY = args.getY() - touchStartY.value;
    touchActive.value = false;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
      emit("swipe", deltaX < 0 ? "left" : "right");
    }
  }
}
// 星期标题
const weekDayNames = computed(() => getWeekDayNames(props.firstDayOfWeek));

// 周视图数据
const weekGrid = computed(() =>
  generateWeekGrid(props.month, props.selectedDate, props.firstDayOfWeek, props.showLunar)
);
// 获取农历显示文本
function getLunarText(cell: DateCell): string {
  if (!cell.lunar) return "";
  return getLunarDayText(cell.lunar);
}
// 判断是否是特殊日期（节气或节日）
function checkIsSpecialDay(cell: DateCell): boolean {
  if (!cell.lunar) return false;
  return isSpecialDay(cell.lunar);
}

// 处理日期点击
function onDateTap(cell: DateCell) {
  emit("select", cell.date);
}

// 判断是否应该显示该日期
function shouldShowDay(cell: DateCell): boolean {
  return props.showOutsideDays || cell.isCurrentMonth;
}

// 动画相关
const contentRef = ref();
const screenWidth = Screen.mainScreen.widthDIPs;
const isAnimating = ref(false);

// 播放完整的滑动动画（退出 + 进入）
async function playSlideAnimation(direction: "left" | "right", onMiddle?: () => void): Promise<void> {
  const view = contentRef.value?.nativeView;
  if (!view || isAnimating.value) return;

  isAnimating.value = true;

  // 退出方向：向左滑则当前内容向左退出，向右滑则向右退出
  const exitX = direction === "left" ? -screenWidth * 0.3 : screenWidth * 0.3;
  const enterX = direction === "left" ? screenWidth * 0.3 : -screenWidth * 0.3;
  const duration = 150;

  // 第一阶段：退出动画
  await view.animate({
    translate: { x: exitX, y: 0 },
    opacity: 0,
    duration,
    curve: CoreTypes.AnimationCurve.easeIn
  });

  // 中间回调：更新数据
  onMiddle?.();

  // 设置进入起始位置
  view.translateX = enterX;

  // 第二阶段：进入动画
  await view.animate({
    translate: { x: 0, y: 0 },
    opacity: 1,
    duration,
    curve: CoreTypes.AnimationCurve.easeOut
  });

  isAnimating.value = false;
}

// 暴露方法给父组件调用
defineExpose({
  playSlideAnimation
});
</script>

<template>
  <StackLayout ref="contentRef" class="bg-white rounded-2xl flex" @touch="onTouch">
    <!-- 星期标题行（左侧空白 + 7列星期） -->
    <GridLayout columns="24, *, *, *, *, *, *, *" class="pt-4 px-2 pb-2">
      <Label col="0" text="" />
      <Label
        v-for="(name, index) in weekDayNames"
        :key="index"
        :col="index + 1"
        :text="name"
        class="text-center text-xs text-gray-500"
      />
    </GridLayout>

    <!-- 日期网格（左侧周数 + 7列日期） -->
    <StackLayout class="px-2">
      <GridLayout v-for="week in weekGrid" :key="week.weekNumber" columns="24, *, *, *, *, *, *, *" class="h-14 mb-2">
        <!-- 左侧周数 -->
        <StackLayout col="0" class="border-r border-gray-400" verticalAlignment="center">
          <Label :text="week.weekNumber.toString()" class="text-xs text-gray-400 text-center" />
          <Label text="周" class="text-xs text-gray-400 text-center" style="margin-top: -2" />
        </StackLayout>

        <!-- 日期单元格 -->
        <StackLayout
          v-for="(cell, dayIndex) in week.days"
          :key="dayIndex"
          :col="dayIndex + 1"
          :class="['items-center justify-center rounded-2xl']"
          :style="{
            backgroundColor: cell.isToday ? props.color : '',
            borderWidth: cell.isSelected ? 1 : 0,
            borderColor: cell.isSelected ? props.color : 'transparent'
          }"
          @tap="onDateTap(cell)"
        >
          <!-- 日期数字 -->
          <Label
            v-if="shouldShowDay(cell)"
            :text="cell.day.toString()"
            :class="[
              'text-lg font-medium text-center mb-0.5',
              !cell.isCurrentMonth ? 'opacity-30' : '',
              cell.isToday ? 'text-white' : 'text-gray-800'
            ]"
          />
          <!-- 农历日期 -->
          <Label
            v-if="showLunar && shouldShowDay(cell)"
            :text="getLunarText(cell)"
            :class="['text-xs text-center', !cell.isCurrentMonth ? 'opacity-30' : '']"
            :style="{
              color: cell.isToday ? 'white' : checkIsSpecialDay(cell) && cell.isCurrentMonth ? props.color : '#1f2937'
            }"
          />
        </StackLayout>
      </GridLayout>
    </StackLayout>
  </StackLayout>
</template>

<style scoped lang="less">
/* 样式代码 */
</style>
