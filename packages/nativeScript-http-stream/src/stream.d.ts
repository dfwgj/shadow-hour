/**
 * 流式 HTTP 请求函数声明
 * @author: DF蓝梦/xierfloat
 * @date 2025-12-10
 */

import type { StreamRequestOptions, StreamCallbacks, StreamResult, SSECallbacks } from "./types";

/**
 * 发起流式 HTTP 请求
 * @param options 请求配置
 * @param callbacks 回调函数
 * @returns 流控制器和完成 Promise
 */
export function streamRequest(options: StreamRequestOptions, callbacks: StreamCallbacks): StreamResult;

/**
 * 建立 SSE (Server-Sent Events) 连接
 * @param options 请求配置
 * @param callbacks SSE 回调函数
 * @returns 流控制器和完成 Promise
 */
export function sseConnect(options: StreamRequestOptions, callbacks: SSECallbacks): StreamResult;
