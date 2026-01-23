/**
 * 通知工具定义
 * @author DF蓝梦/xierfloat
 * @date 2025-12-26
 */

import type { ToolDefinition, ToolHandler, ToolContext } from "@xierfloat-monorepo/nativeScript-ai";

// ==================== Types ====================

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  scheduledAt: string;
  data?: Record<string, unknown>;
}

export interface NotificationService {
  send(params: { title: string; body: string; data?: Record<string, unknown> }): Promise<void>;
  schedule(params: {
    title: string;
    body: string;
    scheduledAt: string;
    data?: Record<string, unknown>;
  }): Promise<string>;
  cancel(notificationId: string): Promise<void>;
  cancelAll(): Promise<void>;
  getScheduled(): Promise<ScheduledNotification[]>;
}

// ==================== Tool Definitions ====================

export const notificationSendDefinition: ToolDefinition = {
  name: "notification_send",
  displayName: "发送通知",
  description: "立即发送一条通知。",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "通知标题" },
      body: { type: "string", description: "通知内容" }
    },
    required: ["title", "body"]
  },
  category: "notification"
};

export const notificationScheduleDefinition: ToolDefinition = {
  name: "notification_schedule",
  displayName: "调度通知",
  description: "在指定时间发送通知。",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "通知标题" },
      body: { type: "string", description: "通知内容" },
      scheduledAt: { type: "string", description: "发送时间 (ISO 8601)" }
    },
    required: ["title", "body", "scheduledAt"]
  },
  category: "notification"
};

export const notificationCancelDefinition: ToolDefinition = {
  name: "notification_cancel",
  displayName: "取消通知",
  description: "取消一条已调度的通知。",
  inputSchema: {
    type: "object",
    properties: {
      notificationId: { type: "string", description: "通知 ID" }
    },
    required: ["notificationId"]
  },
  category: "notification"
};

export const notificationListDefinition: ToolDefinition = {
  name: "notification_list",
  displayName: "查看调度通知",
  description: "查看所有已调度的通知。",
  inputSchema: {
    type: "object",
    properties: {}
  },
  category: "notification"
};

// ==================== Factory Functions ====================

export function createNotificationSendHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationSendDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext) {
      try {
        const params = args as { title: string; body: string };
        await service.send(params);
        return {
          success: true,
          content: "通知已发送"
        };
      } catch (error) {
        return {
          success: false,
          content: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export function createNotificationScheduleHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationScheduleDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext) {
      try {
        const params = args as { title: string; body: string; scheduledAt: string };
        const id = await service.schedule(params);
        return {
          success: true,
          content: `通知已调度，ID: ${id}`
        };
      } catch (error) {
        return {
          success: false,
          content: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export function createNotificationCancelHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationCancelDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext) {
      try {
        const params = args as { notificationId: string };
        await service.cancel(params.notificationId);
        return {
          success: true,
          content: `通知 ${params.notificationId} 已取消`
        };
      } catch (error) {
        return {
          success: false,
          content: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export function createNotificationListHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationListDefinition,
    async execute(_args: Record<string, unknown>, _context: ToolContext) {
      try {
        const notifications = await service.getScheduled();
        return {
          success: true,
          content: JSON.stringify(notifications, null, 2)
        };
      } catch (error) {
        return {
          success: false,
          content: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export function createNotificationTools(service: NotificationService): ToolHandler[] {
  return [
    createNotificationSendHandler(service),
    createNotificationScheduleHandler(service),
    createNotificationCancelHandler(service),
    createNotificationListHandler(service)
  ];
}
