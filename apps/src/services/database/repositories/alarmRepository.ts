/**
 * 提醒仓库
 * 负责提醒的 CRUD 操作
 * @author xierfloat
 */

import type { VAlarm } from "../../../types/calendar";
import { DatabaseManager } from "../core";

/**
 * 提醒更新参数
 */
export type UpdateAlarmInput = Partial<VAlarm>;

/**
 * 提醒仓库接口
 */
export interface IAlarmRepository {
  /** 创建提醒 */
  create(eventUid: string, alarm: VAlarm): Promise<void>;
  /** 根据事件 UID 查找提醒 */
  findByEventUid(eventUid: string): Promise<VAlarm[]>;
  /** 根据事件 UID 删除所有提醒 */
  deleteByEventUid(eventUid: string): Promise<void>;
  /** 根据 ID 删除提醒 */
  deleteById(id: number): Promise<void>;
  /** 更新提醒 */
  update(id: number, alarm: UpdateAlarmInput): Promise<void>;
}

/**
 * 提醒仓库类
 */
export class AlarmRepository implements IAlarmRepository {
  /**
   * 获取数据库连接
   */
  private getDb() {
    return DatabaseManager.getInstance().getConnection();
  }

  /**
   * 创建提醒
   */
  async create(eventUid: string, alarm: VAlarm): Promise<void> {
    const db = this.getDb();

    await db.execute(
      `INSERT INTO alarms (event_uid, action, trigger_minutes, description)
       VALUES (?, ?, ?, ?)`,
      [eventUid, alarm.action, alarm.trigger.minutes, alarm.description || null]
    );

    console.log("[AlarmRepository] 提醒已创建, event_uid:", eventUid);
  }

  /**
   * 根据事件 UID 查找提醒
   */
  async findByEventUid(eventUid: string): Promise<VAlarm[]> {
    const db = this.getDb();

    const rows = await db.select("SELECT * FROM alarms WHERE event_uid = ?", [eventUid]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((row: any) => ({
      action: row.action as VAlarm["action"],
      trigger: { minutes: row.trigger_minutes as number },
      description: row.description as string | undefined
    }));
  }

  /**
   * 根据事件 UID 删除所有提醒
   */
  async deleteByEventUid(eventUid: string): Promise<void> {
    const db = this.getDb();

    await db.execute("DELETE FROM alarms WHERE event_uid = ?", [eventUid]);
    console.log("[AlarmRepository] 已删除事件的所有提醒, event_uid:", eventUid);
  }

  /**
   * 根据 ID 删除提醒
   */
  async deleteById(id: number): Promise<void> {
    const db = this.getDb();

    await db.execute("DELETE FROM alarms WHERE id = ?", [id]);
    console.log("[AlarmRepository] 提醒已删除, id:", id);
  }

  /**
   * 更新提醒
   */
  async update(id: number, alarm: UpdateAlarmInput): Promise<void> {
    const db = this.getDb();
    const fields: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];

    if (alarm.action !== undefined) {
      fields.push("action = ?");
      values.push(alarm.action);
    }
    if (alarm.trigger !== undefined) {
      fields.push("trigger_minutes = ?");
      values.push(alarm.trigger.minutes);
    }
    if (alarm.description !== undefined) {
      fields.push("description = ?");
      values.push(alarm.description);
    }

    if (fields.length === 0) return;

    values.push(id);

    await db.execute(`UPDATE alarms SET ${fields.join(", ")} WHERE id = ?`, values);

    console.log("[AlarmRepository] 提醒已更新, id:", id);
  }
}
