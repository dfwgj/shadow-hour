/**
 * 通知服务适配器
 * 将 NotificationService 适配为 SDK 的 MCPNotificationService 接口
 */

import type {
  NotificationService as MCPNotificationService,
  ScheduledNotification
} from "../tools/notificationTool";
import { notificationService } from "../../notification";

export class NotificationAdapter implements MCPNotificationService {
  private scheduledNotifications = new Map<string, ScheduledNotification>();

  /**
   * 解析时间字符串为本地时间
   */
  private parseScheduledTime(scheduledAt: string): Date {
    // 如果没有时区信息，当作本地时间处理
    if (scheduledAt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)) {
      const [datePart, timePart] = scheduledAt.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute, second = 0] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hour, minute, second);
    }
    return new Date(scheduledAt);
  }

  async send(params: { title: string; body: string; data?: Record<string, unknown> }): Promise<void> {
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
    const scheduledDate = this.parseScheduledTime(params.scheduledAt);

    console.log(`[NotificationAdapter] 调度通知: ${params.title}`);
    console.log(`[NotificationAdapter] 原始时间: ${params.scheduledAt}`);
    console.log(`[NotificationAdapter] 解析时间: ${scheduledDate.toLocaleString()}`);
    console.log(`[NotificationAdapter] 当前时间: ${new Date().toLocaleString()}`);

    // 验证时间
    if (isNaN(scheduledDate.getTime())) {
      throw new Error(`无效的时间格式: ${params.scheduledAt}`);
    }

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
