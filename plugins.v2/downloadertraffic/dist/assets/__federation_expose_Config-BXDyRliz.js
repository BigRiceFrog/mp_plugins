import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const {createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode,withKeys:_withKeys} = await importShared('vue');


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
  limit_download_kb: 0,
  recovery_speed_kb: 0,
  recovery_download_kb: 0,
  recovery_cron: '30 0 1 * *',
  retention_days: 90,
});

const downloaderItems = ref([]);
const loadingItems = ref(false);
const collectBusy = ref(false);
const limitBusy = ref(false);
const resetBusy = ref(false);
const actionMsg = ref('');
// 清空历史数据：二次确认对话框
const clearDialog = ref(false);
const clearInput = ref('');
const clearBusy = ref(false);
const clearOk = computed(() => clearInput.value.trim() === '清空');

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
        ? `已按超限限速 上传${payload.upload_kb ?? 0}/下载${payload.download_kb ?? 0} KB/s 设置 ${payload.applied_count ?? 0} 个下载器`
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
        ? `已按恢复限速 上传${payload.upload_kb ?? 0}/下载${payload.download_kb ?? 0} KB/s 设置 ${payload.reset_count ?? 0} 个下载器`
        : `操作失败：${payload?.error || ''}`,
      !payload?.ok
    );
  } catch (e) {
    showAction(`请求失败：${e?.message || e}`, true);
  } finally {
    resetBusy.value = false;
  }
}

// 清空历史数据 —— 二次确认：先弹框，须输入「清空」才能执行
function openClearDialog() {
  clearInput.value = '';
  clearDialog.value = true;
}
function closeClearDialog() {
  clearDialog.value = false;
  clearInput.value = '';
}
async function doClear() {
  clearBusy.value = true;
  actionMsg.value = '';
  try {
    const r = await props.api.post(`${base.value}/clear`);
    const payload = r?.data ?? r;
    if (payload?.ok) {
      showAction(`已清空历史数据（records ${payload.deleted_records ?? 0} / snapshots ${payload.deleted_snapshots ?? 0}），下次采集重新入账`);
      clearDialog.value = false;
    } else {
      showAction(`清空失败：${payload?.error || ''}`, true);
    }
  } catch (e) {
    showAction(`请求失败：${e?.message || e}`, true);
  } finally {
    clearBusy.value = false;
    clearInput.value = '';
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
    limit_download_kb: c.limit_download_kb || 0,
    recovery_speed_kb: c.recovery_speed_kb || 0,
    recovery_download_kb: c.recovery_download_kb || 0,
    recovery_cron: c.recovery_cron || '30 0 1 * *',
    retention_days: c.retention_days ?? 90,
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
  const _component_VCardTitle = _resolveComponent("VCardTitle");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VDialog = _resolveComponent("VDialog");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_VToolbar, {
      density: "comfortable",
      color: "transparent"
    }, {
      default: _withCtx(() => [
        _cache[14] || (_cache[14] = _createElementVNode("div", { class: "text-h6 ms-3" }, "下载器流量统计 · 配置", -1)),
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
          default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
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
          default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
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
          default: _withCtx(() => [...(_cache[17] || (_cache[17] = [
            _createTextVNode("测试月初恢复", -1)
          ]))]),
          _: 1
        }, 8, ["loading"]),
        _createVNode(_component_VBtn, {
          color: "error",
          variant: "text",
          density: "comfortable",
          onClick: openClearDialog
        }, {
          default: _withCtx(() => [...(_cache[18] || (_cache[18] = [
            _createTextVNode("清空历史数据", -1)
          ]))]),
          _: 1
        })
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
        hint: "0=达到阈值也不限上传",
        "persistent-hint": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.limit_download_kb,
        "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((local.value.limit_download_kb) = $event)),
        modelModifiers: { number: true },
        label: "超限后全局下载限速 (KB/s)",
        type: "number",
        placeholder: "0",
        class: "mt-3",
        variant: "outlined",
        hint: "0=达到阈值也不限下载",
        "persistent-hint": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.recovery_speed_kb,
        "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((local.value.recovery_speed_kb) = $event)),
        modelModifiers: { number: true },
        label: "月初恢复全局上传限速 (KB/s)",
        type: "number",
        placeholder: "0",
        class: "mt-3",
        variant: "outlined",
        hint: "恢复时把全局上传限速设成该值（如 4096=4M/s）；0=完全放开",
        "persistent-hint": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.recovery_download_kb,
        "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((local.value.recovery_download_kb) = $event)),
        modelModifiers: { number: true },
        label: "月初恢复全局下载限速 (KB/s)",
        type: "number",
        placeholder: "0",
        class: "mt-3",
        variant: "outlined",
        hint: "恢复时把全局下载限速设成该值；0=完全放开",
        "persistent-hint": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.recovery_cron,
        "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((local.value.recovery_cron) = $event)),
        label: "月初恢复触发时间 (Cron 表达式)",
        placeholder: "30 0 1 * *",
        class: "mt-3",
        variant: "outlined",
        hint: "默认每月1号00:30（30 0 1 * *）。可临时改成更频繁的值来测试恢复动作",
        "persistent-hint": ""
      }, null, 8, ["modelValue"]),
      _createVNode(_component_VTextField, {
        modelValue: local.value.retention_days,
        "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((local.value.retention_days) = $event)),
        modelModifiers: { number: true },
        label: "历史数据保留天数 (天)",
        type: "number",
        placeholder: "90",
        class: "mt-3",
        variant: "outlined",
        hint: "每次采集自动删除超过该天数的历史记录；0=不自动清理。建议 90~180 天",
        "persistent-hint": ""
      }, null, 8, ["modelValue"])
    ]),
    _createVNode(_component_VDialog, {
      modelValue: clearDialog.value,
      "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((clearDialog).value = $event)),
      "max-width": "440",
      persistent: ""
    }, {
      default: _withCtx(() => [
        _createVNode(_component_VCard, null, {
          default: _withCtx(() => [
            _createVNode(_component_VCardTitle, { class: "text-error" }, {
              default: _withCtx(() => [...(_cache[19] || (_cache[19] = [
                _createTextVNode("清空全部历史数据？", -1)
              ]))]),
              _: 1
            }),
            _createVNode(_component_VCardText, null, {
              default: _withCtx(() => [
                _cache[20] || (_cache[20] = _createElementVNode("p", null, [
                  _createTextVNode("此操作将"),
                  _createElementVNode("strong", null, "永久删除"),
                  _createTextVNode("插件已采集的所有历史流量记录（含种子基准快照），"),
                  _createElementVNode("strong", null, "不可恢复"),
                  _createTextVNode("。")
                ], -1)),
                _cache[21] || (_cache[21] = _createElementVNode("p", null, [
                  _createTextVNode("清空后，下一次采集会以各种子当前累计值为基准"),
                  _createElementVNode("strong", null, "重新入账"),
                  _createTextVNode("。")
                ], -1)),
                _createVNode(_component_VTextField, {
                  modelValue: clearInput.value,
                  "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((clearInput).value = $event)),
                  label: "请输入「清空」以确认",
                  variant: "outlined",
                  dense: "",
                  class: "mt-2",
                  disabled: clearBusy.value,
                  onKeyup: _cache[12] || (_cache[12] = _withKeys($event => (clearOk.value && !clearBusy.value && doClear()), ["enter"]))
                }, null, 8, ["modelValue", "disabled"])
              ]),
              _: 1
            }),
            _createVNode(_component_VCardActions, null, {
              default: _withCtx(() => [
                _createVNode(_component_VSpacer),
                _createVNode(_component_VBtn, {
                  variant: "text",
                  disabled: clearBusy.value,
                  onClick: closeClearDialog
                }, {
                  default: _withCtx(() => [...(_cache[22] || (_cache[22] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }, 8, ["disabled"]),
                _createVNode(_component_VBtn, {
                  color: "error",
                  variant: "tonal",
                  disabled: !clearOk.value,
                  loading: clearBusy.value,
                  onClick: doClear
                }, {
                  default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                    _createTextVNode("确认清空", -1)
                  ]))]),
                  _: 1
                }, 8, ["disabled", "loading"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"])
  ]))
}
}

};

export { _sfc_main as default };
