<script setup>
import { computed } from 'vue'

// 纯 SVG 饼图（不依赖第三方图表库）：
// - items: [{label, value}]，内部按 value 从大到小排序
// - 只展示 value>0 的站点；图例展示 色块 + 站点名 + 数值 + 占比
const props = defineProps({
  items: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  emptyText: { type: String, default: '暂无数据' },
  loading: { type: Boolean, default: false },
})

const PALETTE = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#10b981', '#f43f5e',
  '#0ea5e9', '#d946ef', '#eab308', '#64748b', '#7c3aed',
]

const SIZE = 220
const CX = SIZE / 2
const CY = SIZE / 2
const R = 100

const sorted = computed(() => {
  return props.items
    .map((it) => ({ label: String(it.label || ''), value: Number(it.value || 0) }))
    .filter((it) => it.value > 0)
    .sort((a, b) => b.value - a.value)
})
const total = computed(() => sorted.value.reduce((s, it) => s + it.value, 0))

const segments = computed(() => {
  const segs = []
  let acc = 0
  for (const it of sorted.value) {
    const a1 = (acc / total.value) * 2 * Math.PI
    acc += it.value
    const a2 = (acc / total.value) * 2 * Math.PI
    segs.push({ ...it, a1, a2 })
  }
  return segs
})

function slicePath(s) {
  const x1 = CX + R * Math.sin(s.a1)
  const y1 = CY - R * Math.cos(s.a1)
  const x2 = CX + R * Math.sin(s.a2)
  const y2 = CY - R * Math.cos(s.a2)
  const large = s.a2 - s.a1 > Math.PI ? 1 : 0
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}
function labelPos(s) {
  const mid = (s.a1 + s.a2) / 2
  const lr = R * 0.62
  return { x: CX + lr * Math.sin(mid), y: CY - lr * Math.cos(mid) }
}
// 扇区角度足够大才在扇区上标数值，避免小扇区文字重叠
function showLabel(s) {
  return s.a2 - s.a1 > 0.28
}
function pct(v) {
  return total.value ? (v / total.value) * 100 : 0
}
function fmtBytes(n) {
  const num = Number(n || 0)
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(2) + ' TB'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(2) + ' GB'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(2) + ' MB'
  if (num >= 1024) return (num / 1024).toFixed(2) + ' KB'
  return num + ' B'
}
// 扇区上的紧凑数值：47.1G / 39.4M 等
function fmtCompact(n) {
  const num = Number(n || 0)
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(1) + 'T'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(1) + 'G'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(1) + 'M'
  if (num >= 1024) return (num / 1024).toFixed(1) + 'K'
  return num + 'B'
}
</script>

<template>
  <div class="pc-wrap">
    <div class="pc-head">
      <span class="pc-title">{{ title }}</span>
      <span v-if="subtitle" class="pc-sub">{{ subtitle }}</span>
      <span v-if="total > 0" class="pc-total">共 {{ fmtBytes(total) }}</span>
    </div>
    <div v-if="sorted.length === 0" class="pc-empty">{{ loading ? '加载中...' : emptyText }}</div>
    <div v-else class="pc-body">
      <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="pc-svg">
        <g v-for="(s, i) in segments" :key="i">
          <path
            :d="slicePath(s)"
            :fill="PALETTE[i % PALETTE.length]"
            stroke="#fff"
            stroke-width="1.5"
          />
          <text
            v-if="showLabel(s)"
            :x="labelPos(s).x"
            :y="labelPos(s).y"
            class="pc-slice-label"
            text-anchor="middle"
            dominant-baseline="middle"
          >{{ fmtCompact(s.value) }}</text>
        </g>
      </svg>
      <div class="pc-legend">
        <div v-for="(s, i) in sorted" :key="i" class="pc-legend-item">
          <span class="pc-dot" :style="{ background: PALETTE[i % PALETTE.length] }" />
          <span class="pc-name" :title="s.label">{{ s.label }}</span>
          <span class="pc-val">{{ fmtBytes(s.value) }}</span>
          <span class="pc-pct">{{ pct(s.value).toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pc-wrap { width: 100%; }
.pc-head {
  display: flex; align-items: baseline; gap: 8px;
  padding: 4px 4px 8px; flex-wrap: wrap;
}
.pc-title { font-size: 15px; font-weight: 600; }
.pc-sub { font-size: 12px; color: rgb(var(--v-theme-on-surface, 33 33 33) / 0.6); }
.pc-total { font-size: 12px; color: rgb(var(--v-theme-primary, 99 102 241)); font-weight: 600; }
.pc-empty { padding: 24px 8px; text-align: center; color: rgb(var(--v-theme-on-surface, 33 33 33) / 0.5); }
.pc-body { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.pc-svg { width: 220px; height: 220px; flex: 0 0 auto; }
.pc-slice-label { font-size: 11px; fill: #fff; font-weight: 600; pointer-events: none; }
.pc-legend {
  flex: 1 1 200px; min-width: 180px;
  max-height: 220px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 2px;
}
.pc-legend-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; line-height: 1.6;
}
.pc-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
.pc-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-val { font-weight: 600; white-space: nowrap; }
.pc-pct { color: rgb(var(--v-theme-on-surface, 33 33 33) / 0.55); white-space: nowrap; min-width: 46px; text-align: right; }
</style>
