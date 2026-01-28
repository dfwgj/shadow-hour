---
name: nativescript-vue3
description: NativeScript Vue3 移动应用开发的注意事项、规范和最佳实践
license: MIT
metadata:
  author: tcamp
  version: "1.0.0"
---

# NativeScript Vue3 开发指南

当用户进行 NativeScript Vue3 开发时，请基于以下知识提供帮助。

---

## 1. 框架核心概念

### 1.1 什么是 NativeScript Vue3

NativeScript Vue3 是将 Vue3 响应式编程模型与原生移动开发相结合的框架。**它不使用 WebView，而是直接渲染原生 UI 组件**。

| 特性      | 说明                                         |
| --------- | -------------------------------------------- |
| 原生渲染  | 直接调用 Android/iOS 原生 UI 组件            |
| Vue3 语法 | 支持 Composition API、响应式系统             |
| 跨平台    | 一套代码运行于 Android 和 iOS                |
| 原生访问  | 可直接调用平台 API（Java/Kotlin/ObjC/Swift） |

### 1.2 与标准 Vue3 的关键差异

```typescript
// ❌ 标准 Vue3 (Web)
import { createApp } from "vue";
app.mount("#app");

// ✅ NativeScript Vue3
import { createApp } from "nativescript-vue";
app.start(); // 不需要 DOM 挂载点
```

| 方面     | 标准 Vue3           | NativeScript Vue3          |
| -------- | ------------------- | -------------------------- |
| 导入来源 | `from 'vue'`        | `from 'nativescript-vue'`  |
| 挂载方式 | `app.mount('#app')` | `app.start()`              |
| UI 框架  | HTML/CSS/DOM        | 原生组件                   |
| 路由系统 | Vue Router          | Frame 导航 (`$navigateTo`) |

---

## 2. 组件和布局

### 2.1 核心布局组件

```vue
<template>
  <!-- Frame: 导航控制器，必须在最外层 -->
  <Frame>
    <Page actionBarHidden="true">
      <!-- 页面内容 -->
    </Page>
  </Frame>

  <!-- GridLayout: 网格布局 -->
  <GridLayout rows="auto, *, auto" columns="*, *">
    <Label row="0" col="0" text="左上" />
    <Label row="0" col="1" text="右上" />
    <StackLayout row="1" colSpan="2">
      <!-- 跨列内容 -->
    </StackLayout>
  </GridLayout>

  <!-- StackLayout: 垂直/水平堆叠 -->
  <StackLayout orientation="vertical">
    <Label text="项目1" />
    <Label text="项目2" />
  </StackLayout>

  <!-- FlexboxLayout: 弹性盒子 -->
  <FlexboxLayout flexDirection="row" justifyContent="space-between">
    <Label text="左" />
    <Label text="右" />
  </FlexboxLayout>
</template>
```

### 2.2 常用 UI 组件

```vue
<template>
  <!-- 文本显示 -->
  <Label text="标题" class="text-2xl font-bold" />

  <!-- 单行输入 -->
  <TextField v-model="input" hint="请输入" />

  <!-- 多行输入 -->
  <TextView v-model="content" height="100" />

  <!-- 开关 -->
  <Switch v-model="enabled" />

  <!-- 图片 -->
  <Image src="res://icon" stretch="aspectFit" />

  <!-- 滚动视图 -->
  <ScrollView>
    <StackLayout>
      <!-- 可滚动内容 -->
    </StackLayout>
  </ScrollView>

  <!-- 日期/时间选择器 -->
  <DatePicker :date="selectedDate" @dateChange="onDateChange" />
  <TimePicker :hour="hour" :minute="minute" :is24Hour="true" />
</template>
```

### 2.3 事件绑定差异

```vue
<!-- ❌ Web Vue3 -->
<button @click="handleClick">点击</button>
<input @input="handleInput" />

<!-- ✅ NativeScript Vue3 -->
<Button @tap="handleTap" text="点击" />
<TextField @textChange="handleTextChange" />
<Switch @checkedChange="handleCheckedChange" />
```

---

## 3. 导航系统

### 3.1 Frame 导航模式

NativeScript 使用基于 Frame 的页面栈导航：

```typescript
import { $navigateTo, $navigateBack } from "nativescript-vue";
import TargetPage from "./TargetPage.vue";

// 向前导航
function goToPage() {
  $navigateTo(TargetPage, {
    transition: {
      name: "slide", // slide, fade, flip, curl 等
      duration: 200
    },
    props: {
      // 传递参数
      itemId: 123
    }
  });
}

// 返回上一页
function goBack() {
  $navigateBack();
}
```

### 3.2 页面栈结构

```
Frame Stack:
┌─────────────────┐
│  DetailPage     │  ← 当前页面
├─────────────────┤
│  ListPage       │
├─────────────────┤
│  Home (root)    │
└─────────────────┘

$navigateTo() = 压入栈
$navigateBack() = 弹出栈
```

---

## 4. 样式系统

### 4.1 CSS 变量主题系统

```css
/* 浅色主题 */
.theme-light,
Page {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --primary: #0038bd;
}

/* 深色主题 */
.theme-dark {
  --bg-primary: #111827;
  --bg-secondary: #1f2937;
  --text-primary: #f9fafb;
}

/* 使用变量 */
.container {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

### 4.2 Tailwind CSS 配置

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{vue,ts,tsx}"],
  darkMode: ["class", ".ns-dark"], // NativeScript 暗黑模式
  corePlugins: {
    preflight: false // 禁用浏览器重置样式！
  }
};
```

### 4.3 样式注意事项

```vue
<template>
  <!-- ✅ 正确：使用支持的属性 -->
  <Label class="text-lg font-bold text-center" :class="isActive ? 'text-blue-500' : 'text-gray-500'" />

  <!-- ⚠️ 注意：NativeScript CSS 是子集 -->
  <!-- 不支持: hover, focus 等伪类 -->
  <!-- 不支持: 复杂选择器 -->
  <!-- 字体大小不带单位: font-size: 16 (不是 16px) -->
</template>
```

---

## 5. 平台特定代码

### 5.1 平台检测

```typescript
import { isAndroid, isIOS, Application, Device, Utils } from "@nativescript/core";

// 方式1: 布尔值检测
if (isAndroid) {
  // Android 特定代码
}

if (isIOS) {
  // iOS 特定代码
}

// 方式2: Application 对象
if (Application.android) {
  const context = Application.android.context;
  // 使用 Android Context
}
```

### 5.2 获取状态栏高度 (Android)

```typescript
import { Application, Utils, Screen } from "@nativescript/core";

function getStatusBarHeight(): number {
  if (!Application.android) return 24; // iOS 默认

  const resourceId = Utils.android
    .getApplicationContext()
    .getResources()
    .getIdentifier("status_bar_height", "dimen", "android");

  if (resourceId > 0) {
    const height = Utils.android.getApplicationContext().getResources().getDimensionPixelSize(resourceId);
    return height / Screen.mainScreen.scale;
  }
  return 24;
}
```

### 5.3 直接调用原生 API

```typescript
declare const android: any; // Android SDK 访问

// 示例：创建通知渠道
function createNotificationChannel() {
  if (!isAndroid) return;

  const sdkVersion = parseInt(Device.sdkVersion, 10);
  if (sdkVersion < 26) return; // Android 8.0+

  const context = Utils.android.getApplicationContext();
  const notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);

  const channel = new android.app.NotificationChannel(
    "my-channel",
    "我的通知",
    android.app.NotificationManager.IMPORTANCE_HIGH
  );
  channel.enableVibration(true);

  notificationManager.createNotificationChannel(channel);
}
```

---

## 6. 最佳实践

### 6.1 Composables 模式

```typescript
// composables/useCalendar.ts
import { ref, computed, onMounted, onUnmounted } from "nativescript-vue";

export function useCalendar() {
  const events = ref<CalendarEvent[]>([]);
  const selectedDate = ref(new Date());

  // 计算属性
  const todayEvents = computed(() => events.value.filter(e => isSameDay(e.date, new Date())));

  // 方法
  async function loadEvents() {
    events.value = await dbQueryEvents();
  }

  // 生命周期
  onMounted(() => {
    loadEvents();
  });

  return {
    events,
    selectedDate,
    todayEvents,
    loadEvents
  };
}
```

### 6.2 服务单例模式

```typescript
// services/notification.ts
export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async schedule(notification: Notification) {
    // 实现...
  }
}

export const notificationService = NotificationService.getInstance();
```

### 6.3 性能优化

```typescript
import { markRaw } from "nativescript-vue";

// 1. 避免不必要的响应式转换
const nativeObject = markRaw(new android.graphics.Paint());

// 2. 批量 UI 更新
import { Utils } from "@nativescript/core";
Utils.executeOnMainThread(() => {
  // 批量 UI 操作
});

// 3. 使用 Worker 处理耗时任务
const worker = new Worker("./workers/heavy-task");
worker.postMessage({ data: largeData });
```

---

## 7. 常见问题

### 7.1 组件不显示

```vue
<!-- ❌ 问题：忘记设置布局属性 -->
<GridLayout rows="auto, *">
  <Label text="标题" />  <!-- 没有指定 row -->
</GridLayout>

<!-- ✅ 正确 -->
<GridLayout rows="auto, *">
  <Label row="0" text="标题" />
  <ScrollView row="1">...</ScrollView>
</GridLayout>
```

### 7.2 样式不生效

```vue
<!-- ❌ 问题：使用了不支持的 CSS -->
<Label style="display: flex; hover: ..." />

<!-- ✅ 正确：使用 NativeScript 支持的样式 -->
<Label class="text-lg font-bold" />
```

### 7.3 双向绑定失效

```vue
<!-- ❌ 问题：使用 Web 事件 -->
<TextField @input="..." />

<!-- ✅ 正确：使用 NativeScript 事件 -->
<TextField v-model="text" @textChange="onTextChange" />
```

---

## 8. 配置文件参考

### 8.1 nativescript.config.ts

```typescript
import { NativeScriptConfig } from "@nativescript/core";

export default {
  id: "org.nativescript.myapp",
  appPath: "src",
  appResourcesPath: "App_Resources",
  android: {
    v8Flags: "--expose_gc",
    markingMode: "none"
  }
} as NativeScriptConfig;
```

### 8.2 webpack.config.js

```javascript
const webpack = require("@nativescript/webpack");

module.exports = env => {
  webpack.init(env);

  webpack.chainWebpack(config => {
    config.resolve.set("fallback", { url: false });
  });

  return webpack.resolveConfig();
};
```

---

## 回答指南

当用户询问 NativeScript Vue3 开发问题时：

1. **基础问题**: 引用上述知识点直接回答
2. **代码问题**: 检查是否使用了正确的 NativeScript 语法
3. **样式问题**: 确认使用的 CSS 属性是否被支持
4. **平台问题**: 提供平台特定的解决方案
5. **性能问题**: 建议使用 Worker 或优化响应式数据

### 常见错误检查清单

- [ ] 是否从 `nativescript-vue` 导入而非 `vue`
- [ ] 是否使用 `@tap` 而非 `@click`
- [ ] GridLayout 子元素是否指定了 row/col
- [ ] 样式单位是否正确（无 px 单位）
- [ ] 平台特定代码是否有条件判断
