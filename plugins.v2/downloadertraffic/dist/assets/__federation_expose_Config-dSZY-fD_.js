import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const {createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode} = await importShared('vue');


const _hoisted_1 = { class: "dt-config" };
const _hoisted_2 = {
  class: "pa-4",
  style: {"max-width":"560px"}
};
const _hoisted_3 = {
  key: 0,
  class: "mb-3"
};
const _hoisted_4 = { class: "d-flex ga-2 mb-3 flex-wrap" };

const {ref,computed,onMounted} = await importShared('vue');



const _sfc_main = {
  __name: 'Config',
  props: {
  api: {
    type: Object,
    default: () => ({}),
  },
  pluginId: {
    type: String,
    default: 'downloadertraffic',
  },
  initialConfig: {
    type: Object,
    default: () => ({}),
  },
},
  emits: ['save', 'close'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

// 后端 API 路由以插件类名 DownloaderTraffic 为前缀注册
const pid = computed(() => {
  const v = props.pluginId;
  return v && v !== 'downloadertraffic' ? v : 'DownloaderTraffic'
});
const base = computed(() => `plugin/${pid.value}`);

// api.get 直接返回响应体（MP 前端拦截器已解包 response.data）；
// 个别宿主若返回 axios 响应对象则解一层 .data
function unwrap(res) {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res &&
      ('status' in res || 'statusText' in res || 'headers' in res)) {
    return res.data
  }
  return res
}

const local = ref({
  enabled: false,
  cron: '*/30 * * * *',
  downloaders: [],
  upload_threshold_gb: 0,
  limit_speed_kb: 0,
  recovery_speed_kb: 0,
});

const downloaderItems = ref([]);
const loadingItems = ref(false);
const collectBusy = ref(false);
const limitBusy = ref(false);
const resetBusy = ref(false);
const actionMsg = ref('');

function showAction(msg, isError = false) {
  actionMsg.value = isError ? msg : `✅ ${msg}`;
}

async function doCollect() {
  collectBusy.value = true;
  actionMsg.value = '';
  try {
    const r = await props.api.get(`${base.value}/collect`);
    const payload = r?.data ?? r;
    showAction(payload?.ok ? '已触发采集，可稍后打开详情页查看' : `采集失败：${payload?.error || ''}`, !payload?.ok);
  } catch (e) {
    showAction(`采集请求失败：${e?.message || e}`, true);
  } finally {
    collectBusy.value = false;
  }
}

// 测试「超限限速」：按 limit_speed_kb 限速
async function doTestLimit() {
  limitBusy.value = true;
  actionMsg.value = '';
  try {
    const r = await props.api.post(`${base.value}/test-limit`);
    const payload = r?.data ?? r;
    showAction(
      payload?.ok
        ? `已按超限限速 ${payload.speed_kb ?? 0} KB/s 设置 ${payload.applied_count ?? 0} 个下载器`
        : `操作失败：${payload?.error || ''}`,
      !payload?.ok
    );
  } catch (e) {
    showAction(`请求失败：${e?.message || e}`, true);
  } finally {
    limitBusy.value = false;
  }
}

// 测试「月初恢复」：按 recovery_speed_kb 恢复限速
async function doReset() {
  resetBusy.value = true;
  actionMsg.value = '';
  try {
    const r = await props.api.post(`${base.value}/reset-limit`);
    const payload = r?.data ?? r;
    showAction(
      payload?.ok
        ? `已按月初恢复限速 ${payload.speed_kb ?? 0} KB/s 设置 ${payload.reset_count ?? 0} 个下载器`
        : `操作失败：${payload?.error || ''}`,
      !payload?.ok
    );
  } catch (e) {
    showAction(`请求失败：${e?.message || e}`, true);
  } finally {
    resetBusy.value = false;
  }
}

onMounted(async () => {
  const c = props.initialConfig || {};
  const dl = c.downloaders;
  local.value = {
    enabled: Boolean(c.enabled),
    cron: c.cron || '*/30 * * * *',
    downloaders: Array.isArray(dl) ? dl : ((dl || '').split(',').filter(Boolean)),
    upload_threshold_gb: c.upload_threshold_gb || 0,
    limit_speed_kb: c.limit_speed_kb || 0,
    recovery_speed_kb: c.recovery_speed_kb || 0,
  };

  if (props.api && props.api.get) {
    loadingItems.value = true;
    try {
      const res = await props.api.get(`${base.value}/downloaders`);
      // api.get 直接返回响应体 {data: [...]}；兼容 axios 响应对象
      const body = unwrap(res) || {};
      const payload = Array.isArray(body) ? body : (body.data ?? body);
      downloaderItems.value = Array.isArray(payload) ? payload : [];
    } catch (e) {
      console.error('读取下载器列表失败', e);
    } finally {
      loadingItems.value = false;
    }
  }
});

function save() {
  emit('save', { ...local.value });
}

return (_ctx, _cache) => {
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VToolbar = _resolveComponent("VToolbar");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VSwitch = _resolveComponent("VSwitch");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VSelect = _resolveComponent("VSelect");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_VToolbar, {
      density: "comfortable",
      color: "transparent"
    }, {
      default: _withCtx(() => [
        _cache[7] || (_cache[7] = _createElementVNode("div", { class: "text-h6 ms-3" }, "下载器流量统计 · 配置", -1)),
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
      (actionMsg.value)
        ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
            _createVNode(_component_VAlert, {
              density: "compact",
              variant: "tonal",
              type: actionMsg.value.includes('失败') ? 'error' : 'success'
            }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(actionMsg.value), 1)
              ]),
              _: 1
            }, 8, ["type"])
          ]))
        : _createCommentVNode("", true),
      _createElementVNode("div", _hoisted_4, [
        _createVNode(_component_VBtn, {
          color: "primary",
          variant: "tonal",
          loading: collectBusy.value,
          onClick: doCollect
        }, {
          default: _withCtx(() => [...(_cache[8] || (_cache[8] = [
            _createTextVNode("立即采集流量", -1)
          ]))]),
          _: 1
        }, 8, ["loading"]),
        _createVNode(_component_VBtn, {
          color: "error",
          variant: "tonal",
          loading: limitBusy.value,
          onClick: doTestLimit
        }, {
          default: _withCtx(() => [...(_cache[9] || (_cache[9] = [
            _createTextVNode("测试限速", -1)
          ]))]),
          _: 1
        }, 8, ["loading"]),
        _createVNode(_component_VBtn, {
          color: "success",
          variant: "tonal",
          loading: resetBusy.value,
          onClick: doReset
        }, {
          default: _withCtx(() => [...(_cache[10] || (_cache[10] = [
            _createTextVNode("测试月初恢复", -1)
          ]))]),
          _: 1
        }, 8, ["loading"])
      ]),
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
      _createVNode(_component_VSelect, {
        modelValue: local.value.downloaders,
        "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((local.value.downloaders) = $event)),
        items: downloaderItems.value,
        loading: loadingItems.value,
        label: "指定下载器（留空=全部）",
        multiple: "",
        chips: "",
        clearable: "",
        class: "mt-3",
        variant: "outlined",
        hint: "从 MP 已配置的下载器中选择；留空则统计全部",
        "persistent-hint": ""
      }, null, 8, ["modelValue", "items", "loading"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.upload_threshold_gb,
        "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((local.value.upload_threshold_gb) = $event)),
        modelModifiers: { number: true },
        label: "月度上传阈值 (GB)",
        type: "number",
        placeholder: "0",
        class: "mt-3",
        variant: "outlined",
        hint: "当前自然月累计上传达到该值后触发全局限速；0=不启用",
        "persistent-hint": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.limit_speed_kb,
        "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((local.value.limit_speed_kb) = $event)),
        modelModifiers: { number: true },
        label: "超限后全局上传限速 (KB/s)",
        type: "number",
        placeholder: "0",
        class: "mt-3",
        variant: "outlined",
        hint: "0=达到阈值也不限速",
        "persistent-hint": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.recovery_speed_kb,
        "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((local.value.recovery_speed_kb) = $event)),
        modelModifiers: { number: true },
        label: "月初恢复上传限速 (KB/s)",
        type: "number",
        placeholder: "0",
        class: "mt-3",
        variant: "outlined",
        hint: "每月 1 号 00:30 把全局上传限速设成该值（如 4096=4M/s）；0=完全放开不限速",
        "persistent-hint": ""
      }, null, 8, ["modelValue"])
    ])
  ]))
}
}

};

export { _sfc_main as default };
