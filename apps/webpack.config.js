/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const webpack = require("@nativescript/webpack");
const { DefinePlugin } = require("webpack");
const { resolve } = require("path");
const { existsSync, readFileSync } = require("fs");

// 加载环境变量
function loadEnv() {
  const envPath = resolve(__dirname, ".env");
  const env = {};

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    content.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key) {
          env[key.trim()] = valueParts.join("=").trim();
        }
      }
    });
  }

  return env;
}

module.exports = env => {
  webpack.init(env);

  // 加载 .env 文件
  const appEnv = loadEnv();

  // Learn how to customize:
  // https://docs.nativescript.org/webpack

  webpack.chainWebpack(config => {
    // 禁用 Node.js 核心模块 polyfill（NativeScript 不需要）
    config.resolve.set("fallback", {
      url: false
    });

    // 注入环境变量
    config.plugin("define").use(DefinePlugin, [
      {
        __APP_VERSION__: JSON.stringify(appEnv.APP_VERSION || "1.0.0"),
        __UPDATE_CHECK_URL__: JSON.stringify(
          appEnv.UPDATE_CHECK_URL || "https://api.github.com/repos/user/repo/releases/latest"
        ),
        __DOWNLOAD_URL__: JSON.stringify(appEnv.DOWNLOAD_URL || "https://github.com/user/repo/releases/latest")
      }
    ]);

    // 修复 Vue 3 vue-loader HMR 问题
    // @nativescript/webpack 5.0.27 不支持 vue-loader 17.x，需要手动配置
    if (env.hmr) {
      config.module
        .rule("vue")
        .use("vue-loader")
        .tap(options => {
          return {
            ...options,
            isServerBuild: false
          };
        });
    }

    // 视频文件处理
    config.module
      .rule("videos")
      .test(/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/)
      .type("asset/resource")
      .set("generator", {
        filename: "assets/videos/[name][ext]"
      });

    // Markdown/文本文件处理（作为原始字符串导入）
    config.module
      .rule("raw-text")
      .test(/\.(md|txt)$/)
      .type("asset/source");
  });

  return webpack.resolveConfig();
};
