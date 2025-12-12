/**
 * MCP 工具导出
 */

export {
  type CalendarDataAccess,
  type CalendarEvent,
  calendarQueryDefinition,
  calendarCreateDefinition,
  calendarUpdateDefinition,
  calendarDeleteDefinition,
  createCalendarQueryHandler,
  createCalendarCreateHandler,
  createCalendarUpdateHandler,
  createCalendarDeleteHandler,
  createCalendarTools
} from './CalendarTool'

export {
  type NotificationService,
  type ScheduledNotification,
  notificationSendDefinition,
  notificationScheduleDefinition,
  notificationCancelDefinition,
  notificationListDefinition,
  createNotificationSendHandler,
  createNotificationScheduleHandler,
  createNotificationCancelHandler,
  createNotificationListHandler,
  createNotificationTools
} from './NotificationTool'

export {
  type WebSearchService,
  type SearchResult,
  webSearchDefinition,
  createWebSearchHandler,
  createWebSearchTools,
  MockWebSearchService
} from './WebSearchTool'
