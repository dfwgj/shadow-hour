/**
 * 平台自动检测的流式 HTTP 请求
 * 自动选择 Android 或 iOS 实现
 */

import { isAndroid, isIOS } from "@nativescript/core";
import type { StreamRequestOptions, StreamCallbacks, StreamResult, SSECallbacks } from "./types";

console.log("[http-stream] Platform detection - isAndroid:", isAndroid, ", isIOS:", isIOS);

// 动态导入平台特定实现
let platformStreamRequest: (options: StreamRequestOptions, callbacks: StreamCallbacks) => StreamResult;
let platformSseConnect: (options: StreamRequestOptions, callbacks: SSECallbacks) => StreamResult;

if (isAndroid) {
  console.log("[http-stream] Loading Android implementation...");
  // Android 实现
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const androidImpl = require("./stream.android");
  platformStreamRequest = androidImpl.streamRequest;
  platformSseConnect = androidImpl.sseConnect;
} else if (isIOS) {
  // iOS 实现
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const iosImpl = require("./stream.ios");
  platformStreamRequest = iosImpl.streamRequest;
  platformSseConnect = iosImpl.sseConnect;
} else {
  // 降级实现（用于测试或不支持的平台）
  platformStreamRequest = (options, callbacks) => {
    const controller = {
      aborted: false,
      abort() {
        this.aborted = true;
      }
    };
    const promise = Promise.reject(new Error("Streaming not supported on this platform"));
    callbacks.onError?.(new Error("Streaming not supported on this platform"));
    return { controller, promise };
  };
  platformSseConnect = platformStreamRequest as any;
}

/**
 * 发起流式 HTTP 请求
 */
export function streamRequest(options: StreamRequestOptions, callbacks: StreamCallbacks): StreamResult {
  return platformStreamRequest(options, callbacks);
}

/**
 * 建立 SSE (Server-Sent Events) 连接
 */
export function sseConnect(options: StreamRequestOptions, callbacks: SSECallbacks): StreamResult {
  return platformSseConnect(options, callbacks);
}
