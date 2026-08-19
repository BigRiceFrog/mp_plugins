<script setup>
import { ref, computed, onMounted } from 'vue'

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

// 后端 API 路由以插件类名 DownloaderTraffic 为前缀注册
const pid = computed(() => {
  const v = props.pluginId
  return v && v !== 'downloadertraffic' ? v : 'DownloaderTraffic'
})
const base = computed(() => `plugin/${pid.value}`)

// api.get 直接返回响应体（MP 前端拦截器已解包 response.data）；
// 个别宿主若返回 axios 响应对象则解一层 .data
function unwrap(res) {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res &&
      ('status' in res || 'statusText' in res || 'headers' in res)) {
    return res.data
  }
  return res
}

const local = ref({
  enabled: false,
  cron: '*/30 * * * *',
  downloaders: [],
  upload_threshold_gb: 0,
  limit_speed_kb: 0,
})

const downloaderItems = ref([])
const loadingItems = ref(false)
const collectBusy = ref(false)
const resetBusy = ref(false)
const actionMsg = ref('')

async function doCollect() {
  collectBusy.value = true
  actionMsg.value = ''
  try {
    const r = await props.api.get(`${base.value}/collect`)
    const payload = r?.data ?? r
    actionMsg.value = payload?.ok ? '已触发采集，可稍后打开详情页查看' : `采集失败：${payload?.error || ''}`
  } catch (e) {
    actionMsg.value = `采集请求失败：${e?.message || e}`
  } finally {
    collectBusy.value = false
  }
}

async function doReset() {
  resetBusy.value = true
  actionMsg.value = ''
  try {
    const r = await props.api.post(`${base.value}/reset-limit`)
    const payload = r?.data ?? r
    actionMsg.value = payload?.ok
      ? `已解除 ${payload.reset_count ?? 0} 个下载器的上传限速`
      : `解除失败：${payload?.error || ''}`
  } catch (e) {
    actionMsg.value = `解除请求失败：${e?.message || e}`
  } finally {
    resetBusy.value = false
  }
}

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
      const res = await props.api.get(`${base.value}/downloaders`)
      // api.get 直接返回响应体 {data: [...]}；兼容 axios 响应对象
      const body = unwrap(res) || {}
      const payload = Array.isArray(body) ? body : (body.data ?? body)
      downloaderItems.value = Array.isArray(payload) ? payload : []
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
      <div v-if="actionMsg" class="mb-3">
        <VAlert density="compact" variant="tonal" :type="actionMsg.includes('失败') ? 'error' : 'success'">
          {{ actionMsg }}
        </VAlert>
      </div>
      <div class="d-flex ga-2 mb-3">
        <VBtn
          color="primary"
          variant="tonal"
          :loading="collectBusy"
          @click="doCollect"
        >立即采集流量</VBtn>
        <VBtn
          color="warning"
          variant="tonal"
          :loading="resetBusy"
          @click="doReset"
        >立即解除限速</VBtn>
      </div>
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
