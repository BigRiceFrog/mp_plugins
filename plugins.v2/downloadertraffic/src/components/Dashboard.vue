<script setup>
import { ref, onMounted, computed } from 'vue'

const props = defineProps({
  api: {
    type: Object,
    default: () => ({}),
  },
  pluginId: {
    type: String,
    default: 'downloadertraffic',
  },
})

const base = computed(() => {
  const v = props.pluginId
  // 后端 API 路由以插件类名 DownloaderTraffic 为前缀注册
  return `plugin/${v && v !== 'downloadertraffic' ? v : 'DownloaderTraffic'}`
})
const loading = ref(false)
const up = ref(0)
const down = ref(0)

// 与详情页 / 配置页保持一致：宿主可能直接回响应体，也可能回 axios 响应对象
function unwrap(res) {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res &&
      ('status' in res || 'statusText' in res || 'headers' in res)) {
    return res.data
  }
  return res
}

function fmtBytes(n) {
  const num = Number(n || 0)
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(2) + ' TB'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(2) + ' GB'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(2) + ' MB'
  if (num >= 1024) return (num / 1024).toFixed(1) + ' KB'
  return num + ' B'
}
function pad2(n) { return String(n).padStart(2, '0') }
// 本地时区的今天：原来的 toISOString() 取的是 UTC 日期，东八区 0-8 点会算成昨天
function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

async function load() {
  loading.value = true
  try {
    const r = await props.api.get(`${base.value}/records?period=day&value=${todayKey()}`)
    const rec = unwrap(r) || {}
    up.value = rec.total_uploaded || 0
    down.value = rec.total_downloaded || 0
  } catch (e) {
    // 仪表盘加载失败不影响主页面
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <VCard variant="flat" class="dt-dash">
    <div class="dt-dash-title">今日流量</div>
    <div class="dt-dash-rows">
      <div class="dt-dash-row">
        <span class="dt-dash-label"><span class="dt-up">↑</span>上传</span>
        <span class="dt-dash-val">{{ fmtBytes(up) }}</span>
      </div>
      <div class="dt-dash-row">
        <span class="dt-dash-label"><span class="dt-down">↓</span>下载</span>
        <span class="dt-dash-val">{{ fmtBytes(down) }}</span>
      </div>
    </div>
  </VCard>
</template>

<style scoped>
/* 仪表盘卡片在手机上可能只有 150~300px 宽：整块按容器宽度伸缩，
   数字用 tabular-nums 且允许换行，不会被卡片裁掉 */
.dt-dash {
  width: 100%;
  min-width: 0;
  padding: 8px 12px 12px;
  box-sizing: border-box;
}
.dt-dash-title {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dt-dash-rows { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dt-dash-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  line-height: 1.5;
}
.dt-dash-label {
  flex: 0 0 auto;
  white-space: nowrap;
  opacity: 0.85;
}
.dt-dash-val {
  flex: 1 1 auto;
  min-width: 0;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.dt-up { color: #4caf50; }
.dt-down { color: #2196f3; }

@media (max-width: 360px) {
  .dt-dash { padding: 6px 8px 10px; }
  .dt-dash-row { font-size: 13px; }
}
</style>
