<template>
  <ScrollView class="config-editor">
    <StackLayout padding="16">
      <!-- 基础信息 -->
      <CardView class="form-section">
        <StackLayout padding="16">
          <Label text="基础信息" class="section-title" />

          <!-- 名称 -->
          <StackLayout class="form-group">
            <Label text="配置名称" class="form-label" />
            <TextField
              v-model="formData.name"
              hint="如：我的 GPT-4"
              class="form-input"
            />
          </StackLayout>

          <!-- 提供商 -->
          <StackLayout class="form-group">
            <Label text="服务提供商" class="form-label" />
            <ListPicker
              :items="providerOptions"
              v-model="providerIndex"
              @selectedIndexChange="onProviderChange"
              class="form-picker"
            />
          </StackLayout>
        </StackLayout>
      </CardView>

      <!-- API 配置 -->
      <CardView class="form-section">
        <StackLayout padding="16">
          <Label text="API 配置" class="section-title" />

          <!-- API Key -->
          <StackLayout class="form-group">
            <Label text="API Key" class="form-label" />
            <SecureField
              v-model="formData.apiKey"
              hint="输入您的 API Key"
              class="form-input"
            />
            <Label
              text="获取 API Key："
              class="help-text"
              @tap="showApiKeyHelp"
            />
          </StackLayout>

          <!-- Base URL (非 OpenAI 时显示) -->
          <StackLayout v-if="showBaseUrl" class="form-group">
            <Label text="API 基础地址" class="form-label" />
            <TextField
              v-model="formData.baseUrl"
              hint="如：https://api.deepseek.com/v1"
              class="form-input"
              text="https://api.deepseek.com/v1"
              :editable="isCustomProvider"
            />
          </StackLayout>
        </StackLayout>
      </CardView>

      <!-- 模型配置 -->
      <CardView class="form-section">
        <StackLayout padding="16">
          <Label text="模型配置" class="section-title" />

          <!-- 模型选择 -->
          <StackLayout class="form-group">
            <Label text="模型" class="form-label" />
            <ListPicker
              :items="modelOptions"
              v-model="modelIndex"
              class="form-picker"
            />
          </StackLayout>

          <!-- 高级参数 -->
          <Button
            text="高级参数"
            @tap="showAdvanced = !showAdvanced"
            class="toggle-button"
          />

          <StackLayout v-if="showAdvanced" class="advanced-section">
            <!-- Max Tokens -->
            <StackLayout class="form-group">
              <Label :text="`最大 Token (${formData.maxTokens})`" class="form-label" />
              <Slider
                v-model="formData.maxTokens"
                minValue="500"
                maxValue="8000"
                class="form-slider"
              />
            </StackLayout>

            <!-- Temperature -->
            <StackLayout class="form-group">
              <Label :text="`温度 (${formData.temperature})`" class="form-label" />
              <Slider
                v-model="formData.temperature"
                minValue="0"
                maxValue="2"
                step="0.1"
                class="form-slider"
              />
            </StackLayout>
          </StackLayout>
        </StackLayout>
      </CardView>

      <!-- 测试连接 -->
      <CardView class="form-section">
        <StackLayout padding="16">
          <Button
            text="测试连接"
            @tap="testConnection"
            :text="testStatus || '测试连接'"
            :class="{ 'test-success': testStatus === '连接成功' }"
            class="test-button"
          />
        </StackLayout>
      </CardView>

      <!-- 操作按钮 -->
      <Gridlayout columns="*, *" class="action-buttons">
        <Button
          col="0"
          text="取消"
          @tap="$emit('cancel')"
          class="cancel-button"
        />
        <Button
          col="1"
          text="保存"
          @tap="saveConfig"
          class="save-button"
        />
      </Gridlayout>
    </StackLayout>
  </ScrollView>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { LLMConfig, LLMProvider } from '@xierfloat-monorepo/mobile-ai/types'
import { LLM_PRESETS } from '@xierfloat-monorepo/mobile-ai/types/config'
import { useChat } from '@xierfloat-monorepo/mobile-ai'
import { AlertDialog } from '@nativescript/core'

// Props
interface Props {
  config?: LLMConfig
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'save', config: LLMConfig): void
  (e: 'cancel'): void
}>()

// 使用 useChat 获取 saveConfig 方法
const chat = useChat()

// 响应式数据
const providerIndex = ref(0)
const modelIndex = ref(0)
const showAdvanced = ref(false)
const testStatus = ref('')
const isCustomProvider = ref(false)

// 表单数据
const formData = ref<Partial<LLMConfig>>({
  name: '',
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  maxTokens: 4096,
  temperature: 0.7,
  supportsStreaming: true,
  supportsTools: true,
  supportsVision: false
})

// 提供商选项
const providerOptions: string[] = [
  'OpenAI',
  'Anthropic (Claude)',
  'DeepSeek',
  '通义千问',
  '月之暗面',
  '智谱 GLM',
  'Ollama',
  '自定义'
]

// Computed
const currentProvider = computed<LLMProvider>(() => {
  const mapping: { [key: number]: LLMProvider } = {
    0: 'openai',
    1: 'anthropic',
    2: 'deepseek',
    3: 'qwen',
    4: 'moonshot',
    5: 'zhipu',
    6: 'ollama',
    7: 'custom'
  }
  return mapping[providerIndex.value] || 'openai'
})

const showBaseUrl = computed(() => {
  return currentProvider.value !== 'openai' && currentProvider.value !== 'anthropic'
})

const modelOptions = computed(() => {
  const presets = Object.entries(LLM_PRESETS)
  const providerModels = presets
    .filter(([_, preset]) => preset.provider === currentProvider.value)
    .map(([_, preset]) => preset.model)
  return providerModels.length > 0 ? providerModels : ['自定义']
})

// 监听提供商变化，更新默认值
watch(currentProvider, (newProvider) => {
  const preset = Object.values(LLM_PRESETS).find(p => p.provider === newProvider)
  if (preset) {
    formData.value = {
      ...formData.value,
      ...preset,
      apiKey: formData.value.apiKey || ''
    }
    // 更新模型选择
    const modelIdx = modelOptions.value.indexOf(preset.model)
    modelIndex.value = Math.max(0, modelIdx)
  }

  // 更新预填充的 Base URL
  const baseUrls = {
    deepseek: 'https://api.deepseek.com/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    moonshot: 'https://api.moonshot.cn/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    ollama: 'http://localhost:11434/v1'
  }

  if (showBaseUrl.value && baseUrls[newProvider as keyof typeof baseUrls]) {
    formData.value.baseUrl = baseUrls[newProvider as keyof typeof baseUrls]
  }
})

// 初始化
onMounted(() => {
  if (props.config) {
    // 编辑模式
    formData.value = { ...props.config }
    const provIdx = providerOptions.findIndex(
      p => p.toLowerCase().includes(props.config!.provider)
    )
    if (provIdx >= 0) {
      providerIndex.value = provIdx
    }
    const modelIdx = modelOptions.value.indexOf(props.config.model)
    if (modelIdx >= 0) {
      modelIndex.value = modelIdx
    }
  } else {
    // 默认选择第一个
    onProviderChange()
  }
})

// 方法
const onProviderChange = () => {
  isCustomProvider.value = currentProvider.value === 'custom'
}

const testConnection = async () => {
  testStatus.value = '测试中...'

  try {
    const adapter = chat.updateConfig(formData.value as LLMConfig)
    const result = await adapter.validateConfig()

    if (result.valid) {
      testStatus.value = '连接成功'
    } else {
      testStatus.value = `错误: ${result.error}`
    }
  } catch (error) {
    testStatus.value = '连接失败'
  }
}

const saveConfig = async () => {
  if (!formData.value.name || !formData.value.apiKey) {
    AlertDialog.show({
      title: '提示',
      message: '请填写必要的配置信息',
      okButtonText: '确定'
    })
    return
  }

  const config: LLMConfig = {
    id: props.config?.id || `config_${Date.now()}`,
    name: formData.value.name!,
    provider: currentProvider.value,
    apiKey: formData.value.apiKey!,
    baseUrl: formData.value.baseUrl,
    model: formData.value.model || modelOptions.value[modelIndex.value],
    maxTokens: formData.value.maxTokens,
    temperature: formData.value.temperature,
    supportsStreaming: formData.value.supportsStreaming ?? true,
    supportsTools: formData.value.supportsTools ?? true,
    supportsVision: formData.value.supportsVision ?? false
  }

  try {
    await chat.saveConfig(config)
    emit('save', config)
  } catch (error) {
    AlertDialog.show({
      title: '错误',
      message: '保存配置失败',
      okButtonText: '确定'
    })
  }
}

const showApiKeyHelp = () => {
  const helpUrls = {
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/',
    deepseek: 'https://platform.deepseek.com/api_keys',
    qwen: 'https://dashscope.console.aliyun.com/',
    moonshot: 'https://platform.moonshot.cn/',
    zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
    ollama: 'https://ollama.com/',
    custom: '请联系服务提供商'
  }

  const provider = currentProvider.value
  const url = helpUrls[provider as keyof typeof helpUrls]

  AlertDialog.show({
    title: '获取 API Key',
    message: `请访问 ${provider} 控制台\n\n${url}`,
    okButtonText: '我知道了'
  })
}
</script>

<style scoped>
.config-editor {
  height: 100%;
  background-color: #f5f5f5;
}

.form-section {
  margin: 8 0;
}

.section-title {
  font-size: 16;
  font-weight: bold;
  color: #333333;
  margin-bottom: 12;
}

.form-group {
  margin: 12 0;
}

.form-label {
  font-size: 14;
  color: #666666;
  margin-bottom: 4;
}

.form-input,
.form-picker {
  padding: 12;
  border-width: 1;
  border-color: #e0e0e0;
  border-radius: 8;
  background-color: white;
}

.form-slider {
  margin-top: 8;
}

.help-text {
  font-size: 12;
  color: #2196f3;
  margin-top: 4;
}

.toggle-button {
  margin: 12 0;
  background-color: #f5f5f5;
  color: #333333;
}

.advanced-section {
  padding-top: 12;
  border-top-color: #e0e0e0;
  border-top-width: 1;
}

.test-button {
  width: 100%;
  background-color: #f5f5f5;
  color: #333333;
  margin-top: 8;
}

.test-button.test-success {
  background-color: #e8f5e9;
  color: #4caf50;
}

.action-buttons {
  margin: 24 0;
  spacing: 16;
}

.cancel-button {
  background-color: #f5f5f5;
  color: #333333;
}

.save-button {
  background-color: #2196f3;
  color: white;
}
</style>