import { createApp } from 'vue'
import Page from './components/Page.vue'

// 仅用于本地 dev 预览；宿主通过模块联邦加载 remoteEntry.js，不会用到此入口。
createApp(Page).mount('#app')
