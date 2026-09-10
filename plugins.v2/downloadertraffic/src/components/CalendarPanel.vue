<script setup>
import { ref, computed, watch } from 'vue'

// 自研中文日期/月/年选择面板（不依赖 Vuetify 内部本地化 / locale / date adapter）
// mode: day | month | year；modelValue 为 'YYYY-MM-DD' / 'YYYY-MM' / 'YYYY'
const props = defineProps({
  mode: { type: String, default: 'day' },
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'close'])

const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const WDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']

const menuOpen = ref(false)
const selYear = ref(new Date().getFullYear())
const selMonth = ref(new Date().getMonth() + 1) // 1..12
const yearPageBase = ref(new Date().getFullYear() - 5)

function pad2(n) { return String(n).padStart(2, '0') }
function defaultValue() {
  const d = new Date()
  if (props.mode === 'year') return String(d.getFullYear())
  if (props.mode === 'month') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function syncFromValue() {
  const v = props.modelValue || defaultValue()
  const ym = String(v).match(/(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/)
  if (ym) {
    selYear.value = Number(ym[1])
    if (ym[2]) selMonth.value = Number(ym[2])
  }
}
watch(() => props.modelValue, syncFromValue, { immediate: true })

const valueDisplay = computed(() => {
  const v = props.modelValue
  if (!v) return ''
  if (props.mode === 'day') return String(v).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1 年 $2 月 $3 日')
  if (props.mode === 'month') return String(v).replace(/^(\d{4})-(\d{2})$/, '$1 年 $2 月')
  return `${v} 年`
})
const valuePlaceholder = computed(() => {
  if (props.mode === 'year') return '请选择年份'
  if (props.mode === 'month') return '请选择月份'
  return '请选择日期'
})
const pickerHeaderTitle = computed(() => {
  if (props.mode === 'day') return `${selYear.value} 年 ${selMonth.value} 月`
  if (props.mode === 'month') return `${selYear.value} 年`
  return `${yearPageBase.value} — ${yearPageBase.value + 11} 年`
})

function buildMonthGrid(y, m) {
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
const yearGrid = computed(() => {
  const out = []
  for (let i = 0; i < 12; i++) out.push(yearPageBase.value + i)
  return out
})

const today = new Date()
const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`
function cellKey(g) { return `${g.y}-${pad2(g.m)}-${pad2(g.d)}` }
function isSelectedDay(g) { return props.mode === 'day' && props.modelValue === cellKey(g) }
function isToday(g) { return cellKey(g) === todayKey }

function headerLeft() {
  if (props.mode === 'day') {
    selMonth.value--
    if (selMonth.value < 1) { selMonth.value = 12; selYear.value-- }
  } else if (props.mode === 'month') {
    selYear.value--
  } else {
    yearPageBase.value -= 12
  }
}
function headerRight() {
  if (props.mode === 'day') {
    selMonth.value++
    if (selMonth.value > 12) { selMonth.value = 1; selYear.value++ }
  } else if (props.mode === 'month') {
    selYear.value++
  } else {
    yearPageBase.value += 12
  }
}
function pick(v) {
  emit('update:modelValue', v)
  menuOpen.value = false
  emit('close')
}
function goToday() {
  const d = new Date()
  selYear.value = d.getFullYear()
  selMonth.value = d.getMonth() + 1
  yearPageBase.value = d.getFullYear() - 5
  if (props.mode === 'day') pick(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`)
  else if (props.mode === 'month') pick(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  else pick(String(d.getFullYear()))
}
function pickDay(g) {
  selYear.value = g.y; selMonth.value = g.m
  pick(`${g.y}-${pad2(g.m)}-${pad2(g.d)}`)
}
function pickMonth(mi) {
  pick(`${selYear.value}-${pad2(mi)}`)
}
function pickYear(y) {
  selYear.value = y
  pick(String(y))
}
</script>

<template>
  <VMenu
    v-model="menuOpen"
    location="bottom start"
    :close-on-content-click="false"
    min-width="320"
  >
    <template #activator="{ props: menuProps }">
      <VTextField
        :model-value="valueDisplay || modelValue"
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
    <VCard class="dt-calendar-card" variant="elevated">
      <div class="dt-cal-head">
        <div class="dt-cal-head-label">
          <span v-if="mode === 'year'">选择年份</span>
          <span v-else-if="mode === 'month'">选择月份</span>
          <span v-else>选择日期</span>
        </div>
        <div class="dt-cal-head-value">
          <template v-if="mode === 'day'">
            {{ selYear }} 年 {{ selMonth }} 月 {{ modelValue?.slice(-2)?.replace(/^-/, '') || today.getDate() }} 日
          </template>
          <template v-else-if="mode === 'month'">
            {{ selYear }} 年 {{ selMonth }} 月
          </template>
          <template v-else>
            {{ modelValue || selYear }} 年
          </template>
        </div>
      </div>
      <div class="dt-cal-toolbar d-flex align-center justify-space-between pa-2">
        <VBtn variant="text" icon="mdi-chevron-left" size="small" @click="headerLeft" />
        <div class="dt-cal-toolbar-title">{{ pickerHeaderTitle }}</div>
        <VBtn variant="text" icon="mdi-chevron-right" size="small" @click="headerRight" />
      </div>

      <div v-if="mode === 'day'" class="px-2 pb-2">
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

      <div v-else-if="mode === 'month'" class="px-3 pb-3">
        <div class="dt-m-grid">
          <button
            v-for="(name, i) in MONTHS_ZH"
            :key="i"
            type="button"
            class="dt-m-btn"
            :class="{ 'dt-selected': selMonth === i + 1 && Number(String(modelValue).slice(0, 4)) === selYear }"
            @click="pickMonth(i + 1)"
          >{{ name }}</button>
        </div>
      </div>

      <div v-else class="px-3 pb-3">
        <div class="dt-m-grid">
          <button
            v-for="y in yearGrid"
            :key="y"
            type="button"
            class="dt-m-btn"
            :class="{ 'dt-selected': String(modelValue) === String(y) }"
            @click="pickYear(y)"
          >{{ y }}</button>
        </div>
      </div>

      <div class="d-flex justify-end ga-1 px-2 pb-2">
        <VBtn size="small" variant="text" @click="goToday">今天</VBtn>
        <VBtn size="small" variant="text" @click="menuOpen = false">关闭</VBtn>
      </div>
    </VCard>
  </VMenu>
</template>

<style scoped>
.dt-calendar-card { min-width: 300px; width: 312px; padding: 0; overflow: hidden; }
.dt-cal-head {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  color: #fff;
  padding: 14px 16px 12px;
}
.dt-cal-head-label { font-size: 12px; opacity: 0.9; letter-spacing: 0.4px; }
.dt-cal-head-value { font-size: 22px; font-weight: 600; margin-top: 4px; line-height: 1.2; }
.dt-cal-toolbar-title { font-size: 14px; font-weight: 600; color: rgb(var(--v-theme-on-surface, 33 33 33)); }

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
