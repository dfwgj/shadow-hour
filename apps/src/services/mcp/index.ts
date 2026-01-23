/**
 * MCP 工具服务
 * 初始化和管理 AI 可用的工具
 * @author DF蓝梦/xierfloat
 * @date 2025-12-30
 */

import {
  getToolRegistry,
  createWebSearchTools,
  createWebFetchTools,
  WebFetchService,
  type ToolRegistry
} from "@xierfloat-monorepo/nativeScript-ai";

import { CalendarAdapter, NotificationAdapter } from "./adapters";
import { createDateTimeToolHandler, createCalendarTools, createNotificationTools } from "./tools";

// 单例适配器
let calendarAdapter: CalendarAdapter | null = null;
let notificationAdapter: NotificationAdapter | null = null;
let toolsInitialized = false;

/**
 * 初始化 MCP 工具
 */
export function initializeMCPTools(): ToolRegistry {
  if (toolsInitialized) {
    return getToolRegistry();
  }

  const registry = getToolRegistry();
  let totalTools = 0;

  // 创建适配器
  calendarAdapter = new CalendarAdapter();
  notificationAdapter = new NotificationAdapter();

  // 注册日历工具
  const calendarTools = createCalendarTools(calendarAdapter);
  for (const tool of calendarTools) {
    registry.register(tool);
  }
  totalTools += calendarTools.length;

  // 注册通知工具
  const notificationTools = createNotificationTools(notificationAdapter);
  for (const tool of notificationTools) {
    registry.register(tool);
  }
  totalTools += notificationTools.length;

  // 注册获取当前时间工具
  registry.register(createDateTimeToolHandler());
  totalTools += 1;

  // 注册网页搜索工具
  try {
    const webSearchTools = createWebSearchTools({
      defaultEngine: "searxng",
      searxng: {
        baseUrl: "https://searsh.gdmu-stuorg.com/",
        language: "zh-CN",
        engines: ["sogou", "presearch", "bing"]
      }
    });
    for (const tool of webSearchTools) {
      registry.register(tool);
    }
    totalTools += webSearchTools.length;
    console.log("[MCPTools] 网页搜索工具已注册");
  } catch (error) {
    console.warn("[MCPTools] 网页搜索工具注册失败:", error);
  }

  // 注册网页读取工具
  try {
    const fetchService = new WebFetchService({ timeout: 15000, maxBytes: 8000 });
    const webFetchTools = createWebFetchTools(fetchService);
    for (const tool of webFetchTools) {
      registry.register(tool);
    }
    totalTools += webFetchTools.length;
    console.log("[MCPTools] 网页读取工具已注册");
  } catch (error) {
    console.warn("[MCPTools] 网页读取工具注册失败:", error);
  }

  toolsInitialized = true;
  console.log(`[MCPTools] 已注册 ${totalTools} 个工具`);

  return registry;
}

/**
 * 获取工具定义（用于 API 请求）
 */
export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  const registry = getToolRegistry();
  return registry.getDefinitions().map(def => ({
    name: def.name,
    description: def.description,
    input_schema: def.inputSchema
  }));
}

/**
 * 执行工具
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  sessionId: string = "default"
): Promise<{ success: boolean; content: string; error?: string }> {
  const registry = getToolRegistry();
  const result = await registry.execute(name, args, {
    sessionId,
    metadata: { timestamp: Date.now() }
  });

  return {
    success: result.success,
    content: result.content,
    error: result.error
  };
}

/**
 * 检查工具是否已初始化
 */
export function isToolsInitialized(): boolean {
  return toolsInitialized;
}

// 导出适配器和工具（供外部使用）
export { CalendarAdapter, NotificationAdapter } from "./adapters";
export { createDateTimeToolHandler, dateTimeToolDefinition } from "./tools";
