<template>
  <Page actionBarHidden="true">
      <GridLayout rows="auto, auto, *">
        <!-- 状态栏占位 -->
        <StackLayout row="0" :height="statusBarHeight" class="bg-white" />

        <!-- 头部 -->
        <GridLayout row="1" columns="auto, *, auto" class="bg-white p-3 border-b border-gray-100">
          <Label col="0" text="←" class="text-2xl text-gray-600 p-2" @tap="goBack" />
          <Label col="1" text="AI 配置" class="text-lg font-bold text-gray-800 text-center" />
          <Label col="2" text="" class="text-xl p-2" />
        </GridLayout>

        <!-- 配置内容 -->
        <ScrollView row="2" class="bg-gray-50">
          <StackLayout class="p-4">
            <!-- 模型配置卡片 -->
            <StackLayout class="bg-white rounded-2xl p-4 mb-4">
              <Label text="模型配置" class="text-lg font-bold text-gray-800 mb-4" />

              <!-- 当前模型 -->
              <GridLayout columns="auto, *, auto" class="mb-4">
                <Label col="0" text="当前模型" class="text-gray-600" />
                <Label col="1" />
                <Label col="2" :text="currentModel" class="text-orange-500 font-medium" />
              </GridLayout>

              <!-- API Key -->
              <StackLayout class="mb-4">
                <Label text="API Key" class="text-gray-600 mb-2" />
                <TextField
                  v-model="apiKey"
                  hint="输入你的 API Key"
                  secure="true"
                  class="bg-gray-100 rounded-xl p-3"
                />
              </StackLayout>

              <!-- 提供商选择 -->
              <StackLayout class="mb-4">
                <Label text="服务提供商" class="text-gray-600 mb-2" />
                <GridLayout columns="*, *, *" class="bg-gray-100 rounded-xl p-1">
                  <Label
                    v-for="(provider, index) in providers"
                    :key="provider.id"
                    :col="index"
                    :text="provider.name"
                    :class="[
                      'text-center py-2 rounded-lg text-sm',
                      selectedProvider === provider.id ? 'bg-white font-medium text-orange-500' : 'text-gray-600'
                    ]"
                    @tap="selectProvider(provider.id)"
                  />
                </GridLayout>
              </StackLayout>

              <!-- 保存按钮 -->
              <Label
                text="保存配置"
                class="bg-orange-500 text-white text-center py-3 rounded-xl font-medium mt-4"
                @tap="saveConfig"
              />
            </StackLayout>

            <!-- 功能说明 -->
            <StackLayout class="bg-white rounded-2xl p-4 mb-4">
              <Label text="功能说明" class="text-lg font-bold text-gray-800 mb-4" />

              <StackLayout v-for="feature in features" :key="feature.title" class="mb-3">
                <GridLayout columns="auto, *">
                  <Label col="0" :text="feature.icon" class="text-xl mr-3" />
                  <StackLayout col="1">
                    <Label :text="feature.title" class="text-gray-800 font-medium" />
                    <Label :text="feature.desc" class="text-sm text-gray-500" textWrap="true" />
                  </StackLayout>
                </GridLayout>
              </StackLayout>
            </StackLayout>

            <!-- 隐私说明 -->
            <StackLayout class="bg-blue-50 rounded-2xl p-4">
              <GridLayout columns="auto, *">
                <Label col="0" text="🔒" class="text-xl mr-3" />
                <StackLayout col="1">
                  <Label text="隐私保护" class="text-blue-800 font-medium" />
                  <Label
                    text="你的 API Key 仅存储在本地设备，不会上传到任何服务器。所有对话数据也仅保存在本地。"
                    class="text-sm text-blue-600 mt-1"
                    textWrap="true"
                  />
                </StackLayout>
              </GridLayout>
            </StackLayout>
          </StackLayout>
        </ScrollView>
      </GridLayout>
    </Page>
</template>

<script lang="ts" setup>
import { ref, onMounted, $navigateBack } from 'nativescript-vue'
import { Screen, Application, Utils } from '@nativescript/core'
import { Toast } from '@xierfloat-monorepo/mobile-ui'

// 状态栏高度
const statusBarHeight = ref(24)

// 配置数据
const currentModel = ref('GPT-4')
const apiKey = ref('')
const selectedProvider = ref('openai')

// 提供商列表
const providers = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'qwen', name: '通义' }
]

// 功能列表
const features = [
  {
    icon: '📅',
    title: '日程管理',
    desc: '创建、查询、修改和删除日程事件'
  },
  {
    icon: '🔔',
    title: '智能提醒',
    desc: '为重要事件设置提前通知提醒'
  },
  {
    icon: '🔍',
    title: '信息搜索',
    desc: '搜索网络获取相关信息'
  },
  {
    icon: '💬',
    title: '自然对话',
    desc: '用自然语言描述需求，AI 自动理解执行'
  }
]

onMounted(() => {
  // 获取状态栏高度
  if (Application.android) {
    const resourceId = Utils.android
      .getApplicationContext()
      .getResources()
      .getIdentifier('status_bar_height', 'dimen', 'android')
    if (resourceId > 0) {
      const height = Utils.android.getApplicationContext().getResources().getDimensionPixelSize(resourceId)
      statusBarHeight.value = height / Screen.mainScreen.scale
    }
  }

  // 加载已保存的配置
  // TODO: 从存储中读取
})

// 返回
function goBack() {
  $navigateBack()
}

// 选择提供商
function selectProvider(id: string) {
  selectedProvider.value = id
  // 更新模型名称
  const modelNames: Record<string, string> = {
    openai: 'GPT-4',
    deepseek: 'DeepSeek',
    qwen: 'Qwen-Turbo'
  }
  currentModel.value = modelNames[id] || 'GPT-4'
}

// 保存配置
function saveConfig() {
  if (!apiKey.value.trim()) {
    Toast.warning('请输入 API Key')
    return
  }

  // TODO: 保存到存储
  Toast.success('配置已保存')
  goBack()
}
</script>