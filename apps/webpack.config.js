/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const webpack = require("@nativescript/webpack");

module.exports = env => {
  webpack.init(env);

  // Learn how to customize:
  // https://docs.nativescript.org/webpack

  webpack.chainWebpack(config => {
    // 禁用 Node.js 核心模块 polyfill（NativeScript 不需要）
    config.resolve.set("fallback", {
      url: false
    });

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
  });

  return webpack.resolveConfig();
};
