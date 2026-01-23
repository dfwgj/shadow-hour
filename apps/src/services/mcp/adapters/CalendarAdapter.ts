/**
 * 日历数据访问适配器
 * 将 EventRepository 适配为 SDK 的 CalendarDataAccess 接口
 */

import type {
  CalendarDataAccess,
  CalendarEvent as MCPCalendarEvent,
  CalendarQueryParams,
  CalendarCreateParams,
  CalendarUpdateParams
} from "../tools/calendarTool";
import { EventRepository } from "../../database/repositories/eventRepository";
import { notificationService } from "../../notification";

export class CalendarAdapter implements CalendarDataAccess {
  private repo = new EventRepository();

  /**
   * 解析日期字符串为本地时间
   * "2025-12-30" -> 本地时间 2025-12-30 00:00:00
   * "2025-12-30T10:00:00" -> 保持原样
   */
  private parseLocalDate(dateStr: string): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    return new Date(dateStr);
  }

  /**
   * 将数据库事件转换为 MCP 事件格式
   */
  private toMCPEvent(event: {
    uid: string;
    summary: string;
    dtStart: Date;
    dtEnd?: Date;
    description?: string;
    location?: string;
    status?: string;
    created?: Date;
    lastModified?: Date;
  }): MCPCalendarEvent {
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

  async query(params: CalendarQueryParams): Promise<MCPCalendarEvent[]> {
    let events;

    console.log("[CalendarAdapter] 查询参数:", JSON.stringify(params));

    if (params.startDate && params.endDate) {
      const startDate = this.parseLocalDate(params.startDate);
      const endDate = this.parseLocalDate(params.endDate);
      endDate.setHours(23, 59, 59, 999);

      console.log("[CalendarAdapter] 查询日期范围:", startDate.toISOString(), "至", endDate.toISOString());
      events = await this.repo.findByDateRange(startDate, endDate);
    } else if (params.startDate) {
      const date = this.parseLocalDate(params.startDate);
      events = await this.repo.findByDate(date);
    } else if (params.keyword) {
      events = await this.repo.search(params.keyword);
    } else {
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

    return events.map(e => this.toMCPEvent(e));
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

    return this.toMCPEvent(event);
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

    return this.toMCPEvent(updated);
  }

  async delete(id: string): Promise<void> {
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
