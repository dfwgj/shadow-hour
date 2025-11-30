import path from "node:path";
import URL from "node:url";
import fs from "node:fs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import vue from "@vitejs/plugin-vue";
import postcss from "rollup-plugin-postcss";

const __filename = URL.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 自动扫描 packages 目录，只处理存在 buildOptions 的包
async function discoverPackages() {
  const packagesDir = path.resolve(__dirname, "../packages");
  const entries = await fs.promises.readdir(packagesDir, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pkgJsonPath = path.resolve(packagesDir, entry.name, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;

    try {
      const content = await fs.promises.readFile(pkgJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      // 只处理有 buildOptions 的包（需要 rollup 打包的）
      if (pkg.buildOptions) {
        packages.push(entry.name);
      }
    } catch {
      // 忽略读取失败的包
    }
  }

  return packages;
}

function getPackageRoots(packages) {
  return packages.map(pkg => path.resolve(__dirname, "../packages", pkg));
}

async function packageJson(root) {
  const jsonPath = path.resolve(root, "package.json");
  const content = await fs.promises.readFile(jsonPath, "utf-8");
  return JSON.parse(content);
}

async function getRollupConfig(root) {
  const config = await packageJson(root);
  const tsconfig = path.resolve(root, "tsconfig.json");
  const { name, formats } = config.buildOptions || {};
  const dist = path.resolve(root, "./dist");
  const entry = path.resolve(root, "./src/index.ts");
  const rollupOptions = {
    input: entry,
    sourcemap: true,
    external: ["vue"],
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({
        tsconfig,
        compilerOptions: {
          outDir: dist
        }
      }),
      vue({
        template: {
          compilerOptions: {
            // 自定义转换函数，在生成 AST 时移除特定属性
            nodeTransforms: [
              node => {
                if (node.type === 1 /* NodeTypes.ELEMENT */) {
                  // 过滤掉所有 data-testid 属性
                  node.props = node.props.filter(prop => {
                    if (prop.type === 6 /* NodeTypes.ATTRIBUTE */) {
                      return prop.name !== "data-testid";
                    }
                    return true;
                  });
                }
              }
            ]
          }
        }
      }),
      postcss()
    ],
    dir: dist
  };
  const output = [];
  for (const format of formats) {
    const outputItem = {
      format,
      file: path.resolve(dist, `index.${format}.js`),
      sourcemap: true,
      globals: {
        vue: "Vue"
      }
    };
    if (format === "iife") {
      outputItem.name = name;
    }
    output.push(outputItem);
  }
  rollupOptions.output = output;
  // watch options
  rollupOptions.watch = {
    include: path.resolve(root, "src/**"),
    exclude: path.resolve(root, "node_modules/**"),
    clearScreen: false
  };
  return rollupOptions;
}

export async function getRollupConfigs() {
  const packages = await discoverPackages();

  if (packages.length === 0) {
    console.log("📦 没有找到需要打包的包（需要 package.json 中有 buildOptions 配置）");
    return {};
  }

  console.log(`📦 发现 ${packages.length} 个需要打包的包: ${packages.join(", ")}`);

  const roots = getPackageRoots(packages);
  const configs = await Promise.all(roots.map(getRollupConfig));
  const result = {};
  for (let i = 0; i < packages.length; i++) {
    result[packages[i]] = configs[i];
  }
  return result;
}

export function clearDist(name) {
  const dist = path.resolve(__dirname, "../packages", name, "dist");
  if (fs.existsSync(dist)) {
    fs.rmSync(dist, { recursive: true, force: true });
  }
}
