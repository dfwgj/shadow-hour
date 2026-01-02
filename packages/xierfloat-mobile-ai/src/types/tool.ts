/**
 * MCP 工具类型定义
 */

/** 工具参数类型 */
export type ToolParameterType = "string" | "number" | "boolean" | "array" | "object";

/** 工具参数定义 */
export interface ToolParameter {
  /** 参数名称 */
  name: string;
  /** 参数类型 */
  type: ToolParameterType;
  /** 参数描述 */
  description: string;
  /** 是否必需 */
  required?: boolean;
  /** 默认值 */
  default?: unknown;
  /** 枚举值 (type 为 string 时) */
  enum?: string[];
  /** 数组元素类型 (type 为 array 时) */
  items?: ToolParameter;
  /** 对象属性 (type 为 object 时) */
  properties?: ToolParameter[];
}

/** MCP 工具定义 */
export interface ToolDefinition {
  /** 工具名称 (唯一标识) */
  name: string;
  /** 工具显示名称 */
  displayName?: string;
  /** 工具描述 */
  description: string;
  /** 输入参数定义 */
  inputSchema: {
    type: "object";
    properties: Record<
      string,
      {
        type: ToolParameterType;
        description?: string;
        enum?: string[];
        items?: { type: ToolParameterType };
        default?: unknown;
      }
    >;
    required?: string[];
  };
  /** 工具分类 */
  category?: string;
  /** 是否为危险操作 (需要确认) */
  dangerous?: boolean;
}

/** 工具执行上下文 */
export interface ToolContext {
  /** 当前会话 ID */
  sessionId: string;
  /** 当前用户 ID (可选) */
  userId?: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/** 工具执行结果 */
export interface ToolExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 结果内容 (JSON 字符串) */
  content: string;
  /** 错误信息 (失败时) */
  error?: string;
  /** 执行耗时 (毫秒) */
  duration?: number;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/** 工具处理器接口 */
export interface ToolHandler {
  /** 工具定义 */
  definition: ToolDefinition;
  /** 执行工具 */
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolExecutionResult>;
  /** 验证参数 (可选) */
  validate?(args: Record<string, unknown>): { valid: boolean; errors?: string[] };
}

/** 工具注册表 */
export interface ToolRegistry {
  /** 注册工具 */
  register(handler: ToolHandler): void;
  /** 注销工具 */
  unregister(name: string): void;
  /** 获取工具 */
  get(name: string): ToolHandler | undefined;
  /** 获取所有工具定义 */
  getDefinitions(): ToolDefinition[];
  /** 检查工具是否存在 */
  has(name: string): boolean;
  /** 执行工具 */
  execute(name: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolExecutionResult>;
}

/** 内置工具名称 */
export type BuiltinToolName =
  | "calendar_query" // 查询日程
  | "calendar_create" // 创建日程
  | "calendar_update" // 更新日程
  | "calendar_delete" // 删除日程
  | "notification_send" // 发送通知
  | "notification_schedule" // 调度通知
  | "web_search"; // 网页搜索

/** 日历工具参数 */
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
  reminder?: number; // 提前提醒分钟数
  repeat?: "none" | "daily" | "weekly" | "monthly" | "yearly";
}

export interface CalendarUpdateParams {
  id: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  location?: string;
  category?: string;
  reminder?: number;
}

export interface CalendarDeleteParams {
  id: string;
}

/** 通知工具参数 */
export interface NotificationSendParams {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationScheduleParams {
  title: string;
  body: string;
  scheduledAt: string; // ISO 日期时间
  data?: Record<string, unknown>;
}

/** 搜索工具参数 */
export interface WebSearchParams {
  engine: string | undefined;
  query: string;
  limit?: number;
}
