<script lang="ts" setup>
/**
 * 日程弹窗组件
 * 管理事件添加弹窗状态：标题、时间等
 * 提供事件添加功能：用户输入标题、选择时间等
 * @author: DF蓝梦/xierfloat
 * @date 2025-12-10
 */
import { ref, computed, watch } from "nativescript-vue";
import { useTheme } from "../composables/useTheme";
const { getBrandClass, getColor } = useTheme();

import type { CalendarEvent } from "~/types/calendar";

// 提醒时间选项
const reminderOptions = [
  { label: "日程开始时", value: 0 },
  { label: "前5分钟", value: 5 },
  { label: "前10分钟", value: 10 },
  { label: "前15分钟", value: 15 },
  { label: "前30分钟", value: 30 },
  { label: "前1小时", value: 60 },
  { label: "前2小时", value: 120 }
];

const props = defineProps<{
  visible: boolean;
  selectedDate?: Date;
  /** 查看/编辑的事件（传入则为编辑模式） */
  event?: CalendarEvent | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (
    e: "submit",
    event: {
      summary: string;
      description: string;
      dtStart: Date;
      dtEnd: Date;
      enableReminder: boolean;
      reminderMinutes: number;
    }
  ): void;
  (
    e: "update",
    event: {
      uid: string;
      summary: string;
      description: string;
      dtStart: Date;
      dtEnd: Date;
      enableReminder: boolean;
      reminderMinutes: number;
    }
  ): void;
}>();

// 是否为编辑模式
const isEditMode = computed(() => !!props.event);

// 弹窗标题
const modalTitle = computed(() => (isEditMode.value ? "查看日程" : "新建日程"));

// 当前提醒选项标签
const currentReminderLabel = computed(() => {
  const option = reminderOptions.find(o => o.value === reminderMinutes.value);
  return option ? option.label : "前10分钟";
});

// 表单数据
const summary = ref("");
const description = ref("");
const startDate = ref(new Date());
const endDate = ref(new Date());

// 推送提醒
const enableReminder = ref(true); // 默认开启
const reminderMinutes = ref(10); // 默认提前10分钟
const showReminderPicker = ref(false);

// 错误信息
const errorMessage = ref("");

// 时间选择器状态
type PickerType = "startDate" | "startTime" | "endDate" | "endTime" | null;
const showPicker = ref<PickerType>(null);
const tempPickerDate = ref(new Date());

// 当前时间（用于验证）
const now = computed(() => new Date());

// 格式化日期显示
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}年${month}月${day}日`;
}

// 格式化时间显示（24小时制）
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// 格式化星期
function formatWeekday(date: Date): string {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return weekdays[date.getDay()];
}

// 监听 visible 变化，重置表单
watch(
  () => props.visible,
  newVal => {
    if (newVal) {
      if (props.event) {
        // 编辑模式：填充事件数据
        fillEventData(props.event);
      } else {
        // 新增模式：重置表单
        resetForm();
      }
    }
  }
);

// 填充事件数据（编辑模式）
function fillEventData(event: CalendarEvent) {
  summary.value = event.summary;
  description.value = event.description || "";
  startDate.value = new Date(event.dtStart);
  endDate.value = event.dtEnd ? new Date(event.dtEnd) : new Date(event.dtStart);
  errorMessage.value = "";

  // 提醒设置：从 alarms 中获取
  if (event.alarms && event.alarms.length > 0) {
    enableReminder.value = true;
    const alarm = event.alarms[0];
    if (alarm.trigger && typeof alarm.trigger === "object" && "minutes" in alarm.trigger) {
      reminderMinutes.value = Math.abs(alarm.trigger.minutes);
    } else {
      reminderMinutes.value = 10;
    }
  } else {
    enableReminder.value = false;
    reminderMinutes.value = 10;
  }
}

// 重置表单
function resetForm() {
  const defaultDate = props.selectedDate || new Date();
  const currentHour = new Date().getHours();

  // 设置开始时间为当前时间的下一个整点
  const start = new Date(defaultDate);
  start.setHours(currentHour, 0, 0, 0);

  // 如果选择的日期是过去，则使用今天
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDay = new Date(start);
  selectedDay.setHours(0, 0, 0, 0);

  if (selectedDay < today) {
    start.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    start.setHours(currentHour, 0, 0, 0);
  }

  // 结束时间为开始时间后 1 小时
  const end = new Date(start);
  end.setHours(start.getHours() + 1);

  startDate.value = start;
  endDate.value = end;
  summary.value = "";
  description.value = "";
  errorMessage.value = "";

  // 重置提醒设置为默认值
  enableReminder.value = true;
  reminderMinutes.value = 10;
}

// 验证表单
function validate(): boolean {
  errorMessage.value = "";

  if (!summary.value.trim()) {
    errorMessage.value = "请输入日程标题";
    return false;
  }

  // 编辑模式下允许过去的时间
  if (!isEditMode.value) {
    const nowTime = new Date();
    if (startDate.value < nowTime) {
      errorMessage.value = "开始时间不能早于当前时间";
      return false;
    }
  }

  if (endDate.value <= startDate.value) {
    errorMessage.value = "结束时间必须晚于开始时间";
    return false;
  }

  return true;
}

// 提交表单
function handleSubmit() {
  if (!validate()) return;

  if (isEditMode.value && props.event) {
    // 编辑模式：发出 update 事件
    emit("update", {
      uid: props.event.uid,
      summary: summary.value.trim(),
      description: description.value.trim(),
      dtStart: startDate.value,
      dtEnd: endDate.value,
      enableReminder: enableReminder.value,
      reminderMinutes: reminderMinutes.value
    });
  } else {
    // 新增模式：发出 submit 事件
    emit("submit", {
      summary: summary.value.trim(),
      description: description.value.trim(),
      dtStart: startDate.value,
      dtEnd: endDate.value,
      enableReminder: enableReminder.value,
      reminderMinutes: reminderMinutes.value
    });
  }
}

// 选择提醒时间
function selectReminderOption(minutes: number) {
  reminderMinutes.value = minutes;
  showReminderPicker.value = false;
}

// 关闭弹窗
function handleClose() {
  emit("close");
}

// 打开选择器
function openPicker(type: PickerType) {
  if (type === "startDate" || type === "startTime") {
    tempPickerDate.value = new Date(startDate.value);
  } else {
    tempPickerDate.value = new Date(endDate.value);
  }
  showPicker.value = type;
}

// 关闭选择器
function closePicker() {
  showPicker.value = null;
}

// 确认选择器
function confirmPicker() {
  const type = showPicker.value;
  if (!type) return;

  if (type === "startDate" || type === "startTime") {
    // 新增模式下验证不能选择过去的时间
    if (!isEditMode.value) {
      const nowTime = new Date();
      if (tempPickerDate.value < nowTime) {
        errorMessage.value = "不能选择过去的时间";
        closePicker();
        return;
      }
    }

    startDate.value = new Date(tempPickerDate.value);
    errorMessage.value = "";

    // 自动调整结束时间
    if (endDate.value <= startDate.value) {
      const newEnd = new Date(startDate.value);
      newEnd.setHours(startDate.value.getHours() + 1);
      endDate.value = newEnd;
    }
  } else {
    // 验证结束时间必须晚于开始时间
    if (tempPickerDate.value <= startDate.value) {
      errorMessage.value = "结束时间必须晚于开始时间";
      closePicker();
      return;
    }

    endDate.value = new Date(tempPickerDate.value);
    errorMessage.value = "";
  }

  closePicker();
}

// 处理日期变化
function onDateChange(args: any) {
  const picker = args.object;
  tempPickerDate.value.setFullYear(picker.year, picker.month - 1, picker.day);
}

// 处理时间变化
function onTimeChange(args: any) {
  const picker = args.object;
  tempPickerDate.value.setHours(picker.hour, picker.minute, 0, 0);
}
</script>
<template>
  <GridLayout v-if="visible" rows="*" columns="*">
    <!-- 背景遮罩 (全屏) -->
    <StackLayout row="0" col="0" class="bg-black opacity-50" @tap="handleClose" />
    <!-- 弹窗内容 -->
    <ScrollView row="0" col="0" verticalAlignment="center" class="mx-4">
      <StackLayout class="bg-theme-card rounded-2xl p-5">
        <!-- 标题栏 -->
        <GridLayout columns="auto, *, auto" class="mb-4">
          <Label col="0" text="取消" class="text-base text-theme-secondary" @tap="handleClose" />
          <Label col="1" :text="modalTitle" class="text-lg font-bold text-center text-theme-primary" />
          <Label col="2" text="保存" class="text-base font-medium" :class="getBrandClass('text')" @tap="handleSubmit" />
        </GridLayout>

        <!-- 错误提示 -->
        <Label v-if="errorMessage" :text="errorMessage" class="text-lg text-theme-error mb-3 px-2" />

        <!-- 标题输入 -->
        <StackLayout class="mb-4">
          <Label text="标题" class="text-sm text-theme-secondary mb-2" />
          <TextField
            v-model="summary"
            hint="请输入日程标题"
            class="bg-theme-secondary rounded-xl p-3 text-base text-theme-primary"
          />
        </StackLayout>

        <!-- 开始时间 -->
        <StackLayout class="mb-4">
          <Label text="开始时间" class="text-sm text-theme-secondary mb-2" />
          <GridLayout columns="*, auto, *" class="bg-theme-secondary rounded-xl p-3">
            <StackLayout col="0" @tap="openPicker('startDate')">
              <Label :text="formatDate(startDate)" class="text-base text-theme-primary" />
              <Label :text="formatWeekday(startDate)" class="text-xs text-theme-secondary" />
            </StackLayout>
            <Label col="1" text="|" class="text-theme-tertiary mx-3" />
            <StackLayout col="2" @tap="openPicker('startTime')">
              <Label :text="formatTime(startDate)" class="text-xl font-medium text-theme-primary" />
            </StackLayout>
          </GridLayout>
        </StackLayout>

        <!-- 结束时间 -->
        <StackLayout class="mb-4">
          <Label text="结束时间" class="text-sm text-theme-secondary mb-2" />
          <GridLayout columns="*, auto, *" class="bg-theme-secondary rounded-xl p-3">
            <StackLayout col="0" @tap="openPicker('endDate')">
              <Label :text="formatDate(endDate)" class="text-base text-theme-primary" />
              <Label :text="formatWeekday(endDate)" class="text-xs text-theme-secondary" />
            </StackLayout>
            <Label col="1" text="|" class="text-theme-tertiary mx-3" />
            <StackLayout col="2" @tap="openPicker('endTime')">
              <Label :text="formatTime(endDate)" class="text-xl font-medium text-theme-primary" />
            </StackLayout>
          </GridLayout>
        </StackLayout>

        <!-- 提醒设置 -->
        <StackLayout class="mb-4">
          <Label text="提醒" class="text-sm text-theme-secondary mb-2" />
          <GridLayout columns="auto, *, auto" class="bg-theme-secondary rounded-xl p-3">
            <Label col="0" text="开启提醒" class="text-base" />
            <Switch col="2" v-model="enableReminder" :color="getColor('primary')" />
          </GridLayout>
          <!-- 提醒时间选择（仅在开启时显示） -->
          <GridLayout
            v-if="enableReminder"
            columns="*, auto"
            class="bg-theme-secondary rounded-xl p-3 mt-2"
            @tap="showReminderPicker = true"
          >
            <Label col="0" text="提前提醒" class="text-base text-theme-primary" />
            <Label col="1" :text="currentReminderLabel" class="text-base font-medium" :class="getBrandClass('text')" />
          </GridLayout>
        </StackLayout>

        <!-- 描述输入 -->
        <StackLayout class="mb-2">
          <Label text="备注" class="text-sm text-theme-secondary mb-2" />
          <TextView
            v-model="description"
            hint="添加备注（可选）"
            class="bg-theme-secondary rounded-xl p-3 text-base text-theme-primary"
            height="80"
          />
        </StackLayout>
      </StackLayout>
    </ScrollView>

    <!-- 底部选择器弹窗 -->
    <GridLayout v-if="showPicker" row="0" col="0" rows="*, auto" columns="*">
      <!-- 选择器遮罩 -->
      <StackLayout row="0" rowSpan="2" col="0" class="bg-black opacity-30" @tap="closePicker" />
      <!-- 选择器内容 -->
      <StackLayout row="1" col="0" class="bg-theme-card rounded-t-2xl">
        <!-- 选择器标题栏 -->
        <GridLayout columns="auto, *, auto" class="p-4 border-b border-theme-light">
          <Label col="0" text="取消" class="text-base text-theme-secondary" @tap="closePicker" />
          <Label
            col="1"
            :text="showPicker === 'startDate' || showPicker === 'endDate' ? '选择日期' : '选择时间'"
            class="text-base font-medium text-center text-theme-primary"
          />
          <Label col="2" text="确定" class="text-base text-theme-brand font-medium" @tap="confirmPicker" />
        </GridLayout>

        <!-- 日期选择器 -->
        <DatePicker
          v-if="showPicker === 'startDate' || showPicker === 'endDate'"
          :date="tempPickerDate"
          :minDate="!isEditMode && showPicker === 'startDate' ? now : undefined"
          class="p-4"
          @dateChange="onDateChange"
        />

        <!-- 时间选择器 -->
        <TimePicker
          v-if="showPicker === 'startTime' || showPicker === 'endTime'"
          :hour="tempPickerDate.getHours()"
          :minute="tempPickerDate.getMinutes()"
          :is24Hour="true"
          class="p-4"
          @timeChange="onTimeChange"
        />
      </StackLayout>
    </GridLayout>

    <!-- 提醒时间选择器弹窗 -->
    <GridLayout v-if="showReminderPicker" row="0" col="0" rows="*, auto" columns="*">
      <!-- 选择器遮罩 -->
      <StackLayout row="0" rowSpan="2" col="0" class="bg-black opacity-30" @tap="showReminderPicker = false" />
      <!-- 选择器内容 -->
      <StackLayout row="1" col="0" class="bg-theme-card rounded-t-2xl">
        <!-- 选择器标题栏 -->
        <GridLayout columns="auto, *, auto" class="p-4 border-b border-theme-light">
          <Label col="0" text="取消" class="text-base text-theme-secondary" @tap="showReminderPicker = false" />
          <Label col="1" text="选择提醒时间" class="text-base font-medium text-center text-theme-primary" />
          <Label col="2" text="" />
        </GridLayout>

        <!-- 提醒选项列表 -->
        <ScrollView height="300">
          <StackLayout class="p-2">
            <StackLayout
              v-for="option in reminderOptions"
              :key="option.value"
              class="p-4 border-b border-theme-light"
              @tap="selectReminderOption(option.value)"
            >
              <GridLayout columns="*, auto">
                <Label col="0" :text="option.label" class="text-base text-theme-primary" />
                <Label v-if="reminderMinutes === option.value" col="1" text="✓" class="text-theme-brand text-lg" />
              </GridLayout>
            </StackLayout>
          </StackLayout>
        </ScrollView>
      </StackLayout>
    </GridLayout>
  </GridLayout>
</template>

<style scoped></style>
