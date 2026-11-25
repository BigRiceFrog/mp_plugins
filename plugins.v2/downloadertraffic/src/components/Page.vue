<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import CalendarPanel from './CalendarPanel.vue'
import PieChart from './PieChart.vue'
import { useNarrow } from '../composables/useNarrow'
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

// 窄屏（手机 / 桌面窄弹窗）判定：按组件自身宽度，而不是视口宽度
const { target: rootEl, narrow, width: rootWidth } = useNarrow(640)
// 超窄（≤380px 容器）：日期框换到独占一行，避免「2026 年 11 月」被截断
const tiny = computed(() => rootWidth.value > 0 && rootWidth.value < 380)
// 够宽（≥900px）：饼图排成 2×2，否则单列（饼图 + 图例在窄卡片里上下排更易读）
const roomy = computed(() => rootWidth.value >= 900)

const period = ref('month')
const value = ref('')
const loading = ref(false)
const error = ref('')
const records = ref([])
const totalUp = ref(0)
const totalDown = ref(0)
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
    const r1 = await props.api.get(`${base.value}/records?${q.toString()}`)
    const rec = unwrap(r1) || {}
    records.value = rec.data || []
    totalUp.value = rec.total_uploaded || 0
    totalDown.value = rec.total_downloaded || 0
  } catch (e) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  pieDay.value = defaultDay()
  pieMonth.value = defaultMonth()
  pieYear.value = defaultYear()
  load()
  loadDayPie()
  loadMonthPie()
  loadYearPie()
  loadAllPie()
})
watch(period, () => {
  value.value = defaultValue()
  nextTick(load)
})

// ============================================================
// 上传流量饼图：今日 / 本月 / 今年 / 历史总计，四张同款饼图，仅统计上传
// ============================================================
const pieDay = ref('')
const pieMonth = ref('')
const pieYear = ref('')
const dayPie = ref([]) // [{label, value}]
const monthPie = ref([])
const yearPie = ref([])
const allPie = ref([])
const dayPieLoading = ref(false)
const monthPieLoading = ref(false)
const yearPieLoading = ref(false)
const allPieLoading = ref(false)

function defaultDay() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function defaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}
function defaultYear() {
  return String(new Date().getFullYear())
}
function aggregateBySite(rows) {
  const map = new Map()
  for (const r of rows || []) {
    if (!r || r.site === 'GLOBAL') continue
    map.set(r.site, (map.get(r.site) || 0) + Number(r.uploaded || 0))
  }
  return Array.from(map, ([label, value]) => ({ label, value }))
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
async function loadYearPie() {
  yearPieLoading.value = true
  try {
    const v = pieYear.value || defaultYear()
    const r = await props.api.get(`${base.value}/records?period=year&value=${v}`)
    const rec = unwrap(r) || {}
    yearPie.value = aggregateBySite(rec.data || [])
  } catch (e) {
    yearPie.value = []
  } finally {
    yearPieLoading.value = false
  }
}
// 历史总计：period=all（后端不加时间过滤），只取一次，无日期选择器
async function loadAllPie() {
  allPieLoading.value = true
  try {
    const r = await props.api.get(`${base.value}/records?period=all`)
    const rec = unwrap(r) || {}
    allPie.value = aggregateBySite(rec.data || [])
  } catch (e) {
    allPie.value = []
  } finally {
    allPieLoading.value = false
  }
}

// ---------- 明细数据：窄屏改用卡片列表，避免 4 列表格挤爆 ----------
const recordRows = computed(() => (records.value || []).slice(0, 15))
</script>

<template>
  <div ref="rootEl" class="dt-page" :class="{ 'dt-narrow': narrow, 'dt-tiny': tiny }">
    <div class="dt-header">
      <div class="dt-header-row">
        <div class="dt-title">下载器流量统计</div>
        <VBtn icon="mdi-close" variant="text" class="dt-close" aria-label="关闭" @click="emit('close')" />
        <div class="dt-header-actions">
          <VSelect
            v-model="period"
            :items="[
              { title: '按日', value: 'day' },
              { title: '按月', value: 'month' },
              { title: '按年', value: 'year' },
            ]"
            density="compact"
            hide-details
            class="dt-period"
            variant="outlined"
          />
          <!-- 自研选择器：点击输入框弹出中文面板 -->
          <div class="dt-date">
            <CalendarPanel v-model="value" :mode="period" @close="load" />
          </div>
          <VBtn icon="mdi-refresh" variant="text" :loading="loading" class="dt-refresh" aria-label="刷新" @click="load" />
          <!-- 两个操作按钮固定成一组：窄屏时整组独占一行、等宽平分 -->
          <div class="dt-buttons">
            <VBtn
              color="primary"
              variant="tonal"
              density="comfortable"
              :loading="collectBusy"
              class="dt-action"
              @click="doCollect"
            >立即采集</VBtn>
            <VBtn
              color="warning"
              variant="tonal"
              density="comfortable"
              :loading="resetBusy"
              class="dt-action"
              @click="doReset"
            >解除限速</VBtn>
          </div>
        </div>
      </div>
    </div>
    <VDivider />
    <div v-if="actionMsg" class="dt-notice">
      <VAlert density="compact" variant="tonal" :type="actionMsg.includes('失败') ? 'error' : 'success'">
        {{ actionMsg }}
      </VAlert>
    </div>
    <div v-if="error" class="text-error dt-notice">{{ error }}</div>
    <div class="dt-cards">
      <VCard variant="tonal" color="green" class="dt-card">
        <div class="dt-kpi-label">上传流量</div>
        <div class="dt-kpi">{{ fmtBytes(totalUp) }}</div>
      </VCard>
      <VCard variant="tonal" color="blue" class="dt-card">
        <div class="dt-kpi-label">下载流量</div>
        <div class="dt-kpi">{{ fmtBytes(totalDown) }}</div>
      </VCard>
      <VCard variant="tonal" class="dt-card">
        <div class="dt-kpi-label">分享率</div>
        <div class="dt-kpi">{{ totalDown > 0 ? (totalUp / totalDown).toFixed(2) : '—' }}</div>
      </VCard>
    </div>
    <VCard class="dt-section">
      <div class="dt-section-head">
        <span class="dt-section-title">上传流量分布（今日 / 本月 / 今年 / 历史总计）</span>
      </div>
      <div class="dt-section-body">
        <div class="dt-pies" :class="{ 'dt-pies-roomy': roomy }">
          <VCard variant="tonal" class="dt-pie-card">
            <div class="dt-pie-head">
              <span class="dt-pie-title">今日上传</span>
              <div class="dt-pie-date">
                <CalendarPanel v-model="pieDay" mode="day" @close="loadDayPie" />
              </div>
            </div>
            <PieChart
              :items="dayPie"
              :subtitle="pieDay"
              :loading="dayPieLoading"
              :narrow="narrow"
            />
          </VCard>
          <VCard variant="tonal" class="dt-pie-card">
            <div class="dt-pie-head">
              <span class="dt-pie-title">本月上传</span>
              <div class="dt-pie-date">
                <CalendarPanel v-model="pieMonth" mode="month" @close="loadMonthPie" />
              </div>
            </div>
            <PieChart
              :items="monthPie"
              :subtitle="pieMonth"
              :loading="monthPieLoading"
              :narrow="narrow"
            />
          </VCard>
          <VCard variant="tonal" class="dt-pie-card">
            <div class="dt-pie-head">
              <span class="dt-pie-title">今年上传</span>
              <div class="dt-pie-date">
                <CalendarPanel v-model="pieYear" mode="year" @close="loadYearPie" />
              </div>
            </div>
            <PieChart
              :items="yearPie"
              :subtitle="pieYear"
              :loading="yearPieLoading"
              :narrow="narrow"
            />
          </VCard>
          <VCard variant="tonal" class="dt-pie-card">
            <div class="dt-pie-head">
              <span class="dt-pie-title">历史总计上传</span>
            </div>
            <PieChart
              :items="allPie"
              subtitle="全部历史"
              :loading="allPieLoading"
              :narrow="narrow"
            />
          </VCard>
        </div>
      </div>
    </VCard>
    <VCard class="dt-section">
      <div class="dt-section-head"><span class="dt-section-title">明细数据</span></div>
      <div class="dt-section-body">
        <!-- 窄屏：两行式卡片列表，站点/下载器换行，数字靠右，不需要横向滚动 -->
        <div v-if="narrow" class="dt-rec-list">
          <div v-if="!recordRows.length" class="dt-empty">暂无数据</div>
          <div v-for="(r, i) in recordRows" :key="i" class="dt-rec">
            <div class="dt-rec-main">
              <span class="dt-rec-site">{{ r.site }}</span>
              <span class="dt-rec-dl">{{ r.downloader }}</span>
            </div>
            <div class="dt-rec-nums">
              <span class="dt-up">↑ {{ fmtBytes(r.uploaded) }}</span>
              <span class="dt-down">↓ {{ fmtBytes(r.downloaded) }}</span>
            </div>
          </div>
          <div v-if="records.length > recordRows.length" class="dt-rec-more">
            共 {{ records.length }} 条，此处显示前 {{ recordRows.length }} 条
          </div>
        </div>
        <VDataTable
          v-else
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
      </div>
    </VCard>
  </div>
</template>

<style scoped>
.dt-page {
  width: 100%;
  max-width: 100%;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

/* ---------- 顶栏：窄屏自动折行，不再把按钮挤成一排 ---------- */
.dt-header { width: 100%; }
.dt-header-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
}
.dt-title {
  order: 0;
  flex: 0 1 auto;
  margin-right: 8px;
  min-width: 0;
  font-size: 1.05rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dt-header-actions {
  order: 1;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.dt-close { order: 2; }
.dt-period { flex: 0 0 auto; width: 108px; }
.dt-date { flex: 0 1 260px; min-width: 0; }
.dt-refresh { flex: 0 0 auto; }
.dt-buttons { display: flex; gap: 8px; flex: 0 0 auto; }
.dt-action { flex: 0 0 auto; min-height: 36px; }

.dt-narrow .dt-header-row { padding: 8px 10px; row-gap: 8px; }
.dt-narrow .dt-title { flex: 1 1 auto; margin-right: 0; font-size: 1rem; }
.dt-narrow .dt-close { order: 1; }
.dt-narrow .dt-header-actions { order: 2; flex: 1 1 100%; justify-content: flex-start; row-gap: 8px; }
.dt-narrow .dt-period { flex: 0 0 112px; width: 112px; }
.dt-narrow .dt-date { flex: 1 1 130px; }
.dt-narrow .dt-buttons { flex: 1 1 100%; }
.dt-narrow .dt-action { flex: 1 1 0; min-width: 0; min-height: 40px; }

/* 超窄容器（≤380px）：日期框单独占一行，避免“2026 年 11 月”被截断。
   用容器宽度判定（.dt-tiny），手机上若页面本身还有内边距也照样命中 */
.dt-tiny .dt-period { order: 1; }
.dt-tiny .dt-refresh { order: 2; margin-left: auto; }
.dt-tiny .dt-date { order: 3; flex: 1 1 100%; }
.dt-tiny .dt-buttons { order: 4; }
.dt-tiny .dt-pie-date :deep(input) { font-size: 13px; }

.dt-notice { padding: 12px 12px 0; }
.dt-narrow .dt-notice { padding: 8px 10px 0; }

/* ---------- 概览卡片：等宽网格，窄屏也保持一行三张 ---------- */
.dt-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: 12px;
  padding: 12px;
}
.dt-card { padding: 12px; min-width: 0; }
.dt-kpi-label { font-size: 12px; opacity: 0.75; line-height: 1.4; }
.dt-kpi {
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.dt-narrow .dt-cards { gap: 8px; padding: 8px 10px; }
.dt-narrow .dt-card { padding: 10px 8px; }
.dt-narrow .dt-kpi { font-size: 1rem; }
.dt-narrow .dt-kpi-label { font-size: 11px; }

.dt-section { margin: 12px; }
/* 自绘标题 / 内容区：不依赖 Vuetify 的 .v-card-title 等内部类
   （插件 vite.config.js 的 vuetify-filter 会在打包时剥掉所有 .v-* 规则） */
.dt-section-head { padding: 16px 16px 4px; }
.dt-section-title {
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.0075em;
}
.dt-section-body { padding: 8px 16px 16px; }
.dt-narrow .dt-section { margin: 8px 10px; }
.dt-narrow .dt-section-head { padding: 12px 12px 0; }
.dt-narrow .dt-section-title { font-size: 1.02rem; }
.dt-narrow .dt-section-body { padding: 8px 12px 12px; }

/* ---------- 上传流量饼图区块：窄屏单列，够宽时 2×2 ---------- */
.dt-pies {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  padding: 0;
}
.dt-pies-roomy {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding: 4px;
}
.dt-pie-card { padding: 12px; min-width: 0; }
.dt-pie-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.dt-pie-title { font-size: 15px; font-weight: 600; }
.dt-pie-hint { font-size: 12px; opacity: 0.6; }
.dt-pie-date { flex: 0 1 240px; min-width: 0; }
.dt-narrow .dt-pie-card { padding: 10px; }
.dt-narrow .dt-pie-date { flex: 1 1 200px; }

/* ---------- 明细数据（窄屏列表） ---------- */
.dt-rec-list { display: flex; flex-direction: column; }
.dt-rec {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.16);
}
.dt-rec:last-child { border-bottom: none; }
.dt-rec-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
.dt-rec-site { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.dt-rec-dl { font-size: 12px; opacity: 0.62; overflow-wrap: anywhere; }
.dt-rec-nums {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex: 0 0 auto;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dt-rec-more { padding-top: 8px; font-size: 12px; opacity: 0.6; text-align: center; }
.dt-empty { padding: 16px 0; text-align: center; font-size: 13px; opacity: 0.6; }
.dt-up { color: #4caf50; }
.dt-down { color: #2196f3; }
</style>
