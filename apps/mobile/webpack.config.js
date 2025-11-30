const webpack = require("@nativescript/webpack");

module.exports = (env) => {
	webpack.init(env);

	// Learn how to customize:
	// https://docs.nativescript.org/webpack

	webpack.chainWebpack((config) => {
		// 禁用 Node.js 核心模块 polyfill（NativeScript 不需要）
		config.resolve.set("fallback", {
			url: false,
		});
	});

	return webpack.resolveConfig();
};
