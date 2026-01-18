/**
 * HTTP Stream Types
 * NativeScript 流式 HTTP 请求类型定义
 */

/**
 * 流式请求配置选项
 */
export interface StreamRequestOptions {
  /** 请求 URL */
  url: string;
  /** HTTP 方法 */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 (用于 POST/PUT/PATCH) */
  body?: string | object;
  /** 超时时间 (毫秒) */
  timeout?: number;
}

/**
 * 流事件回调
 */
export interface StreamCallbacks {
  /** 收到数据块时触发 */
  onData?: (chunk: string) => void;
  /** 请求完成时触发 */
  onComplete?: () => void;
  /** 发生错误时触发 */
  onError?: (error: Error) => void;
  /** 收到响应头时触发 */
  onHeaders?: (statusCode: number, headers: Record<string, string>) => void;
}

/**
 * SSE (Server-Sent Events) 事件
 */
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

/**
 * SSE 回调
 */
export interface SSECallbacks {
  /** 收到 SSE 事件时触发 */
  onEvent?: (event: SSEEvent) => void;
  /** 连接建立时触发 */
  onOpen?: () => void;
  /** 连接关闭时触发 */
  onClose?: () => void;
  /** 发生错误时触发 */
  onError?: (error: Error) => void;
}

/**
 * 流控制器 - 用于取消请求
 */
export interface StreamController {
  /** 取消/中止请求 */
  abort: () => void;
  /** 是否已中止 */
  readonly aborted: boolean;
}

/**
 * 流式请求结果
 */
export interface StreamResult {
  /** 流控制器 */
  controller: StreamController;
  /** 等待完成的 Promise */
  promise: Promise<void>;
}
