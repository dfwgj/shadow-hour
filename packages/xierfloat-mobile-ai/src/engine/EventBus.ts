/**
 * 事件总线 - Pub/Sub 模式实现
 *
 * 提供类型安全的事件订阅和发布机制
 */

import type { AgentEvent, EventHandler, Unsubscribe } from '../types/event'

/** 事件总线配置 */
export interface EventBusOptions {
  /** 是否启用调试日志 */
  debug?: boolean
  /** 最大监听器数量 (防止内存泄漏) */
  maxListeners?: number
}

/** 事件过滤器 */
export type EventFilter<T extends AgentEvent = AgentEvent> = (event: T) => boolean

/** 事件总线接口 */
export interface IEventBus {
  /** 订阅事件 */
  on<T extends AgentEvent>(handler: EventHandler<T>, filter?: EventFilter<T>): Unsubscribe
  /** 订阅一次性事件 */
  once<T extends AgentEvent>(handler: EventHandler<T>, filter?: EventFilter<T>): Unsubscribe
  /** 发布事件 */
  emit(event: AgentEvent): void
  /** 清除所有订阅 */
  clear(): void
  /** 获取订阅者数量 */
  listenerCount(): number
}

/** 订阅者信息 */
interface Subscriber {
  handler: EventHandler
  filter?: EventFilter
  once: boolean
}

/**
 * 事件总线实现
 */
export class EventBus implements IEventBus {
  private subscribers: Set<Subscriber> = new Set()
  private options: Required<EventBusOptions>

  constructor(options?: EventBusOptions) {
    this.options = {
      debug: options?.debug ?? false,
      maxListeners: options?.maxListeners ?? 100
    }
  }

  /**
   * 订阅事件
   */
  on<T extends AgentEvent>(
    handler: EventHandler<T>,
    filter?: EventFilter<T>
  ): Unsubscribe {
    if (this.subscribers.size >= this.options.maxListeners) {
      console.warn(
        `[EventBus] Max listeners (${this.options.maxListeners}) exceeded. ` +
        'Possible memory leak detected.'
      )
    }

    const subscriber: Subscriber = {
      handler: handler as EventHandler,
      filter: filter as EventFilter | undefined,
      once: false
    }

    this.subscribers.add(subscriber)

    if (this.options.debug) {
      console.log(`[EventBus] Subscriber added. Total: ${this.subscribers.size}`)
    }

    return () => {
      this.subscribers.delete(subscriber)
      if (this.options.debug) {
        console.log(`[EventBus] Subscriber removed. Total: ${this.subscribers.size}`)
      }
    }
  }

  /**
   * 订阅一次性事件
   */
  once<T extends AgentEvent>(
    handler: EventHandler<T>,
    filter?: EventFilter<T>
  ): Unsubscribe {
    const subscriber: Subscriber = {
      handler: handler as EventHandler,
      filter: filter as EventFilter | undefined,
      once: true
    }

    this.subscribers.add(subscriber)

    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  /**
   * 发布事件
   */
  emit(event: AgentEvent): void {
    if (this.options.debug) {
      console.log(`[EventBus] Emit:`, event.type)
    }

    const toRemove: Subscriber[] = []

    for (const subscriber of this.subscribers) {
      // 应用过滤器
      if (subscriber.filter && !subscriber.filter(event)) {
        continue
      }

      try {
        subscriber.handler(event)
      } catch (error) {
        console.error(`[EventBus] Handler error:`, error)
      }

      // 标记一次性订阅者待移除
      if (subscriber.once) {
        toRemove.push(subscriber)
      }
    }

    // 移除一次性订阅者
    for (const subscriber of toRemove) {
      this.subscribers.delete(subscriber)
    }
  }

  /**
   * 清除所有订阅
   */
  clear(): void {
    this.subscribers.clear()
    if (this.options.debug) {
      console.log('[EventBus] All subscribers cleared')
    }
  }

  /**
   * 获取订阅者数量
   */
  listenerCount(): number {
    return this.subscribers.size
  }
}

/**
 * 创建事件总线实例
 */
export function createEventBus(options?: EventBusOptions): IEventBus {
  return new EventBus(options)
}

/**
 * 事件类型过滤器工厂
 */
export const EventFilters = {
  /** 按事件类型过滤 */
  byType<T extends AgentEvent['type']>(type: T): EventFilter {
    return (event) => event.type === type
  },

  /** 按多个事件类型过滤 */
  byTypes<T extends AgentEvent['type']>(types: T[]): EventFilter {
    const typeSet = new Set(types)
    return (event) => typeSet.has(event.type as T)
  },

  /** 流事件过滤器 */
  streamEvents(): EventFilter {
    const streamTypes = new Set([
      'message_start',
      'text_delta',
      'tool_use_start',
      'tool_use_delta',
      'tool_use_stop',
      'message_stop',
      'stream_error'
    ])
    return (event) => streamTypes.has(event.type)
  },

  /** 状态事件过滤器 */
  stateEvents(): EventFilter {
    const stateTypes = new Set([
      'state_change',
      'conversation_start',
      'conversation_end'
    ])
    return (event) => stateTypes.has(event.type)
  },

  /** 工具事件过滤器 */
  toolEvents(): EventFilter {
    const toolTypes = new Set([
      'tool_call_start',
      'tool_call_result',
      'tool_call_error'
    ])
    return (event) => toolTypes.has(event.type)
  },

  /** 组合过滤器 (AND) */
  and(...filters: EventFilter[]): EventFilter {
    return (event) => filters.every((f) => f(event))
  },

  /** 组合过滤器 (OR) */
  or(...filters: EventFilter[]): EventFilter {
    return (event) => filters.some((f) => f(event))
  },

  /** 取反过滤器 */
  not(filter: EventFilter): EventFilter {
    return (event) => !filter(event)
  }
}
