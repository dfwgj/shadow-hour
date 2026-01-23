/**
 * Android 平台流式 HTTP 实现
 * 使用 Worker 在后台线程执行网络请求
 * @author: DF蓝梦/xierfloat
 * @date 2025-12-10
 */

import type {
  StreamRequestOptions,
  StreamCallbacks,
  StreamController,
  StreamResult,
  SSECallbacks,
  SSEEvent,
  NSWorker,
  NSMessageEvent,
  NSErrorEvent
} from "./types";

// 运行时使用全局 Worker，类型使用 NSWorker
declare const Worker: typeof NSWorker;

// Worker 实例（延迟初始化）
let httpWorker: NSWorker | null = null;

// 请求回调映射
const pendingRequests = new Map<
  string,
  {
    callbacks: StreamCallbacks;
    controller: StreamController & { _aborted: boolean };
    resolve: () => void;
    reject: (error: Error) => void;
  }
>();

/**
 * 获取或创建 Worker
 */
function getWorker(): NSWorker {
  if (!httpWorker) {
    console.log("[nativeScript-http-stream] Creating HTTP Worker...");
    // 使用包的 worker 路径（需要 webpack 正确配置）
    httpWorker = new Worker("@xierfloat-monorepo/nativeScript-http-stream/src/workers/http-worker");

    httpWorker.onmessage = (msg: NSMessageEvent) => {
      const data = msg.data as {
        id: string;
        type: "headers" | "data" | "complete" | "error";
        statusCode?: number;
        headers?: Record<string, string>;
        chunk?: string;
        error?: string;
      };

      const pending = pendingRequests.get(data.id);
      if (!pending) return;

      const { callbacks, controller, resolve, reject } = pending;

      if (controller.aborted) {
        pendingRequests.delete(data.id);
        resolve();
        return;
      }

      switch (data.type) {
        case "headers":
          if (callbacks.onHeaders && data.statusCode !== undefined) {
            callbacks.onHeaders(data.statusCode, data.headers || {});
          }
          break;

        case "data":
          if (callbacks.onData && data.chunk !== undefined) {
            // console.log("[nativeScript-http-stream] Received chunk:", data.chunk.substring(0, 100));
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
    };

    httpWorker.onerror = (error: NSErrorEvent) => {
      console.log("[nativeScript-http-stream] Worker error:", error.message);
      // 通知所有等待中的请求
      for (const [, pending] of pendingRequests) {
        const err = new Error(`Worker error: ${error.message}`);
        pending.callbacks.onError?.(err);
        pending.reject(err);
      }
      pendingRequests.clear();
    };
  }

  return httpWorker;
}

/**
 * 生成唯一请求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建流控制器
 */
function createController(): StreamController & { _aborted: boolean } {
  return {
    _aborted: false,
    get aborted() {
      return this._aborted;
    },
    abort() {
      this._aborted = true;
    }
  };
}

/**
 * Android 流式 HTTP 请求（使用 Worker）
 */
export function streamRequest(options: StreamRequestOptions, callbacks: StreamCallbacks): StreamResult {
  const controller = createController();
  const requestId = generateRequestId();

  console.log("[nativeScript-http-stream] Android streamRequest called, url:", options.url);

  const promise = new Promise<void>((resolve, reject) => {
    // 保存回调
    pendingRequests.set(requestId, {
      callbacks,
      controller,
      resolve,
      reject
    });

    // 准备请求体
    const bodyStr =
      typeof options.body === "string" ? options.body : options.body ? JSON.stringify(options.body) : undefined;

    // 发送请求到 Worker
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

/**
 * Android SSE (Server-Sent Events) 客户端
 */
export function sseConnect(options: StreamRequestOptions, callbacks: SSECallbacks): StreamResult {
  // SSE 解析状态
  let eventType: string | undefined;
  let eventData: string[] = [];
  let eventId: string | undefined;

  /**
   * 解析 SSE 行
   */
  function parseLine(line: string): SSEEvent | null {
    // 空行表示事件结束
    if (line === "") {
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

    // 注释行（以 : 开头）
    if (line.startsWith(":")) {
      return null;
    }

    // 解析字段
    const colonIndex = line.indexOf(":");
    let field: string;
    let value: string;

    if (colonIndex === -1) {
      field = line;
      value = "";
    } else {
      field = line.substring(0, colonIndex);
      value = line.substring(colonIndex + 1);
      // 移除开头的空格
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
        // 可选处理重试间隔
        break;
    }

    return null;
  }

  // 添加 SSE 特定头
  const sseOptions: StreamRequestOptions = {
    ...options,
    headers: {
      ...options.headers,
      Accept: "text/event-stream",
      "Cache-Control": "no-cache"
    }
  };

  const result = streamRequest(sseOptions, {
    onHeaders: statusCode => {
      if (statusCode >= 200 && statusCode < 300) {
        callbacks.onOpen?.();
      } else {
        callbacks.onError?.(new Error(`HTTP ${statusCode}`));
      }
    },
    onData: chunk => {
      const sseEvent = parseLine(chunk);
      if (sseEvent && callbacks.onEvent) {
        callbacks.onEvent(sseEvent);
      }
    },
    onComplete: () => {
      callbacks.onClose?.();
    },
    onError: error => {
      callbacks.onError?.(error);
    }
  });

  return result;
}
