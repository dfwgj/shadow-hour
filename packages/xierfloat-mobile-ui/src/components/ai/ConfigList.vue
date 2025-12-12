<template>
  <ScrollView class="config-list">
    <StackLayout>
      <!-- 当前配置 -->
      <CardView v-if="currentConfig" class="current-config">
        <StackLayout padding="16">
          <Label text="当前配置" class="section-title" />
          <GridLayout columns="auto, *" rows="auto, auto, auto" class="config-item">
            <Image
              col="0"
              row="0"
              :src="getProviderIcon(currentConfig.provider)"
              width="40"
              height="40"
              marginRight="12"
            />
            <Label :text="currentConfig.name" col="1" row="0" class="config-name" />
            <Label :text="currentConfig.model" col="1" row="1" class="config-model" />
            <Button
              col="1"
              row="2"
              :text="isEditing ? '保存' : '编辑'"
              @tap="toggleEdit"
              class="edit-button"
            />
          </GridLayout>
        </StackLayout>
      </CardView>

      <!-- 配置列表 -->
      <CardView class="configs-section">
        <StackLayout padding="16">
          <GridLayout columns="*, auto" class="section-header">
            <Label text="所有配置" col="0" class="section-title" />
            <Button
              col="1"
              text="添加"
              @tap="$emit('add-config')"
              class="add-button"
            />
          </GridLayout>

          <StackLayout v-if="configs.length === 0" class="empty-state">
            <Label text="暂无配置" class="empty-text" />
          </StackLayout>

          <StackLayout v-else>
            <StackLayout
              v-for="config in configs"
              :key="config.id"
              class="config-item"
              @tap="selectConfig(config)"
            >
              <GridLayout columns="auto, *, auto" rows="auto, auto">
                <Image
                  col="0"
                  row="0"
                  :src="getProviderIcon(config.provider)"
                  width="40"
                  height="40"
                  marginRight="12"
                />
                <Label :text="config.name" col="1" row="0" class="config-name" />
                <Label :text="config.model" col="1" row="1" class="config-model" />
                <Button
                  col="2"
                  row="0"
                  rowSpan="2"
                  :text="config.id === currentConfig?.id ? '✓' : '选择'"
                  @tap.stop="switchConfig(config)"
                  :class="{ active: config.id === currentConfig?.id }"
                />
              </GridLayout>

              <!-- 操作按钮 -->
              <StackLayout orientation="horizontal" class="config-actions">
                <Button
                  text="编辑"
                  @tap.stop="$emit('edit-config', config)"
                  class="action-button"
                />
                <Button
                  text="删除"
                  @tap.stop="deleteConfig(config.id)"
                  class="action-button delete"
                />
              </StackLayout>
            </StackLayout>
          </StackLayout>
        </StackLayout>
      </CardView>

      <!-- 隐私提示 -->
      <Label
        text="⚠️ 您的 API 密钥将安全存储在本地，不会上传到服务器"
        class="privacy-note"
        textWrap="true"
      />
    </StackLayout>
  </ScrollView>
</template>

<script setup lang="ts">
import { computed, type ComputedRef } from 'vue'
import type { LLMConfig } from '@xierfloat-monorepo/mobile-ai/types'
import { useChat } from '@xierfloat-monorepo/mobile-ai'
import { AlertDialog } from '@nativescript/core'

// Props
interface Props {
  configs: LLMConfig[]
  currentConfigId?: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'select-config', config: LLMConfig): void
  (e: 'add-config'): void
  (e: 'edit-config', config: LLMConfig): void
}>()

// 使用 useChat 获取 switchConfig 方法
const chat = useChat()
const isEditing = ref(false)

// Computed
const currentConfig: ComputedRef<LLMConfig | null> = computed(() => {
  if (props.currentConfigId) {
    return props.configs.find(c => c.id === props.currentConfigId) ?? null
  }
  return props.configs.find(c => c.isDefault) ?? null
})

// 方法
const selectConfig = (config: LLMConfig) => {
  emit('select-config', config)
}

const switchConfig = async (config: LLMConfig) => {
  try {
    await chat.switchConfig(config.id)
    // 通知父组件切换成功
    selectConfig(config)
  } catch (error) {
    AlertDialog.show({
      title: '错误',
      message: '切换配置失败',
      okButtonText: '确定'
    })
  }
}

const deleteConfig = async (id: string) => {
  const confirm = await AlertDialog.show({
    title: '确认删除',
    message: '确定要删除这个配置吗？',
    okButtonText: '删除',
    cancelButtonText: '取消'
  })

  if (confirm) {
    try {
      await chat.deleteConfig(id)
      // 刷新配置列表 (父组件处理)
    } catch (error) {
      AlertDialog.show({
        title: '错误',
        message: '删除失败',
        okButtonText: '确定'
      })
    }
  }
}

const toggleEdit = () => {
  isEditing.value = !isEditing.value
  if (!isEditing.value) {
    // 保存编辑逻辑
  }
}

const getProviderIcon = (provider: string): string => {
  const icons = {
    openai: '~/assets/icons/openai.png',
    anthropic: '~/assets/icons/claude.png',
    deepseek: '~/assets/icons/deepseek.png',
    qwen: '~/assets/icons/qwen.png',
    moonshot: '~/assets/icons/moonshot.png',
    zhipu: '~/assets/icons/zhipu.png',
    ollama: '~/assets/icons/ollama.png',
    custom: '~/assets/icons/custom.png'
  }
  return icons[provider as keyof typeof icons] || icons.custom
}
</script>

<style scoped>
.config-list {
  height: 100%;
}

.current-config {
  margin: 8;
  background-color: #e3f2fd;
}

.configs-section {
  margin: 8;
}

.section-title {
  font-size: 18;
  font-weight: bold;
  color: #333333;
  margin-bottom: 12;
}

.section-header {
  margin-bottom: 16;
}

.config-item {
  padding: 12;
  margin: 8 0;
  background-color: #ffffff;
  border-radius: 8;
}

.config-name {
  font-size: 16;
  font-weight: bold;
  color: #333333;
}

.config-model {
  font-size: 14;
  color: #666666;
}

.config-actions {
  margin-top: 8;
  spacing: 8;
  horizontal-align: right;
}

.action-button {
  padding: 8 16;
  font-size: 12;
  background-color: #f5f5f5;
  color: #333333;
  border-radius: 4;
}

.action-button.delete {
  background-color: #ffebee;
  color: #f44336;
}

.edit-button,
.add-button,
.active {
  background-color: #2196f3;
  color: white;
  padding: 8 16;
  border-radius: 4;
  font-size: 14;
}

.empty-state {
  padding: 32 0;
  horizontal-align: center;
}

.empty-text {
  font-size: 14;
  color: #999999;
}

.privacy-note {
  padding: 16;
  font-size: 12;
  color: #666666;
  text-align: center;
}
</style>