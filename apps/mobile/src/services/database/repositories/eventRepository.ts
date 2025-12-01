/**
 * 事件仓库
 * 负责事件的 CRUD 操作
 * @author xierfloat
 */

import type { CalendarEvent, VAlarm } from "../../../types/calendar";
import { DatabaseManager } from "../core";
import { AlarmRepository } from "./alarmRepository";

/**
 * 事件创建参数（不包含自动生成的字段）
 */
export type CreateEventInput = Omit<CalendarEvent, "uid" | "created" | "lastModified">;

/**
 * 事件更新参数
 */
export type UpdateEventInput = Partial<CalendarEvent>;

/**
 * 事件仓库接口
 */
export interface IEventRepository {
  /** 创建事件 */
  create(event: CreateEventInput): Promise<CalendarEvent>;
  /** 更新事件 */
  update(uid: string, updates: UpdateEventInput): Promise<void>;
  /** 删除事件 */
  delete(uid: string): Promise<void>;
  /** 根据 UID 查找事件 */
  findById(uid: string): Promise<CalendarEvent | null>;
  /** 获取所有事件 */
  findAll(): Promise<CalendarEvent[]>;
  /** 根据日期查找事件 */
  findByDate(date: Date): Promise<CalendarEvent[]>;
  /** 根据日期范围查找事件 */
  findByDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  /** 搜索事件（按标题或描述） */
  search(keyword: string): Promise<CalendarEvent[]>;
  /** 获取即将到来的事件 */
  findUpcoming(days?: number): Promise<CalendarEvent[]>;
}

/**
 * 生成唯一 ID
 */
function generateUID(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}@calendar`;
}

/**
 * 将数据库行转换为 CalendarEvent 对象
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEvent(row: any, alarms: VAlarm[]): CalendarEvent {
  return {
    uid: row.uid,
    summary: row.summary,
    description: row.description || undefined,
    location: row.location || undefined,
    dtStart: new Date(row.dt_start),
    dtEnd: row.dt_end ? new Date(row.dt_end) : undefined,
    status: row.status || "CONFIRMED",
    rrule: row.rrule ? JSON.parse(row.rrule) : undefined,
    alarms: alarms.length > 0 ? alarms : undefined,
    created: row.created ? new Date(row.created) : undefined,
    lastModified: row.last_modified ? new Date(row.last_modified) : undefined
  };
}

/**
 * 事件仓库类
 */
export class EventRepository implements IEventRepository {
  private alarmRepo = new AlarmRepository();

  /**
   * 获取数据库连接
   */
  private getDb() {
    return DatabaseManager.getInstance().getConnection();
  }

  /**
   * 创建事件
   */
  async create(event: CreateEventInput): Promise<CalendarEvent> {
    const db = this.getDb();
    const uid = generateUID();
    const now = Date.now();

    const newEvent: CalendarEvent = {
      ...event,
      uid,
      created: new Date(now),
      lastModified: new Date(now)
    };

    await db.execute(
      `INSERT INTO events (uid, summary, description, location, dt_start, dt_end, status, rrule, created, last_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        newEvent.summary,
        newEvent.description || null,
        newEvent.location || null,
        newEvent.dtStart.getTime(),
        newEvent.dtEnd?.getTime() || null,
        newEvent.status || "CONFIRMED",
        newEvent.rrule ? JSON.stringify(newEvent.rrule) : null,
        now,
        now
      ]
    );

    // 添加提醒
    if (newEvent.alarms && newEvent.alarms.length > 0) {
      for (const alarm of newEvent.alarms) {
        await this.alarmRepo.create(uid, alarm);
      }
    }

    console.log("[EventRepository] 事件已创建:", uid);
    return newEvent;
  }

  /**
   * 更新事件
   */
  async update(uid: string, updates: UpdateEventInput): Promise<void> {
    const db = this.getDb();
    const now = Date.now();
    const fields: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];

    if (updates.summary !== undefined) {
      fields.push("summary = ?");
      values.push(updates.summary);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }
    if (updates.location !== undefined) {
      fields.push("location = ?");
      values.push(updates.location);
    }
    if (updates.dtStart !== undefined) {
      fields.push("dt_start = ?");
      values.push(updates.dtStart.getTime());
    }
    if (updates.dtEnd !== undefined) {
      fields.push("dt_end = ?");
      values.push(updates.dtEnd?.getTime() || null);
    }
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.rrule !== undefined) {
      fields.push("rrule = ?");
      values.push(updates.rrule ? JSON.stringify(updates.rrule) : null);
    }

    fields.push("last_modified = ?");
    values.push(now);
    values.push(uid);

    await db.execute(`UPDATE events SET ${fields.join(", ")} WHERE uid = ?`, values);

    // 更新提醒
    if (updates.alarms !== undefined) {
      await this.alarmRepo.deleteByEventUid(uid);
      for (const alarm of updates.alarms) {
        await this.alarmRepo.create(uid, alarm);
      }
    }

    console.log("[EventRepository] 事件已更新:", uid);
  }

  /**
   * 删除事件
   */
  async delete(uid: string): Promise<void> {
    const db = this.getDb();

    // 先删除关联的提醒
    await this.alarmRepo.deleteByEventUid(uid);

    await db.execute("DELETE FROM events WHERE uid = ?", [uid]);
    console.log("[EventRepository] 事件已删除:", uid);
  }

  /**
   * 根据 UID 查找事件
   */
  async findById(uid: string): Promise<CalendarEvent | null> {
    const db = this.getDb();
    const rows = await db.select("SELECT * FROM events WHERE uid = ?", [uid]);

    if (rows.length === 0) return null;

    const row = rows[0];
    const alarms = await this.alarmRepo.findByEventUid(uid);

    return rowToEvent(row, alarms);
  }

  /**
   * 获取所有事件
   */
  async findAll(): Promise<CalendarEvent[]> {
    const db = this.getDb();
    const rows = await db.select("SELECT * FROM events ORDER BY dt_start ASC");

    const events: CalendarEvent[] = [];
    for (const row of rows) {
      const alarms = await this.alarmRepo.findByEventUid(row.uid as string);
      events.push(rowToEvent(row, alarms));
    }

    return events;
  }

  /**
   * 根据日期查找事件
   */
  async findByDate(date: Date): Promise<CalendarEvent[]> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return this.findByDateRange(startOfDay, endOfDay);
  }

  /**
   * 根据日期范围查找事件
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const db = this.getDb();
    const rows = await db.select(
      `SELECT * FROM events
       WHERE dt_start >= ? AND dt_start < ?
       ORDER BY dt_start ASC`,
      [startDate.getTime(), endDate.getTime()]
    );

    const events: CalendarEvent[] = [];
    for (const row of rows) {
      const alarms = await this.alarmRepo.findByEventUid(row.uid as string);
      events.push(rowToEvent(row, alarms));
    }

    return events;
  }

  /**
   * 搜索事件
   */
  async search(keyword: string): Promise<CalendarEvent[]> {
    const db = this.getDb();
    const searchTerm = `%${keyword}%`;
    const rows = await db.select(
      `SELECT * FROM events
       WHERE summary LIKE ? OR description LIKE ?
       ORDER BY dt_start DESC`,
      [searchTerm, searchTerm]
    );

    const events: CalendarEvent[] = [];
    for (const row of rows) {
      const alarms = await this.alarmRepo.findByEventUid(row.uid as string);
      events.push(rowToEvent(row, alarms));
    }

    return events;
  }

  /**
   * 获取即将到来的事件
   */
  async findUpcoming(days: number = 7): Promise<CalendarEvent[]> {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.findByDateRange(now, endDate);
  }
}
