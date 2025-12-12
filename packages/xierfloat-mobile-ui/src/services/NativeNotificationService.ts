/**
 * NativeScript 通知服务实现
 */

import { LocalNotifications } from '@nativescript/local-notifications'
import type { INotificationService, ScheduledNotification } from '~/models/interfaces'

export class NativeNotificationService implements INotificationService {
  private scheduled: Map<string, ScheduledNotification> = new Map()

  constructor() {
    // 初始化通知权限
    this.requestPermissions()
  }

  /**
   * 请求通知权限
   */
  private async requestPermissions(): Promise<void> {
    try {
      const hasPermission = await LocalNotifications.hasPermission()
      if (!hasPermission) {
        await LocalNotifications.requestPermission()
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error)
    }
  }

  /**
   * 发送即时通知
   */
  async send(params: {
    title: string
    body: string
    data?: Record<string, unknown>
  }): Promise<void> {
    try {
      await LocalNotifications.schedule([{
        id: Date.now(),
        title: params.title,
        body: params.body,
        badge: 1,
        notificationLed: true,
        color: '#2196f3',
        channel: 'default',
        payload: params.data
      }])
    } catch (error) {
      console.error('Failed to send notification:', error)
    }
  }

  /**
   * 调度通知
   */
  async schedule(params: {
    title: string
    body: string
    scheduledAt: string
    data?: Record<string, unknown>
  }): Promise<string> {
    const scheduledTime = new Date(params.scheduledAt).getTime()
    const now = Date.now()

    if (scheduledTime <= now) {
      throw new Error('Scheduled time must be in the future')
    }

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const delaySeconds = Math.floor((scheduledTime - now) / 1000)

    try {
      await LocalNotifications.schedule([{
        id: notificationId,
        title: params.title,
        body: params.body,
        badge: 1,
        notificationLed: true,
        color: '#2196f3',
        channel: 'reminder',
        at: new Date(params.scheduledAt),
        payload: params.data
      }])

      // 保存调度信息
      const scheduled: ScheduledNotification = {
        id: notificationId,
        title: params.title,
        body: params.body,
        scheduledAt: params.scheduledAt,
        data: params.data
      }
      this.scheduled.set(notificationId, scheduled)

      return notificationId
    } catch (error) {
      console.error('Failed to schedule notification:', error)
      throw error
    }
  }

  /**
   * 取消通知
   */
  async cancel(notificationId: string): Promise<void> {
    try {
      await LocalNotifications.cancel(Number.parseInt(notificationId))
      this.scheduled.delete(notificationId)
    } catch (error) {
      console.error('Failed to cancel notification:', error)
    }
  }

  /**
   * 取消所有通知
   */
  async cancelAll(): Promise<void> {
    try {
      await LocalNotifications.cancelAll()
      this.scheduled.clear()
    } catch (error) {
      console.error('Failed to cancel all notifications:', error)
    }
  }

  /**
   * 获取已调度的通知
   */
  async getScheduled(): Promise<ScheduledNotification[]> {
    // 返回内存中保存的调度信息
    // 实际应用中应该从持久化存储中获取
    return Array.from(this.scheduled.values())
  }

  /**
   * 恢复调度信息（应用启动时调用）
   */
  async restoreScheduled(): Promise<void> {
    try {
      // 获取系统中的所有 scheduled 通知
      const pendingNotifications = await (LocalNotifications as any).getScheduledNotifications()

      // 清空内存
      this.scheduled.clear()

      // 重建调度信息
      for (const notif of pendingNotifications || []) {
        const scheduled: ScheduledNotification = {
          id: String(notif.id || notif.key),
          title: notif.title,
          body: notif.body,
          scheduledAt: notif.date.toISOString(),
          data: notif.payload
        }
        this.scheduled.set(scheduled.id, scheduled)
      }
    } catch (error) {
      console.error('Failed to restore scheduled notifications:', error)
    }
  }

  /**
   * 监听通知点击事件
   */
  onNotificationTap(callback: (notification: ScheduledNotification) => void): void {
    LocalNotifications.addOnNotificationReceivedListener(args => {
      if (args.payload) {
        callback({
          id: String(args.id),
          title: args.title || '',
          body: args.body || '',
          scheduledAt: new Date().toISOString(),
          data: args.payload
        })
      }
    })
  }
}

/**
 * 创建通知服务实例
 */
export function createNotificationService(): Promise<NativeNotificationService> {
  const service = new NativeNotificationService()

  // 恢复已调度的通知
  service.restoreScheduled().catch(console.error)

  return Promise.resolve(service)
}