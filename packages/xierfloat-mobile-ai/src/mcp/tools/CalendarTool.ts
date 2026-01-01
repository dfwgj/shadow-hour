/**
 * 日历工具 - SQLite 日程操作
 */

import type {
  ToolHandler,
  ToolDefinition,
  ToolExecutionResult,
  CalendarQueryParams,
  CalendarCreateParams,
  CalendarUpdateParams,
  CalendarDeleteParams
} from "../../types/tool";

/** 日历数据访问接口 (由外部注入) */
export interface CalendarDataAccess {
  query(params: CalendarQueryParams): Promise<CalendarEvent[]>;
  create(params: CalendarCreateParams): Promise<CalendarEvent>;
  update(params: CalendarUpdateParams): Promise<CalendarEvent>;
  delete(id: string): Promise<void>;
  /** 批量创建日程 */
  batchCreate?(params: CalendarCreateParams[]): Promise<CalendarEvent[]>;
  /** 批量删除日程 */
  batchDelete?(ids: string[]): Promise<void>;
}

/** 日历事件 */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  description?: string;
  location?: string;
  category?: string;
  reminder?: number;
  repeat?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  createdAt: number;
  updatedAt: number;
}

/**
 * 日历查询工具定义
 */
export const calendarQueryDefinition: ToolDefinition = {
  name: "calendar_query",
  displayName: "查询日程",
  description: "查询日历中的日程事件。可按日期范围、关键词、分类等条件筛选。",
  inputSchema: {
    type: "object",
    properties: {
      startDate: {
        type: "string",
        description: "开始日期 (ISO 格式，如 2024-01-01)"
      },
      endDate: {
        type: "string",
        description: "结束日期 (ISO 格式)"
      },
      keyword: {
        type: "string",
        description: "搜索关键词"
      },
      category: {
        type: "string",
        description: "日程分类"
      },
      limit: {
        type: "number",
        description: "返回结果数量限制",
        default: 20
      }
    }
  },
  category: "calendar"
};

/**
 * 日历创建工具定义
 */
export const calendarCreateDefinition: ToolDefinition = {
  name: "calendar_create",
  displayName: "创建日程",
  description: "创建新的日程事件。支持设置标题、时间、描述、地点、提醒等。",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "日程标题"
      },
      startTime: {
        type: "string",
        description: "开始时间 (ISO 格式，如 2024-01-01T10:00:00)"
      },
      endTime: {
        type: "string",
        description: "结束时间 (ISO 格式)"
      },
      description: {
        type: "string",
        description: "日程描述"
      },
      location: {
        type: "string",
        description: "地点"
      },
      category: {
        type: "string",
        description: "日程分类"
      },
      reminder: {
        type: "number",
        description: "提前提醒分钟数"
      },
      repeat: {
        type: "string",
        description: "重复规则",
        enum: ["none", "daily", "weekly", "monthly", "yearly"]
      }
    },
    required: ["title", "startTime"]
  },
  category: "calendar"
};

/**
 * 日历更新工具定义
 */
export const calendarUpdateDefinition: ToolDefinition = {
  name: "calendar_update",
  displayName: "更新日程",
  description: "更新已有的日程事件。",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "日程ID"
      },
      title: {
        type: "string",
        description: "新标题"
      },
      startTime: {
        type: "string",
        description: "新开始时间"
      },
      endTime: {
        type: "string",
        description: "新结束时间"
      },
      description: {
        type: "string",
        description: "新描述"
      },
      location: {
        type: "string",
        description: "新地点"
      },
      category: {
        type: "string",
        description: "新分类"
      },
      reminder: {
        type: "number",
        description: "新提醒时间"
      }
    },
    required: ["id"]
  },
  category: "calendar"
};

/**
 * 日历删除工具定义
 */
export const calendarDeleteDefinition: ToolDefinition = {
  name: "calendar_delete",
  displayName: "删除日程",
  description: "删除指定的日程事件。",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "要删除的日程ID"
      }
    },
    required: ["id"]
  },
  category: "calendar",
  dangerous: true
};

/**
 * 创建日历查询工具处理器
 */
export function createCalendarQueryHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarQueryDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const params = args as CalendarQueryParams;
      const events = await dataAccess.query(params);

      return {
        success: true,
        content: JSON.stringify(
          {
            count: events.length,
            events: events.map(e => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime,
              endTime: e.endTime,
              category: e.category,
              location: e.location
            }))
          },
          null,
          2
        )
      };
    }
  };
}

/**
 * 创建日历创建工具处理器
 */
export function createCalendarCreateHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarCreateDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const params = args as unknown as CalendarCreateParams;
      const event = await dataAccess.create(params);

      return {
        success: true,
        content: JSON.stringify(
          {
            message: "日程创建成功",
            event: {
              id: event.id,
              title: event.title,
              startTime: event.startTime
            }
          },
          null,
          2
        )
      };
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = [];
      if (!args.title) errors.push("title is required");
      if (!args.startTime) errors.push("startTime is required");
      return { valid: errors.length === 0, errors };
    }
  };
}

/**
 * 创建日历更新工具处理器
 */
export function createCalendarUpdateHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarUpdateDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const params = args as unknown as CalendarUpdateParams;
      const event = await dataAccess.update(params);

      return {
        success: true,
        content: JSON.stringify(
          {
            message: "日程更新成功",
            event: {
              id: event.id,
              title: event.title,
              startTime: event.startTime
            }
          },
          null,
          2
        )
      };
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = [];
      if (!args.id) errors.push("id is required");
      return { valid: errors.length === 0, errors };
    }
  };
}

/**
 * 创建日历删除工具处理器
 */
export function createCalendarDeleteHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarDeleteDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const params = args as unknown as CalendarDeleteParams;
      await dataAccess.delete(params.id);

      return {
        success: true,
        content: JSON.stringify(
          {
            message: "日程删除成功",
            deletedId: params.id
          },
          null,
          2
        )
      };
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = [];
      if (!args.id) errors.push("id is required");
      return { valid: errors.length === 0, errors };
    }
  };
}

/**
 * 批量创建日程工具定义
 */
export const calendarBatchCreateDefinition: ToolDefinition = {
  name: "calendar_batch_create",
  displayName: "批量创建日程",
  description: "一次性创建多个日程事件。适用于需要添加多个相关日程的场景。",
  inputSchema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        description: "日程事件数组，每个事件包含 title 和 startTime"
      }
    },
    required: ["events"]
  },
  category: "calendar"
};

/**
 * 批量删除日程工具定义
 */
export const calendarBatchDeleteDefinition: ToolDefinition = {
  name: "calendar_batch_delete",
  displayName: "批量删除日程",
  description: "一次性删除多个日程事件。",
  inputSchema: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        description: "要删除的日程ID数组"
      }
    },
    required: ["ids"]
  },
  category: "calendar",
  dangerous: true
};

/**
 * 创建批量创建日程工具处理器
 */
export function createCalendarBatchCreateHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarBatchCreateDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const events = args.events as CalendarCreateParams[];

      if (!events || !Array.isArray(events) || events.length === 0) {
        return {
          success: false,
          content: "",
          error: "请提供要创建的日程列表"
        };
      }

      const results: CalendarEvent[] = [];
      const errors: string[] = [];

      // 如果有批量创建方法，使用它
      if (dataAccess.batchCreate) {
        try {
          const created = await dataAccess.batchCreate(events);
          results.push(...created);
        } catch (e: any) {
          errors.push(e.message || "批量创建失败");
        }
      } else {
        // 否则逐个创建
        for (let i = 0; i < events.length; i++) {
          const eventParams = events[i];
          if (!eventParams) continue;
          try {
            const event = await dataAccess.create(eventParams);
            results.push(event);
          } catch (e: any) {
            errors.push(`第${i + 1}个日程创建失败: ${e.message}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        content: JSON.stringify(
          {
            message: `成功创建 ${results.length} 个日程` + (errors.length > 0 ? `，${errors.length} 个失败` : ""),
            created: results.map(e => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime
            })),
            errors: errors.length > 0 ? errors : undefined
          },
          null,
          2
        )
      };
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = [];
      const events = args.events as any[];

      if (!events || !Array.isArray(events)) {
        errors.push("events must be an array");
      } else if (events.length === 0) {
        errors.push("events array cannot be empty");
      } else {
        for (let i = 0; i < events.length; i++) {
          if (!events[i].title) errors.push(`events[${i}].title is required`);
          if (!events[i].startTime) errors.push(`events[${i}].startTime is required`);
        }
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

/**
 * 创建批量删除日程工具处理器
 */
export function createCalendarBatchDeleteHandler(dataAccess: CalendarDataAccess): ToolHandler {
  return {
    definition: calendarBatchDeleteDefinition,
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const ids = args.ids as string[];

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return {
          success: false,
          content: "",
          error: "请提供要删除的日程ID列表"
        };
      }

      const deleted: string[] = [];
      const errors: string[] = [];

      // 如果有批量删除方法，使用它
      if (dataAccess.batchDelete) {
        try {
          await dataAccess.batchDelete(ids);
          deleted.push(...ids);
        } catch (e: any) {
          errors.push(e.message || "批量删除失败");
        }
      } else {
        // 否则逐个删除
        for (const id of ids) {
          try {
            await dataAccess.delete(id);
            deleted.push(id);
          } catch (e: any) {
            errors.push(`删除 ${id} 失败: ${e.message}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        content: JSON.stringify(
          {
            message: `成功删除 ${deleted.length} 个日程` + (errors.length > 0 ? `，${errors.length} 个失败` : ""),
            deletedIds: deleted,
            errors: errors.length > 0 ? errors : undefined
          },
          null,
          2
        )
      };
    },
    validate(args: Record<string, unknown>) {
      const errors: string[] = [];
      const ids = args.ids as string[];

      if (!ids || !Array.isArray(ids)) {
        errors.push("ids must be an array");
      } else if (ids.length === 0) {
        errors.push("ids array cannot be empty");
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

/**
 * 创建所有日历工具处理器
 */
export function createCalendarTools(dataAccess: CalendarDataAccess): ToolHandler[] {
  return [
    createCalendarQueryHandler(dataAccess),
    createCalendarCreateHandler(dataAccess),
    createCalendarUpdateHandler(dataAccess),
    createCalendarDeleteHandler(dataAccess),
    createCalendarBatchCreateHandler(dataAccess),
    createCalendarBatchDeleteHandler(dataAccess)
  ];
}
