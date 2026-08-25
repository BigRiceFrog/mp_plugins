<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import CalendarPanel from './CalendarPanel.vue'
import PieChart from './PieChart.vue'
const props = defineProps({
  api: {
    type: Object,
    default: () => ({}),
  },
  pluginId: {
    type: String,
    default: 'downloadertraffic',
  },
  hideTitle: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['close'])
const period = ref('month')
const value = ref('')
const loading = ref(false)
const error = ref('')
const records = ref([])
const totalUp = ref(0)
const totalDown = ref(0)
const trend = ref([])
// 后端 API 路由由 MoviePilot 以「插件类名 DownloaderTraffic」为前缀注册；
// 这里固定使用类名，兼容宿主传入小写文件夹名 / 未传 pluginId 的情况。
const pid = computed(() => {
  const v = props.pluginId
  return v && v !== 'downloadertraffic' ? v : 'DownloaderTraffic'
})
const base = computed(() => `plugin/${pid.value}`)

// 立即采集 / 解除限速
const collectBusy = ref(false)
const resetBusy = ref(false)
const actionMsg = ref('')
async function doCollect() {
  collectBusy.value = true
  actionMsg.value = ''
  try {
    const r = await props.api.get(`${base.value}/collect`)
    const payload = r?.data ?? r
    actionMsg.value = payload?.ok ? '已触发采集，稍后自动刷新' : `采集失败：${payload?.error || ''}`
  } catch (e) {
    actionMsg.value = `采集请求失败：${e?.message || e}`
  } finally {
    collectBusy.value = false
    setTimeout(load, 800)
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
function fmtBytes(n) {
  const num = Number(n || 0)
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(2) + ' TB'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(2) + ' GB'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(2) + ' MB'
  if (num >= 1024) return (num / 1024).toFixed(2) + ' KB'
  return num + ' B'
}
function pad2(n) { return String(n).padStart(2, '0') }
function defaultValue() {
  const d = new Date()
  if (period.value === 'year') return String(d.getFullYear())
  if (period.value === 'month') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function unwrap(res) {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res &&
      ('status' in res || 'statusText' in res || 'headers' in res)) {
    return res.data
  }
  return res
}
async function load() {
  loading.value = true
  error.value = ''
  if (!value.value) value.value = defaultValue()
  try {
    const q = new URLSearchParams({ period: period.value, value: value.value })
    const [r1, r2] = await Promise.all([
      props.api.get(`${base.value}/records?${q.toString()}`),
      props.api.get(`${base.value}/trend?${q.toString()}`),
    ])
    const rec = unwrap(r1) || {}
    const tr = unwrap(r2) || {}
    records.value = rec.data || []
    totalUp.value = rec.total_uploaded || 0
    totalDown.value = rec.total_downloaded || 0
    trend.value = tr.data || []
  } catch (e) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  pieMonth.value = defaultMonth()
  pieDay.value = defaultDay()
  load()
  loadMonthPie()
  loadDayPie()
  observeTrendWidth()
})
onUnmounted(() => {
  if (trendRO) trendRO.disconnect()
})
watch(period, () => {
  value.value = defaultValue()
  nextTick(load)
})

// ============================================================
// 上传流量饼图：左=按月（默认当前月），右=按日（默认今日），仅统计上传
// ============================================================
const pieMonth = ref('')
const pieDay = ref('')
const monthPie = ref([]) // [{label, value}]
const dayPie = ref([])
const monthPieLoading = ref(false)
const dayPieLoading = ref(false)

function defaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}
function defaultDay() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function aggregateBySite(rows) {
  const map = new Map()
  for (const r of rows || []) {
    if (!r || r.site === 'GLOBAL') continue
    map.set(r.site, (map.get(r.site) || 0) + Number(r.uploaded || 0))
  }
  return Array.from(map, ([label, value]) => ({ label, value }))
}
async function loadMonthPie() {
  monthPieLoading.value = true
  try {
    const r = await props.api.get(`${base.value}/records?period=month&value=${pieMonth.value}`)
    const rec = unwrap(r) || {}
    monthPie.value = aggregateBySite(rec.data || [])
  } catch (e) {
    monthPie.value = []
  } finally {
    monthPieLoading.value = false
  }
}
async function loadDayPie() {
  dayPieLoading.value = true
  try {
    const r = await props.api.get(`${base.value}/records?period=day&value=${pieDay.value}`)
    const rec = unwrap(r) || {}
    dayPie.value = aggregateBySite(rec.data || [])
  } catch (e) {
    dayPie.value = []
  } finally {
    dayPieLoading.value = false
  }
}

// ---------- 折线图（自适应容器宽度，避免只占左半屏）----------
const lineH = 220, linePadL = 48, linePadB = 28
const trendW = ref(640)
const trendWrap = ref(null)
let trendRO = null
function observeTrendWidth() {
  if (!trendWrap.value || typeof ResizeObserver === 'undefined') return
  trendRO = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect?.width
    if (w > 0) trendW.value = Math.max(320, Math.floor(w))
  })
  trendRO.observe(trendWrap.value)
}
const maxTrendBytes = computed(() => {
  let m = 0
  for (const p of trend.value) m = Math.max(m, Number(p.uploaded || 0), Number(p.downloaded || 0))
  return m || 1
})
function linePoints(field) {
  const n = trend.value.length
  if (n === 0) return ''
  const plotW = trendW.value - linePadL - 10
  const plotH = lineH - linePadB - 10
  return trend.value
    .map((p, i) => {
      const x = linePadL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
      const y = 10 + plotH - (Number(p[field] || 0) / maxTrendBytes.value) * plotH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
}
const lineXLabels = computed(() => {
  const n = trend.value.length
  if (n === 0) return []
  const plotW = trendW.value - linePadL - 10
  const step = Math.max(1, Math.ceil(n / 8))
  const out = []
  for (let i = 0; i < n; i += step) {
    const x = linePadL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    out.push({ x: x.toFixed(1), label: (trend.value[i].label || '').slice(-5) })
  }
  return out
})
</script>

<template>
  <div class="dt-page">
    <VToolbar density="comfortable" color="transparent">
      <div class="text-h6 ms-3">下载器流量统计</div>
      <VSpacer />
      <VSelect
        v-model="period"
        :items="[
          { title: '按日', value: 'day' },
          { title: '按月', value: 'month' },
          { title: '按年', value: 'year' },
        ]"
        density="compact"
        hide-details
        style="max-width: 110px"
        variant="outlined"
      />
      <!-- 自研选择器：点击输入框弹出中文面板 -->
      <div class="ms-2">
        <CalendarPanel v-model="value" :mode="period" @close="load" />
      </div>

      <VBtn icon="mdi-refresh" variant="text" :loading="loading" class="ms-2" @click="load" />
      <VBtn
        color="primary"
        variant="tonal"
        density="comfortable"
        :loading="collectBusy"
        class="ms-2"
        @click="doCollect"
      >立即采集</VBtn>
      <VBtn
        color="warning"
        variant="tonal"
        density="comfortable"
        :loading="resetBusy"
        class="ms-2"
        @click="doReset"
      >解除限速</VBtn>
      <VBtn icon="mdi-close" variant="text" @click="emit('close')" />
    </VToolbar>
    <VDivider />
    <div v-if="actionMsg" class="pa-3">
      <VAlert density="compact" variant="tonal" :type="actionMsg.includes('失败') ? 'error' : 'success'">
        {{ actionMsg }}
      </VAlert>
    </div>
    <div v-if="error" class="text-error pa-3">{{ error }}</div>
    <div class="dt-cards">
      <VCard variant="tonal" color="green" class="dt-card">
        <div class="text-caption">上传流量</div>
        <div class="text-h6">{{ fmtBytes(totalUp) }}</div>
      </VCard>
      <VCard variant="tonal" color="blue" class="dt-card">
        <div class="text-caption">下载流量</div>
        <div class="text-h6">{{ fmtBytes(totalDown) }}</div>
      </VCard>
      <VCard variant="tonal" class="dt-card">
        <div class="text-caption">分享率</div>
        <div class="text-h6">{{ totalDown > 0 ? (totalUp / totalDown).toFixed(2) : '—' }}</div>
      </VCard>
    </div>
    <VCard class="dt-section" title="上传流量分布（按月 / 按日）">
      <template #text>
        <div class="dt-pies">
          <VCard variant="tonal" class="dt-pie-card">
            <div class="dt-pie-head">
              <span class="dt-pie-title">本月上传</span>
              <CalendarPanel v-model="pieMonth" mode="month" @close="loadMonthPie" />
            </div>
            <PieChart
              :items="monthPie"
              :subtitle="pieMonth"
              :loading="monthPieLoading"
            />
          </VCard>
          <VCard variant="tonal" class="dt-pie-card">
            <div class="dt-pie-head">
              <span class="dt-pie-title">今日上传</span>
              <CalendarPanel v-model="pieDay" mode="day" @close="loadDayPie" />
            </div>
            <PieChart
              :items="dayPie"
              :subtitle="pieDay"
              :loading="dayPieLoading"
            />
          </VCard>
        </div>
      </template>
    </VCard>
    <VCard class="dt-section" :title="`时间趋势（${period === 'year' ? '逐月' : '逐日'}）`">
      <template #text>
        <div ref="trendWrap" class="dt-line-wrap">
          <div v-if="trend.length === 0" class="text-medium-emphasis">暂无数据</div>
          <svg v-else :width="trendW" :height="lineH" class="dt-line">
            <line :x1="linePadL" :y1="10" :x2="trendW - 10" :y2="10" stroke="#eee" />
            <line :x1="linePadL" :y1="lineH - linePadB" :x2="trendW - 10" :y2="lineH - linePadB" stroke="#ccc" />
            <text :x="4" :y="16" class="dt-axis">{{ fmtBytes(maxTrendBytes) }}</text>
            <text :x="4" :y="lineH - linePadB" class="dt-axis">0</text>
            <polyline :points="linePoints('uploaded')" fill="none" stroke="#4caf50" stroke-width="2" />
            <polyline :points="linePoints('downloaded')" fill="none" stroke="#2196f3" stroke-width="2" />
            <text
              v-for="(t, i) in lineXLabels"
              :key="i"
              :x="t.x"
              :y="lineH - linePadB + 16"
              class="dt-axis"
              text-anchor="middle"
            >{{ t.label }}</text>
          </svg>
        </div>
        <div class="dt-legend">
          <span class="dt-dot" style="background: #4caf50" /> 上传
          <span class="dt-dot" style="background: #2196f3" /> 下载
        </div>
      </template>
    </VCard>
    <VCard class="dt-section" title="明细数据">
      <template #text>
        <VDataTable
          :items="records"
          :items-per-page="15"
          density="compact"
          hide-default-footer
          :headers="[
            { title: '站点', key: 'site' },
            { title: '下载器', key: 'downloader' },
            { title: '上传', key: 'uploaded', align: 'end' },
            { title: '下载', key: 'downloaded', align: 'end' },
          ]"
        >
          <template #item.uploaded="{ item }">
            <span style="color: #4caf50">{{ fmtBytes(item.uploaded) }}</span>
          </template>
          <template #item.downloaded="{ item }">
            <span style="color: #2196f3">{{ fmtBytes(item.downloaded) }}</span>
          </template>
        </VDataTable>
      </template>
    </VCard>
  </div>
</template>

<style scoped>
.dt-page { padding-bottom: 16px; }
.dt-cards { display: flex; gap: 12px; padding: 12px; flex-wrap: wrap; }
.dt-card { flex: 1; min-width: 140px; padding: 12px; }
.dt-section { margin: 12px; }
.dt-axis { font-size: 10px; fill: #999; }
.dt-line-wrap { width: 100%; }
.dt-line { display: block; max-width: 100%; }
.dt-legend { font-size: 12px; padding: 4px 12px; }
.dt-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 4px 0 12px; vertical-align: middle; }

/* 上传流量饼图区块 */
.dt-pies { display: flex; gap: 16px; flex-wrap: wrap; padding: 4px; }
.dt-pie-card { flex: 1 1 430px; min-width: 340px; padding: 12px; }
.dt-pie-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.dt-pie-title { font-size: 15px; font-weight: 600; }
</style>
