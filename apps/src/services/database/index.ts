/**
 * 数据库服务入口
 * @author xierfloat
 */

export { DatabaseManager } from "./core";
export { EventRepository } from "./repositories/eventRepository";
export { AlarmRepository } from "./repositories/alarmRepository";

// 便捷导出
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
