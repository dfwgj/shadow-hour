/**
 * MCP 工具注册表实现 - 管理工具注册、发现、执行等功能
 * @author DF蓝梦/xierfloat
 * @date 2025-12-22
 */

import type {
  ToolDefinition,
  ToolHandler,
  ToolRegistry,
  ToolContext,
  ToolExecutionResult
} from '../types/tool'

/**
 * 工具注册表实现
 */
export class ToolRegistryImpl implements ToolRegistry {
  private handlers = new Map<string, ToolHandler>()

  /**
   * 注册工具
   */
  register(handler: ToolHandler): void {
    const name = handler.definition.name
    if (this.handlers.has(name)) {
      console.warn(`[ToolRegistry] Tool "${name}" already registered, overwriting`)
    }
    this.handlers.set(name, handler)
  }

  /**
   * 注销工具
   */
  unregister(name: string): void {
    this.handlers.delete(name)
  }

  /**
   * 获取工具
   */
  get(name: string): ToolHandler | undefined {
    return this.handlers.get(name)
  }

  /**
   * 获取所有工具定义
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.handlers.values()).map((h) => h.definition)
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.handlers.has(name)
  }

  /**
   * 执行工具
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const handler = this.handlers.get(name)
    if (!handler) {
      return {
        success: false,
        content: '',
        error: `Tool "${name}" not found`
      }
    }

    // 验证参数
    if (handler.validate) {
      const validation = handler.validate(args)
      if (!validation.valid) {
        return {
          success: false,
          content: '',
          error: `Invalid arguments: ${validation.errors?.join(', ')}`
        }
      }
    }

    const startTime = Date.now()

    try {
      const result = await handler.execute(args, context)
      return {
        ...result,
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * 批量注册工具
   */
  registerAll(handlers: ToolHandler[]): void {
    for (const handler of handlers) {
      this.register(handler)
    }
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.handlers.clear()
  }

  /**
   * 获取工具数量
   */
  size(): number {
    return this.handlers.size
  }
}

// 全局单例
let registry: ToolRegistry | null = null

/**
 * 获取工具注册表实例
 */
export function getToolRegistry(): ToolRegistry {
  if (!registry) {
    registry = new ToolRegistryImpl()
  }
  return registry
}

/**
 * 创建新的工具注册表
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistryImpl()
}
