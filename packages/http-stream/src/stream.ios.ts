/**
 * iOS 平台流式 HTTP 实现
 * 使用 NSURLSession + NSURLSessionDataDelegate 实现流式读取
 */

import { Utils } from "@nativescript/core";
import type {
  StreamRequestOptions,
  StreamCallbacks,
  StreamController,
  StreamResult,
  SSECallbacks,
  SSEEvent
} from "./types";

/**
 * 创建流控制器
 */
function createController(
  task?: NSURLSessionDataTask
): StreamController & { _aborted: boolean; _task?: NSURLSessionDataTask } {
  return {
    _aborted: false,
    _task: task,
    get aborted() {
      return this._aborted;
    },
    abort() {
      this._aborted = true;
      this._task?.cancel();
    }
  };
}

/**
 * NSData 转字符串
 */
function nsDataToString(data: NSData): string {
  return NSString.alloc().initWithDataEncoding(data, NSUTF8StringEncoding).toString();
}

/**
 * iOS 流式 HTTP 请求
 * 使用 NSURLSessionDataDelegate 实现逐块数据接收
 */
export function streamRequest(options: StreamRequestOptions, callbacks: StreamCallbacks): StreamResult {
  const controller = createController();

  const promise = new Promise<void>((resolve, reject) => {
    // 创建请求
    const url = NSURL.URLWithString(options.url);
    const request = NSMutableURLRequest.requestWithURL(url);

    // 设置方法
    request.HTTPMethod = options.method || "GET";

    // 设置超时
    if (options.timeout) {
      request.timeoutInterval = options.timeout / 1000;
    }

    // 设置请求头
    if (options.headers) {
      for (const key of Object.keys(options.headers)) {
        request.setValueForHTTPHeaderField(options.headers[key], key);
      }
    }

    // 设置请求体
    if (options.body && ["POST", "PUT", "PATCH"].includes(options.method || "")) {
      const bodyStr = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      request.HTTPBody = NSString.stringWithString(bodyStr).dataUsingEncoding(NSUTF8StringEncoding);
    }

    // 创建 delegate
    @NativeClass()
    class StreamDelegate extends NSObject implements NSURLSessionDataDelegate {
      static ObjCProtocols = [NSURLSessionDataDelegate];

      private buffer = "";

      // 收到响应头
      URLSessionDataTaskDidReceiveResponseCompletionHandler(
        _session: NSURLSession,
        _dataTask: NSURLSessionDataTask,
        response: NSURLResponse,
        completionHandler: (p1: NSURLSessionResponseDisposition) => void
      ): void {
        const httpResponse = response as NSHTTPURLResponse;
        const statusCode = httpResponse.statusCode;

        // 解析响应头
        const headers: Record<string, string> = {};
        const allHeaders = httpResponse.allHeaderFields;
        if (allHeaders) {
          allHeaders.enumerateKeysAndObjectsUsingBlock((key, value) => {
            headers[key.toString().toLowerCase()] = value.toString();
          });
        }

        // 回调
        if (callbacks.onHeaders) {
          Utils.executeOnMainThread(() => {
            callbacks.onHeaders!(statusCode, headers);
          });
        }

        // 继续接收数据
        completionHandler(NSURLSessionResponseDisposition.Allow);
      }

      // 收到数据块
      URLSessionDataTaskDidReceiveData(_session: NSURLSession, _dataTask: NSURLSessionDataTask, data: NSData): void {
        if (controller.aborted) return;

        const chunk = nsDataToString(data);

        // 按行处理（处理可能的不完整行）
        this.buffer += chunk;
        const lines = this.buffer.split("\n");

        // 保留最后一个可能不完整的行
        this.buffer = lines.pop() || "";

        // 回调完整的行
        for (const line of lines) {
          if (callbacks.onData) {
            Utils.executeOnMainThread(() => {
              callbacks.onData!(line);
            });
          }
        }
      }

      // 请求完成
      URLSessionTaskDidCompleteWithError(_session: NSURLSession, _task: NSURLSessionTask, error: NSError): void {
        // 处理缓冲区中剩余的数据
        if (this.buffer && callbacks.onData) {
          const remaining = this.buffer;
          Utils.executeOnMainThread(() => {
            callbacks.onData!(remaining);
          });
        }

        if (error && !controller.aborted) {
          const err = new Error(error.localizedDescription);
          Utils.executeOnMainThread(() => {
            callbacks.onError?.(err);
            reject(err);
          });
        } else {
          Utils.executeOnMainThread(() => {
            callbacks.onComplete?.();
            resolve();
          });
        }
      }
    }

    // 创建 session 配置
    const config = NSURLSessionConfiguration.defaultSessionConfiguration;

    // 创建 delegate 实例
    const delegate = StreamDelegate.new();

    // 创建 session
    const session = NSURLSession.sessionWithConfigurationDelegateDelegateQueue(
      config,
      delegate,
      NSOperationQueue.mainQueue
    );

    // 创建并启动任务
    const task = session.dataTaskWithRequest(request);
    controller._task = task;
    task.resume();
  });

  return { controller, promise };
}

/**
 * iOS SSE (Server-Sent Events) 客户端
 */
export function sseConnect(options: StreamRequestOptions, callbacks: SSECallbacks): StreamResult {
  const controller = createController();

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
        eventType = undefined;
        eventData = [];
        return event;
      }
      return null;
    }

    // 注释行
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
        break;
    }

    return null;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const url = NSURL.URLWithString(options.url);
    const request = NSMutableURLRequest.requestWithURL(url);

    request.HTTPMethod = options.method || "GET";

    // SSE 特定头
    request.setValueForHTTPHeaderField("text/event-stream", "Accept");
    request.setValueForHTTPHeaderField("no-cache", "Cache-Control");

    if (options.timeout) {
      request.timeoutInterval = options.timeout / 1000;
    }

    if (options.headers) {
      for (const key of Object.keys(options.headers)) {
        request.setValueForHTTPHeaderField(options.headers[key], key);
      }
    }

    if (options.body && ["POST", "PUT", "PATCH"].includes(options.method || "")) {
      const bodyStr = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      request.HTTPBody = NSString.stringWithString(bodyStr).dataUsingEncoding(NSUTF8StringEncoding);
    }

    @NativeClass()
    class SSEDelegate extends NSObject implements NSURLSessionDataDelegate {
      static ObjCProtocols = [NSURLSessionDataDelegate];

      private buffer = "";

      URLSessionDataTaskDidReceiveResponseCompletionHandler(
        _session: NSURLSession,
        _dataTask: NSURLSessionDataTask,
        response: NSURLResponse,
        completionHandler: (p1: NSURLSessionResponseDisposition) => void
      ): void {
        const httpResponse = response as NSHTTPURLResponse;
        const statusCode = httpResponse.statusCode;

        if (statusCode >= 200 && statusCode < 300) {
          Utils.executeOnMainThread(() => {
            callbacks.onOpen?.();
          });
          completionHandler(NSURLSessionResponseDisposition.Allow);
        } else {
          const err = new Error(`HTTP ${statusCode}`);
          Utils.executeOnMainThread(() => {
            callbacks.onError?.(err);
          });
          completionHandler(NSURLSessionResponseDisposition.Cancel);
        }
      }

      URLSessionDataTaskDidReceiveData(_session: NSURLSession, _dataTask: NSURLSessionDataTask, data: NSData): void {
        if (controller.aborted) return;

        const chunk = nsDataToString(data);
        this.buffer += chunk;

        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() || "";

        for (const line of lines) {
          const event = parseLine(line);
          if (event && callbacks.onEvent) {
            Utils.executeOnMainThread(() => {
              callbacks.onEvent!(event);
            });
          }
        }
      }

      URLSessionTaskDidCompleteWithError(_session: NSURLSession, _task: NSURLSessionTask, error: NSError): void {
        // 处理剩余缓冲
        if (this.buffer) {
          const event = parseLine(this.buffer);
          if (event && callbacks.onEvent) {
            Utils.executeOnMainThread(() => {
              callbacks.onEvent!(event);
            });
          }
        }

        if (error && !controller.aborted) {
          const err = new Error(error.localizedDescription);
          Utils.executeOnMainThread(() => {
            callbacks.onError?.(err);
            reject(err);
          });
        } else {
          Utils.executeOnMainThread(() => {
            callbacks.onClose?.();
            resolve();
          });
        }
      }
    }

    const config = NSURLSessionConfiguration.defaultSessionConfiguration;
    const delegate = SSEDelegate.new();
    const session = NSURLSession.sessionWithConfigurationDelegateDelegateQueue(
      config,
      delegate,
      NSOperationQueue.mainQueue
    );

    const task = session.dataTaskWithRequest(request);
    controller._task = task;
    task.resume();
  });

  return { controller, promise };
}
