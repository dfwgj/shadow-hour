# NativeScript 流式 HTTP 实现方案

## 概述

本文档记录了为 NativeScript Vue 移动应用实现流式 HTTP 请求的完整过程，包括遇到的问题、尝试的方案以及最终解决方案。

## 背景

### 需求

AI 对话功能需要支持流式输出（Server-Sent Events），让用户能够实时看到 AI 的回复，而不是等待完整响应后才显示。

### 问题

NativeScript 的 `fetch` API 不支持流式读取：

```typescript
// 这在 NativeScript 中不工作
const response = await fetch(url, options);
const reader = response.body.getReader(); // body 为 null 或不支持 getReader()
```

## 解决方案演进

### 方案一：直接使用 Java 线程 ❌

**尝试**：使用 `java.lang.Thread` + `java.lang.Runnable` 在后台线程执行网络请求。

```typescript
const runnable = new java.lang.Runnable({
  run: () => {
    // 网络请求代码
  }
});
new java.lang.Thread(runnable).start();
```

**结果**：`android.os.NetworkOnMainThreadException`

**原因**：NativeScript 的 JavaScript 引擎（V8）只在主线程运行。当 Java 后台线程调用 JavaScript 回调时，NativeScript 必须将调用 **转发回主线程** 执行，因为 V8 不是线程安全的。

```
Java 后台线程
    ↓ 调用 JS 回调
NativeScript Bridge
    ↓ 转发到主线程
主线程执行 JS 代码（包含网络请求）
    ↓
NetworkOnMainThreadException ❌
```

### 方案二：使用 AsyncTask ❌

**尝试**：使用 `android.os.AsyncTask`。

**结果**：同样失败，原因相同。

### 方案三：使用 OkHttp ❌

**尝试**：使用 OkHttp 的异步回调 `call.enqueue()`。

```typescript
const OkHttpCallback = okhttp3.Callback.extend({
  onResponse(call, response) {
    // 处理响应
  }
});
call.enqueue(new OkHttpCallback());
```

**结果**：`ReferenceError: okhttp3 is not defined`

**原因**：OkHttp 没有包含在 NativeScript 默认依赖中，需要额外配置。

### 方案四：NativeScript Worker ✅

**最终方案**：使用 NativeScript Worker，它在独立的 V8 实例中运行，真正实现后台线程执行。

## 最终架构

```
┌─────────────────────────────────────────────────────────────┐
│                        主线程 (Main Thread)                   │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐   │
│  │  AIChat.vue │───▶│ stream.android│───▶│ postMessage() │   │
│  │             │◀───│     .ts       │◀───│               │   │
│  └─────────────┘    └──────────────┘    └───────────────┘   │
│         │                  │                    ▲            │
│         ▼                  ▼                    │            │
│    更新 UI            管理请求              接收消息          │
└─────────────────────────────────────────────────────────────┘
                              │
                    Worker 消息通道
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Worker 线程 (独立 V8)                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   http-worker.ts                     │    │
│  │  ┌───────────────┐  ┌──────────────┐  ┌──────────┐  │    │
│  │  │ java.net.URL  │─▶│ BufferedReader│─▶│ 逐行读取 │  │    │
│  │  │ HttpURLConn.  │  │              │  │ postMsg  │  │    │
│  │  └───────────────┘  └──────────────┘  └──────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 核心代码

### 1. Worker 文件 (`http-worker.ts`)

```typescript
// 在独立 V8 实例中运行，可以执行阻塞操作
const url = new java.net.URL(req.url);
const connection = url.openConnection();

// 设置请求...

const reader = new java.io.BufferedReader(new java.io.InputStreamReader(inputStream, "UTF-8"));

// 逐行读取，每行发送给主线程
let line;
while ((line = reader.readLine()) !== null) {
  context.postMessage({
    id: req.id,
    type: "data",
    chunk: String(line)
  });
}
```

### 2. 主线程 (`stream.android.ts`)

```typescript
// 创建 Worker
httpWorker = new Worker("@xierfloat-monorepo/http-stream/src/workers/http-worker");

// 接收 Worker 消息
httpWorker.onmessage = msg => {
  switch (msg.data.type) {
    case "data":
      callbacks.onData(msg.data.chunk);
      break;
    case "complete":
      callbacks.onComplete();
      break;
    case "error":
      callbacks.onError(new Error(msg.data.error));
      break;
  }
};

// 发送请求到 Worker
worker.postMessage({
  id: requestId,
  type: "request",
  url: options.url,
  method: options.method,
  headers: options.headers,
  body: bodyStr
});
```

### 3. SSE 解析 (`AIChat.vue`)

```typescript
onData: chunk => {
  const line = chunk.trim();

  // 跳过空行和 event: 行
  if (!line || line.startsWith("event:")) return;

  // 处理 data: 行（兼容有无空格）
  if (!line.startsWith("data:")) return;
  const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();

  const parsed = JSON.parse(data);

  // 处理 Anthropic 格式
  if (parsed.type === "content_block_delta") {
    if (parsed.delta?.type === "text_delta") {
      fullContent += parsed.delta.text;
      streamingText.value = fullContent;
    }
  }
};
```

## 遇到的其他问题

### SSE 格式解析

**问题**：API 返回 `data:{"json":"data"}` 而不是 `data: {"json":"data"}`（冒号后没有空格）。

**解决**：兼容两种格式：

```typescript
const data = line.startsWith("data: ")
  ? line.slice(6).trim() // 有空格
  : line.slice(5).trim(); // 无空格
```

### Worker 路径解析

**问题**：Worker 文件放在 npm 包中时，路径解析可能失败。

**解决**：使用完整包路径：

```typescript
new Worker("@xierfloat-monorepo/http-stream/src/workers/http-worker");
```

## 方案优缺点

### 优点

1. **真正的流式传输**：数据逐行发送，UI 实时更新
2. **不阻塞主线程**：网络请求在 Worker 中执行
3. **纯 TypeScript**：无需编写原生 Java/Kotlin 代码
4. **可维护性好**：代码都在 monorepo 中，统一管理

### 缺点

1. **消息传递开销**：每行数据都需要序列化/反序列化
2. **Worker 初始化成本**：首次创建 Worker 需要时间
3. **调试困难**：Worker 中的错误不如主线程直观

## 文件结构

```
packages/http-stream/
├── src/
│   ├── index.ts           # 导出入口
│   ├── types.ts           # 类型定义
│   ├── stream.ts          # 平台检测
│   ├── stream.android.ts  # Android 实现（使用 Worker）
│   ├── stream.ios.ts      # iOS 实现
│   └── workers/
│       └── http-worker.ts # Worker 脚本
└── package.json
```

## 总结

NativeScript 中实现流式 HTTP 的核心挑战是 **线程问题**。由于 JavaScript 只在主线程运行，而 Android 禁止在主线程进行网络操作，必须使用 Worker 来在真正的后台线程中执行网络请求。

Worker 方案虽然增加了一些复杂度，但它是目前在 NativeScript 中实现流式 HTTP 最可靠的纯 JavaScript 方案。如果需要更高性能，可以考虑编写原生插件（Java/Kotlin）。
