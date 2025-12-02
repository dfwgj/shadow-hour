/**
 * Toast Composable
 * 提供类似 Element Plus 的编程式调用
 * @author xierfloat
 */

import type { ToastOptions, IToastService } from "./types";

/**
 * 获取全局 Toast 服务
 */
function getToastService(): IToastService | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__toastService || null;
}

/**
 * Toast 服务代理
 * 用于在 ToastContainer 挂载前缓存调用
 */
class ToastServiceProxy implements IToastService {
  private queue: Array<{ method: keyof IToastService; args: unknown[] }> = [];
  private retryCount = 0;
  private readonly MAX_RETRIES = 5; // 最多重试5次，避免无限增长
  private readonly MAX_QUEUE_SIZE = 10; // 队列最大长度

  private getService(): IToastService | null {
    return getToastService();
  }

  private execute<K extends keyof IToastService>(method: K, ...args: Parameters<IToastService[K]>): void {
    const service = this.getService();
    if (service) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service[method] as (...args: any[]) => void)(...args);
      this.retryCount = 0; // 重置重试计数
    } else {
      // 队列已满则丢弃最旧的
      if (this.queue.length >= this.MAX_QUEUE_SIZE) {
        this.queue.shift();
      }
      // 缓存调用，等待服务就绪
      this.queue.push({ method, args });
      // 延迟重试（有次数限制）
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        setTimeout(() => this.flushQueue(), 100);
      }
    }
  }

  private flushQueue(): void {
    const service = this.getService();
    if (service && this.queue.length > 0) {
      const pending = [...this.queue];
      this.queue = [];
      this.retryCount = 0;
      for (const { method, args } of pending) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service[method] as (...args: any[]) => void)(...args);
      }
    }
  }

  show(options: ToastOptions | string): void {
    this.execute("show", options);
  }

  success(message: string, options?: Partial<ToastOptions>): void {
    this.execute("success", message, options);
  }

  error(message: string, options?: Partial<ToastOptions>): void {
    this.execute("error", message, options);
  }

  warning(message: string, options?: Partial<ToastOptions>): void {
    this.execute("warning", message, options);
  }

  info(message: string, options?: Partial<ToastOptions>): void {
    this.execute("info", message, options);
  }

  closeAll(): void {
    this.execute("closeAll");
  }
}

// 单例代理
const toastProxy = new ToastServiceProxy();

/**
 * Toast 服务对象
 * 类似 Element Plus 的 ElMessage
 *
 * @example
 * ```ts
 * import { Toast } from "@xierfloat/mobile-ui";
 *
 * // 快捷调用
 * Toast.success("操作成功");
 * Toast.error("操作失败");
 * Toast.warning("请注意");
 * Toast.info("提示信息");
 *
 * // 完整配置
 * Toast.show({
 *   message: "自定义消息",
 *   type: "success",
 *   duration: 5000,
 *   position: "center",
 *   showClose: true,
 *   onClose: () => console.log("closed")
 * });
 *
 * // 关闭所有
 * Toast.closeAll();
 * ```
 */
export const Toast: IToastService = toastProxy;

/**
 * useToast composable
 * 用于组件内使用
 *
 * @example
 * ```ts
 * import { useToast } from "@xierfloat/mobile-ui";
 *
 * const toast = useToast();
 * toast.success("保存成功");
 * ```
 */
export function useToast(): IToastService {
  return toastProxy;
}
