/**
 * Android 背景图生成脚本
 * 根据源图片生成不同密度的背景图
 *
 * 用法: node scripts/generate-backgrounds.cjs <源图片路径> [输出文件名] [mdpi宽度] [mdpi高度]
 *
 * 示例:
 *   node scripts/generate-backgrounds.cjs ./splash.png
 *   node scripts/generate-backgrounds.cjs ./splash.png background.png
 *   node scripts/generate-backgrounds.cjs ./splash.png splash.png 320 480
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Android 背景图密度比例
const densities = [
  { dir: "drawable-mdpi", scale: 1 },
  { dir: "drawable-hdpi", scale: 1.5 },
  { dir: "drawable-xhdpi", scale: 2 },
  { dir: "drawable-xxhdpi", scale: 3 },
  { dir: "drawable-xxxhdpi", scale: 4 },
];

// 输出基准路径
const basePath = path.join(
  __dirname,
  "../apps/mobile/App_Resources/Android/src/main/res"
);

async function generateBackgrounds(inputPath, outputName, baseWidth, baseHeight) {
  console.log(`\n📁 源文件: ${inputPath}`);
  console.log(`📄 输出文件名: ${outputName}`);

  const image = sharp(inputPath);
  const metadata = await image.metadata();

  console.log(`📐 原始尺寸: ${metadata.width}x${metadata.height}`);

  // 如果没有指定基准尺寸，使用原图尺寸作为 xxxhdpi (4x)，计算 mdpi 尺寸
  const mdpiWidth = baseWidth || Math.round(metadata.width / 4);
  const mdpiHeight = baseHeight || Math.round(metadata.height / 4);

  console.log(`📏 mdpi 基准尺寸: ${mdpiWidth}x${mdpiHeight}\n`);

  for (const { dir, scale } of densities) {
    const width = Math.round(mdpiWidth * scale);
    const height = Math.round(mdpiHeight * scale);
    const outputDir = path.join(basePath, dir);

    // 确保目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, outputName);

    await sharp(inputPath)
      .resize(width, height, { fit: "cover" })
      .png()
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`✅ ${dir}: ${width}x${height} → ${sizeKB}KB`);
  }

  console.log(`\n✨ 背景图生成完成!`);
  console.log(`📂 输出目录: ${basePath}`);
}

// 主程序
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("用法: node scripts/generate-backgrounds.cjs <源图片路径> [输出文件名] [mdpi宽度] [mdpi高度]");
  console.log("");
  console.log("示例:");
  console.log("  node scripts/generate-backgrounds.cjs ./splash.png");
  console.log("  node scripts/generate-backgrounds.cjs ./splash.png background.png");
  console.log("  node scripts/generate-backgrounds.cjs ./splash.png splash.png 320 480");
  process.exit(1);
}

const inputPath = args[0];
const outputName = args[1] || "background.png";
const baseWidth = args[2] ? parseInt(args[2]) : null;
const baseHeight = args[3] ? parseInt(args[3]) : null;

if (!fs.existsSync(inputPath)) {
  console.error(`❌ 错误: 文件不存在 - ${inputPath}`);
  process.exit(1);
}

generateBackgrounds(inputPath, outputName, baseWidth, baseHeight).catch((err) => {
  console.error("❌ 生成失败:", err.message);
  process.exit(1);
});
