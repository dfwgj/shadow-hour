/**
 * 本地通知服务
 * 用于日程提醒推送
 * @author xierfloat
 */
import { LocalNotifications } from "@nativescript/local-notifications";
import { isAndroid, Device, Utils } from "@nativescript/core";

// Android SDK 类型声明
declare const android: any;

export interface ScheduleNotificationOptions {
  id: number;
  title: string;
  body: string;
  /** 触发时间 */
  at: Date;
  /** 事件 UID，用于关联 */
  eventUid?: string;
}

/**
 * 通知服务类
 */
export class NotificationService {
  private static instance: NotificationService;
  private hasPermission: boolean = false;
  private channelCreated: boolean = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * 创建通知渠道 (Android 8.0+)
   */
  private createNotificationChannel(): void {
    if (!isAndroid || this.channelCreated) return;

    try {
      const sdkVersion = parseInt(Device.sdkVersion, 10);
      // Android 8.0 (API 26) 及以上需要通知渠道
      if (sdkVersion >= 26) {
        const context = Utils.android.getApplicationContext();
        if (!context) {
          console.warn("[NotificationService] Android context not available yet");
          return;
        }
        const notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);

        // 创建日程提醒渠道
        const channelId = "calendar-reminder";
        const channelName = "日程提醒";
        const channelDescription = "日程事件的提醒通知";
        const importance = android.app.NotificationManager.IMPORTANCE_HIGH;

        const channel = new android.app.NotificationChannel(channelId, channelName, importance);
        channel.setDescription(channelDescription);
        channel.enableVibration(true);
        channel.enableLights(true);

        notificationManager.createNotificationChannel(channel);
        console.log("[NotificationService] 通知渠道已创建: calendar-reminder");
      }
      this.channelCreated = true;
    } catch (error) {
      console.error("[NotificationService] 创建通知渠道失败:", error);
    }
  }

  /**
   * 请求通知权限
   */
  async requestPermission(): Promise<boolean> {
    try {
      // 先创建通知渠道
      this.createNotificationChannel();

      const granted = await LocalNotifications.requestPermission();
      this.hasPermission = granted;
      console.log("[NotificationService] 通知权限:", granted ? "已授权" : "未授权");
      return granted;
    } catch (error) {
      console.error("[NotificationService] 请求权限失败:", error);
      return false;
    }
  }

  /**
   * 检查是否有通知权限
   */
  async checkPermission(): Promise<boolean> {
    try {
      const granted = await LocalNotifications.hasPermission();
      this.hasPermission = granted;
      return granted;
    } catch (error) {
      console.error("[NotificationService] 检查权限失败:", error);
      return false;
    }
  }

  /**
   * 调度一个通知
   */
  async scheduleNotification(options: ScheduleNotificationOptions): Promise<boolean> {
    try {
      // 确保通知渠道已创建
      this.createNotificationChannel();

      // 确保有权限
      if (!this.hasPermission) {
        const granted = await this.requestPermission();
        if (!granted) {
          console.warn("[NotificationService] 没有通知权限");
          return false;
        }
      }

      const now = new Date();
      // 检查时间是否在未来
      if (options.at <= now) {
        console.warn("[NotificationService] 通知时间已过，不调度");
        console.warn(
          `[NotificationService] 当前时间: ${now.toLocaleString()}, 目标时间: ${options.at.toLocaleString()}`
        );
        return false;
      }

      const delayMs = options.at.getTime() - now.getTime();
      console.log(`[NotificationService] 准备调度通知...`);
      console.log(`[NotificationService] - ID: ${options.id}`);
      console.log(`[NotificationService] - 标题: ${options.title}`);
      console.log(`[NotificationService] - 内容: ${options.body}`);
      console.log(`[NotificationService] - 触发时间: ${options.at.toLocaleString()}`);
      console.log(`[NotificationService] - 延迟: ${Math.round(delayMs / 1000)} 秒`);

      await LocalNotifications.schedule([
        {
          id: options.id,
          title: options.title,
          body: options.body,
          at: options.at,
          badge: 1,
          sound: "default",
          channel: "calendar-reminder",
          forceShowWhenInForeground: true
        }
      ]);

      console.log(`[NotificationService] 通知已成功调度!`);
      return true;
    } catch (error) {
      console.error("[NotificationService] 调度通知失败:", error);
      return false;
    }
  }

  /**
   * 取消指定通知
   */
  async cancelNotification(id: number): Promise<void> {
    try {
      await LocalNotifications.cancel(id);
      console.log(`[NotificationService] 通知已取消: ID=${id}`);
    } catch (error) {
      console.error("[NotificationService] 取消通知失败:", error);
    }
  }

  /**
   * 取消所有通知
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await LocalNotifications.cancelAll();
      console.log("[NotificationService] 所有通知已取消");
    } catch (error) {
      console.error("[NotificationService] 取消所有通知失败:", error);
    }
  }

  /**
   * 根据事件 UID 生成通知 ID
   * 使用简单的哈希函数将字符串转换为数字
   */
  generateNotificationId(eventUid: string): number {
    let hash = 0;
    for (let i = 0; i < eventUid.length; i++) {
      const char = eventUid.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 为日程事件调度提醒通知
   * @param eventUid 事件 UID
   * @param title 事件标题
   * @param startTime 事件开始时间
   * @param reminderMinutes 提前多少分钟提醒（默认10分钟）
   */
  async scheduleEventReminder(
    eventUid: string,
    title: string,
    startTime: Date,
    reminderMinutes: number = 10
  ): Promise<boolean> {
    const notificationTime = new Date(startTime.getTime() - reminderMinutes * 60 * 1000);

    // 如果通知时间已过��不调度
    if (notificationTime <= new Date()) {
      console.log("[NotificationService] 提醒时间已过，不调度通知");
      return false;
    }

    const notificationId = this.generateNotificationId(eventUid);

    return this.scheduleNotification({
      id: notificationId,
      title: "日程提醒",
      body: `${title} 将在 ${reminderMinutes} 分钟后开始`,
      at: notificationTime,
      eventUid
    });
  }

  /**
   * 取消事件的提醒通知
   */
  async cancelEventReminder(eventUid: string): Promise<void> {
    const notificationId = this.generateNotificationId(eventUid);
    await this.cancelNotification(notificationId);
  }
}

// 导出单例
export const notificationService = NotificationService.getInstance();
