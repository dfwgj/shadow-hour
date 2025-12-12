/**
 * SQLite 日历数据访问服务
 */

import { SQLiteDatabase } from '@nativescript-community/sqlitedatabase'
import type { ICalendarDataAccess, CalendarEvent } from '~/models/interfaces'

export class SQLiteCalendarService implements ICalendarDataAccess {
  private db: SQLiteDatabase

  constructor(db: SQLiteDatabase) {
    this.db = db
    this.initTables()
  }

  /**
   * 初始化数据表
   */
  private async initTables(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        description TEXT,
        location TEXT,
        category TEXT,
        reminder INTEGER,
        repeat_type TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_start_time ON calendar_events(start_time);
      CREATE INDEX IF NOT EXISTS idx_category ON calendar_events(category);
      CREATE INDEX IF NOT EXISTS idx_repeat ON calendar_events(repeat_type);
    `

    await this.db.execSQL(createTableSQL)
  }

  /**
   * 查询日程
   */
  async query(params: {
    startDate?: string
    endDate?: string
    keyword?: string
    category?: string
    limit?: number
  }): Promise<CalendarEvent[]> {
    let query = `
      SELECT * FROM calendar_events
      WHERE 1=1
    `

    const queryParams: any[] = []

    // 日期范围
    if (params.startDate) {
      query += ' AND start_time >= ?'
      queryParams.push(params.startDate)
    }
    if (params.endDate) {
      query += ' AND start_time <= ?'
      queryParams.push(params.endDate)
    }

    // 关键词搜索
    if (params.keyword) {
      query += ' AND (title LIKE ? OR description LIKE ? OR location LIKE ?)'
      const keyword = `%${params.keyword}%`
      queryParams.push(keyword, keyword, keyword)
    }

    // 分类过滤
    if (params.category) {
      query += ' AND category = ?'
      queryParams.push(params.category)
    }

    // 排序
    query += ' ORDER BY start_time ASC'

    // 限制
    if (params.limit) {
      query += ' LIMIT ?'
      queryParams.push(params.limit)
    }

    const results = await this.db.all(query, ...queryParams)

    return results.map(row => this.mapRowToEvent(row))
  }

  /**
   * 创建日程
   */
  async create(params: {
    title: string
    startTime: string
    endTime?: string
    description?: string
    location?: string
    category?: string
    reminder?: number
    repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  }): Promise<CalendarEvent> {
    const now = Date.now()
    const id = `event_${now}_${Math.random().toString(36).slice(2, 9)}`

    const query = `
      INSERT INTO calendar_events (
        id, title, start_time, end_time, description, location,
        category, reminder, repeat_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    const nowIso = new Date().toISOString()
    await this.db.execSQL(query, [
      id,
      params.title,
      params.startTime,
      params.endTime || null,
      params.description || null,
      params.location || null,
      params.category || null,
      params.reminder || null,
      params.repeat || 'none',
      now,
      now
    ])

    // 返回创建的事件
    const events = await this.query({ startDate: params.startDate, endDate: params.startTime, limit: 1 })
    return events[0] || {
      id,
      title: params.title,
      startTime: params.startTime,
      endTime: params.endTime,
      description: params.description,
      location: params.location,
      category: params.category,
      reminder: params.reminder,
      repeat: params.repeat,
      createdAt: now,
      updatedAt: now
    }
  }

  /**
   * 更新日程
   */
  async update(params: {
    id: string
    title?: string
    startTime?: string
    endTime?: string
    description?: string
    location?: string
    category?: string
    reminder?: number
  }): Promise<CalendarEvent> {
    const updates: string[] = []
    const queryParams: any[] = []

    if (params.title !== undefined) {
      updates.push('title = ?')
      queryParams.push(params.title)
    }
    if (params.startTime !== undefined) {
      updates.push('start_time = ?')
      queryParams.push(params.startTime)
    }
    if (params.endTime !== undefined) {
      updates.push('end_time = ?')
      queryParams.push(params.endTime)
    }
    if (params.description !== undefined) {
      updates.push('description = ?')
      queryParams.push(params.description)
    }
    if (params.location !== undefined) {
      updates.push('location = ?')
      queryParams.push(params.location)
    }
    if (params.category !== undefined) {
      updates.push('category = ?')
      queryParams.push(params.category)
    }
    if (params.reminder !== undefined) {
      updates.push('reminder = ?')
      queryParams.push(params.reminder)
    }

    updates.push('updated_at = ?')
    queryParams.push(Date.now())

    queryParams.push(params.id)

    const query = `
      UPDATE calendar_events
      SET ${updates.join(', ')}
      WHERE id = ?
    `

    await this.db.execSQL(query, ...queryParams)

    // 返回更新后的事件
    const events = await this.query({ startDate: '1970-01-01', endDate: '2100-12-31', limit: 1000 })
    const updatedEvent = events.find(e => e.id === params.id)
    if (!updatedEvent) {
      throw new Error(`Event not found: ${params.id}`)
    }
    return updatedEvent
  }

  /**
   * 删除日程
   */
  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM calendar_events WHERE id = ?'
    await this.db.execSQL(query, [id])
  }

  /**
   * 将数据库行映射为事件对象
   */
  private mapRowToEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      startTime: row.start_time,
      endTime: row.end_time,
      description: row.description,
      location: row.location,
      category: row.category,
      reminder: row.reminder,
      repeat: row.repeat_type as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

/**
 * 创建日历服务实例
 */
export async function createCalendarService(): Promise<SQLiteCalendarService> {
  // 使用应用数据库
  const db = await SQLiteDatabase.openDatabase({
    name: 'tcamp.db'
  })

  return new SQLiteCalendarService(db)
}