import { ref, computed } from "nativescript-vue";
import { Application } from "@nativescript/core";

// 主题颜色的默认值
const defaultColors = {
  // 背景色
  bgPrimary: "#FFFFFF",
  bgSecondary: "#F9FAFB",
  bgTertiary: "#F3F4F6",
  cardBg: "#FFFFFF",

  // 文字颜色
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  textInverse: "#FFFFFF",

  // 品牌色
  primary: "#0038BD",
  primaryLight: "#01DAFF",
  primaryDark: "#0038BD",

  // 功能色
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // 边框色
  border: "#E5E7EB",
  borderLight: "#F3F4F6",

  // 按钮
  btnPrimaryBg: "#F97316",
  btnPrimaryText: "#FFFFFF",
  btnSecondaryBg: "#F3F4F6",
  btnSecondaryText: "#374151"
};

// CSS 变量名映射
const cssVarMap: Record<keyof typeof defaultColors, string> = {
  bgPrimary: "--bg-primary",
  bgSecondary: "--bg-secondary",
  bgTertiary: "--bg-tertiary",
  cardBg: "--card-bg",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textTertiary: "--text-tertiary",
  textInverse: "--text-inverse",
  primary: "--primary",
  primaryLight: "--primary-light",
  primaryDark: "--primary-dark",
  success: "--success",
  warning: "--warning",
  error: "--error",
  info: "--info",
  border: "--border",
  borderLight: "--border-light",
  btnPrimaryBg: "--btn-primary-bg",
  btnPrimaryText: "--btn-primary-text",
  btnSecondaryBg: "--btn-secondary-bg",
  btnSecondaryText: "--btn-secondary-text"
};

// 当前主题模式
const isDarkMode = ref(false);

// 特殊时段颜色（北京时间 0:00-1:00）
const MIDNIGHT_PRIMARY = "#116E15";

// 检查是否在北京时间 0:00-1:00
function isBeijingMidnight(): boolean {
  const now = new Date();
  // 获取 UTC 时间，加 8 小时得到北京时间
  const utcHours = now.getUTCHours();
  const beijingHours = (utcHours + 8) % 24;
  return beijingHours >= 1 && beijingHours < 2;
}

// 获取单个 CSS 变量值
function getCssVariable(varName: string, fallback: string): string {
  try {
    const rootView = Application.getRootView();
    if (rootView?.style) {
      const value = rootView.style.getCssVariable(varName);
      return value || fallback;
    }
  } catch (e) {
    console.log("Failed to get CSS variable:", varName, e);
  }
  return fallback;
}

// 当前是否午夜模式
const isMidnightMode = ref(false);

// 应用午夜主题（通过切换 Page 的 className）
function applyMidnightColors(): void {
  const shouldBeMidnight = isBeijingMidnight();
  isMidnightMode.value = shouldBeMidnight;

  try {
    const rootView = Application.getRootView();
    if (rootView) {
      // 获取当前 className
      const className = rootView.className || "";
      const classes = className.split(" ").filter((c: string) => c && c !== "theme-midnight");

      if (shouldBeMidnight) {
        classes.push("theme-midnight");
      }

      rootView.className = classes.join(" ");
      console.log("Theme applied:", rootView.className, "isMidnight:", shouldBeMidnight);
    }
  } catch (e) {
    console.log("Failed to apply midnight colors:", e);
  }
}

// 获取所有主题颜色
function getThemeColors() {
  const colors: Record<string, string> = {};
  const isMidnight = isBeijingMidnight();

  for (const [key, cssVar] of Object.entries(cssVarMap)) {
    // 北京时间 0:00-1:00 时 primary 系列颜色变为特殊颜色
    if (isMidnight && (key === "primary" || key === "primaryDark")) {
      colors[key] = MIDNIGHT_PRIMARY;
    } else {
      colors[key] = getCssVariable(cssVar, defaultColors[key as keyof typeof defaultColors]);
    }
  }
  return colors as typeof defaultColors;
}

export function useTheme() {
  // 响应式颜色对象
  const colors = computed(() => getThemeColors());

  // 快捷访问方法
  const getColor = (colorKey: keyof typeof defaultColors): string => {
    // 北京时间 0:00-1:00 时 primary 系列颜色变为特殊颜色
    if (isBeijingMidnight() && (colorKey === "primary" || colorKey === "primaryDark")) {
      return MIDNIGHT_PRIMARY;
    }
    return getCssVariable(cssVarMap[colorKey], defaultColors[colorKey]);
  };

  // 切换主题
  const toggleTheme = () => {
    isDarkMode.value = !isDarkMode.value;
    const rootView = Application.getRootView();
    if (rootView) {
      if (isDarkMode.value) {
        rootView.className = "theme-dark";
      } else {
        rootView.className = "theme-light";
      }
    }
  };

  // 设置主题
  const setTheme = (theme: "light" | "dark") => {
    isDarkMode.value = theme === "dark";
    const rootView = Application.getRootView();
    if (rootView) {
      rootView.className = `theme-${theme}`;
    }
  };

  // 初始化主题（应用午夜颜色并启动定时检查）
  let midnightTimer: ReturnType<typeof setInterval> | null = null;

  const initTheme = () => {
    // 立即应用一次
    applyMidnightColors();

    // 每分钟检查一次是否需要切换
    if (!midnightTimer) {
      midnightTimer = setInterval(() => {
        applyMidnightColors();
      }, 60000); // 每分钟检查
    }
  };

  const destroyTheme = () => {
    if (midnightTimer) {
      clearInterval(midnightTimer);
      midnightTimer = null;
    }
  };

  // 获取品牌色类名（根据时段自动切换）
  const getBrandClass = (type: "text" | "bg" | "border" = "text"): string => {
    if (isMidnightMode.value) {
      return `${type}-midnight-brand`;
    }
    return `${type}-theme-brand`;
  };

  return {
    // 状态
    isDarkMode,
    isMidnightMode,
    colors,

    // 方法
    getColor,
    getBrandClass,
    toggleTheme,
    setTheme,
    isBeijingMidnight,
    applyMidnightColors,
    initTheme,
    destroyTheme,
    // 直接导出默认颜色（用于组件初始化时）
    defaultColors
  };
}

// 导出默认颜色常量，便于直接使用
export const themeColors = defaultColors;
