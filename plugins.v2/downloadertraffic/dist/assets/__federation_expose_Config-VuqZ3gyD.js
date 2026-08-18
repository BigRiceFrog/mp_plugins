import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const {createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,withCtx:_withCtx,openBlock:_openBlock,createElementBlock:_createElementBlock} = await importShared('vue');


const _hoisted_1 = { class: "dt-config" };
const _hoisted_2 = {
  class: "pa-4",
  style: {"max-width":"560px"}
};

const {ref,onMounted} = await importShared('vue');



const _sfc_main = {
  __name: 'Config',
  props: {
  initialConfig: {
    type: Object,
    default: () => ({}),
  },
},
  emits: ['save', 'close'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const local = ref({
  enabled: false,
  cron: '*/30 * * * *',
  downloaders: '',
});

onMounted(() => {
  local.value = {
    enabled: Boolean(props.initialConfig?.enabled),
    cron: props.initialConfig?.cron || '*/30 * * * *',
    downloaders: props.initialConfig?.downloaders || '',
  };
});

function save() {
  emit('save', { ...local.value });
}

return (_ctx, _cache) => {
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VToolbar = _resolveComponent("VToolbar");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VSwitch = _resolveComponent("VSwitch");
  const _component_VTextField = _resolveComponent("VTextField");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_VToolbar, {
      density: "comfortable",
      color: "transparent"
    }, {
      default: _withCtx(() => [
        _cache[4] || (_cache[4] = _createElementVNode("div", { class: "text-h6 ms-3" }, "下载器流量统计 · 配置", -1)),
        _createVNode(_component_VSpacer),
        _createVNode(_component_VBtn, {
          icon: "mdi-content-save",
          variant: "text",
          color: "primary",
          onClick: save
        }),
        _createVNode(_component_VBtn, {
          icon: "mdi-close",
          variant: "text",
          onClick: _cache[0] || (_cache[0] = $event => (emit('close')))
        })
      ]),
      _: 1
    }),
    _createVNode(_component_VDivider),
    _createElementVNode("div", _hoisted_2, [
      _createVNode(_component_VSwitch, {
        modelValue: local.value.enabled,
        "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((local.value.enabled) = $event)),
        label: "启用插件",
        color: "primary",
        "hide-details": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.cron,
        "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((local.value.cron) = $event)),
        label: "采集周期 (Cron 表达式)",
        placeholder: "*/30 * * * *",
        class: "mt-3",
        variant: "outlined",
        hint: "默认每 30 分钟采集一次",
        "persistent-hint": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.downloaders,
        "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((local.value.downloaders) = $event)),
        label: "指定下载器 (留空=全部，逗号分隔)",
        placeholder: "QB-Main,TR-Seed",
        class: "mt-3",
        variant: "outlined"
      }, null, 8, ["modelValue"])
    ])
  ]))
}
}

};

export { _sfc_main as default };
