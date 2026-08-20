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
  limit_download_kb: 0,
  recovery_speed_kb: 0,
  recovery_download_kb: 0,
  recovery_cron: '30 0 1 * *',
})

const downloaderItems = ref([])
const loadingItems = ref(false)
const collectBusy = ref(false)
const limitBusy = ref(false)
const resetBusy = ref(false)
const actionMsg = ref('')

function showAction(msg, isError = false) {
  actionMsg.value = isError ? msg : `✅ ${msg}`
}

async function doCollect() {
  collectBusy.value = true
  actionMsg.value = ''
  try {
    const r = await props.api.get(`${base.value}/collect`)
    const payload = r?.data ?? r
    showAction(payload?.ok ? '已触发采集，可稍后打开详情页查看' : `采集失败：${payload?.error || ''}`, !payload?.ok)
  } catch (e) {
    showAction(`采集请求失败：${e?.message || e}`, true)
  } finally {
    collectBusy.value = false
  }
}

// 测试「超限限速」：按 limit_speed_kb 限速
async function doTestLimit() {
  limitBusy.value = true
  actionMsg.value = ''
  try {
    const r = await props.api.post(`${base.value}/test-limit`)
    const payload = r?.data ?? r
    showAction(
      payload?.ok
        ? `已按超限限速 上传${payload.upload_kb ?? 0}/下载${payload.download_kb ?? 0} KB/s 设置 ${payload.applied_count ?? 0} 个下载器`
        : `操作失败：${payload?.error || ''}`,
      !payload?.ok
    )
  } catch (e) {
    showAction(`请求失败：${e?.message || e}`, true)
  } finally {
    limitBusy.value = false
  }
}

// 测试「月初恢复」：按 recovery_speed_kb 恢复限速
async function doReset() {
  resetBusy.value = true
  actionMsg.value = ''
  try {
    const r = await props.api.post(`${base.value}/reset-limit`)
    const payload = r?.data ?? r
    showAction(
      payload?.ok
        ? `已按恢复限速 上传${payload.upload_kb ?? 0}/下载${payload.download_kb ?? 0} KB/s 设置 ${payload.reset_count ?? 0} 个下载器`
        : `操作失败：${payload?.error || ''}`,
      !payload?.ok
    )
  } catch (e) {
    showAction(`请求失败：${e?.message || e}`, true)
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
    limit_download_kb: c.limit_download_kb || 0,
    recovery_speed_kb: c.recovery_speed_kb || 0,
    recovery_download_kb: c.recovery_download_kb || 0,
    recovery_cron: c.recovery_cron || '30 0 1 * *',
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
      <div class="d-flex ga-2 mb-3 flex-wrap">
        <VBtn
          color="primary"
          variant="tonal"
          :loading="collectBusy"
          @click="doCollect"
        >立即采集流量</VBtn>
        <VBtn
          color="error"
          variant="tonal"
          :loading="limitBusy"
          @click="doTestLimit"
        >测试限速</VBtn>
        <VBtn
          color="success"
          variant="tonal"
          :loading="resetBusy"
          @click="doReset"
        >测试月初恢复</VBtn>
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
        hint="0=达到阈值也不限上传"
        persistent-hint
      />
      <VTextField
        v-model.number="local.limit_download_kb"
        label="超限后全局下载限速 (KB/s)"
        type="number"
        placeholder="0"
        class="mt-3"
        variant="outlined"
        hint="0=达到阈值也不限下载"
        persistent-hint
      />
      <VTextField
        v-model.number="local.recovery_speed_kb"
        label="月初恢复全局上传限速 (KB/s)"
        type="number"
        placeholder="0"
        class="mt-3"
        variant="outlined"
        hint="恢复时把全局上传限速设成该值（如 4096=4M/s）；0=完全放开"
        persistent-hint
      />
      <VTextField
        v-model.number="local.recovery_download_kb"
        label="月初恢复全局下载限速 (KB/s)"
        type="number"
        placeholder="0"
        class="mt-3"
        variant="outlined"
        hint="恢复时把全局下载限速设成该值；0=完全放开"
        persistent-hint
      />
      <VTextField
        v-model="local.recovery_cron"
        label="月初恢复触发时间 (Cron 表达式)"
        placeholder="30 0 1 * *"
        class="mt-3"
        variant="outlined"
        hint="默认每月1号00:30（30 0 1 * *）。可临时改成更频繁的值来测试恢复动作"
        persistent-hint
      />
    </div>
  </div>
</template>
