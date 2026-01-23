# NativeScript Vue3 框架深度解析

> 本文档深入分析 NativeScript Vue3 在本项目中的应用，涵盖框架原理、配置、组件开发和平台适配等核心内容。

## 目录

1. [框架概述](#1-框架概述)
2. [与标准 Vue3 的差异](#2-与标准-vue3-的差异)
3. [配置文件详解](#3-配置文件详解)
4. [原生组件注册与使用](#4-原生组件注册与使用)
5. [应用入口与初始化](#5-应用入口与初始化)
6. [路由与导航](#6-路由与导航)
7. [Tailwind CSS 样式系统](#7-tailwind-css-样式系统)
8. [平台特定代码模式](#8-平台特定代码模式)
9. [高级开发模式](#9-高级开发模式)

---

## 1. 框架概述

NativeScript Vue3 是一个将 Vue3 响应式编程模型与原生移动开发相结合的框架。它不使用 WebView，而是直接渲染原生 UI 组件，从而获得接近原生应用的性能。

### 核心特点

| 特性      | 说明                                         |
| --------- | -------------------------------------------- |
| 原生渲染  | 直接调用 Android/iOS 原生 UI 组件            |
| Vue3 语法 | 支持 Composition API、响应式系统             |
| 跨平台    | 一套代码运行于 Android 和 iOS                |
| 原生访问  | 可直接调用平台 API（Java/Kotlin/ObjC/Swift） |

---

## 2. 与标准 Vue3 的差异

### 2.1 导入方式

**标准 Vue3 (Web)**

```typescript
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);
app.mount("#app");
```

**NativeScript Vue3**

```typescript
// apps/mobile/src/app.ts
import { createApp } from "nativescript-vue";
import Home from "./pages/Home.vue";

const app = createApp(Home);
app.start(); // 不需要 DOM 挂载点
```

### 2.2 核心差异对比

| 方面     | 标准 Vue3            | NativeScript Vue3                   |
| -------- | -------------------- | ----------------------------------- |
| 导入来源 | `from 'vue'`         | `from 'nativescript-vue'`           |
| 挂载方式 | `app.mount('#app')`  | `app.start()`                       |
| UI 框架  | HTML/CSS/DOM         | 原生组件                            |
| 路由系统 | Vue Router           | Frame 导航 (`$navigateTo`)          |
| 样式系统 | CSS/Tailwind         | Tailwind + CSS 变量                 |
| 数据库   | 任意 JS 数据库       | SQLite                              |
| 通知     | Web Notification API | `@nativescript/local-notifications` |

### 2.3 生命周期钩子

NativeScript Vue3 支持标准 Vue3 生命周期钩子，但有一些平台特定的考虑：

```typescript
import { onMounted, onUnmounted } from "nativescript-vue";

onMounted(async () => {
  // 初始化数据库
  await init();

  // 获取 Android 状态栏高度（平台特定代码）
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

onUnmounted(() => {
  destroyTheme(); // 清理定时器
});
```

---

## 3. 配置文件详解

### 3.1 nativescript.config.ts

```typescript
// apps/mobile/nativescript.config.ts
import { NativeScriptConfig } from "@nativescript/core";

export default {
  id: "org.nativescript.shadowHour", // 应用包名
  appPath: "src", // 源码目录
  appResourcesPath: "App_Resources", // 原生资源目录
  android: {
    v8Flags: "--expose_gc", // 启用垃圾回收控制
    markingMode: "none" // GC 标记模式优化
  }
} as NativeScriptConfig;
```

**配置说明：**

- `id`: Android 和 iOS 的包名标识
- `appPath`: 源代码目录
- `appResourcesPath`: 存放原生资源（图标、AndroidManifest.xml 等）
- `v8Flags`: V8 引擎优化标志

### 3.2 tailwind.config.js

```javascript
// apps/mobile/tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{css,xml,html,vue,svelte,ts,tsx}",
    "../../packages/nativeScript-ui/src/**/*.{css,xml,html,vue,svelte,ts,tsx}"
  ],
  darkMode: ["class", ".ns-dark"], // NativeScript 暗黑模式
  theme: {
    extend: {}
  },
  plugins: [],
  corePlugins: {
    preflight: false // 禁用浏览器重置样式
  }
};
```

**关键配置：**

- `content`: 扫描 Vue 模板和 XML 布局
- `darkMode`: 使用 `.ns-dark` 类（而非 CSS 媒体查询）
- `preflight: false`: 禁用浏览器特定的样式重置

### 3.3 webpack.config.js

```javascript
// apps/mobile/webpack.config.js
const webpack = require("@nativescript/webpack");

module.exports = env => {
  webpack.init(env);

  webpack.chainWebpack(config => {
    // 禁用 Node.js polyfills
    config.resolve.set("fallback", { url: false });

    // 修复 Vue 3 热更新
    if (env.hmr) {
      config.module
        .rule("vue")
        .use("vue-loader")
        .tap(options => ({
          ...options,
          isServerBuild: false
        }));
    }
  });

  return webpack.resolveConfig();
};
```

---

## 4. 原生组件注册与使用

### 4.1 NativeScript 内置组件

```vue
<template>
  <!-- Frame: 导航控制器 -->
  <Frame>
    <Page actionBarHidden="true">
      <!-- 页面内容 -->
    </Page>
  </Frame>

  <!-- 布局组件 -->
  <GridLayout rows="auto, auto, *, auto" columns="*, *">
    <StackLayout row="0" col="0">
      <!-- 垂直堆叠子元素 -->
    </StackLayout>
    <FlexboxLayout row="1" orientation="horizontal">
      <!-- 弹性盒子布局 -->
    </FlexboxLayout>
  </GridLayout>

  <!-- 输入组件 -->
  <Label text="标题" class="text-2xl font-bold" />
  <TextField v-model="input" hint="输入文本" />
  <TextView v-model="description" height="80" />
  <Switch v-model="enableReminder" />
  <DatePicker :date="tempPickerDate" @dateChange="onDateChange" />
  <TimePicker :hour="hour" :minute="minute" :is24Hour="true" />

  <!-- 滚动视图 -->
  <ScrollView verticalAlignment="center">
    <StackLayout>
      <!-- 可滚动内容 -->
    </StackLayout>
  </ScrollView>
</template>
```

### 4.2 自定义原生组件注册

```typescript
// apps/mobile/src/app.ts
import { createApp } from "nativescript-vue";
import { Video } from "@nstudio/nativescript-exoplayer";
import Home from "./pages/Home.vue";

const app = createApp(Home);

// 注册自定义原生组件
app.registerElement("VideoPlayer", () => Video);

app.start();
```

**在模板中使用：**

```vue
<VideoPlayer
  row="0"
  col="0"
  src="~/assets/videos/cycle.mp4"
  autoplay="true"
  loop="true"
  muted="true"
  controls="false"
  stretch="aspectFill"
/>
```

### 4.3 第三方组件库

```typescript
// 从 monorepo 导入组件库
import {
  MonthView,
  YearView,
  WeekView,
  EventCard,
  Toast,
  ToastContainer,
  WeekScheduleGrid
} from "@xierfloat-monorepo/nativeScript-ui";

// 在模板中使用
<MonthView
  ref="monthViewRef"
  :year="currentDate.getFullYear()"
  :month="currentDate.getMonth()"
  :selected-date="selectedDate"
  :first-day-of-week="firstDayOfWeek"
  :show-lunar="showLunar"
  :color="getColor('primary')"
  @select="onDateSelect"
  @swipe="onSwipe"
/>

// Toast 通知
Toast.success("操作成功");
Toast.error("操作失败");
```

---

## 5. 应用入口与初始化

### 5.1 入口文件流程

```typescript
// apps/mobile/src/app.ts
import { createApp } from "nativescript-vue";
import { Video } from "@nstudio/nativescript-exoplayer";
import Home from "./pages/Home.vue";

// 1. 创建应用实例
const app = createApp(Home);

// 2. 注册原生元素
app.registerElement("VideoPlayer", () => Video);

// 3. 启动应用（渲染 Home 组件）
app.start();
```

### 5.2 页面初始化逻辑

```typescript
// Home.vue
onMounted(async () => {
  // 1. 初始化数据库和日历系统
  await init(); // useCalendar composable

  // 2. 获取平台特定信息（Android 状态栏）
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

  // 3. 加载事件数据
  await getEvents();

  // 4. 请求通知权限
  const hasPermission = await notificationService.requestPermission();

  // 5. 初始化主题（午夜检查）
  initTheme();
});
```

---

## 6. 路由与导航

### 6.1 Frame 导航模式

NativeScript 使用基于 Frame 的导航而非传统路由：

```typescript
import AIChat from "./AIChat.vue";
import AIConfig from "./AIConfig.vue";
import { $navigateTo, $navigateBack } from "nativescript-vue";

// 向前导航
function navigateToAIChat() {
  $navigateTo(AIChat, {
    transition: {
      name: "slide",
      duration: 200
    }
  });
}

// 返回上一页
function goBack() {
  $navigateBack();
}
```

### 6.2 页面栈结构

```
Frame Stack:
┌─────────────────┐
│  AIConfig       │  ← 当前页面
├─────────────────┤
│  AIChat         │
├─────────────────┤
│  Home (root)    │
└─────────────────┘

$navigateTo() = 压入栈
$navigateBack() = 弹出栈
```

---

## 7. Tailwind CSS 样式系统

### 7.1 全局主题系统

```css
/* apps/mobile/src/app.css */

/* 浅色主题（默认） */
.theme-light,
Page {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --primary: #0038bd;
  --primary-light: #01daff;
}

/* 深色主题 */
.theme-dark {
  --bg-primary: #111827;
  --bg-secondary: #1f2937;
  --text-primary: #f9fafb;
  --primary: #0038bd;
}

/* 主题工具类 */
.bg-theme-primary {
  background-color: var(--bg-primary);
}
.text-theme-primary {
  color: var(--text-primary);
}
.text-theme-brand {
  color: var(--primary);
}

/* 字体大小 */
.text-xs {
  font-size: 10;
}
.text-sm {
  font-size: 12;
}
.text-base {
  font-size: 14;
}
.text-lg {
  font-size: 16;
}
.text-xl {
  font-size: 18;
}
.text-2xl {
  font-size: 20;
}
.text-3xl {
  font-size: 24;
}
```

### 7.2 组件中使用样式

```vue
<template>
  <Label :text="headerTitle" class="text-2xl font-bold text-theme-primary" />

  <GridLayout columns="*, *, *, *" class="bg-theme-secondary mx-4 rounded-3xl p-1 mt-2">
    <Label
      :text="tab.label"
      :class="[
        'text-center py-2 text-sm text-theme-primary rounded-2xl',
        currentView === tab.type ? 'bg-theme-card font-medium' : ''
      ]"
    />
  </GridLayout>
</template>
```

### 7.3 动态主题切换

```typescript
// composables/useTheme.ts
import { ref, computed } from "nativescript-vue";
import { Application } from "@nativescript/core";

export function useTheme() {
  const getColor = (colorKey: string): string => {
    // 午夜特殊颜色
    if (isBeijingMidnight() && colorKey === "primary") {
      return "#116E15"; // 绿色
    }
    return getCssVariable(cssVarMap[colorKey], defaultColors[colorKey]);
  };

  const setTheme = (theme: "light" | "dark") => {
    const rootView = Application.getRootView();
    if (rootView) {
      rootView.className = `theme-${theme}`;
    }
  };

  // 午夜检查（北京时间 00:00-01:00）
  const initTheme = () => {
    applyMidnightColors();
    setInterval(() => applyMidnightColors(), 60000);
  };

  return { getColor, setTheme, initTheme };
}
```

---

## 8. 平台特定代码模式

### 8.1 Android/iOS 检测

```typescript
import { isAndroid, Device, Utils, Application } from "@nativescript/core";

declare const android: any; // Android SDK 访问

function createNotificationChannel(): void {
  if (!isAndroid) return; // 仅在 Android 上执行

  try {
    const sdkVersion = parseInt(Device.sdkVersion, 10);
    if (sdkVersion >= 26) {
      // Android 8.0+
      const context = Utils.android.getApplicationContext();
      const notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);

      const channel = new android.app.NotificationChannel(
        "calendar-reminder",
        "日程提醒",
        android.app.NotificationManager.IMPORTANCE_HIGH
      );
      channel.enableVibration(true);
      channel.enableLights(true);

      notificationManager.createNotificationChannel(channel);
    }
  } catch (error) {
    console.error("创建通知渠道失败:", error);
  }
}
```

### 8.2 Android Context 访问

```typescript
function getDatabasePath(): string {
  if (Application.android) {
    // Android: /data/data/<package>/databases/calendar.db
    const context = Application.android.context;
    return context.getDatabasePath("calendar.db").getAbsolutePath();
  } else {
    // iOS: Documents 文件夹
    return path.join(knownFolders.documents().path, "calendar.db");
  }
}
```

### 8.3 电池优化与权限

```typescript
// 检查电池优化状态
isIgnoringBatteryOptimizations(): boolean {
  if (!isAndroid) return true;

  try {
    const sdkVersion = parseInt(Device.sdkVersion, 10);
    if (sdkVersion < 23) return true;  // Android 6.0 以下

    const context = Utils.android.getApplicationContext();
    const powerManager = context.getSystemService(
      android.content.Context.POWER_SERVICE
    );
    const packageName = context.getPackageName();

    return powerManager.isIgnoringBatteryOptimizations(packageName);
  } catch (error) {
    return false;
  }
}

// 请求忽略电池优化
requestIgnoreBatteryOptimizations(): void {
  if (!isAndroid) return;

  const context = Utils.android.getApplicationContext();
  const intent = new android.content.Intent();
  intent.setAction(
    android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
  );
  intent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
  intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);

  context.startActivity(intent);
}
```

### 8.4 精确闹钟权限（Android 12+）

```typescript
canScheduleExactAlarms(): boolean {
  if (!isAndroid) return true;

  try {
    const sdkVersion = parseInt(Device.sdkVersion, 10);
    if (sdkVersion < 31) return true;  // Android 12 以下

    const context = Utils.android.getApplicationContext();
    const alarmManager = context.getSystemService(
      android.content.Context.ALARM_SERVICE
    );
    return alarmManager.canScheduleExactAlarms();
  } catch (error) {
    return false;
  }
}
```

---

## 9. 高级开发模式

### 9.1 Composables（Vue 3 风格）

```typescript
// composables/useCalendar.ts
import { ref, computed } from "nativescript-vue";

export function useCalendar() {
  // 状态
  const currentDate = ref(new Date());
  const selectedDate = ref(new Date());
  const events = ref<CalendarEvent[]>([]);

  // 计算属性
  const monthTitle = computed(() => getMonthName(currentDate.value));

  // 方法
  async function init() {
    await initDatabase();
    await loadAllEvents();
  }

  async function addEvent(event: Omit<CalendarEvent, "uid">) {
    const newEvent = await dbAddEvent(event);
    events.value.push(newEvent);
    return newEvent;
  }

  return {
    currentDate,
    selectedDate,
    events,
    monthTitle,
    init,
    addEvent
  };
}
```

### 9.2 服务类（单例模式）

```typescript
// services/notification.ts
export class NotificationService {
  private static instance: NotificationService;
  private hasPermission: boolean = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermission(): Promise<boolean> {
    // 实现...
  }
}

export const notificationService = NotificationService.getInstance();
```

### 9.3 流式数据处理（AI 聊天）

```typescript
// AIChat.vue
const { controller, promise } = streamRequest(
  {
    url: API_URL,
    method: "POST",
    headers: {
      /* ... */
    },
    body: requestBody
  },
  {
    onData: chunk => {
      const line = chunk.trim();
      if (line.startsWith("data:")) {
        const data = line.slice(6).trim();
        const parsed = JSON.parse(data);

        if (parsed.type === "content_block_delta") {
          if (parsed.delta?.type === "text_delta") {
            fullContent += parsed.delta.text;
            streamingText.value = fullContent;
          }
        }
      }
    },
    onError: error => {
      /* 错误处理 */
    },
    onComplete: () => {
      /* 完成处理 */
    }
  }
);

streamController.value = controller; // 保存用于中止
```

### 9.4 数据库层

```typescript
// database/core.ts
async init(): Promise<void> {
  if (this.initialized) return;

  try {
    const sqliteModule = await import("@nativescript-community/sqlite");
    SQLite = sqliteModule;

    const dbPath = this.getDatabasePath();
    db = await SQLite.openOrCreate(dbPath);

    await this.createTables();
    this.initialized = true;
  } catch (error) {
    console.error("数据库初始化失败:", error);
    throw error;
  }
}

private async createTables(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE NOT NULL,
      summary TEXT NOT NULL,
      description TEXT,
      dt_start INTEGER NOT NULL,
      dt_end INTEGER,
      status TEXT DEFAULT 'CONFIRMED',
      created INTEGER,
      last_modified INTEGER
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_events_dt_start ON events(dt_start)
  `);
}
```

---

## 总结

NativeScript Vue3 为移动应用开发提供了一个强大的框架，结合了 Vue3 的响应式编程模型和原生移动平台的能力。本项目展示了以下最佳实践：

1. **合理的项目结构**：monorepo 架构分离 UI 组件库、AI 模块和应用代码
2. **主题系统**：基于 CSS 变量的动态主题切换，支持午夜特殊主题
3. **平台适配**：通过 `isAndroid`/`Application.android` 处理平台差异
4. **组件化开发**：可复用的 composables 和组件库
5. **性能优化**：Worker 线程处理 HTTP 流、V8 引擎优化

这种架构使得代码具有良好的可维护性和扩展性，同时保持了接近原生应用的性能体验。
