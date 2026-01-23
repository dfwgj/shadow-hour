/**
 * 应用配置
 * 通过 webpack DefinePlugin 注入环境变量
 * @author: DF蓝梦/xierfloat
 * @date 2025-1-20
 */

// 从 webpack DefinePlugin 注入的环境变量
declare const __APP_VERSION__: string;
declare const __UPDATE_CHECK_URL__: string;
declare const __DOWNLOAD_URL__: string;

export const AppConfig = {
  // 应用版本号
  version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0",

  // 更新检查 API 地址 (GitHub Releases API)
  updateCheckUrl:
    typeof __UPDATE_CHECK_URL__ !== "undefined"
      ? __UPDATE_CHECK_URL__
      : "https://api.github.com/repos/user/repo/releases/latest",

  // 下载页面地址 (用户点击后跳转)
  downloadUrl:
    typeof __DOWNLOAD_URL__ !== "undefined" ? __DOWNLOAD_URL__ : "https://github.com/user/repo/releases/latest"
};

export default AppConfig;
