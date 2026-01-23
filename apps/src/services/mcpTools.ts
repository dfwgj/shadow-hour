/**
 * MCP 工具服务
 * 初始化和管理 AI 可用的工具
 * @author DF蓝梦/xierfloat
 * @date 2025-12-30
 */

import {
  getToolRegistry,
  createCalendarTools,
  createNotificationTools,
  createWebSearchTools,
  createWebFetchTools,
  WebFetchService,
  type CalendarDataAccess,
  type CalendarEvent as MCPCalendarEvent,
  type NotificationService as MCPNotificationService,
  type ScheduledNotification,
  type ToolRegistry,
  type ToolHandler,
  type ToolDefinition,
  type CalendarQueryParams,
  type CalendarCreateParams,
  type CalendarUpdateParams
} from "@xierfloat-monorepo/mobile-ai";
import { EventRepository } from "./database/repositories/eventRepository";
import { notificationService } from "./notification";

/**
 * 获取当前日期时间工具定义
 */
const getCurrentDateTimeDefinition: ToolDefinition = {
  name: "get_current_datetime",
  displayName: "获取当前时间",
  description: "获取当前的日期和时间信息，包括年月日、星期、时分秒等。用于帮助用户安排日程时确定时间。",
  inputSchema: {
    type: "object",
    properties: {}
  },
  category: "utility"
};

/**
 * 创建获取当前日期时间工具
 */
function createGetCurrentDateTimeHandler(): ToolHandler {
  return {
    definition: getCurrentDateTimeDefinition,
    async execute() {
      const now = new Date();
      const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

      const result = {
        timestamp: now.getTime(),
        iso: now.toISOString(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        weekday: weekdays[now.getDay()],
        weekdayIndex: now.getDay(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        formatted: {
          date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
          time: `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
          full: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
        }
      };

      return {
        success: true,
        content: JSON.stringify(result, null, 2)
      };
    }
  };
}

/**
 * 日历数据访问适配器
 * 将 EventRepository 适配为 CalendarDataAccess 接口
 */
class CalendarDataAccessAdapter implements CalendarDataAccess {
  private repo = new EventRepository();

  /**
   * 解析日期字符串为本地时间
   * "2025-12-30" -> 本地时间 2025-12-30 00:00:00
   * "2025-12-30T10:00:00" -> 保持原样
   */
  private parseLocalDate(dateStr: string): Date {
    // 如果是纯日期格式 (YYYY-MM-DD)，添加本地时间
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    // 否则直接解析
    return new Date(dateStr);
  }

  async query(params: CalendarQueryParams): Promise<MCPCalendarEvent[]> {
    let events;

    console.log("[CalendarAdapter] 查询参数:", JSON.stringify(params));

    if (params.startDate && params.endDate) {
      // 按日期范围查询
      // 处理日期字符串，确保使用本地时间
      const startDate = this.parseLocalDate(params.startDate);
      const endDate = this.parseLocalDate(params.endDate);

      // 将结束日期设为当天结束 (23:59:59.999)
      endDate.setHours(23, 59, 59, 999);

      console.log("[CalendarAdapter] 查询日期范围:", startDate.toISOString(), "至", endDate.toISOString());
      events = await this.repo.findByDateRange(startDate, endDate);
    } else if (params.startDate) {
      // 只有开始日期，查询当天
      const date = this.parseLocalDate(params.startDate);
      events = await this.repo.findByDate(date);
    } else if (params.keyword) {
      // 按关键词搜索
      events = await this.repo.search(params.keyword);
    } else {
      // 获取所有事件
      events = await this.repo.findAll();
    }

    console.log("[CalendarAdapter] 查询到", events.length, "条记录");

    // 按分类过滤
    if (params.category) {
      events = events.filter(e => e.status === params.category);
    }

    // 限制返回数量
    if (params.limit && events.length > params.limit) {
      events = events.slice(0, params.limit);
    }

    // 转换为 MCP 日历事件格式
    return events.map(e => ({
      id: e.uid,
      title: e.summary,
      startTime: e.dtStart.toISOString(),
      endTime: e.dtEnd?.toISOString(),
      description: e.description,
      location: e.location,
      category: e.status,
      createdAt: e.created?.getTime() || Date.now(),
      updatedAt: e.lastModified?.getTime() || Date.now()
    }));
  }

  async create(params: CalendarCreateParams): Promise<MCPCalendarEvent> {
    const event = await this.repo.create({
      summary: params.title,
      dtStart: new Date(params.startTime),
      dtEnd: params.endTime ? new Date(params.endTime) : undefined,
      description: params.description,
      location: params.location,
      status: (params.category as "TENTATIVE" | "CONFIRMED" | "CANCELLED") || "CONFIRMED"
    });

    // 如果设置了提醒，调度通知
    if (params.reminder && params.reminder > 0) {
      await notificationService.scheduleEventReminder(event.uid, event.summary, event.dtStart, params.reminder);
    }

    return {
      id: event.uid,
      title: event.summary,
      startTime: event.dtStart.toISOString(),
      endTime: event.dtEnd?.toISOString(),
      description: event.description,
      location: event.location,
      category: event.status,
      createdAt: event.created?.getTime() || Date.now(),
      updatedAt: event.lastModified?.getTime() || Date.now()
    };
  }

  async update(params: CalendarUpdateParams): Promise<MCPCalendarEvent> {
    await this.repo.update(params.id, {
      summary: params.title,
      dtStart: params.startTime ? new Date(params.startTime) : undefined,
      dtEnd: params.endTime ? new Date(params.endTime) : undefined,
      description: params.description,
      location: params.location,
      status: params.category as "TENTATIVE" | "CONFIRMED" | "CANCELLED" | undefined
    });

    const updated = await this.repo.findById(params.id);
    if (!updated) {
      throw new Error(`Event not found: ${params.id}`);
    }

    return {
      id: updated.uid,
      title: updated.summary,
      startTime: updated.dtStart.toISOString(),
      endTime: updated.dtEnd?.toISOString(),
      description: updated.description,
      location: updated.location,
      category: updated.status,
      createdAt: updated.created?.getTime() || Date.now(),
      updatedAt: updated.lastModified?.getTime() || Date.now()
    };
  }

  async delete(id: string): Promise<void> {
    // 取消关联的通知
    await notificationService.cancelEventReminder(id);
    await this.repo.delete(id);
  }

  async batchCreate(params: CalendarCreateParams[]): Promise<MCPCalendarEvent[]> {
    console.log("[CalendarAdapter] 批量创建", params.length, "个日程");
    const results: MCPCalendarEvent[] = [];

    for (const param of params) {
      const event = await this.create(param);
      results.push(event);
    }

    return results;
  }

  async batchDelete(ids: string[]): Promise<void> {
    console.log("[CalendarAdapter] 批量删除", ids.length, "个日程");

    for (const id of ids) {
      await this.delete(id);
    }
  }
}

/**
 * 通知服务适配器
 * 将 NotificationService 适配为 MCP NotificationService 接口
 */
class NotificationServiceAdapter implements MCPNotificationService {
  private scheduledNotifications = new Map<string, ScheduledNotification>();

  async send(params: { title: string; body: string; data?: Record<string, unknown> }): Promise<void> {
    // 立即发送 = 调度为当前时间
    const id = Date.now();
    await notificationService.scheduleNotification({
      id,
      title: params.title,
      body: params.body,
      at: new Date()
    });
  }

  async schedule(params: {
    title: string;
    body: string;
    scheduledAt: string;
    data?: Record<string, unknown>;
  }): Promise<string> {
    const notificationId = `notif_${Date.now()}`;
    const numericId = notificationService.generateNotificationId(notificationId);

    // 解析时间 - 处理多种格式
    let scheduledDate: Date;
    const scheduledAt = params.scheduledAt;

    // 如果没有时区信息，当作本地时间处理
    if (scheduledAt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)) {
      // ISO 格式无时区，解析为本地时间
      const [datePart, timePart] = scheduledAt.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute, second = 0] = timePart.split(':').map(Number);
      scheduledDate = new Date(year, month - 1, day, hour, minute, second);
    } else {
      // 其他格式直接解析
      scheduledDate = new Date(scheduledAt);
    }

    console.log(`[NotificationAdapter] 调度通知: ${params.title}`);
    console.log(`[NotificationAdapter] 原始时间: ${scheduledAt}`);
    console.log(`[NotificationAdapter] 解析时间: ${scheduledDate.toLocaleString()}`);
    console.log(`[NotificationAdapter] 当前时间: ${new Date().toLocaleString()}`);

    // 检查时间是否有效
    if (isNaN(scheduledDate.getTime())) {
      throw new Error(`无效的时间格式: ${scheduledAt}`);
    }

    // 检查是否在未来
    if (scheduledDate.getTime() <= Date.now()) {
      throw new Error(`调度时间必须是未来时间，收到: ${scheduledDate.toLocaleString()}`);
    }

    await notificationService.scheduleNotification({
      id: numericId,
      title: params.title,
      body: params.body,
      at: scheduledDate
    });

    // 保存到内存中以便查询
    this.scheduledNotifications.set(notificationId, {
      id: notificationId,
      title: params.title,
      body: params.body,
      scheduledAt: params.scheduledAt,
      data: params.data
    });

    console.log(`[NotificationAdapter] 通知已调度，ID: ${notificationId}`);
    return notificationId;
  }

  async cancel(notificationId: string): Promise<void> {
    const numericId = notificationService.generateNotificationId(notificationId);
    await notificationService.cancelNotification(numericId);
    this.scheduledNotifications.delete(notificationId);
  }

  async cancelAll(): Promise<void> {
    await notificationService.cancelAllNotifications();
    this.scheduledNotifications.clear();
  }

  async getScheduled(): Promise<ScheduledNotification[]> {
    return Array.from(this.scheduledNotifications.values());
  }
}

// 单例适配器
let calendarAdapter: CalendarDataAccessAdapter | null = null;
let notificationAdapter: NotificationServiceAdapter | null = null;
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
  calendarAdapter = new CalendarDataAccessAdapter();
  notificationAdapter = new NotificationServiceAdapter();

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
  registry.register(createGetCurrentDateTimeHandler());
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
