import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const {createElementVNode:_createElementVNode,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,resolveComponent:_resolveComponent,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock} = await importShared('vue');


const _hoisted_1 = { class: "pa-2" };

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

const base = computed(() => `plugin/${props.pluginId}`);
const loading = ref(false);
const up = ref(0);
const down = ref(0);

function fmtBytes(n) {
  const num = Number(n || 0);
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(2) + ' TB'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(2) + ' GB'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(2) + ' MB'
  return (num / 1024).toFixed(1) + ' KB'
}

async function load() {
  loading.value = true;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await props.api.get(`${base.value}/records?period=day&value=${today}`);
    const rec = r?.data ?? r;
    up.value = rec?.total_uploaded || 0;
    down.value = rec?.total_downloaded || 0;
  } catch (e) {
    // 仪表盘加载失败不影响主页面
  } finally {
    loading.value = false;
  }
}

onMounted(load);

return (_ctx, _cache) => {
  const _component_VCard = _resolveComponent("VCard");

  return (_openBlock(), _createBlock(_component_VCard, { variant: "flat" }, {
    default: _withCtx(() => [
      _cache[2] || (_cache[2] = _createElementVNode("div", { class: "pa-2 text-caption" }, "今日流量", -1)),
      _createElementVNode("div", _hoisted_1, [
        _createElementVNode("div", null, [
          _cache[0] || (_cache[0] = _createElementVNode("span", { style: {"color":"#4caf50"} }, "↑", -1)),
          _createTextVNode(" " + _toDisplayString(fmtBytes(up.value)), 1)
        ]),
        _createElementVNode("div", null, [
          _cache[1] || (_cache[1] = _createElementVNode("span", { style: {"color":"#2196f3"} }, "↓", -1)),
          _createTextVNode(" " + _toDisplayString(fmtBytes(down.value)), 1)
        ])
      ])
    ]),
    _: 1
  }))
}
}

};

export { _sfc_main as default };
