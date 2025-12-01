<script lang="ts" setup>
/**
 * 日程弹窗组件
 * 支持新增和查看/编辑模式
 */
import { ref, computed, watch } from "nativescript-vue";
import type { CalendarEvent } from "~/types/calendar";

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
    }
  ): void;
}>();

// 是否为编辑模式
const isEditMode = computed(() => !!props.event);

// 弹窗标题
const modalTitle = computed(() => (isEditMode.value ? "查看日程" : "新建日程"));

// 表单数据
const summary = ref("");
const description = ref("");
const startDate = ref(new Date());
const endDate = ref(new Date());

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
      dtEnd: endDate.value
    });
  } else {
    // 新增模式：发出 submit 事件
    emit("submit", {
      summary: summary.value.trim(),
      description: description.value.trim(),
      dtStart: startDate.value,
      dtEnd: endDate.value
    });
  }
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
      <StackLayout class="bg-white rounded-2xl p-5">
        <!-- 标题栏 -->
        <GridLayout columns="auto, *, auto" class="mb-4">
          <Label col="0" text="取消" class="text-base text-gray-500" @tap="handleClose" />
          <Label col="1" :text="modalTitle" class="text-lg font-bold text-center text-gray-800" />
          <Label col="2" text="保存" class="text-base text-orange-500 font-medium" @tap="handleSubmit" />
        </GridLayout>

        <!-- 错误提示 -->
        <Label v-if="errorMessage" :text="errorMessage" class="text-sm text-red-500 mb-3 px-2" />

        <!-- 标题输入 -->
        <StackLayout class="mb-4">
          <Label text="标题" class="text-sm text-gray-500 mb-2" />
          <TextField v-model="summary" hint="请输入日程标题" class="bg-gray-100 rounded-xl p-3 text-base" />
        </StackLayout>

        <!-- 开始时间 -->
        <StackLayout class="mb-4">
          <Label text="开始时间" class="text-sm text-gray-500 mb-2" />
          <GridLayout columns="*, auto, *" class="bg-gray-100 rounded-xl p-3">
            <StackLayout col="0" @tap="openPicker('startDate')">
              <Label :text="formatDate(startDate)" class="text-base text-gray-800" />
              <Label :text="formatWeekday(startDate)" class="text-xs text-gray-500" />
            </StackLayout>
            <Label col="1" text="|" class="text-gray-300 mx-3" />
            <StackLayout col="2" @tap="openPicker('startTime')">
              <Label :text="formatTime(startDate)" class="text-xl font-medium text-gray-800" />
            </StackLayout>
          </GridLayout>
        </StackLayout>

        <!-- 结束时间 -->
        <StackLayout class="mb-4">
          <Label text="结束时间" class="text-sm text-gray-500 mb-2" />
          <GridLayout columns="*, auto, *" class="bg-gray-100 rounded-xl p-3">
            <StackLayout col="0" @tap="openPicker('endDate')">
              <Label :text="formatDate(endDate)" class="text-base text-gray-800" />
              <Label :text="formatWeekday(endDate)" class="text-xs text-gray-500" />
            </StackLayout>
            <Label col="1" text="|" class="text-gray-300 mx-3" />
            <StackLayout col="2" @tap="openPicker('endTime')">
              <Label :text="formatTime(endDate)" class="text-xl font-medium text-gray-800" />
            </StackLayout>
          </GridLayout>
        </StackLayout>

        <!-- 描述输入 -->
        <StackLayout class="mb-2">
          <Label text="备注" class="text-sm text-gray-500 mb-2" />
          <TextView
            v-model="description"
            hint="添加备注（可选）"
            class="bg-gray-100 rounded-xl p-3 text-base"
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
      <StackLayout row="1" col="0" class="bg-white rounded-t-2xl">
        <!-- 选择器标题栏 -->
        <GridLayout columns="auto, *, auto" class="p-4 border-b border-gray-100">
          <Label col="0" text="取消" class="text-base text-gray-500" @tap="closePicker" />
          <Label
            col="1"
            :text="showPicker === 'startDate' || showPicker === 'endDate' ? '选择日期' : '选择时间'"
            class="text-base font-medium text-center text-gray-800"
          />
          <Label col="2" text="确定" class="text-base text-orange-500 font-medium" @tap="confirmPicker" />
        </GridLayout>

        <!-- 日期选择器 -->
        <DatePicker
          v-if="showPicker === 'startDate' || showPicker === 'endDate'"
          :date="tempPickerDate"
          :minDate="!isEditMode && showPicker === 'startDate' ? now : undefined"
          class="p-4"
          @dateChange="onDateChange"
        />

        <!-- 时间选择器 (24小时制) -->
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
  </GridLayout>
</template>

<style scoped></style>
