<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  api: {
    type: Object,
    default: () => ({}),
  },
  pluginId: {
    type: String,
    default: 'downloadertraffic',
  },
  initialConfig: {
    type: Object,
    default: () => ({}),
  },
})
const emit = defineEmits(['save', 'close'])

const local = ref({
  enabled: false,
  cron: '*/30 * * * *',
  downloaders: [],
  upload_threshold_gb: 0,
  limit_speed_kb: 0,
})

const downloaderItems = ref([])
const loadingItems = ref(false)

onMounted(async () => {
  const c = props.initialConfig || {}
  const dl = c.downloaders
  local.value = {
    enabled: Boolean(c.enabled),
    cron: c.cron || '*/30 * * * *',
    downloaders: Array.isArray(dl) ? dl : ((dl || '').split(',').filter(Boolean)),
    upload_threshold_gb: c.upload_threshold_gb || 0,
    limit_speed_kb: c.limit_speed_kb || 0,
  }

  if (props.api && props.api.get) {
    loadingItems.value = true
    try {
      const res = await props.api.get(`plugin/${props.pluginId}/downloaders`)
      const payload = res?.data ?? res
      downloaderItems.value = Array.isArray(payload?.data) ? payload.data : []
    } catch (e) {
      console.error('读取下载器列表失败', e)
    } finally {
      loadingItems.value = false
    }
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
      <VSelect
        v-model="local.downloaders"
        :items="downloaderItems"
        :loading="loadingItems"
        label="指定下载器（留空=全部）"
        multiple
        chips
        clearable
        class="mt-3"
        variant="outlined"
        hint="从 MP 已配置的下载器中选择；留空则统计全部"
        persistent-hint
      />
      <VTextField
        v-model.number="local.upload_threshold_gb"
        label="月度上传阈值 (GB)"
        type="number"
        placeholder="0"
        class="mt-3"
        variant="outlined"
        hint="当前自然月累计上传达到该值后触发全局限速；0=不启用"
        persistent-hint
      />
      <VTextField
        v-model.number="local.limit_speed_kb"
        label="超限后全局上传限速 (KB/s)"
        type="number"
        placeholder="0"
        class="mt-3"
        variant="outlined"
        hint="0=达到阈值也不限速"
        persistent-hint
      />
    </div>
  </div>
</template>
