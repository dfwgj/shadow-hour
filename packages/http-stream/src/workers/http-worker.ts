/**
 * HTTP 流式请求 Worker
 * 在后台线程执行网络请求，通过消息传递数据
 */

// 只引入必要的全局设置，避免重复的类扩展
// @nativescript/core/globals 包含会导致 SBG 冲突的类扩展
// Worker 环境只需要 Java 访问，不需要完整的 NativeScript globals

// Worker 上下文
const context: Worker = self as any;

// 声明 Java 类型
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

/**
 * 发送消息到主线程
 */
function send(msg: WorkerResponse) {
  context.postMessage(msg);
}

/**
 * 执行 HTTP 请求
 */
function executeRequest(req: WorkerRequest) {
  let connection: any = null;
  let reader: any = null;

  try {
    console.log("[http-worker] Starting request:", req.url);

    // 创建 URL 和连接
    const url = new java.net.URL(req.url);
    connection = url.openConnection();

    // 设置请求方法
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

    // 设置请求体
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

    // 发送 headers
    send({
      id: req.id,
      type: "headers",
      statusCode,
      headers
    });

    // 获取输入流
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
      // readLine() 会去掉换行符，需要添加回来以便 SSE 解析
      send({
        id: req.id,
        type: "data",
        chunk: String(line) + "\n"
      });
    }

    console.log("[http-worker] Response complete");

    // 发送完成消息
    send({
      id: req.id,
      type: "complete"
    });
  } catch (error: any) {
    console.log("[http-worker] Error:", error);
    const errorMessage = error.getMessage ? error.getMessage() : String(error);
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
      // ignore cleanup errors
    }
  }
}

// 监听主线程消息
context.onmessage = (msg: MessageEvent) => {
  const data = msg.data as WorkerRequest;

  if (data.type === "request") {
    executeRequest(data);
  }
};

console.log("[http-worker] Worker initialized");
