<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  initialConfig: {
    type: Object,
    default: () => ({}),
  },
})
const emit = defineEmits(['save', 'close'])

const local = ref({
  enabled: false,
  cron: '*/30 * * * *',
  downloaders: '',
})

onMounted(() => {
  local.value = {
    enabled: Boolean(props.initialConfig?.enabled),
    cron: props.initialConfig?.cron || '*/30 * * * *',
    downloaders: props.initialConfig?.downloaders || '',
  }
})

function save() {
  emit('save', { ...local.value })
}
</script>

<template>
  <div class="dt-config">
    <VToolbar density="comfortable" color="transparent">
      <div class="text-h6 ms-3">下载器流量统计 · 配置</div>
      <VSpacer />
      <VBtn icon="mdi-content-save" variant="text" color="primary" @click="save" />
      <VBtn icon="mdi-close" variant="text" @click="emit('close')" />
    </VToolbar>
    <VDivider />
    <div class="pa-4" style="max-width: 560px">
      <VSwitch v-model="local.enabled" label="启用插件" color="primary" hide-details />
      <VTextField
        v-model="local.cron"
        label="采集周期 (Cron 表达式)"
        placeholder="*/30 * * * *"
        class="mt-3"
        variant="outlined"
        hint="默认每 30 分钟采集一次"
        persistent-hint
      />
      <VTextField
        v-model="local.downloaders"
        label="指定下载器 (留空=全部，逗号分隔)"
        placeholder="QB-Main,TR-Seed"
        class="mt-3"
        variant="outlined"
      />
    </div>
  </div>
</template>
