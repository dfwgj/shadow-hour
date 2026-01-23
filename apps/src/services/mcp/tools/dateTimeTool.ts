/**
 * 日期时间工具
 * 提供获取当前时间的工具处理器
 * @author DF蓝梦/xierfloat
 * @date 2025-12-30
 */

import { type ToolDefinition, type ToolHandler } from "@xierfloat-monorepo/nativeScript-ai";

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/**
 * 获取当前日期时间工具定义
 */
export const dateTimeToolDefinition: ToolDefinition = {
  name: "get_current_datetime",
  displayName: "获取当前时间",
  description: "获取当前的日期和时间信息，包括年月日、星期、时分秒等。用于帮助用户安排日程时确定时间。",
  inputSchema: {
    type: "object",
    properties: {}
  },
  category: "utility"
};

/**
 * 创建日期时间工具处理器
 */
export function createDateTimeToolHandler(): ToolHandler {
  return {
    definition: dateTimeToolDefinition,
    async execute() {
      const now = new Date();

      const result = {
        timestamp: now.getTime(),
        iso: now.toISOString(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        weekday: WEEKDAYS[now.getDay()],
        weekdayIndex: now.getDay(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        formatted: {
          date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
          time: `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
          full: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
        }
      };

      return {
        success: true,
        content: JSON.stringify(result, null, 2)
      };
    }
  };
}
