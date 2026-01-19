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
                class="bg-theme-tertiary rounded-xl p-3"
              />
              <Label text="前往获取 API Key →" class="text-theme-info text-sm mt-2" @tap="openApiKeyPage" />
            </StackLayout>

            <!-- 模型选择 -->
            <StackLayout class="mb-4">
              <Label text="模型" class="text-theme-secondary mb-2" />
              <TextField v-model="model" hint="zai-org/GLM-4.6V" class="bg-theme-tertiary rounded-xl p-3" />
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
                    model === m.id ? 'bg-theme-brand text-theme-inverse' : 'bg-theme-card text-theme-secondary'
                  ]"
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
              class="bg-theme-brand text-theme-inverse text-center py-3 rounded-xl font-medium"
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
                  <Label :text="feature.title" class="text-theme-primary font-medium" />
                  <Label :text="feature.desc" class="text-sm text-theme-secondary" textWrap="true" />
                </StackLayout>
              </GridLayout>
            </StackLayout>
          </StackLayout>

          <!-- 隐私说明 -->
          <StackLayout class="bg-theme-info rounded-2xl p-4" style="opacity: 0.15">
            <GridLayout columns="auto, *">
              <StackLayout col="1">
                <Label text="隐私保护" class="text-theme-info font-medium" />
                <Label
                  text="你的 API Key 仅存储在本地设备，不会上传到任何服务器。所有对话数据也仅保存在本地。"
                  class="text-sm text-theme-info"
                  textWrap="true"
                />
              </StackLayout>
            </GridLayout>
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
import { Screen, Application, Utils } from "@nativescript/core";
import { Toast } from "@xierfloat-monorepo/mobile-ui";
import { ApplicationSettings } from "@nativescript/core";

// 硅基流动配置常量
const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/messages";
const DEFAULT_MODEL = "zai-org/GLM-4.6V"; // 免费模型

// 状态栏高度
const statusBarHeight = ref(24);
const bottomSafeArea = ref(0);

// 配置数据
const apiKey = ref("");
const model = ref(DEFAULT_MODEL);
const testStatus = ref("");

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
</script>

<style scoped>
.slider {
  margin: 0 8;
}
</style>
