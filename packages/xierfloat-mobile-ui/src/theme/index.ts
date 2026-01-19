/**
 * 组件库主题配置
 * 提供颜色配置接口，由应用层注入
 */

import { ref, computed, reactive } from "nativescript-vue";

/**
 * 组件库颜色配置接口
 */
export interface UIThemeColors {
  // 背景色
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  cardBg: string;

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

  // 特殊颜色
  weekend: string;
  today: string;
  selected: string;
  holiday: string;
  lunarText: string;
}

/**
 * 默认日间颜色配置
 */
export const defaultLightColors: UIThemeColors = {
  bgPrimary: "#FFFFFF",
  bgSecondary: "#F9FAFB",
  bgTertiary: "#F3F4F6",
  cardBg: "#FFFFFF",

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

  weekend: "#EF4444",
  today: "#F97316",
  selected: "#F97316",
  holiday: "#EF4444",
  lunarText: "#9CA3AF"
};

/**
 * 默认夜间颜色配置
 */
export const defaultDarkColors: UIThemeColors = {
  bgPrimary: "#111827",
  bgSecondary: "#1F2937",
  bgTertiary: "#374151",
  cardBg: "#1F2937",

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

  weekend: "#F87171",
  today: "#FB923C",
  selected: "#FB923C",
  holiday: "#F87171",
  lunarText: "#9CA3AF"
};

/**
 * 当前主题状态
 */
const isDarkMode = ref(false);

/**
 * 自定义颜色配置
 */
const customLightColors = reactive<Partial<UIThemeColors>>({});
const customDarkColors = reactive<Partial<UIThemeColors>>({});

/**
 * 当前颜色配置（合并默认和自定义）
 */
export const uiColors = computed<UIThemeColors>(() => {
  const baseColors = isDarkMode.value ? defaultDarkColors : defaultLightColors;
  const customColors = isDarkMode.value ? customDarkColors : customLightColors;
  return { ...baseColors, ...customColors };
});

/**
 * 设置是否为暗色模式
 */
export function setDarkMode(dark: boolean) {
  isDarkMode.value = dark;
}

/**
 * 获取当前是否为暗色模式
 */
export function getIsDarkMode() {
  return isDarkMode.value;
}

/**
 * 配置日间主题颜色
 */
export function configureLightColors(colors: Partial<UIThemeColors>) {
  Object.assign(customLightColors, colors);
}

/**
 * 配置夜间主题颜色
 */
export function configureDarkColors(colors: Partial<UIThemeColors>) {
  Object.assign(customDarkColors, colors);
}

/**
 * 一次性配置所有颜色
 */
export function configureTheme(options: {
  light?: Partial<UIThemeColors>;
  dark?: Partial<UIThemeColors>;
  isDark?: boolean;
}) {
  if (options.light) {
    Object.assign(customLightColors, options.light);
  }
  if (options.dark) {
    Object.assign(customDarkColors, options.dark);
  }
  if (options.isDark !== undefined) {
    isDarkMode.value = options.isDark;
  }
}

/**
 * 重置为默认颜色
 */
export function resetTheme() {
  Object.keys(customLightColors).forEach(key => {
    delete (customLightColors as any)[key];
  });
  Object.keys(customDarkColors).forEach(key => {
    delete (customDarkColors as any)[key];
  });
}

/**
 * 组合式 API：使用主题
 */
export function useUITheme() {
  return {
    colors: uiColors,
    isDark: computed(() => isDarkMode.value),
    setDarkMode,
    configureLightColors,
    configureDarkColors,
    configureTheme,
    resetTheme,
    defaultLightColors,
    defaultDarkColors
  };
}
