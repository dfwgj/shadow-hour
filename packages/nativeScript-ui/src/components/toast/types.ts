/**
 * Toast 组件类型定义
 * @author: DF蓝梦/xierfloat
 * @Date 2025-12-2
 */

/**
 * Toast 类型
 */
export type ToastType = "success" | "error" | "warning" | "info";

/**
 * Toast 位置
 */
export type ToastPosition = "top" | "center" | "bottom";

/**
 * Toast 配置选项
 */
export interface ToastOptions {
  /** 消息内容 */
  message: string;
  /** 类型 */
  type?: ToastType;
  /** 显示时长（毫秒），0 表示不自动关闭 */
  duration?: number;
  /** 位置 */
  position?: ToastPosition;
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * Toast 实例
 */
export interface ToastInstance {
  /** 唯一标识 */
  id: string;
  /** 消息内容 */
  message: string;
  /** 类型 */
  type: ToastType;
  /** 显示时长 */
  duration: number;
  /** 位置 */
  position: ToastPosition;
  /** 是否显示关闭按钮 */
  showClose: boolean;
  /** 是否可见 */
  visible: boolean;
  /** 关闭回调 */
  onClose?: (() => void) | undefined;
}

/**
 * Toast 服务接口
 */
export interface IToastService {
  /** 显示 Toast */
  show(options: ToastOptions | string): void;
  /** 成功提示 */
  success(message: string, options?: Partial<ToastOptions>): void;
  /** 错误提示 */
  error(message: string, options?: Partial<ToastOptions>): void;
  /** 警告提示 */
  warning(message: string, options?: Partial<ToastOptions>): void;
  /** 信息提示 */
  info(message: string, options?: Partial<ToastOptions>): void;
  /** 关闭所有 Toast */
  closeAll(): void;
}
