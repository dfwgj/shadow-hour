import { getRollupConfigs } from "./buildBase.js";
import { watch } from "rollup";

async function dev() {
  const configs = await getRollupConfigs();

  if (Object.keys(configs).length === 0) {
    console.log("✅ 没有需要监听的包，退出");
    return;
  }

  for (const name in configs) {
    const config = configs[name];
    const watcher = watch(
      config.output.map(o => ({
        input: config.input,
        plugins: config.plugins,
        external: config.external,
        output: o,
        watch: config.watch
      }))
    );
    watcher.on("event", event => {
      if (event.code === "START") {
        console.log(`👁️ 开始监听: ${name}`);
      } else if (event.code === "ERROR") {
        console.error(`❌ ${name}打包失败:`, event.error);
      } else if (event.code === "BUNDLE_START") {
        console.log(`📦 正在打包: ${name}`);
      } else if (event.code === "BUNDLE_END") {
        console.log(`✅ ${name} 打包完成`);
      }
    });
  }
}

dev();
