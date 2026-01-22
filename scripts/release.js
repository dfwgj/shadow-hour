import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const envPath = join(process.cwd(), "apps", ".env");
  const rl = createInterface({ input, output });

  try {
    // 读取当前版本
    let currentVersion = "1.0.0";
    try {
      const envContent = await readFile(envPath, "utf-8");
      const match = envContent.match(/APP_VERSION=(.+)/);
      if (match) {
        currentVersion = match[1].trim();
      }
    } catch {
      console.log("⚠️ 未找到 .env 文件，使用默认版本 1.0.0");
    }

    console.log(`\n📱 ShadowHour 版本发布工具\n`);
    console.log(`当前版本: v${currentVersion}`);

    // 选择版本类型
    const bumpTypeInput = await rl.question(
      "\n选择版本类型:\n  1. patch (修复 Bug, 如 1.0.0 -> 1.0.1)\n  2. minor (新功能, 如 1.0.0 -> 1.1.0)\n  3. major (重大更新, 如 1.0.0 -> 2.0.0)\n  4. custom (自定义版本号)\n\n请选择 [1]: "
    );

    const typeMap = { "1": "patch", "2": "minor", "3": "major", "4": "custom" };
    const type = typeMap[bumpTypeInput.trim() || "1"] || "patch";

    let newVersion = currentVersion;
    if (type === "custom") {
      const custom = await rl.question("输入版本号 (如 1.2.3): ");
      const candidate = custom.trim();
      if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(candidate)) {
        console.error("❌ 版本格式不合法");
        rl.close();
        process.exit(1);
      }
      newVersion = candidate;
    } else {
      newVersion = bumpSemver(currentVersion, type);
    }

    // 输入更新说明
    const releaseNotes = await rl.question(`\n输入更新说明 (可选): `);

    console.log(`\n📋 发布信息:`);
    console.log(`   版本: v${currentVersion} -> v${newVersion}`);
    console.log(`   说明: ${releaseNotes || "(无)"}`);

    const confirm = await rl.question(`\n确认发布? (y/N): `);
    if (!/^y(es)?$/i.test(confirm.trim())) {
      console.log("已取消");
      rl.close();
      return;
    }

    // 更新 .env 文件
    console.log("\n📝 更新版本号...");
    let envContent = "";
    try {
      envContent = await readFile(envPath, "utf-8");
      envContent = envContent.replace(/APP_VERSION=.+/, `APP_VERSION=${newVersion}`);
    } catch {
      envContent = `APP_VERSION=${newVersion}\n`;
    }
    await writeFile(envPath, envContent, "utf-8");

    // Git 操作
    console.log("📦 提交更改...");
    execSync(`git add apps/.env`, { stdio: "inherit" });
    execSync(`git commit -m "chore: release v${newVersion}"`, { stdio: "inherit" });

    console.log("🏷️ 创建 tag...");
    const tagMessage = releaseNotes || `Release v${newVersion}`;
    execSync(`git tag -a v${newVersion} -m "${tagMessage}"`, { stdio: "inherit" });

    const pushConfirm = await rl.question(`\n推送到远程仓库? (Y/n): `);
    if (!/^n(o)?$/i.test(pushConfirm.trim())) {
      console.log("🚀 推送中...");
      execSync(`git push origin master --tags`, { stdio: "inherit" });
      console.log(`\n✅ v${newVersion} 发布成功！`);
      console.log(`   GitHub Actions 将自动构建并发布 APK`);
    } else {
      console.log(`\n✅ v${newVersion} 已创建，稍后运行以下命令推送:`);
      console.log(`   git push origin master --tags`);
    }
  } catch (err) {
    console.error("❌ 发布失败:", err?.message || err);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

function bumpSemver(v, type) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(.*)?$/);
  if (!m) return v;

  let major = parseInt(m[1], 10);
  let minor = parseInt(m[2], 10);
  let patch = parseInt(m[3], 10);

  switch (type) {
    case "patch":
      patch += 1;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

main();
