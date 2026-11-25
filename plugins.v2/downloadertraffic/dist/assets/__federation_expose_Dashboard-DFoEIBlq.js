import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {createElementVNode:_createElementVNode,createTextVNode:_createTextVNode,toDisplayString:_toDisplayString,resolveComponent:_resolveComponent,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock} = await importShared('vue');


const _hoisted_1 = { class: "dt-dash-rows" };
const _hoisted_2 = { class: "dt-dash-row" };
const _hoisted_3 = { class: "dt-dash-val" };
const _hoisted_4 = { class: "dt-dash-row" };
const _hoisted_5 = { class: "dt-dash-val" };

const {ref,onMounted,computed} = await importShared('vue');



const _sfc_main = {
  __name: 'Dashboard',
  props: {
  api: {
    type: Object,
    default: () => ({}),
  },
  pluginId: {
    type: String,
    default: 'downloadertraffic',
  },
},
  setup(__props) {

const props = __props;

const base = computed(() => {
  const v = props.pluginId;
  // 后端 API 路由以插件类名 DownloaderTraffic 为前缀注册
  return `plugin/${v && v !== 'downloadertraffic' ? v : 'DownloaderTraffic'}`
});
const loading = ref(false);
const up = ref(0);
const down = ref(0);

// 与详情页 / 配置页保持一致：宿主可能直接回响应体，也可能回 axios 响应对象
function unwrap(res) {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res &&
      ('status' in res || 'statusText' in res || 'headers' in res)) {
    return res.data
  }
  return res
}

function fmtBytes(n) {
  const num = Number(n || 0);
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(2) + ' TB'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(2) + ' GB'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(2) + ' MB'
  if (num >= 1024) return (num / 1024).toFixed(1) + ' KB'
  return num + ' B'
}
function pad2(n) { return String(n).padStart(2, '0') }
// 本地时区的今天：原来的 toISOString() 取的是 UTC 日期，东八区 0-8 点会算成昨天
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

async function load() {
  loading.value = true;
  try {
    const r = await props.api.get(`${base.value}/records?period=day&value=${todayKey()}`);
    const rec = unwrap(r) || {};
    up.value = rec.total_uploaded || 0;
    down.value = rec.total_downloaded || 0;
  } catch (e) {
    // 仪表盘加载失败不影响主页面
  } finally {
    loading.value = false;
  }
}

onMounted(load);

return (_ctx, _cache) => {
  const _component_VCard = _resolveComponent("VCard");

  return (_openBlock(), _createBlock(_component_VCard, {
    variant: "flat",
    class: "dt-dash"
  }, {
    default: _withCtx(() => [
      _cache[2] || (_cache[2] = _createElementVNode("div", { class: "dt-dash-title" }, "今日流量", -1)),
      _createElementVNode("div", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
          _cache[0] || (_cache[0] = _createElementVNode("span", { class: "dt-dash-label" }, [
            _createElementVNode("span", { class: "dt-up" }, "↑"),
            _createTextVNode("上传")
          ], -1)),
          _createElementVNode("span", _hoisted_3, _toDisplayString(fmtBytes(up.value)), 1)
        ]),
        _createElementVNode("div", _hoisted_4, [
          _cache[1] || (_cache[1] = _createElementVNode("span", { class: "dt-dash-label" }, [
            _createElementVNode("span", { class: "dt-down" }, "↓"),
            _createTextVNode("下载")
          ], -1)),
          _createElementVNode("span", _hoisted_5, _toDisplayString(fmtBytes(down.value)), 1)
        ])
      ])
    ]),
    _: 1
  }))
}
}

};
const Dashboard = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-4bdb69b2"]]);

export { Dashboard as default };
