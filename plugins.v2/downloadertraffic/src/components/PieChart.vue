<script setup>
import { computed, ref, onUnmounted } from 'vue'

// 纯 SVG 饼图（不依赖第三方图表库）：
// - items: [{label, value}]，内部按 value 从大到小排序
// - 只展示 value>0 的站点；图例展示 色块 + 站点名 + 数值 + 占比
// - 鼠标悬停 / 手指点按扇区显示 tooltip（站点名 + 数据量）
const props = defineProps({
  items: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  emptyText: { type: String, default: '暂无数据' },
  loading: { type: Boolean, default: false },
  // 窄屏：图例改为整行铺开（不再限高裁切），扇区上的数值隐藏（图例已有），避免小扇区文字互压
  narrow: { type: Boolean, default: false },
})

const PALETTE = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#10b981', '#f43f5e',
  '#0ea5e9', '#d946ef', '#eab308', '#64748b', '#7c3aed',
]

const SIZE = 260
const CX = SIZE / 2
const CY = SIZE / 2
const R = 118

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
// 扇区角度足够大才在扇区上标数值，避免小扇区文字重叠；窄屏图例已给出数值，直接不标
function showLabel(s) {
  if (props.narrow) return false
  return s.a2 - s.a1 > 0.3
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

// ---------- tooltip ----------
const svgRef = ref(null)
const hover = ref(null)
let hideTimer = null
function placeTip(e, s, i) {
  const el = svgRef.value
  if (!el) return false
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return false
  let x = e.clientX - rect.left
  let y = e.clientY - rect.top
  const tipW = 160, tipH = 34
  if (x + tipW > rect.width - 4) x = x - tipW - 10
  else x += 12
  if (y + tipH > rect.height - 4) y = y - tipH - 8
  else y -= 8
  hover.value = {
    label: s.label,
    value: s.value,
    color: PALETTE[i % PALETTE.length],
    x: Math.max(4, Math.floor(x)),
    y: Math.max(4, Math.floor(y)),
  }
  return true
}
function onMove(e, s, i) {
  placeTip(e, s, i)
}
// 触摸屏没有 mouseover：点一下扇区就让 tooltip 显示 2 秒，避免手机上完全看不到数值
function onTap(e, s, i) {
  if (!placeTip(e, s, i)) return
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { hover.value = null }, 2200)
}
function onLeave(e) {
  // 手指离开不立刻隐藏（否则 tap 的 tooltip 一闪而过）
  if (e && e.pointerType && e.pointerType !== 'mouse') return
  hover.value = null
}
onUnmounted(() => { clearTimeout(hideTimer) })
</script>

<template>
  <div class="pc-wrap" :class="{ 'pc-narrow': narrow }">
    <div class="pc-head">
      <span class="pc-title">{{ title }}</span>
      <span v-if="subtitle" class="pc-sub">{{ subtitle }}</span>
      <span v-if="total > 0" class="pc-total">共 {{ fmtBytes(total) }}</span>
    </div>
    <div v-if="sorted.length === 0" class="pc-empty">{{ loading ? '加载中...' : emptyText }}</div>
    <div v-else class="pc-body">
      <div class="pc-svg-wrap">
        <svg ref="svgRef" :viewBox="`0 0 ${SIZE} ${SIZE}`" class="pc-svg" @pointerleave="onLeave">
          <g v-for="(s, i) in segments" :key="i">
            <path
              :d="slicePath(s)"
              :fill="PALETTE[i % PALETTE.length]"
              stroke="#fff"
              stroke-width="1.5"
              @pointermove="onMove($event, s, i)"
              @pointerdown="onTap($event, s, i)"
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
        <div
          v-if="hover"
          class="pc-tip"
          :style="{ left: hover.x + 'px', top: hover.y + 'px', background: hover.color }"
        >
          <span class="pc-tip-name">{{ hover.label }}</span>
          <span class="pc-tip-val">{{ fmtBytes(hover.value) }}</span>
        </div>
      </div>
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
.pc-wrap { width: 100%; min-width: 0; }
.pc-head {
  display: flex; align-items: baseline; gap: 8px;
  padding: 4px 4px 8px; flex-wrap: wrap;
}
.pc-title { font-size: 15px; font-weight: 600; }
.pc-sub { font-size: 12px; color: rgb(var(--v-theme-on-surface, 33 33 33) / 0.6); }
.pc-total { font-size: 12px; color: rgb(var(--v-theme-primary, 99 102 241)); font-weight: 600; }
.pc-empty { padding: 24px 8px; text-align: center; color: rgb(var(--v-theme-on-surface, 33 33 33) / 0.5); }
.pc-body { display: flex; gap: 16px 20px; align-items: flex-start; flex-wrap: wrap; }

/* 图表按容器宽度缩放：不再写死 260px，手机窄卡片里也不会溢出 */
.pc-svg-wrap {
  position: relative;
  flex: 1 1 190px;
  min-width: 0;
  max-width: 280px;
  margin-inline: auto;
}
.pc-svg { width: 100%; height: auto; aspect-ratio: 1 / 1; display: block; }
.pc-slice-label { font-size: 13px; fill: #fff; font-weight: 600; pointer-events: none; }
.pc-tip {
  position: absolute;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  line-height: 1;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  white-space: nowrap;
  z-index: 5;
  max-width: calc(100% - 8px);
}
.pc-tip-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.pc-tip-val { font-weight: 600; opacity: 0.95; }
.pc-legend {
  flex: 1 1 180px;
  min-width: 0;
  max-height: 320px;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 3px;
  -webkit-overflow-scrolling: touch;
}
.pc-legend-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; line-height: 1.7;
  min-width: 0;
}
.pc-dot { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 auto; }
.pc-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-val { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pc-pct { color: rgb(var(--v-theme-on-surface, 33 33 33) / 0.55); white-space: nowrap; min-width: 52px; text-align: right; }

@media (max-width: 420px) {
  .pc-legend-item { font-size: 13px; line-height: 1.6; }
  .pc-legend { max-height: 220px; }
}

/* 窄屏：饼图缩小并居中，图例整行铺开且不再裁切，站点再多也全部可见 */
.pc-narrow .pc-svg-wrap { flex: 1 1 160px; max-width: 224px; }
.pc-narrow .pc-legend {
  flex: 1 1 100%;
  max-height: none;
  overflow: visible;
  gap: 1px;
}
.pc-narrow .pc-legend-item { font-size: 13px; line-height: 1.55; }
.pc-narrow .pc-head { padding: 0 0 6px; }
</style>
