/**
 * 全局主题配置
 * 支持日间/夜间模式切换
 */

import { ref, computed, watch } from "nativescript-vue";
import { ApplicationSettings, Application } from "@nativescript/core";

// 主题类型
export type ThemeMode = "light" | "dark" | "system";

// 主题颜色配置
export interface ThemeColors {
  // 背景色
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;

  // 文字颜色
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // 品牌色
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // 功能色
  success: string;
  warning: string;
  error: string;
  info: string;

  // 边框色
  border: string;
  borderLight: string;

  // 阴影色
  shadow: string;

  // 卡片背景
  cardBg: string;

  // 按钮颜色
  btnPrimaryBg: string;
  btnPrimaryText: string;
  btnSecondaryBg: string;
  btnSecondaryText: string;
}

// 字体配置
export interface ThemeFonts {
  // 字体大小
  sizeXs: number;
  sizeSm: number;
  sizeBase: number;
  sizeLg: number;
  sizeXl: number;
  size2xl: number;
  size3xl: number;

  // 字重
  weightNormal: string;
  weightMedium: string;
  weightSemibold: string;
  weightBold: string;

  // 行高
  lineHeightTight: number;
  lineHeightNormal: number;
  lineHeightRelaxed: number;
}

// 间距配置
export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

// 圆角配置
export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

// 完整主题配置
export interface Theme {
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
}

// 日间主题
export const lightTheme: Theme = {
  colors: {
    bgPrimary: "#FFFFFF",
    bgSecondary: "#F9FAFB",
    bgTertiary: "#F3F4F6",

    textPrimary: "#111827",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    textInverse: "#FFFFFF",

    primary: "#F97316",
    primaryLight: "#FDBA74",
    primaryDark: "#EA580C",

    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    border: "#E5E7EB",
    borderLight: "#F3F4F6",

    shadow: "rgba(0, 0, 0, 0.1)",

    cardBg: "#FFFFFF",

    btnPrimaryBg: "#F97316",
    btnPrimaryText: "#FFFFFF",
    btnSecondaryBg: "#F3F4F6",
    btnSecondaryText: "#374151"
  },
  fonts: {
    sizeXs: 10,
    sizeSm: 12,
    sizeBase: 14,
    sizeLg: 16,
    sizeXl: 18,
    size2xl: 20,
    size3xl: 24,

    weightNormal: "400",
    weightMedium: "500",
    weightSemibold: "600",
    weightBold: "700",

    lineHeightTight: 1.25,
    lineHeightNormal: 1.5,
    lineHeightRelaxed: 1.75
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999
  }
};

// 夜间主题
export const darkTheme: Theme = {
  colors: {
    bgPrimary: "#111827",
    bgSecondary: "#1F2937",
    bgTertiary: "#374151",

    textPrimary: "#F9FAFB",
    textSecondary: "#D1D5DB",
    textTertiary: "#9CA3AF",
    textInverse: "#111827",

    primary: "#FB923C",
    primaryLight: "#FDBA74",
    primaryDark: "#F97316",

    success: "#34D399",
    warning: "#FBBF24",
    error: "#F87171",
    info: "#60A5FA",

    border: "#374151",
    borderLight: "#4B5563",

    shadow: "rgba(0, 0, 0, 0.3)",

    cardBg: "#1F2937",

    btnPrimaryBg: "#FB923C",
    btnPrimaryText: "#111827",
    btnSecondaryBg: "#374151",
    btnSecondaryText: "#F9FAFB"
  },
  fonts: lightTheme.fonts, // 字体配置相同
  spacing: lightTheme.spacing, // 间距配置相同
  radius: lightTheme.radius // 圆角配置相同
};

// 主题状态管理
const THEME_KEY = "app_theme_mode";

// 当前主题模式
export const themeMode = ref<ThemeMode>((ApplicationSettings.getString(THEME_KEY, "light") as ThemeMode) || "light");

// 当前是否为暗色模式
export const isDark = computed(() => {
  if (themeMode.value === "system") {
    // 跟随系统（NativeScript 中可通过 Application.systemAppearance() 获取）
    return Application.systemAppearance?.() === "dark";
  }
  return themeMode.value === "dark";
});

// 当前主题配置
export const currentTheme = computed<Theme>(() => {
  return isDark.value ? darkTheme : lightTheme;
});

// 当前颜色配置（快捷访问）
export const colors = computed(() => currentTheme.value.colors);
export const fonts = computed(() => currentTheme.value.fonts);
export const spacing = computed(() => currentTheme.value.spacing);
export const radius = computed(() => currentTheme.value.radius);

// 切换主题
export function setThemeMode(mode: ThemeMode) {
  themeMode.value = mode;
  ApplicationSettings.setString(THEME_KEY, mode);
}

// 切换日间/夜间
export function toggleTheme() {
  setThemeMode(isDark.value ? "light" : "dark");
}

// 监听主题变化，应用 CSS 类
watch(
  isDark,
  dark => {
    const rootFrame = Application.getRootView();
    if (rootFrame) {
      if (dark) {
        rootFrame.className = (rootFrame.className || "").replace("theme-light", "").trim() + " theme-dark";
      } else {
        rootFrame.className = (rootFrame.className || "").replace("theme-dark", "").trim() + " theme-light";
      }
    }
  },
  { immediate: true }
);

// 导出便捷方法
export function useTheme() {
  return {
    themeMode,
    isDark,
    currentTheme,
    colors,
    fonts,
    spacing,
    radius,
    setThemeMode,
    toggleTheme,
    lightTheme,
    darkTheme
  };
}
