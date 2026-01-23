/**
 * 日历工具定义
 * @author DF蓝梦/xierfloat
 * @date 2025-12-26
 */

import type { ToolDefinition, ToolHandler, ToolContext } from "@xierfloat-monorepo/nativeScript-ai";

// ==================== Types ====================

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  description?: string;
  location?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CalendarQueryParams {
  startDate?: string;
  endDate?: string;
  keyword?: string;
  category?: string;
  limit?: number;
}

export interface CalendarCreateParams {
  title: string;
  startTime: string;
  endTime?: string;
  description?: string;
  location?: string;
  category?: string;
  reminder?: number;
}

export interface CalendarUpdateParams {
  id: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  location?: string;
  category?: string;
}

export interface CalendarDataAccess {
  query(params: CalendarQueryParams): Promise<CalendarEvent[]>;
  create(params: CalendarCreateParams): Promise<CalendarEvent>;
  update(params: CalendarUpdateParams): Promise<CalendarEvent>;
  delete(id: string): Promise<void>;
  batchCreate?(params: CalendarCreateParams[]): Promise<CalendarEvent[]>;
  batchDelete?(ids: string[]): Promise<void>;
}

// ==================== Tool Definitions ====================

export const calendarQueryDefinition: ToolDefinition = {
  name: "calendar_query",
  displayName: "查询日程",
  description: "查询日历中的日程事件。可以按日期范围、关键词或分类查询。",
  inputSchema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "开始日期 (YYYY-MM-DD)" },
      endDate: { type: "string", description: "结束日期 (YYYY-MM-DD)" },
      keyword: { type: "string", description: "搜索关键词" },
      category: { type: "string", description: "分类" },
      limit: { type: "number", description: "最大返回数量" }
    }
  },
  category: "calendar"
};

export const calendarCreateDefinition: ToolDefinition = {
  name: "calendar_create",
  displayName: "创建日程",
  description: "创建新的日程事件。",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "日程标题" },
      startTime: { type: "string", description: "开始时间 (ISO 8601)" },
      endTime: { type: "string", description: "结束时间 (ISO 8601)" },
      description: { type: "string", description: "描述" },
      location: { type: "string", description: "地点" },
      category: { type: "string", description: "分类" },
      reminder: { type: "number", description: "提前提醒分钟数" }
    },
    required: ["title", "startTime"]
  },
  category: "calendar"
};

export const calendarUpdateDefinition: ToolDefinition = {
  name: "calendar_update",
  displayName: "更新日程",
  description: "更新已有的日程事件。",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "日程 ID" },
      title: { type: "string", description: "日程标题" },
      startTime: { type: "string", description: "开始时间" },
      endTime: { type: "string", description: "结束时间" },
      description: { type: "string", description: "描述" },
      location: { type: "string", description: "地点" },
      category: { type: "string", description: "分类" }
    },
    required: ["id"]
  },
  category: "calendar"
};

export const calendarDeleteDefinition: ToolDefinition = {
  name: "calendar_delete",
  displayName: "删除日程",
  description: "删除日程事件。",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "日程 ID" }
    },
    required: ["id"]
  },
  category: "calendar"
};

// ==================== Factory Functions ====================

export function createCalendarQueryHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarQueryDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext) {
      try {
        const params = args as CalendarQueryParams;
        const events = await dataAccess.query(params);
        return {
          success: true,
          content: JSON.stringify(events, null, 2)
        };
      } catch (error) {
        return {
          success: false,
          content: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export function createCalendarCreateHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarCreateDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext) {
      try {
        const params = args as unknown as CalendarCreateParams;
        const event = await dataAccess.create(params);
        return {
          success: true,
          content: JSON.stringify(event, null, 2)
        };
      } catch (error) {
        return {
          success: false,
          content: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export function createCalendarUpdateHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarUpdateDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext) {
      try {
        const params = args as unknown as CalendarUpdateParams;
        const event = await dataAccess.update(params);
        return {
          success: true,
          content: JSON.stringify(event, null, 2)
        };
      } catch (error) {
        return {
          success: false,
          content: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export function createCalendarDeleteHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarDeleteDefinition,
    async execute(args: Record<string, unknown>, _context: ToolContext) {
      try {
        const params = args as { id: string };
        await dataAccess.delete(params.id);
        return {
          success: true,
          content: `日程 ${params.id} 已删除`
        };
      } catch (error) {
        return {
          success: false,
          content: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export function createCalendarTools(dataAccess: CalendarDataAccess): ToolHandler[] {
  return [
    createCalendarQueryHandler(dataAccess),
    createCalendarCreateHandler(dataAccess),
    createCalendarUpdateHandler(dataAccess),
    createCalendarDeleteHandler(dataAccess)
  ];
}
