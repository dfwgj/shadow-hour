/**
 * 通知工具 - 本地通知调度
 */

import type {
  ToolHandler,
  ToolDefinition,
  ToolContext,
  ToolExecutionResult,
  NotificationSendParams,
  NotificationScheduleParams
} from '../../types/tool'

/** 通知服务接口 (由外部注入) */
export interface NotificationService {
  send(params: NotificationSendParams): Promise<void>
  schedule(params: NotificationScheduleParams): Promise<string>
  cancel(notificationId: string): Promise<void>
  cancelAll(): Promise<void>
  getScheduled(): Promise<ScheduledNotification[]>
}

/** 已调度的通知 */
export interface ScheduledNotification {
  id: string
  title: string
  body: string
  scheduledAt: string
  data?: Record<string, unknown>
}

/**
 * 发送通知工具定义
 */
export const notificationSendDefinition: ToolDefinition = {
  name: 'notification_send',
  displayName: '发送通知',
  description: '立即发送一条本地通知。',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '通知标题'
      },
      body: {
        type: 'string',
        description: '通知内容'
      },
      data: {
        type: 'object',
        description: '附加数据 (点击通知时传递)'
      }
    },
    required: ['title', 'body']
  },
  category: 'notification'
}

/**
 * 调度通知工具定义
 */
export const notificationScheduleDefinition: ToolDefinition = {
  name: 'notification_schedule',
  displayName: '调度通知',
  description: '在指定时间发送通知。用于设置日程提醒。',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '通知标题'
      },
      body: {
        type: 'string',
        description: '通知内容'
      },
      scheduledAt: {
        type: 'string',
        description: '调度时间 (ISO 格式，如 2024-01-01T10:00:00)'
      },
      data: {
        type: 'object',
        description: '附加数据'
      }
    },
    required: ['title', 'body', 'scheduledAt']
  },
  category: 'notification'
}

/**
 * 取消通知工具定义
 */
export const notificationCancelDefinition: ToolDefinition = {
  name: 'notification_cancel',
  displayName: '取消通知',
  description: '取消已调度的通知。',
  inputSchema: {
    type: 'object',
    properties: {
      notificationId: {
        type: 'string',
        description: '通知ID'
      }
    },
    required: ['notificationId']
  },
  category: 'notification'
}

/**
 * 查询已调度通知工具定义
 */
export const notificationListDefinition: ToolDefinition = {
  name: 'notification_list',
  displayName: '查询通知',
  description: '查询所有已调度的通知。',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  category: 'notification'
}

/**
 * 创建发送通知工具处理器
 */
export function createNotificationSendHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationSendDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolExecutionResult> {
      const params = args as unknown as NotificationSendParams
      await service.send(params)

      return {
        success: true,
        content: JSON.stringify({
          message: '通知已发送',
          title: params.title
        }, null, 2)
      }
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = []
      if (!args.title) errors.push('title is required')
      if (!args.body) errors.push('body is required')
      return { valid: errors.length === 0, errors }
    }
  }
}

/**
 * 创建调度通知工具处理器
 */
export function createNotificationScheduleHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationScheduleDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolExecutionResult> {
      const params = args as unknown as NotificationScheduleParams

      // 验证时间是否在未来
      const scheduledTime = new Date(params.scheduledAt).getTime()
      if (scheduledTime <= Date.now()) {
        return {
          success: false,
          content: '',
          error: '调度时间必须是未来时间'
        }
      }

      const notificationId = await service.schedule(params)

      return {
        success: true,
        content: JSON.stringify({
          message: '通知已调度',
          notificationId,
          scheduledAt: params.scheduledAt,
          title: params.title
        }, null, 2)
      }
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = []
      if (!args.title) errors.push('title is required')
      if (!args.body) errors.push('body is required')
      if (!args.scheduledAt) errors.push('scheduledAt is required')
      return { valid: errors.length === 0, errors }
    }
  }
}

/**
 * 创建取消通知工具处理器
 */
export function createNotificationCancelHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationCancelDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolExecutionResult> {
      const notificationId = args.notificationId as string
      await service.cancel(notificationId)

      return {
        success: true,
        content: JSON.stringify({
          message: '通知已取消',
          canceledId: notificationId
        }, null, 2)
      }
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = []
      if (!args.notificationId) errors.push('notificationId is required')
      return { valid: errors.length === 0, errors }
    }
  }
}

/**
 * 创建查询通知工具处理器
 */
export function createNotificationListHandler(service: NotificationService): ToolHandler {
  return {
    definition: notificationListDefinition,
    async execute(_args: Record<string, unknown>, _context: ToolContext): Promise<ToolExecutionResult> {
      const notifications = await service.getScheduled()

      return {
        success: true,
        content: JSON.stringify({
          count: notifications.length,
          notifications: notifications.map((n) => ({
            id: n.id,
            title: n.title,
            scheduledAt: n.scheduledAt
          }))
        }, null, 2)
      }
    }
  }
}

/**
 * 创建所有通知工具处理器
 */
export function createNotificationTools(service: NotificationService): ToolHandler[] {
  return [
    createNotificationSendHandler(service),
    createNotificationScheduleHandler(service),
    createNotificationCancelHandler(service),
    createNotificationListHandler(service)
  ]
}
