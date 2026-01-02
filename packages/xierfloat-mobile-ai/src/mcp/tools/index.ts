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
} from "./CalendarTool";

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
} from "./NotificationTool";

export {
  type WebSearchService,
  webSearchDefinition,
  createWebSearchHandler,
  createWebSearchTools,
  createSearchService
} from "./WebSearchTool/WebSearchTool";
export {
  type SearchResult,
  type SearchServiceConfig,
  type SearXNGConfig,
  type SearXNGResult
} from "./WebSearchTool/type";

// export {
//   type WebFetchResult,
//   type WebFetchConfig,
//   webFetchDefinition,
//   WebFetchService,
//   createWebFetchHandler,
//   createWebFetchTools
// } from "./WebFetchTool";
