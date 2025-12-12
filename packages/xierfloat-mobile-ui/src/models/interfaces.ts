/**
 * 接口定义 - 用于数据访问层
 */

/** 日历数据访问接口 */
export interface ICalendarDataAccess {
  /** 查询日程 */
  query(params: {
    startDate?: string
    endDate?: string
    keyword?: string
    category?: string
    limit?: number
  }): Promise<CalendarEvent[]>

  /** 创建日程 */
  create(params: {
    title: string
    startTime: string
    endTime?: string
    description?: string
    location?: string
    category?: string
    reminder?: number
    repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  }): Promise<CalendarEvent>

  /** 更新日程 */
  update(params: {
    id: string
    title?: string
    startTime?: string
    endTime?: string
    description?: string
    location?: string
    category?: string
    reminder?: number
  }): Promise<CalendarEvent>

  /** 删除日程 */
  delete(id: string): Promise<void>
}

/** 日历事件 */
export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime?: string
  description?: string
  location?: string
  category?: string
  reminder?: number
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  createdAt: number
  updatedAt: number
}

/** 通知服务接口 */
export interface INotificationService {
  /** 发送通知 */
  send(params: {
    title: string
    body: string
    data?: Record<string, unknown>
  }): Promise<void>

  /** 调度通知 */
  schedule(params: {
    title: string
    body: string
    scheduledAt: string
    data?: Record<string, unknown>
  }): Promise<string>

  /** 取消通知 */
  cancel(notificationId: string): Promise<void>

  /** 取消所有通知 */
  cancelAll(): Promise<void>

  /** 获取已调度的通知 */
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

/** 搜索服务接口 */
export interface IWebSearchService {
  /** 搜索 */
  search(query: string, limit?: number): Promise<SearchResult[]>
}

/** 搜索结果 */
export interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
}