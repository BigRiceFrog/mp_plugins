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
// 后端 API 路由由 MoviePilot 以「插件类名 DownloaderTraffic」为前缀注册，
// 这里固定使用类名，兼容宿主传入小写文件夹名 / 未传 pluginId 的情况。
const pid = computed(() => {
  const v = props.pluginId
  return v && v !== 'downloadertraffic' ? v : 'DownloaderTraffic'
})
const base = computed(() => `plugin/${pid.value}`)
// 手动触发采集 / 解除限速
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
function defaultValue() {
  const d = new Date()
  if (period.value === 'year') return String(d.getFullYear())
  if (period.value === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// api.get 直接返回响应体（MP 前端拦截器已解包 response.data）；
// 个别宿主若返回 axios 响应对象则解一层 .data
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

// ============================================================
// 日期/月/年选择器（v1.4.1 交互修复 + 全中文）
// ============================================================
// 关键点：
// 1) 不再用 view-mode 锁死——所有 period 都打开"日视图"，用户可以：
//    - 按日模式：点某一天（具体日）→ 提交 YYYY-MM-DD
//    - 按月模式：日历顶部「月份标题」可切换到月面板；点某个月方块 → 提交 YYYY-MM
//    - 按年模式：日历顶部「年份标题」可切换到年面板；点某年 → 提交 YYYY
//    为了更顺手，我们直接用 click:year / click:month 事件：
//      - click:year  → 点年面板里的某一年
//      - click:month → 点月面板里的某一月（或月模式中的月份单元格）
//      - click:date  → 点日面板里的某一天
// 2) 中文化：传入 months / weekdays / header / cancel / ok / today / clear 等
//    VDatePicker 3.x 支持 slots/prop 传中文覆盖。
//    月份名 / 周名 直接写死中文数组（避免依赖宿主的 vuetify locale 是否已加载中文）。
// 3) 输入框设为 readonly + 日历图标，避免手输错；占位随 period 切换。
const dateMenuOpen = ref(false)
// picker 的「显示年 / 月」用于头部标题 & 非日模式下 picker 跳转到的年月
const displayYear = ref(new Date().getFullYear())
const displayMonth = ref(new Date().getMonth() + 1) // 1..12
// picker v-model 值总是完整的 YYYY-MM-DD（Vuetify 约束）；实际查询用 value。
const pickerDate = ref('')

// 按当前 value / period 同步 pickerDate 与 显示年月
function syncPickerFromValue() {
  const v = value.value || defaultValue()
  let y, mo, da
  if (period.value === 'year') {
    y = (String(v).match(/\d{4}/) || [])[0] || String(new Date().getFullYear())
    mo = 1; da = 1
  } else if (period.value === 'month') {
    const mm = String(v).match(/^(\d{4})-(\d{2})/)
    y = mm ? mm[1] : String(new Date().getFullYear())
    mo = mm ? Number(mm[2]) : new Date().getMonth() + 1
    da = 1
  } else {
    const dd = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
    y = dd ? dd[1] : String(new Date().getFullYear())
    mo = dd ? Number(dd[2]) : new Date().getMonth() + 1
    da = dd ? Number(dd[3]) : new Date().getDate()
  }
  y = Number(y)
  mo = Number(mo)
  da = Number(da)
  displayYear.value = y
  displayMonth.value = mo
  pickerDate.value = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`
}
// period 切换：重置 value + picker + 立刻查
watch(period, () => {
  value.value = ''
  nextTick(() => {
    if (!value.value) value.value = defaultValue()
    syncPickerFromValue()
    load()
  })
})
watch(value, syncPickerFromValue, { immediate: true })

// 点击具体日（日视图） → 仅在 period=day 时提交；否则（按月/按年）仍需等用户点月/年
function onClickDate(dt) {
  if (period.value !== 'day') return
  const { y, m, d } = normalizeDate(dt)
  if (!y || !m || !d) return
  pickerDate.value = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  value.value = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  dateMenuOpen.value = false
  load()
}
// 点击某个月（月面板里的月方块） → period=month 时提交 YYYY-MM；period=year 时不提前收
function onClickMonth(dt) {
  const { y, m } = normalizeDate(dt)
  if (!y || !m) return
  displayYear.value = y
  displayMonth.value = m
  // 让 picker 的 v-model 也跳过去，避免下次打开还停在别处
  const padM = String(m).padStart(2, '0')
  pickerDate.value = `${y}-${padM}-${String(extractDayFromPicker() || 1).padStart(2, '0')}`
  if (period.value === 'month') {
    value.value = `${y}-${padM}`
    dateMenuOpen.value = false
    load()
  }
}
// 点击年面板里的某一年 → period=year 直接提交；其它 period 仅切换显示
function onClickYear(dt) {
  const { y, m } = normalizeDate(dt)
  if (!y) return
  displayYear.value = y
  if (m) displayMonth.value = m
  const padM = String(displayMonth.value || 1).padStart(2, '0')
  pickerDate.value = `${y}-${padM}-${String(extractDayFromPicker() || 1).padStart(2, '0')}`
  if (period.value === 'year') {
    value.value = String(y)
    dateMenuOpen.value = false
    load()
  }
}
function normalizeDate(dt) {
  if (!dt) return {}
  if (typeof dt === 'string') {
    const m0 = dt.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/)
    if (m0) return { y: Number(m0[1]), m: m0[2] ? Number(m0[2]) : undefined, d: m0[3] ? Number(m0[3]) : undefined }
    return {}
  }
  if (typeof dt === 'object') {
    // Vuetify 常用几种：{year, month, day} / {date:'YYYY-MM-DD'} / JS Date
    if ('year' in dt && ('month' in dt || 'day' in dt)) {
      return { y: Number(dt.year), m: dt.month != null ? Number(dt.month) : undefined, d: dt.day != null ? Number(dt.day) : undefined }
    }
    if (dt.date) return normalizeDate(dt.date)
    if (dt instanceof Date && !isNaN(dt.getTime())) {
      return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }
    }
  }
  return {}
}
function extractDayFromPicker() {
  const mm = String(pickerDate.value || '').match(/^\d{4}-\d{2}-(\d{2})/)
  return mm ? Number(mm[1]) : null
}

// ---------- 中文化 ----------
// 直接传 props；Vuetify 3 VDatePicker 中大部分文案都有对应 prop。
const monthsZh = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const weekdaysAbbrZh = ['日', '一', '二', '三', '四', '五', '六']

// 输入框占位/当前值提示（中文语义化）
const valuePlaceholder = computed(() => {
  if (period.value === 'year') return '请选择年份，如 2026'
  if (period.value === 'month') return '请选择月份，如 2026-08'
  return '请选择日期，如 2026-08-22'
})

// 工具栏上 picker 的当前标题（中文化）
const pickerTitle = computed(() => {
  if (period.value === 'year') return '选择年份（点击年份方块即选中）'
  if (period.value === 'month') return '选择月份（点击月份方块即选中，可再点年份切换年）'
  return '选择日期（点击具体日期；顶部年月可切换）'
})

// 仅展示具体站点（排除 GLOBAL 汇总行）用于柱状图
const siteRows = computed(() => records.value.filter((r) => r.site !== 'GLOBAL'))
const maxSiteBytes = computed(() => {
  let m = 0
  for (const r of siteRows.value) {
    m = Math.max(m, Number(r.uploaded || 0), Number(r.downloaded || 0))
  }
  return m || 1
})
// 柱状图几何
const barW = 360
const barH = 26
const barGap = 14
const barLabelW = 120
function barUpWidth(r) {
  return (Number(r.uploaded || 0) / maxSiteBytes.value) * barW
}
function barDownWidth(r) {
  return (Number(r.downloaded || 0) / maxSiteBytes.value) * barW
}
const barSvgHeight = computed(() => siteRows.value.length * (barH + barGap) + 10)
// 折线图几何
const lineW = 640
const lineH = 220
const linePadL = 48
const linePadB = 28
const maxTrendBytes = computed(() => {
  let m = 0
  for (const p of trend.value) {
    m = Math.max(m, Number(p.uploaded || 0), Number(p.downloaded || 0))
  }
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
    })
    .join(' ')
}
const lineXLabels = computed(() => {
  const n = trend.value.length
  if (n === 0) return []
  const plotW = lineW - linePadL - 10
  // 最多显示 8 个刻度
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
      <!-- 日期/月/年选择器：输入框可点弹出日历 -->
      <VMenu
        v-model="dateMenuOpen"
        :close-on-content-click="false"
        location="bottom start"
        min-width="340"
        class="ms-2"
      >
        <template #activator="{ props: menuProps }">
          <VTextField
            v-model="value"
            :placeholder="valuePlaceholder"
            density="compact"
            hide-details
            style="max-width: 230px; min-width: 190px"
            variant="outlined"
            readonly
            append-inner-icon="mdi-calendar"
            v-bind="menuProps"
          />
        </template>
        <VCard class="pa-0" variant="flat">
          <!--
            文案中文化：
            - title / months / weekdays（缩写）
            - header 下方给一行使用提示（看 pickerTitle）
            - 底部按钮：取消 / 今天 / 确定
          -->
          <div class="px-3 pt-2 pb-1 text-caption text-medium-emphasis">
            {{ pickerTitle }}
          </div>
          <VDatePicker
            v-model="pickerDate"
            color="primary"
            show-adjacent-months
            :months="monthsZh"
            :weekdays="weekdaysAbbrZh"
            locale="zh-cn"
            first-day-of-week="1"
            @click:year="onClickYear"
            @click:month="onClickMonth"
            @click:date="onClickDate"
          />
          <div class="d-flex justify-end ga-1 px-2 pb-2">
            <VBtn size="small" variant="text" @click="onClickDate({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() })">今天</VBtn>
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
    <!-- 汇总卡片 -->
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
        <div class="text-h6">
          {{ totalDown > 0 ? (totalUp / totalDown).toFixed(2) : '—' }}
        </div>
      </VCard>
    </div>
    <!-- 按 PT 站点细分（柱状图） -->
    <VCard class="dt-section" title="按 PT 站点细分">
      <template #text>
        <div v-if="siteRows.length === 0" class="text-medium-emphasis">暂无数据</div>
        <svg v-else :width="barLabelW + barW + 170" :height="barSvgHeight" class="dt-bars">
          <g v-for="(r, i) in siteRows" :key="r.site">
            <text :x="0" :y="i * (barH + barGap) + barH" class="dt-bar-label">{{ r.site }}</text>
            <!-- 上传 -->
            <rect
              :x="barLabelW"
              :y="i * (barH + barGap) + 2"
              :width="Math.max(1, barUpWidth(r))"
              :height="barH / 2 - 2"
              fill="#4caf50"
              rx="2"
            />
            <text
              :x="barLabelW + barW + 8"
              :y="i * (barH + barGap) + barH / 2"
              class="dt-bar-val"
            >↑ {{ fmtBytes(r.uploaded) }}</text>
            <!-- 下载 -->
            <rect
              :x="barLabelW"
              :y="i * (barH + barGap) + barH / 2 + 2"
              :width="Math.max(1, barDownWidth(r))"
              :height="barH / 2 - 2"
              fill="#2196f3"
              rx="2"
            />
            <text
              :x="barLabelW + barW + 8"
              :y="i * (barH + barGap) + barH + 2"
              class="dt-bar-val"
            >↓ {{ fmtBytes(r.downloaded) }}</text>
          </g>
        </svg>
      </template>
    </VCard>
    <!-- 时间趋势（折线图） -->
    <VCard class="dt-section" :title="`时间趋势（${period === 'year' ? '逐月' : '逐日'}）`">
      <template #text>
        <div v-if="trend.length === 0" class="text-medium-emphasis">暂无数据</div>
        <svg v-else :width="lineW" :height="lineH" class="dt-line">
          <!-- 横线 -->
          <line :x1="linePadL" :y1="10" :x2="lineW - 10" :y2="10" stroke="#eee" />
          <line :x1="linePadL" :y1="lineH - linePadB" :x2="lineW - 10" :y2="lineH - linePadB" stroke="#ccc" />
          <!-- Y 轴最大值 -->
          <text :x="4" :y="16" class="dt-axis">{{ fmtBytes(maxTrendBytes) }}</text>
          <text :x="4" :y="lineH - linePadB" class="dt-axis">0</text>
          <!-- 上传折线 -->
          <polyline :points="linePoints('uploaded')" fill="none" stroke="#4caf50" stroke-width="2" />
          <!-- 下载折线 -->
          <polyline :points="linePoints('downloaded')" fill="none" stroke="#2196f3" stroke-width="2" />
          <!-- X 轴刻度 -->
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
    <!-- 明细表 -->
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
.dt-bar-val { font-size: 11px; fill: currentColor; opacity: 0.8; }
.dt-axis { font-size: 10px; fill: #999; }
.dt-legend { font-size: 12px; padding: 4px 12px; }
.dt-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 4px 0 12px; vertical-align: middle; }
</style>
