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

function fmtBytes(n) {
  const num = Number(n || 0)
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(2) + ' TB'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(2) + ' GB'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(2) + ' MB'
  return (num / 1024).toFixed(1) + ' KB'
}

async function load() {
  loading.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    const r = await props.api.get(`${base.value}/records?period=day&value=${today}`)
    const rec = r?.data ?? r
    up.value = rec?.total_uploaded || 0
    down.value = rec?.total_downloaded || 0
  } catch (e) {
    // 仪表盘加载失败不影响主页面
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <VCard variant="flat">
    <div class="pa-2 text-caption">今日流量</div>
    <div class="pa-2">
      <div><span style="color: #4caf50">↑</span> {{ fmtBytes(up) }}</div>
      <div><span style="color: #2196f3">↓</span> {{ fmtBytes(down) }}</div>
    </div>
  </VCard>
</template>
