/**
 * 数据库核心管理模块
 * 负责数据库的初始化、连接管理
 * 自动更新数据库结构
 * @author  DF蓝梦/xierfloat
 * @date 2025-12-15
 */

import { Application, path, knownFolders } from "@nativescript/core";

// 数据库配置
const DB_NAME = "calendar.db";
// SQLite 模块和数据库实例
let SQLite: any = null;
let db: any = null;

/**
 * 数据库管理器（单例模式）
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private initialized = false;

  private constructor() { }

  /**
   * 获取单例实例
   */
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * 获取数据库连接
   */
  getConnection(): any {
    if (!db) {
      throw new Error("数据库未初始化，请先调用 init()");
    }
    return db;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取数据库路径
   */
  private getDatabasePath(): string {
    if (Application.android) {
      // Android: /data/data/<package>/databases/calendar.db
      const context = Application.android.context;
      return context.getDatabasePath(DB_NAME).getAbsolutePath();
    } else {
      // iOS: 使用 Documents 目录
      return path.join(knownFolders.documents().path, DB_NAME);
    }
  }

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // 动态导入 SQLite 模块
      const sqliteModule = await import("@nativescript-community/sqlite");
      SQLite = sqliteModule;

      // 获取数据库路径
      const dbPath = this.getDatabasePath();

      // 打开或创建数据库
      db = await SQLite.openOrCreate(dbPath);

      // 创建表结构
      await this.createTables();

      this.initialized = true;
      console.log("[DatabaseManager] 数据库初始化成功, 路径:", dbPath);
    } catch (error) {
      console.error("[DatabaseManager] 数据库初始化失败:", error);
      throw error;
    }
  }

  /**
   * 创建表结构
   */
  private async createTables(): Promise<void> {
    if (!db) return;

    // 事件表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE NOT NULL,
        summary TEXT NOT NULL,
        description TEXT,
        location TEXT,
        dt_start INTEGER NOT NULL,
        dt_end INTEGER,
        status TEXT DEFAULT 'CONFIRMED',
        rrule TEXT,
        created INTEGER,
        last_modified INTEGER
      )
    `);

    // 提醒表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS alarms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_uid TEXT NOT NULL,
        action TEXT DEFAULT 'DISPLAY',
        trigger_minutes INTEGER NOT NULL,
        description TEXT,
        FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
      )
    `);

    // 创建索引
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_events_dt_start ON events(dt_start)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_events_uid ON events(uid)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_alarms_event_uid ON alarms(event_uid)
    `);

    console.log("[DatabaseManager] 表结构创建完成");
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (db) {
      await db.close();
      db = null;
      this.initialized = false;
      console.log("[DatabaseManager] 数据库已关闭");
    }
  }
}
