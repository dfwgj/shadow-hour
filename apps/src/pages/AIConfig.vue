<template>
  <Page actionBarHidden="true">
    <GridLayout rows="auto, auto, *, auto">
      <!-- 状态栏占位 -->
      <StackLayout row="0" :height="statusBarHeight" class="bg-theme-card" />

      <!-- 头部 -->
      <GridLayout row="1" columns="auto, *, auto" class="bg-theme-card p-3 border-b border-theme-light">
        <Label col="0" text="←" class="text-2xl text-theme-secondary p-2" @tap="goBack" />
        <Label col="1" text="AI 配置" class="text-lg font-bold text-theme-primary text-center" />
        <Label col="2" text="" class="text-xl p-2" />
      </GridLayout>

      <!-- 配置内容 -->
      <ScrollView row="2" class="bg-theme-secondary overflow-auto">
        <StackLayout class="p-4">
          <!-- 硅基流动配置卡片 -->
          <StackLayout class="bg-theme-card rounded-2xl p-4 mb-4">
            <!-- 平台标识 -->
            <GridLayout columns="auto, *" class="mb-4">
              <StackLayout col="1" class="ml-3">
                <Label text="硅基流动" class="text-lg font-bold text-theme-primary" />
                <Label text="SiliconFlow AI Platform" class="text-sm text-theme-secondary" />
              </StackLayout>
            </GridLayout>

            <!-- API Key -->
            <StackLayout class="mb-4">
              <Label text="API Key" class="text-theme-secondary mb-2" />
              <TextField
                v-model="apiKey"
                hint="输入你的硅基流动 API Key"
                secure="true"
                class="bg-theme-tertiary rounded-lg p-2"
              />
              <Label text="前往获取 API Key →" class="text-sm mt-2"  :color="getColor('primary')" @tap="openApiKeyPage" />
            </StackLayout>

            <!-- 模型选择 -->
            <StackLayout class="mb-4">
              <Label text="模型" class="text-theme-secondary mb-2" />
              <TextField v-model="model" hint="zai-org/GLM-4.6V" class="bg-theme-tertiary rounded-lg p-2" />
            </StackLayout>

            <!-- 推荐模型 -->
            <StackLayout class="mb-4">
              <Label text="推荐模型" class="text-theme-secondary mb-2" />
              <WrapLayout class="bg-theme-secondary rounded-xl p-2">
                <Label
                  v-for="m in recommendedModels"
                  :key="m.id"
                  :text="m.name"
                  :class="[
                    'px-3 py-2 m-1 rounded-lg text-xs',
                    model === m.id ? 'text-theme-inverse' : ' text-theme-secondary'
                  ]"
                  :backgroundColor="model === m.id ? getColor('primary') : getColor('bgPrimary')"
                  @tap="selectModel(m.id)"
                />
              </WrapLayout>
            </StackLayout>

            <!-- 测试连接 -->
            <Label
              :text="testStatus || '测试连接'"
              :class="[
                'text-center py-3 rounded-xl font-medium mb-2',
                testStatus === '连接成功'
                  ? 'bg-theme-success text-theme-inverse'
                  : testStatus === '连接失败'
                    ? 'bg-theme-error text-theme-inverse'
                    : 'bg-theme-tertiary text-theme-secondary'
              ]"
              @tap="testConnection"
            />
            <!-- 保存按钮 -->
            <Label
              text="保存配置"
              class=" text-theme-inverse text-center py-3 rounded-xl font-medium"
              :backgroundColor="getColor('primary')"
              @tap="saveConfig"
            />
          </StackLayout>

          <!-- 功能说明 -->
          <StackLayout class="bg-theme-card rounded-2xl p-4 mb-4">
            <Label text="支持的功能" class="text-lg font-bold text-theme-primary mb-4" />

            <StackLayout v-for="feature in features" :key="feature.title" class="mb-3">
              <GridLayout columns="auto, *">
                <Label col="0" :text="feature.icon" class="text-xl mr-3" />
                <StackLayout col="1">
                  <Label :text="feature.title" class="text-theme-primary text-lg" />
                  <Label :text="feature.desc" class="text-sm text-theme-secondary" textWrap="true" />
                </StackLayout>
              </GridLayout>
            </StackLayout>
          </StackLayout>

          <!-- 隐私说明 -->
          <StackLayout class="bg-theme-card rounded-2xl p-4 mb-4">
            <Label text="隐私保护" class="text-lg font-bold text-theme-primary mb-4" />
            <GridLayout columns="auto, *">
              <StackLayout col="1">
                <Label
                  text="您的 API Key 仅存储在本地设备，不会上传到任何服务器。所有对话数据也仅保存在本地。"
                  class="text-sm text-theme-primary"
                  textWrap="true"
                  lineHeight="2"
                />
              </StackLayout>
            </GridLayout>
          </StackLayout>

          <!-- 版本信息 -->
          <StackLayout class="bg-theme-card rounded-2xl p-4 mb-4">
            <Label text="关于" class="text-lg font-bold text-theme-primary mb-4" />
            <GridLayout columns="*, auto" class="mb-3">
              <Label col="0" text="当前版本" class="text-theme-primary" />
              <Label col="1" :text="'v' + currentVersion" class="text-theme-secondary" />
            </GridLayout>
            <Label
              :text="checkingUpdate ? '检查中...' : '检查更新'"
              :class="[
                'text-center py-3 rounded-xl font-medium',
                checkingUpdate ? ' text-theme-secondary' : 'text-theme-inverse'
              ]"
              :backgroundColor="checkingUpdate ? getColor('bgSecondary') : getColor('primary')"
              @tap="checkUpdate"
            />
          </StackLayout>
        </StackLayout>
      </ScrollView>

      <!-- 底部安全区域 -->
      <StackLayout row="3" :height="bottomSafeArea" class="bg-theme-secondary" />
    </GridLayout>
  </Page>
</template>

<script lang="ts" setup>
import { ref, onMounted, $navigateBack } from "nativescript-vue";
import { Screen, Application, Utils, Dialogs } from "@nativescript/core";
import { Toast } from "@xierfloat-monorepo/mobile-ui";
import { ApplicationSettings } from "@nativescript/core";
import { AppConfig } from "../config/app.config";
import { useTheme } from "../composables/useTheme";
const {  getColor } = useTheme();
// 硅基流动配置常量
const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/messages";
const DEFAULT_MODEL = "zai-org/GLM-4.6V"; // 免费模型

// 版本信息 (从环境变量读取)
const currentVersion = AppConfig.version;

// 状态栏高度
const statusBarHeight = ref(24);
const bottomSafeArea = ref(0);

// 配置数据
const apiKey = ref("");
const model = ref(DEFAULT_MODEL);
const testStatus = ref("");
const checkingUpdate = ref(false);

const recommendedModels = [
  { id: "zai-org/GLM-4.6V", name: "GLM-4.6" },
  { id: "Qwen/Qwen3-VL-32B-Thinking", name: "Qwen3-VL-32B" },
  { id: "MiniMaxAI/MiniMax-M2", name: "MiniMax-M2" },
  { id: "moonshotai/Kimi-K2-Instruct-0905", name: "Kimi-K2" },
  { id: "deepseek-ai/DeepSeek-V3.2", name: "DeepSeek-V3.2" }
];

// 功能列表
const features = [
  {
    icon: "📅",
    title: "日程管理",
    desc: "创建、查询、修改和删除日程事件"
  },
  {
    icon: "🔔",
    title: "智能提醒",
    desc: "为重要事件设置提前通知提醒"
  },
  {
    icon: "🔍",
    title: "信息搜索",
    desc: "搜索网络获取相关信息"
  },
  {
    icon: "💬",
    title: "自然对话",
    desc: "用自然语言描述需求，AI 自动理解执行"
  }
];

onMounted(() => {
  if (Application.android) {
    const resourceId = Utils.android
      .getApplicationContext()
      .getResources()
      .getIdentifier("status_bar_height", "dimen", "android");
    if (resourceId > 0) {
      const height = Utils.android.getApplicationContext().getResources().getDimensionPixelSize(resourceId);
      statusBarHeight.value = height / Screen.mainScreen.scale;
    }
  }

  // 加载已保存的配置
  loadSavedConfig();

  // 自动检查更新
  checkUpdate(true);
});

// 返回
function goBack() {
  $navigateBack();
}

// 选择模型
function selectModel(modelId: string) {
  model.value = modelId;
}

// 打开 API Key 页面
function openApiKeyPage() {
  Utils.openUrl("https://cloud.siliconflow.cn/i/0xu8cOpi");
}

// 加载已保存的配置
function loadSavedConfig() {
  const savedApiKey = ApplicationSettings.getString("siliconflow_api_key", "");
  const savedModel = ApplicationSettings.getString("siliconflow_model", DEFAULT_MODEL);

  if (savedApiKey) {
    apiKey.value = savedApiKey;
  }
  if (savedModel) {
    model.value = savedModel;
  }
}

// 测试连接
async function testConnection() {
  if (!apiKey.value.trim()) {
    Toast.warning("请先输入 API Key");
    return;
  }

  testStatus.value = "测试中...";

  try {
    console.log("开始测试连接...");
    console.log("API URL:", SILICONFLOW_API_URL);
    console.log("Model:", model.value || DEFAULT_MODEL);

    const response = await fetch(SILICONFLOW_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.value}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model.value || DEFAULT_MODEL,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 10,
        stream: false
      })
    });

    console.log("Response status:", response.status);

    if (response.ok) {
      testStatus.value = "连接成功";
      Toast.success("API Key 验证成功");
    } else {
      const errorText = await response.text();
      console.log("Error response:", errorText);
      let errorMsg = "未知错误";
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMsg = errorText || `HTTP ${response.status}`;
      }
      testStatus.value = "连接失败";
      Toast.error(`验证失败: ${errorMsg}`);
    }

    setTimeout(() => {
      testStatus.value = "";
    }, 3000);
  } catch (error: any) {
    console.error("Connection test error:", error);
    testStatus.value = "连接失败";
    Toast.error(`网络错误: ${error.message || "请检查网络连接"}`);
  }
}

// 保存配置
function saveConfig() {
  if (!apiKey.value.trim()) {
    Toast.warning("请输入 API Key");
    return;
  }

  try {
    // 保存到 ApplicationSettings
    ApplicationSettings.setString("siliconflow_api_key", apiKey.value);
    ApplicationSettings.setString("siliconflow_model", model.value || DEFAULT_MODEL);
    ApplicationSettings.setString("siliconflow_api_url", SILICONFLOW_API_URL);

    Toast.success("配置已保存");
    goBack();
  } catch (error) {
    Toast.error("保存失败");
  }
}

// 比较版本号 (返回: 1 = v1 > v2, -1 = v1 < v2, 0 = 相等)
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, "").split(".").map(Number);
  const parts2 = v2.replace(/^v/, "").split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// 检查更新
async function checkUpdate(silent = false) {
  if (checkingUpdate.value) return;

  checkingUpdate.value = true;

  try {
    const response = await fetch(AppConfig.updateCheckUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "ShadowHour-App"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const latestVersion = data.tag_name || data.version || "";
    const downloadUrl = data.html_url || data.assets?.[0]?.browser_download_url || AppConfig.downloadUrl;
    const releaseNotes = data.body || "";

    // 比较版本
    if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
      // 有新版本
      showUpdateDialog(latestVersion, releaseNotes, downloadUrl);
    } else if (!silent) {
      Toast.success("已是最新版本");
    }
  } catch (error: any) {
    console.error("[AIConfig] 检查更新失败:", error);
    if (!silent) {
      Toast.error("检查更新失败，请稍后重试");
    }
  } finally {
    checkingUpdate.value = false;
  }
}

// 显示更新弹窗
function showUpdateDialog(version: string, notes: string, downloadUrl: string) {
  const message = notes
    ? `发现新版本 ${version}\n\n更新内容：\n${notes.slice(0, 200)}${notes.length > 200 ? "..." : ""}`
    : `发现新版本 ${version}，是否前往下载？`;

  Dialogs.confirm({
    title: "发现新版本",
    message: message,
    okButtonText: "立即更新",
    cancelButtonText: "稍后再说"
  }).then((result: boolean) => {
    if (result) {
      Utils.openUrl(downloadUrl);
    }
  });
}
</script>

<style scoped>
.slider {
  margin: 0 8;
}
</style>
