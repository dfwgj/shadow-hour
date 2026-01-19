#!/usr/bin/env node
/**
 * Android 图标生成脚本
 *
 * 使用方法:
 *   node scripts/generate-icons.js <源图片路径>
 *
 * 示例:
 *   node scripts/generate-icons.js ./my-icon.png
 *
 * 功能:
 *   - 将图片压缩到 10KB 以下
 *   - 生成 Android 各尺寸图标 (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
 *   - 输出到 App_Resources/Android/src/main/res/mipmap-* 目录
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Android 图标尺寸配置
const ICON_SIZES = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

// 目标大小 (10KB)
const TARGET_SIZE_KB = 10;
const TARGET_SIZE_BYTES = TARGET_SIZE_KB * 1024;

// 输出目录
const OUTPUT_BASE = path.join(__dirname, '../apps/mobile/App_Resources/Android/src/main/res');

async function generateIcon(inputPath) {
  // 检查输入文件
  if (!fs.existsSync(inputPath)) {
    console.error(`错误: 找不到文件 ${inputPath}`);
    process.exit(1);
  }

  console.log(`📁 源文件: ${inputPath}`);
  console.log(`📦 目标大小: ${TARGET_SIZE_KB}KB 以下`);
  console.log('');

  for (const config of ICON_SIZES) {
    const outputDir = path.join(OUTPUT_BASE, config.name);
    const outputPath = path.join(outputDir, 'ic_launcher.png');

    // 确保目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 生成图标
    let quality = 100;
    let buffer;

    // 先尝试高质量
    buffer = await sharp(inputPath)
      .resize(config.size, config.size, {
        fit: 'cover',
        position: 'center'
      })
      .png({ quality, compressionLevel: 9 })
      .toBuffer();

    // 如果超过目标大小，逐步降低质量
    while (buffer.length > TARGET_SIZE_BYTES && quality > 10) {
      quality -= 10;
      buffer = await sharp(inputPath)
        .resize(config.size, config.size, {
          fit: 'cover',
          position: 'center'
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

      // PNG 质量调整有限，尝试更高压缩
      if (buffer.length > TARGET_SIZE_BYTES) {
        buffer = await sharp(buffer)
          .png({ compressionLevel: 9, palette: true, colors: 256 })
          .toBuffer();
      }
    }

    // 写入文件
    fs.writeFileSync(outputPath, buffer);

    const sizeKB = (buffer.length / 1024).toFixed(2);
    const status = buffer.length <= TARGET_SIZE_BYTES ? '✅' : '⚠️';
    console.log(`${status} ${config.name}: ${config.size}x${config.size} → ${sizeKB}KB`);
  }

  console.log('');
  console.log('✨ 图标生成完成!');
  console.log(`📂 输出目录: ${OUTPUT_BASE}`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Android 图标生成工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/generate-icons.js <源图片路径>');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/generate-icons.js ./icon.png');
    console.log('');
    console.log('支持的格式: PNG, JPG, WEBP, SVG');
    process.exit(0);
  }

  const inputPath = path.resolve(args[0]);

  try {
    await generateIcon(inputPath);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

main();
