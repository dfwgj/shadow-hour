<script lang="ts" setup>
/**
 * 日历头部组件 - iOS/小米风格
 * 简洁的年月标题 + 操作按钮
 */

import { useCalendar } from '../../composables/useCalendar'

const emit = defineEmits<{
  (e: 'add'): void
}>()

const {
  currentDate,
  goToPrevious,
  goToNext,
  goToToday
} = useCalendar()

// 格式化标题：2019年10月
function formatTitle(): string {
  const d = currentDate.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function onAddTap() {
  emit('add')
}
</script>

<template>
  <GridLayout columns="*, auto" class="calendar-header">
    <!-- 左侧：年月标题 -->
    <StackLayout col="0" orientation="horizontal" class="title-section">
      <Label :text="formatTitle()" class="title-text" @tap="goToToday" />
      <Label text="▼" class="dropdown-icon" />
    </StackLayout>

    <!-- 右侧：操作按钮 -->
    <StackLayout col="1" orientation="horizontal" class="action-section">
      <Label text="+" class="add-btn" @tap="onAddTap" />
      <StackLayout orientation="horizontal" class="nav-dots">
        <Label text="⊞" class="view-btn" />
      </StackLayout>
    </StackLayout>
  </GridLayout>
</template>

<style scoped>
.calendar-header {
  padding: 16 16 8 16;
  background-color: #ffffff;
}

/* 标题区域 */
.title-section {
  vertical-align: center;
}

.title-text {
  font-size: 20;
  font-weight: 600;
  color: #333333;
}

.dropdown-icon {
  font-size: 10;
  color: #999999;
  margin-left: 6;
  vertical-align: center;
}

/* 操作区域 */
.action-section {
  vertical-align: center;
}

.add-btn {
  font-size: 28;
  color: #ff4d4f;
  margin-right: 16;
  font-weight: 300;
}

.view-btn {
  font-size: 20;
  color: #ff4d4f;
}

.nav-dots {
  vertical-align: center;
}
</style>
