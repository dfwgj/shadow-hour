/**
 * 数据库服务入口
 * 自动更新数据库结构
 * @author  DF蓝梦/xierfloat
 * @date 2025-12-15
 */

export { DatabaseManager } from "./core";
export { EventRepository } from "./repositories/eventRepository";
export { AlarmRepository } from "./repositories/alarmRepository";

// 导出
import { DatabaseManager } from "./core";
import { EventRepository } from "./repositories/eventRepository";

const db = DatabaseManager.getInstance();
const eventRepo = new EventRepository();

export const initDatabase = () => db.init();
export const closeDatabase = () => db.close();

// 事件操作
export const addEvent = eventRepo.create.bind(eventRepo);
export const updateEvent = eventRepo.update.bind(eventRepo);
export const deleteEvent = eventRepo.delete.bind(eventRepo);
export const getEvent = eventRepo.findById.bind(eventRepo);
export const getAllEvents = eventRepo.findAll.bind(eventRepo);
export const getEventsByDate = eventRepo.findByDate.bind(eventRepo);
export const getEventsByDateRange = eventRepo.findByDateRange.bind(eventRepo);
export const searchEvents = eventRepo.search.bind(eventRepo);
export const getUpcomingEvents = eventRepo.findUpcoming.bind(eventRepo);
