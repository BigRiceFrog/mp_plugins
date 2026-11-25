import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 按「组件自身可用宽度」判断是否窄屏，而不是按 window.innerWidth。
 *
 * 原因：MoviePilot 详情页在手机上接近全屏，在桌面上也可能是窄弹窗 / 侧栏抽屉，
 * 只看视口宽度会给桌面窄弹窗套上宽屏布局，照样挤成一团。
 *
 * 用法：
 *   const { target: rootEl, narrow, width } = useNarrow(640)
 *   <div ref="rootEl" :class="{ 'dt-narrow': narrow }">
 */
export function useNarrow(maxWidth = 640) {
  const target = ref(null)
  // 先用视口宽度做初值：手机首帧就不会先闪一下宽屏布局，
  // 挂载后再用 ResizeObserver 按组件自身宽度纠正（桌面窄弹窗 / 侧栏也能命中）。
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 0)
  const narrow = ref(width.value > 0 && width.value < maxWidth)
  let observer = null

  function measure(w) {
    if (!w || w <= 0) return
    width.value = Math.round(w)
    narrow.value = w < maxWidth
  }

  onMounted(() => {
    const el = target.value
    if (!el) {
      if (typeof window !== 'undefined') measure(window.innerWidth)
      return
    }
    const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
    measure(rect ? rect.width : 0)

    if (typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver((entries) => {
      measure(entries[0]?.contentRect?.width || 0)
    })
    observer.observe(el)
  })

  onUnmounted(() => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  })

  return { target, narrow, width }
}
