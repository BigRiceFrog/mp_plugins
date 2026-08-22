<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
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
const downloader = ref('')
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
    if (downloader.value) q.set('downloader', downloader.value)
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
onMounted(load)
watch(period, () => {
  value.value = defaultValue()
  nextTick(load)
})

// ============================================================
// 自研日期 / 月 / 年选择面板（v1.4.2 起不再依赖 Vuetify 内部本地化）
// ============================================================
// 关键点：
// - 完全自己拼中文，不依赖 Vuetify 实例的 locale / date adapter / 宿主的 zh 语言包。
// - 面板与 period 联动：period=day 只看日面板；period=month 只看月面板；period=year 只看年面板。
// - 点击后立刻写 value、关面板、刷新。
const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const WDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']

const dateMenuOpen = ref(false)
const selYear = ref(new Date().getFullYear())
const selMonth = ref(new Date().getMonth() + 1) // 1..12
// 选月/选年模式时，也保留展示的「当前月」与「当前年」
function syncFromValue() {
  const v = value.value || defaultValue()
  const ym = String(v).match(/(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/)
  if (ym) {
    selYear.value = Number(ym[1])
    if (ym[2]) selMonth.value = Number(ym[2])
  }
}
watch(value, syncFromValue, { immediate: true })

// 日历网格（按日面板用）
function buildMonthGrid(y, m) {
  // 返回 42 格（6 周）；每格 {y,m,d,inMonth,label}
  const first = new Date(y, m - 1, 1)
  const startOffset = first.getDay() // 周日=0
  const grid = []
  const from = new Date(y, m - 1, 1 - startOffset)
  for (let i = 0; i < 42; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    grid.push({
      y: d.getFullYear(),
      m: d.getMonth() + 1,
      d: d.getDate(),
      inMonth: d.getFullYear() === y && (d.getMonth() + 1) === m,
      label: d.getDate(),
    })
  }
  return grid
}
const grid = computed(() => buildMonthGrid(selYear.value, selMonth.value))

// 年面板：当前年前后 11 年，共 12 格；点标题栏左右翻 12 年
const yearPageBase = ref(new Date().getFullYear() - 5) // 第一个显示的年份
const yearGrid = computed(() => {
  const out = []
  for (let i = 0; i < 12; i++) out.push(yearPageBase.value + i)
  return out
})

// 今日高亮
const today = new Date()
const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`
function cellKey(g) { return `${g.y}-${pad2(g.m)}-${pad2(g.d)}` }
function isSelectedDay(g) {
  if (period.value !== 'day') return false
  return value.value === cellKey(g)
}
function isToday(g) { return cellKey(g) === todayKey }

// 显示用：当前输入框的中文语义化显示（仅用于 placeholder，绑定值仍是原始 YYYY...）
const valueDisplay = computed(() => {
  if (!value.value) return ''
  if (period.value === 'day') return value.value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1 年 $2 月 $3 日')
  if (period.value === 'month') return value.value.replace(/^(\d{4})-(\d{2})$/, '$1 年 $2 月')
  return `${value.value} 年`
})
const valuePlaceholder = computed(() => {
  if (period.value === 'year') return '请选择年份'
  if (period.value === 'month') return '请选择月份'
  return '请选择日期'
})
const pickerHeaderTitle = computed(() => {
  if (period.value === 'day') return `${selYear.value} 年 ${selMonth.value} 月`
  if (period.value === 'month') return `${selYear.value} 年`
  return `${yearPageBase.value} — ${yearPageBase.value + 11} 年`
})
function headerLeft() {
  if (period.value === 'day') {
    selMonth.value--
    if (selMonth.value < 1) { selMonth.value = 12; selYear.value-- }
  } else if (period.value === 'month') {
    selYear.value--
  } else {
    yearPageBase.value -= 12
  }
}
function headerRight() {
  if (period.value === 'day') {
    selMonth.value++
    if (selMonth.value > 12) { selMonth.value = 1; selYear.value++ }
  } else if (period.value === 'month') {
    selYear.value++
  } else {
    yearPageBase.value += 12
  }
}
function goToday() {
  selYear.value = today.getFullYear()
  selMonth.value = today.getMonth() + 1
  yearPageBase.value = today.getFullYear() - 5
  if (period.value === 'day') {
    value.value = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`
    dateMenuOpen.value = false
    load()
  }
}
function pickDay(g) {
  selYear.value = g.y; selMonth.value = g.m
  value.value = `${g.y}-${pad2(g.m)}-${pad2(g.d)}`
  dateMenuOpen.value = false
  load()
}
function pickMonth(mi /*1..12*/) {
  value.value = `${selYear.value}-${pad2(mi)}`
  dateMenuOpen.value = false
  load()
}
function pickYear(y) {
  selYear.value = y
  value.value = String(y)
  dateMenuOpen.value = false
  load()
}

// ---------- 柱状图 / 折线图（原逻辑未动）----------
const siteRows = computed(() => records.value.filter((r) => r.site !== 'GLOBAL'))
const maxSiteBytes = computed(() => {
  let m = 0
  for (const r of siteRows.value) {
    m = Math.max(m, Number(r.uploaded || 0), Number(r.downloaded || 0))
  }
  return m || 1
})
const barW = 360, barH = 26, barGap = 14, barLabelW = 120
function barUpWidth(r) { return (Number(r.uploaded || 0) / maxSiteBytes.value) * barW }
function barDownWidth(r) { return (Number(r.downloaded || 0) / maxSiteBytes.value) * barW }
const barSvgHeight = computed(() => Math.max(60, siteRows.value.length * (barH + barGap) + 10))

const lineW = 640, lineH = 220, linePadL = 48, linePadB = 28
const maxTrendBytes = computed(() => {
  let m = 0
  for (const p of trend.value) m = Math.max(m, Number(p.uploaded || 0), Number(p.downloaded || 0))
  return m || 1
})
function linePoints(field) {
  const n = trend.value.length
  if (n === 0) return ''
  const plotW = lineW - linePadL - 10
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
  const plotW = lineW - linePadL - 10
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
      <VMenu
        v-model="dateMenuOpen"
        location="bottom start"
        :close-on-content-click="false"
        min-width="320"
        class="ms-2"
      >
        <template #activator="{ props: menuProps }">
          <VTextField
            :model-value="valueDisplay || value"
            readonly
            density="compact"
            hide-details
            style="max-width: 260px; min-width: 210px"
            variant="outlined"
            :placeholder="valuePlaceholder"
            append-inner-icon="mdi-calendar"
            v-bind="menuProps"
          />
        </template>
        <!-- 自研面板（不依赖 Vuetify VDatePicker 的 locale / adapter） -->
        <VCard class="dt-calendar-card" variant="elevated">
          <!-- 顶部紫色大标题：当前「按日/月/年」对应的中文展示 -->
          <div class="dt-cal-head">
            <div class="dt-cal-head-label">
              <span v-if="period === 'year'">选择年份</span>
              <span v-else-if="period === 'month'">选择月份</span>
              <span v-else>选择日期</span>
            </div>
            <div class="dt-cal-head-value">
              <template v-if="period === 'day'">
                {{ selYear }} 年 {{ selMonth }} 月 {{ value?.slice(-2)?.replace(/^-/, '') || today.getDate() }} 日
              </template>
              <template v-else-if="period === 'month'">
                {{ selYear }} 年 {{ selMonth }} 月
              </template>
              <template v-else>
                {{ value || selYear }} 年
              </template>
            </div>
          </div>
          <!-- 工具栏：‹ 当前标题 › -->
          <div class="dt-cal-toolbar d-flex align-center justify-space-between pa-2">
            <VBtn variant="text" icon="mdi-chevron-left" size="small" @click="headerLeft" />
            <div class="dt-cal-toolbar-title">{{ pickerHeaderTitle }}</div>
            <VBtn variant="text" icon="mdi-chevron-right" size="small" @click="headerRight" />
          </div>

          <!-- 按日面板：周标题 + 日期网格 -->
          <div v-if="period === 'day'" class="px-2 pb-2">
            <div class="dt-wday-row">
              <div v-for="(w, i) in WDAYS_ZH" :key="i" class="dt-wday">{{ w }}</div>
            </div>
            <div class="dt-grid">
              <button
                v-for="(g, idx) in grid"
                :key="idx"
                type="button"
                class="dt-day"
                :class="{
                  'dt-day-out': !g.inMonth,
                  'dt-day-today': isToday(g),
                  'dt-day-selected': isSelectedDay(g),
                }"
                @click="pickDay(g)"
              >{{ g.label }}</button>
            </div>
          </div>

          <!-- 按月面板：12 个月 3x4 -->
          <div v-else-if="period === 'month'" class="px-3 pb-3">
            <div class="dt-m-grid">
              <button
                v-for="(name, i) in MONTHS_ZH"
                :key="i"
                type="button"
                class="dt-m-btn"
                :class="{ 'dt-selected': selMonth === i + 1 && Number(String(value).slice(0,4)) === selYear }"
                @click="pickMonth(i + 1)"
              >{{ name }}</button>
            </div>
          </div>

          <!-- 按年面板：12 年 3x4 -->
          <div v-else class="px-3 pb-3">
            <div class="dt-m-grid">
              <button
                v-for="y in yearGrid"
                :key="y"
                type="button"
                class="dt-m-btn"
                :class="{ 'dt-selected': String(value) === String(y) }"
                @click="pickYear(y)"
              >{{ y }}</button>
            </div>
          </div>

          <!-- 底部操作按钮：全部中文 -->
          <div class="d-flex justify-end ga-1 px-2 pb-2">
            <VBtn size="small" variant="text" @click="goToday">今天</VBtn>
            <VBtn size="small" variant="text" @click="dateMenuOpen = false">关闭</VBtn>
          </div>
        </VCard>
      </VMenu>

      <VTextField
        v-model="downloader"
        placeholder="下载器(可选)"
        density="compact"
        hide-details
        style="max-width: 150px"
        variant="outlined"
        class="ms-2"
      />
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
    <VCard class="dt-section" title="按 PT 站点细分">
      <template #text>
        <div v-if="siteRows.length === 0" class="text-medium-emphasis">暂无数据</div>
        <svg v-else :width="barLabelW + barW + 170" :height="barSvgHeight" class="dt-bars">
          <g v-for="(r, i) in siteRows" :key="r.site">
            <text :x="0" :y="i * (barH + barGap) + barH" class="dt-bar-label">{{ r.site }}</text>
            <rect
              :x="barLabelW"
              :y="i * (barH + barGap) + 2"
              :width="Math.max(1, barUpWidth(r))"
              :height="barH / 2 - 2"
              fill="#4caf50" rx="2"
            />
            <text :x="barLabelW + barW + 8" :y="i * (barH + barGap) + barH / 2" class="dt-bar-val">
              ↑ {{ fmtBytes(r.uploaded) }}
            </text>
            <rect
              :x="barLabelW"
              :y="i * (barH + barGap) + barH / 2 + 2"
              :width="Math.max(1, barDownWidth(r))"
              :height="barH / 2 - 2"
              fill="#2196f3" rx="2"
            />
            <text :x="barLabelW + barW + 8" :y="i * (barH + barGap) + barH + 2" class="dt-bar-val">
              ↓ {{ fmtBytes(r.downloaded) }}
            </text>
          </g>
        </svg>
      </template>
    </VCard>
    <VCard class="dt-section" :title="`时间趋势（${period === 'year' ? '逐月' : '逐日'}）`">
      <template #text>
        <div v-if="trend.length === 0" class="text-medium-emphasis">暂无数据</div>
        <svg v-else :width="lineW" :height="lineH" class="dt-line">
          <line :x1="linePadL" :y1="10" :x2="lineW - 10" :y2="10" stroke="#eee" />
          <line :x1="linePadL" :y1="lineH - linePadB" :x2="lineW - 10" :y2="lineH - linePadB" stroke="#ccc" />
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
.dt-bar-label { font-size: 12px; fill: currentColor; }
.dt-bar-val { font-size: 11px; fill: currentColor; opacity: 0.85; }
.dt-axis { font-size: 10px; fill: #999; }
.dt-legend { font-size: 12px; padding: 4px 12px; }
.dt-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 4px 0 12px; vertical-align: middle; }

/* ---------------- 自研中文日历样式 ---------------- */
.dt-calendar-card { min-width: 300px; width: 312px; padding: 0; overflow: hidden; }
.dt-cal-head {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  color: #fff;
  padding: 14px 16px 12px;
}
.dt-cal-head-label { font-size: 12px; opacity: 0.9; letter-spacing: 0.4px; }
.dt-cal-head-value { font-size: 22px; font-weight: 600; margin-top: 4px; line-height: 1.2; }
.dt-cal-toolbar-title { font-size: 14px; font-weight: 600; color: rgb(var(--v-theme-on-surface, 33 33 33)); }

/* 日面板 */
.dt-wday-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; padding: 2px 0 4px; }
.dt-wday {
  text-align: center; font-size: 12px; font-weight: 600;
  color: rgb(var(--v-theme-primary, 99 102 241) / 0.75);
  padding: 4px 0;
}
.dt-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.dt-day {
  all: unset; cursor: pointer;
  height: 32px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; color: inherit;
  transition: background 0.15s ease, color 0.15s ease, transform 0.05s ease;
  border: 1px solid transparent;
}
.dt-day:hover { background: rgb(var(--v-theme-primary, 99 102 241) / 0.08); }
.dt-day:active { transform: scale(0.96); }
.dt-day-out { color: rgba(128, 128, 128, 0.55); }
.dt-day-today {
  background: rgb(var(--v-theme-primary, 99 102 241) / 0.08);
  border-color: rgb(var(--v-theme-primary, 99 102 241) / 0.35);
  color: rgb(var(--v-theme-primary, 99 102 241));
  font-weight: 700;
}
.dt-day-selected {
  background: rgb(var(--v-theme-primary, 99 102 241)) !important;
  color: #fff !important;
  font-weight: 700;
}

/* 月/年面板 3x4 网格 */
.dt-m-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 4px; }
.dt-m-btn {
  all: unset; cursor: pointer;
  height: 38px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; color: inherit;
  border: 1px solid rgb(128 128 128 / 0.18);
  background: transparent;
  transition: background 0.15s ease, color 0.15s ease, transform 0.05s ease;
}
.dt-m-btn:hover { background: rgb(var(--v-theme-primary, 99 102 241) / 0.08); }
.dt-m-btn:active { transform: scale(0.96); }
.dt-m-btn.dt-selected {
  background: rgb(var(--v-theme-primary, 99 102 241));
  color: #fff;
  border-color: transparent;
  font-weight: 600;
}
</style>
