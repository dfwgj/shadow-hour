# nativeScript-http-stream 包技术深度解析

> 本文档深入分析 `@xierfloat-monorepo/nativeScript-http-stream` 包的实现，涵盖 Worker 线程架构、流式传输、SSE 解析和 LLM 集成等核心内容。

## 目录

1. [包概述与架构](#1-包概述与架构)
2. [Worker 线程模型](#2-worker-线程模型)
3. [Android 流式实现](#3-android-流式实现)
4. [HTTP Worker 后台逻辑](#4-http-worker-后台逻辑)
5. [类型定义详解](#5-类型定义详解)
6. [SSE 解析机制](#6-sse-解析机制)
7. [错误处理与重试机制](#7-错误处理与重试机制)
8. [LLM 流式接口](#8-llm-流式接口)
9. [平台差异对比](#9-平台差异对比)
10. [使用示例](#10-使用示例)

---

## 1. 包概述与架构

### 1.1 设计目的

`nativeScript-http-stream` 包是一个 NativeScript 原生流式 HTTP 客户端，专门用于处理：

- **Server-Sent Events (SSE)**: 实时事件流
- **Chunked Transfer Encoding**: 分块传输编码
- **LLM API 流式响应**: OpenAI/Claude 等模型的流式输出

### 1.2 核心特性

| 特性         | 说明                        |
| ------------ | --------------------------- |
| 平台原生实现 | 直接使用 Java/ObjC 网络 API |
| 后台线程执行 | UI 线程不阻塞               |
| 统一 API     | Android/iOS 相同接口        |
| LLM 集成     | 内置 OpenAI 协议支持        |
| 工具调用支持 | 完整的 Tool Call 状态管理   |

### 1.3 包结构

```
packages/nativeScript-http-stream/
├── src/
│   ├── index.ts              # 公共 API 导出
│   ├── types.ts              # 类型定义
│   ├── stream.ts             # 平台检测层
│   ├── stream.android.ts     # Android 实现
│   ├── stream.ios.ts         # iOS 实现
│   ├── llm-stream.ts         # LLM 便捷 API
│   └── workers/
│       └── http-worker.ts    # Android Worker 线程
├── package.json
└── tsconfig.json
```

### 1.4 导出 API

```typescript
// 基础流式 API
export { streamRequest, sseConnect } from "./stream";

// 类型定义
export type {
  StreamRequestOptions,
  StreamCallbacks,
  StreamController,
  StreamResult,
  SSEEvent,
  SSECallbacks
} from "./types";

// LLM 便捷 API
export { streamLLM } from "./llm-stream";
export type {
  ChatMessage,
  ToolCall,
  ToolDefinition,
  LLMStreamOptions,
  LLMStreamEvent,
  LLMStreamCallbacks,
  LLMStreamResult
} from "./llm-stream";
```

---

## 2. Worker 线程模型

### 2.1 架构图

```
主线程                              Worker 线程（后台）
┌─────────────────┐                ┌──────────────────────────┐
│ streamRequest() │                │  http-worker.ts          │
│  • 创建请求 ID   │ ─postMessage──>│  • 执行 HTTP 请求         │
│  • 存储回调      │                │  • 读取响应流             │
│  • 返回控制器    │ <─postMessage─ │  • 发送数据块到主线程     │
└─────────────────┘                │  • 清理资源               │
     ▲                              └──────────────────────────┘
     │
  onmessage: 处理 headers、data、complete、error
```

### 2.2 设计决策

1. **延迟 Worker 初始化**: 首次请求时创建（单例模式）
2. **消息队列管理**: `pendingRequests` Map 维护请求状态和回调
3. **请求 ID 追踪**: 唯一 ID 关联主线程回调与 Worker 响应
4. **控制器模式**: 支持提前中止而无需终止线程

### 2.3 请求状态结构

```typescript
const pendingRequests = new Map<
  string,
  {
    callbacks: StreamCallbacks;
    controller: StreamController & { _aborted: boolean };
    resolve: () => void;
    reject: (error: Error) => void;
  }
>();
```

---

## 3. Android 流式实现

### 3.1 Worker 创建与管理

```typescript
// stream.android.ts
let httpWorker: Worker | null = null;

function getWorker(): Worker {
  if (!httpWorker) {
    console.log("[nativeScript-http-stream] Creating HTTP Worker...");
    httpWorker = new Worker("@xierfloat-monorepo/nativeScript-http-stream/src/workers/http-worker");

    httpWorker.onmessage = (msg: MessageEvent) => {
      const data = msg.data as {
        id: string;
        type: "headers" | "data" | "complete" | "error";
        statusCode?: number;
        headers?: Record<string, string>;
        chunk?: string;
        error?: string;
      };
      // 分发到对应请求的回调
    };
  }
  return httpWorker;
}
```

### 3.2 消息路由与回调分发

```typescript
switch (data.type) {
  case "headers":
    if (callbacks.onHeaders && data.statusCode !== undefined) {
      callbacks.onHeaders(data.statusCode, data.headers || {});
    }
    break;

  case "data":
    if (callbacks.onData && data.chunk !== undefined) {
      callbacks.onData(data.chunk);
    }
    break;

  case "complete":
    pendingRequests.delete(data.id);
    callbacks.onComplete?.();
    resolve();
    break;

  case "error": {
    pendingRequests.delete(data.id);
    const err = new Error(data.error || "Unknown error");
    callbacks.onError?.(err);
    reject(err);
    break;
  }
}
```

**消息分发顺序**:

1. `headers` - 初始响应元数据
2. `data` - 多次数据块
3. `complete` 或 `error` - 终止信号

### 3.3 中止处理

```typescript
if (controller.aborted) {
  pendingRequests.delete(data.id);
  resolve();
  return;
}
```

调用 `controller.abort()` 后，所有后续消息被忽略，Promise 立即 resolve。

### 3.4 流式请求 API

```typescript
export function streamRequest(options: StreamRequestOptions, callbacks: StreamCallbacks): StreamResult {
  const controller = createController();
  const requestId = generateRequestId();

  const promise = new Promise<void>((resolve, reject) => {
    pendingRequests.set(requestId, {
      callbacks,
      controller,
      resolve,
      reject
    });

    const bodyStr =
      typeof options.body === "string" ? options.body : options.body ? JSON.stringify(options.body) : undefined;

    const worker = getWorker();
    worker.postMessage({
      id: requestId,
      type: "request",
      url: options.url,
      method: options.method || "GET",
      headers: options.headers,
      body: bodyStr,
      timeout: options.timeout
    });
  });

  return { controller, promise };
}
```

### 3.5 请求 ID 生成

```typescript
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

使用时间戳 + 随机后缀确保多个并发请求的唯一性。

---

## 4. HTTP Worker 后台逻辑

### 4.1 Worker 上下文设置

```typescript
// http-worker.ts
const context: Worker = self as any;

declare const java: any;

interface WorkerRequest {
  id: string;
  type: "request";
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface WorkerResponse {
  id: string;
  type: "headers" | "data" | "complete" | "error";
  statusCode?: number;
  headers?: Record<string, string>;
  chunk?: string;
  error?: string;
}
```

### 4.2 HTTP 请求执行

```typescript
function executeRequest(req: WorkerRequest) {
  let connection: any = null;
  let reader: any = null;

  try {
    console.log("[http-worker] Starting request:", req.url);

    // 创建 URLConnection
    const url = new java.net.URL(req.url);
    connection = url.openConnection();

    // 设置方法
    connection.setRequestMethod(req.method || "GET");

    // 设置超时
    if (req.timeout) {
      connection.setConnectTimeout(req.timeout);
      connection.setReadTimeout(req.timeout);
    }

    // 设置请求头
    if (req.headers) {
      for (const key of Object.keys(req.headers)) {
        connection.setRequestProperty(key, req.headers[key]);
      }
    }

    // 设置请求体（POST/PUT/PATCH）
    if (req.body && ["POST", "PUT", "PATCH"].includes(req.method || "")) {
      connection.setDoOutput(true);
      const outputStream = connection.getOutputStream();
      const writer = new java.io.OutputStreamWriter(outputStream, "UTF-8");
      writer.write(req.body);
      writer.flush();
      writer.close();
    }

    // 获取响应
    const statusCode = connection.getResponseCode();
    console.log("[http-worker] Response status:", statusCode);

    // 读取响应头
    const headers: Record<string, string> = {};
    const headerFields = connection.getHeaderFields();
    if (headerFields) {
      const iterator = headerFields.keySet().iterator();
      while (iterator.hasNext()) {
        const key = iterator.next();
        if (key) {
          const values = headerFields.get(key);
          if (values && values.size() > 0) {
            headers[String(key).toLowerCase()] = String(values.get(0));
          }
        }
      }
    }

    // 发送 headers 消息
    send({
      id: req.id,
      type: "headers",
      statusCode,
      headers
    });
```

**技术要点**:

- **Java 互操作**: 直接使用 `java.net.URL` 和 `java.io.*` 类
- **URLConnection**: 标准 Java HTTP 客户端
- **双超时设置**: 连接超时和读取超时都设置

### 4.3 BufferedReader 流式读取

```typescript
// 根据状态码获取输入流
let inputStream: any;
if (statusCode >= 200 && statusCode < 300) {
  inputStream = connection.getInputStream();
} else {
  inputStream = connection.getErrorStream();
}

// 使用 BufferedReader 逐行读取
reader = new java.io.BufferedReader(new java.io.InputStreamReader(inputStream, "UTF-8"));

console.log("[http-worker] Reading response body...");

let line: string | null;
while ((line = reader.readLine()) !== null) {
  send({
    id: req.id,
    type: "data",
    chunk: String(line)
  });
}

console.log("[http-worker] Response complete");

// 发送完成消息
send({
  id: req.id,
  type: "complete"
});
```

**流式读取策略**:

- **BufferedReader**: 自动按行边界分块
- **UTF-8 编码**: 与请求头/请求体编码一致
- **基于状态的流选择**: 成功路径 vs 错误路径
- **逐行传递**: 每行立即发送（无缓冲）

### 4.4 错误处理与清理

```typescript
  } catch (error: any) {
    console.log("[http-worker] Error:", error);
    const errorMessage = error.getMessage
      ? error.getMessage()
      : String(error);
    send({
      id: req.id,
      type: "error",
      error: errorMessage
    });
  } finally {
    // 清理资源
    try {
      if (reader) reader.close();
      if (connection) connection.disconnect();
    } catch {
      // 忽略清理错误
    }
  }
}
```

---

## 5. 类型定义详解

### 5.1 请求配置

```typescript
export interface StreamRequestOptions {
  /** 请求 URL */
  url: string;
  /** HTTP 方法 */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体（POST/PUT/PATCH 使用） */
  body?: string | object;
  /** 超时时间（毫秒） */
  timeout?: number;
}
```

### 5.2 回调接口

```typescript
export interface StreamCallbacks {
  /** 收到数据块时触发 */
  onData?: (chunk: string) => void;
  /** 请求完成时触发 */
  onComplete?: () => void;
  /** 错误时触发 */
  onError?: (error: Error) => void;
  /** 收到响应头时触发 */
  onHeaders?: (statusCode: number, headers: Record<string, string>) => void;
}
```

**回调顺序**:

1. `onHeaders`（一次）
2. `onData`（多次）
3. `onComplete` 或 `onError`（一次）

### 5.3 Server-Sent Events

```typescript
export interface SSEEvent {
  /** 事件类型 */
  event?: string;
  /** 事件数据 */
  data: string;
  /** 事件 ID */
  id?: string;
  /** 重试间隔 */
  retry?: number;
}

export interface SSECallbacks {
  /** 收到 SSE 事件时触发 */
  onEvent?: (event: SSEEvent) => void;
  /** 连接建立时触发 */
  onOpen?: () => void;
  /** 连接关闭时触发 */
  onClose?: () => void;
  /** 错误时触发 */
  onError?: (error: Error) => void;
}
```

### 5.4 流控制器

```typescript
export interface StreamController {
  /** 中止/取消请求 */
  abort: () => void;
  /** 请求是否已中止 */
  readonly aborted: boolean;
}

export interface StreamResult {
  /** 流控制器 */
  controller: StreamController;
  /** 完成时 resolve 的 Promise */
  promise: Promise<void>;
}
```

---

## 6. SSE 解析机制

### 6.1 SSE 协议格式

```
event: message
data: Hello, World
id: 123

event: update
data: {"key": "value"}
data: {"more": "data"}

```

- 空行 = 事件边界
- `data:` 可多行，用 `\n` 拼接
- `event:` 可选事件类型
- `id:` 可选事件 ID
- `:` 开头为注释行

### 6.2 SSE 解析实现

```typescript
export function sseConnect(options: StreamRequestOptions, callbacks: SSECallbacks): StreamResult {
  let eventType: string | undefined;
  let eventData: string[] = [];
  let eventId: string | undefined;

  function parseLine(line: string): SSEEvent | null {
    if (line === "") {
      // 空行 = 事件边界
      if (eventData.length > 0) {
        const event: SSEEvent = {
          event: eventType,
          data: eventData.join("\n"),
          id: eventId
        };
        // 重置状态
        eventType = undefined;
        eventData = [];
        return event;
      }
      return null;
    }

    if (line.startsWith(":")) {
      return null; // 注释行
    }

    const colonIndex = line.indexOf(":");
    let field: string;
    let value: string;

    if (colonIndex === -1) {
      field = line;
      value = "";
    } else {
      field = line.substring(0, colonIndex);
      value = line.substring(colonIndex + 1);
      if (value.startsWith(" ")) {
        value = value.substring(1);
      }
    }

    switch (field) {
      case "event":
        eventType = value;
        break;
      case "data":
        eventData.push(value);
        break;
      case "id":
        eventId = value;
        break;
      case "retry":
        // 可选重试间隔处理
        break;
    }
    return null;
  }

  // 使用 streamRequest 并解析每行
  return streamRequest(options, {
    onData: line => {
      const event = parseLine(line);
      if (event) {
        callbacks.onEvent?.(event);
      }
    },
    onComplete: () => callbacks.onClose?.(),
    onError: err => callbacks.onError?.(err),
    onHeaders: status => {
      if (status >= 200 && status < 300) {
        callbacks.onOpen?.();
      }
    }
  });
}
```

### 6.3 SSE 解析流程

```
原始数据块:
  "event: message\n"
  "data: Hello, World\n"
  "id: 123\n"
  "\n"

解析状态:
  parseLine("event: message") → eventType = "message"
  parseLine("data: Hello, World") → eventData = ["Hello, World"]
  parseLine("id: 123") → eventId = "123"
  parseLine("") → return { event: "message", data: "Hello, World", id: "123" }

回调:
  onEvent({ event: "message", data: "Hello, World", id: "123" })
```

---

## 7. 错误处理与重试机制

### 7.1 Android 错误处理

```typescript
// Worker 错误（整个 Worker 崩溃）
httpWorker.onerror = (error: ErrorEvent) => {
  console.log("[nativeScript-http-stream] Worker error:", error.message);
  // 通知所有待处理请求
  for (const [, pending] of pendingRequests) {
    const err = new Error(`Worker error: ${error.message}`);
    pending.callbacks.onError?.(err);
    pending.reject(err);
  }
  pendingRequests.clear();
};

// 单个请求错误
case "error": {
  pendingRequests.delete(data.id);
  const err = new Error(data.error || "Unknown error");
  callbacks.onError?.(err);
  reject(err);
  break;
}
```

**错误分类**:

1. **Worker 故障**: 崩溃影响所有待处理请求
2. **网络错误**: 单个请求的错误消息

### 7.2 Worker 错误处理

```typescript
try {
  // ... 执行请求
} catch (error: any) {
  console.log("[http-worker] Error:", error);
  const errorMessage = error.getMessage ? error.getMessage() : String(error);
  send({
    id: req.id,
    type: "error",
    error: errorMessage
  });
} finally {
  // 始终清理
  try {
    if (reader) reader.close();
    if (connection) connection.disconnect();
  } catch {
    // 忽略清理错误
  }
}
```

**错误转换**:

- Java 异常转换为 JavaScript 错误消息
- 非标准异常对象的优雅降级
- finally 块中的资源清理（保证执行）

### 7.3 重试包装示例

```typescript
async function retryStreamRequest(options: StreamRequestOptions, callbacks: StreamCallbacks, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { promise } = streamRequest(options, callbacks);
      await promise;
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // 指数退避
      await new Promise(r => setTimeout(r, 100 * Math.pow(2, i)));
    }
  }
}
```

---

## 8. LLM 流式接口

### 8.1 LLM 类型定义

```typescript
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface LLMStreamOptions {
  url: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMStreamEvent {
  type: "text" | "tool_call" | "done" | "error";
  text?: string;
  toolCall?: ToolCall;
  finishReason?: string;
  error?: string;
}
```

### 8.2 LLM 流式 API

```typescript
export function streamLLM(options: LLMStreamOptions, callbacks: LLMStreamCallbacks): LLMStreamResult {
  // 构建请求
  const requestBody = {
    model: options.model,
    messages: options.messages,
    stream: true,
    tools: options.tools,
    max_tokens: options.maxTokens,
    temperature: options.temperature
  };

  // Tool Call 状态
  const toolCalls = new Map<
    number,
    {
      id: string;
      name: string;
      arguments: string;
    }
  >();

  return streamRequest(
    {
      url: options.url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`
      },
      body: requestBody
    },
    {
      onData: line => {
        if (!line.startsWith("data: ")) return;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          // 发送累积的 tool calls
          for (const tc of toolCalls.values()) {
            callbacks.onEvent({
              type: "tool_call",
              toolCall: {
                id: tc.id,
                type: "function",
                function: {
                  name: tc.name,
                  arguments: tc.arguments
                }
              }
            });
          }
          callbacks.onEvent({ type: "done" });
          return;
        }

        const data = JSON.parse(jsonStr);
        const delta = data.choices?.[0]?.delta;

        // 文本增量
        if (delta?.content) {
          callbacks.onEvent({
            type: "text",
            text: delta.content
          });
        }

        // Tool Call 增量
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index;
            let existing = toolCalls.get(index);

            if (!existing) {
              existing = {
                id: tc.id || "",
                name: tc.function?.name || "",
                arguments: ""
              };
              toolCalls.set(index, existing);
            }

            if (tc.function?.name) {
              existing.name = tc.function.name;
            }
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
            }
          }
        }
      },
      onError: err => {
        callbacks.onEvent({
          type: "error",
          error: err.message
        });
      }
    }
  );
}
```

### 8.3 Tool Call 累积流程

```
Chunk 1: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_123","function":{"name":"get_weather","arguments":"{"}}]}}]}
  → toolCalls.set(0, { id: "call_123", name: "get_weather", arguments: "{" })

Chunk 2: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"location\":"}}]}}]}
  → toolCalls.get(0).arguments += "\"location\":"

Chunk 3: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"Paris\"}"}}]}}]}
  → toolCalls.get(0).arguments += "\"Paris\"}"

收到 [DONE]:
  → emit { type: "tool_call", toolCall: { id: "call_123", ... } }
```

---

## 9. 平台差异对比

### 9.1 架构差异

| 方面        | Android                    | iOS                           |
| ----------- | -------------------------- | ----------------------------- |
| 线程模型    | Worker（显式线程）         | NSURLSessionDataDelegate      |
| HTTP 客户端 | `java.net.URLConnection`   | `NSURLSession`                |
| I/O 模型    | 阻塞读取（BufferedReader） | 回调驱动（delegate）          |
| 缓冲管理    | 逐行在 Worker              | 片段缓冲在 delegate           |
| 主线程安全  | 消息传递                   | `Utils.executeOnMainThread()` |

### 9.2 iOS 实现（stream.ios.ts）

```typescript
@NativeClass()
class StreamDelegate extends NSObject implements NSURLSessionDataDelegate {
  private buffer = "";

  URLSessionDataTaskDidReceiveData(_session: NSURLSession, _dataTask: NSURLSessionDataTask, data: NSData): void {
    if (controller.aborted) return;

    const chunk = nsDataToString(data);
    this.buffer += chunk;

    // 缓冲不完整的行
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      Utils.executeOnMainThread(() => {
        callbacks.onData!(line);
      });
    }
  }
}
```

**关键差异**:

- **NSURLSession delegates** 而非 Workers
- **片段缓冲**（NSData 可能是任意大小）
- **行重建** 从片段
- **主线程调度** 所有回调

### 9.3 流读取对比

```
Android（阻塞）                iOS（事件驱动）
─────────────────────────────────────────────
URLConnection                NSURLSession
  ├─ getInputStream()        ├─ didReceiveData（片段）
  └─ BufferedReader          ├─ didReceiveData（片段）
       └─ readLine() 循环     ├─ didReceiveData（片段）
            └─ send chunks    └─ didCompleteWithError
```

---

## 10. 使用示例

### 10.1 基础流式请求

```typescript
import { streamRequest } from "@xierfloat-monorepo/nativeScript-http-stream";

const { controller, promise } = streamRequest(
  {
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      Authorization: "Bearer sk-...",
      "Content-Type": "application/json"
    },
    body: {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello!" }],
      stream: true
    },
    timeout: 30000
  },
  {
    onHeaders: (status, headers) => {
      console.log(`Response: ${status}`);
      console.log(`Content-Type: ${headers["content-type"]}`);
    },
    onData: chunk => {
      if (chunk.startsWith("data: ")) {
        const json = JSON.parse(chunk.slice(6));
        console.log("Delta:", json.choices[0].delta.content);
      }
    },
    onComplete: () => {
      console.log("Stream complete!");
    },
    onError: err => {
      console.error("Stream error:", err.message);
    }
  }
);

// 等待完成
try {
  await promise;
  console.log("Success!");
} catch (err) {
  console.error("Failed:", err);
}

// 或提前中止
setTimeout(() => controller.abort(), 5000);
```

### 10.2 SSE 实时事件

```typescript
import { sseConnect } from "@xierfloat-monorepo/nativeScript-http-stream";

const { controller, promise } = sseConnect(
  { url: "https://example.com/events" },
  {
    onOpen: () => console.log("SSE connection opened"),
    onEvent: event => {
      console.log(`Event [${event.event}]:`, event.data);
    },
    onClose: () => console.log("SSE connection closed"),
    onError: err => console.error("SSE error:", err.message)
  }
);

await promise;
```

### 10.3 LLM Tool Calling

```typescript
import { streamLLM } from "@xierfloat-monorepo/nativeScript-http-stream";

const { controller, promise } = streamLLM(
  {
    url: "https://api.siliconflow.cn/v1/chat/completions",
    apiKey: "sk-...",
    model: "Qwen/Qwen2.5-7B-Instruct",
    messages: [{ role: "user", content: "What's the weather in Paris?" }],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" }
            }
          }
        }
      }
    ]
  },
  {
    onEvent: event => {
      switch (event.type) {
        case "text":
          console.log("Text:", event.text);
          break;
        case "tool_call":
          console.log("Tool call:", event.toolCall);
          // {
          //   id: "call_123",
          //   type: "function",
          //   function: {
          //     name: "get_weather",
          //     arguments: "{\"location\":\"Paris\"}"
          //   }
          // }
          break;
        case "done":
          console.log("Finished");
          break;
        case "error":
          console.error("Error:", event.error);
          break;
      }
    }
  }
);

await promise;
```

---

## 总结

`nativeScript-http-stream` 包提供了一个强大的平台原生流式 HTTP 抽象层：

| 组件                  | 用途            | 关键技术                                   |
| --------------------- | --------------- | ------------------------------------------ |
| **index.ts**          | API 导出        | 平台特定模块重导出                         |
| **stream.android.ts** | Android 实现    | Worker 消息传递、请求追踪、SSE 解析        |
| **http-worker.ts**    | 后台网络执行    | Java 互操作、URLConnection、BufferedReader |
| **stream.ios.ts**     | iOS 实现        | NSURLSession delegates                     |
| **llm-stream.ts**     | OpenAI 兼容包装 | SSE 解析、Tool Call 累积                   |
| **types.ts**          | 类型定义        | 所有公共 API 接口                          |

**核心设计模式**:

1. **Worker 并发**（Android）vs **原生委托**（iOS）
2. **逐行分块** 支持 SSE 和 JSON 流
3. **请求 ID 追踪** 关联响应到回调
4. **中止感知分发** 阻止取消后的回调执行
5. **状态化解析** 累积多块事件（SSE、Tool Calls）
6. **Promise + Controller 模式** 异步控制和提前终止
