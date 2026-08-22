import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const {createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,mergeProps:_mergeProps,withCtx:_withCtx,createTextVNode:_createTextVNode,toDisplayString:_toDisplayString,openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment} = await importShared('vue');


const _hoisted_1 = { class: "dt-page" };
const _hoisted_2 = {
  key: 0,
  class: "pa-3"
};
const _hoisted_3 = {
  key: 1,
  class: "text-error pa-3"
};
const _hoisted_4 = { class: "dt-cards" };
const _hoisted_5 = { class: "text-h6" };
const _hoisted_6 = { class: "text-h6" };
const _hoisted_7 = { class: "text-h6" };
const _hoisted_8 = {
  key: 0,
  class: "text-medium-emphasis"
};
const _hoisted_9 = ["width", "height"];
const _hoisted_10 = ["y"];
const _hoisted_11 = ["y", "width", "height"];
const _hoisted_12 = ["x", "y"];
const _hoisted_13 = ["y", "width", "height"];
const _hoisted_14 = ["x", "y"];
const _hoisted_15 = {
  key: 0,
  class: "text-medium-emphasis"
};
const _hoisted_16 = ["x2"];
const _hoisted_17 = ["y1", "x2", "y2"];
const _hoisted_18 = {
  x: 4,
  y: 16,
  class: "dt-axis"
};
const _hoisted_19 = ["y"];
const _hoisted_20 = ["points"];
const _hoisted_21 = ["points"];
const _hoisted_22 = ["x", "y"];
const _hoisted_23 = { style: {"color":"#4caf50"} };
const _hoisted_24 = { style: {"color":"#2196f3"} };

const {ref,computed,onMounted,watch,nextTick} = await importShared('vue');

const barW = 360;
const barH = 26;
const barGap = 14;
const barLabelW = 120;
const lineW = 640;
const lineH = 220;
const linePadL = 48;
const linePadB = 28;

const _sfc_main = {
  __name: 'Page',
  props: {
  api: {
    type: Object,
    default: () => ({}),
  },
  pluginId: {
    type: String,
    default: 'downloadertraffic',
  },
  hideTitle: {
    type: Boolean,
    default: false,
  },
},
  emits: ['close'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;
const period = ref('month');
const value = ref('');
const downloader = ref('');
const loading = ref(false);
const error = ref('');
const records = ref([]);
const totalUp = ref(0);
const totalDown = ref(0);
const trend = ref([]);
// 后端 API 路由由 MoviePilot 以「插件类名 DownloaderTraffic」为前缀注册，
// 这里固定使用类名，兼容宿主传入小写文件夹名 / 未传 pluginId 的情况。
const pid = computed(() => {
  const v = props.pluginId;
  return v && v !== 'downloadertraffic' ? v : 'DownloaderTraffic'
});
const base = computed(() => `plugin/${pid.value}`);
// 手动触发采集 / 解除限速
const collectBusy = ref(false);
const resetBusy = ref(false);
const actionMsg = ref('');
async function doCollect() {
  collectBusy.value = true;
  actionMsg.value = '';
  try {
    const r = await props.api.get(`${base.value}/collect`);
    const payload = r?.data ?? r;
    actionMsg.value = payload?.ok ? '已触发采集，稍后自动刷新' : `采集失败：${payload?.error || ''}`;
  } catch (e) {
    actionMsg.value = `采集请求失败：${e?.message || e}`;
  } finally {
    collectBusy.value = false;
    setTimeout(load, 800);
  }
}
async function doReset() {
  resetBusy.value = true;
  actionMsg.value = '';
  try {
    const r = await props.api.post(`${base.value}/reset-limit`);
    const payload = r?.data ?? r;
    actionMsg.value = payload?.ok
      ? `已解除 ${payload.reset_count ?? 0} 个下载器的上传限速`
      : `解除失败：${payload?.error || ''}`;
  } catch (e) {
    actionMsg.value = `解除请求失败：${e?.message || e}`;
  } finally {
    resetBusy.value = false;
  }
}
function fmtBytes(n) {
  const num = Number(n || 0);
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(2) + ' TB'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(2) + ' GB'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(2) + ' MB'
  if (num >= 1024) return (num / 1024).toFixed(2) + ' KB'
  return num + ' B'
}
function defaultValue() {
  const d = new Date();
  if (period.value === 'year') return String(d.getFullYear())
  if (period.value === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// api.get 直接返回响应体（MP 前端拦截器已解包 response.data）；
// 个别宿主若返回 axios 响应对象则解一层 .data
function unwrap(res) {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res &&
      ('status' in res || 'statusText' in res || 'headers' in res)) {
    return res.data
  }
  return res
}
async function load() {
  loading.value = true;
  error.value = '';
  if (!value.value) value.value = defaultValue();
  try {
    const q = new URLSearchParams({ period: period.value, value: value.value });
    if (downloader.value) q.set('downloader', downloader.value);
    const [r1, r2] = await Promise.all([
      props.api.get(`${base.value}/records?${q.toString()}`),
      props.api.get(`${base.value}/trend?${q.toString()}`),
    ]);
    const rec = unwrap(r1) || {};
    const tr = unwrap(r2) || {};
    records.value = rec.data || [];
    totalUp.value = rec.total_uploaded || 0;
    totalDown.value = rec.total_downloaded || 0;
    trend.value = tr.data || [];
  } catch (e) {
    error.value = e?.message || '加载失败';
  } finally {
    loading.value = false;
  }
}
onMounted(load);
// ================= 日期/月/年选择器（修复不可点击选择的问题）=================
// 思路：
//  - Vuetify VDatePicker 模型值永远是 "YYYY-MM-DD"（或年月日对象）。
//  - UI 上按 period 展示不同视图（year/month/day），选中后按 period 截断成 value。
//  - 切换 period 时重置 value；同时同步 pickerDate（用于打开 picker 时高亮当前值）。
const dateMenuOpen = ref(false);
const pickerDate = ref('');
// 根据 period + 当前 value 推断 picker 的 YYYY-MM-DD（用于 picker 回显）
function syncPickerFromValue() {
  const v = value.value || defaultValue();
  if (period.value === 'year') {
    const y = (String(v).match(/\d{4}/) || [])[0] || String(new Date().getFullYear());
    pickerDate.value = `${y}-01-01`;
  } else if (period.value === 'month') {
    const m = (String(v).match(/^\d{4}-\d{2}/) || [])[0] || defaultValue();
    pickerDate.value = `${m}-01`;
  } else {
    pickerDate.value = (String(v).match(/^\d{4}-\d{2}-\d{2}/) || [defaultValue()])[0];
  }
}
// 首次与 period 变化时先补齐默认值，再同步 picker
watch(period, () => {
  value.value = '';
  nextTick(() => {
    if (!value.value) value.value = defaultValue();
    syncPickerFromValue();
    load();
  });
});
// value 可能被外部（初始化 load 里 defaultValue）改 → 保持 picker 同步
watch(value, syncPickerFromValue, { immediate: true });
// Vuetify 3 年/月/日 三级视图对应：
//   - 按年：打开在「年」面板（view-mode=year），点到月面板就收
//   - 按月：打开在「月」面板（view-mode=month），点到日面板就收
//   - 按日：打开在「日」面板（view-mode=day），选到具体日就收
const pickerViewMode = computed(() => (period.value === 'year' ? 'year' : period.value === 'month' ? 'month' : 'day'));
// VDatePicker 的 v-model 绑定 pickerDate（YYYY-MM-DD）；选完后按 period 截断写回 value
function onPickerUpdate(val) {
  if (!val) return
  // VDatePicker 可能返回对象或字符串；统一转字符串
  const s = typeof val === 'string' ? val : (val.date || val.year ? `${val.year}-${String(val.month || 1).padStart(2, '0')}-${String(val.day || 1).padStart(2, '0')}` : String(val));
  const m = s.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!m) return
  pickerDate.value = s;
  const [, y, mo, da] = m;
  if (period.value === 'year') {
    value.value = y;
    // 年视图选择完成直接关闭；注意 VDatePicker 选年通常不会 emit 更新，
    // 但在「年」面板点中年份时会把 year 推进 —— 这里我们在 update:model-value 都处理。
    dateMenuOpen.value = false;
    load();
  } else if (period.value === 'month') {
    value.value = `${y}-${mo || '01'}`;
    // 月视图：切换到某个月即可关闭，不必再选日
    dateMenuOpen.value = false;
    load();
  } else {
    value.value = `${y}-${mo || '01'}-${da || '01'}`;
    dateMenuOpen.value = false;
    load();
  }
}
// 对「按月」模式：点击月份节点后 VDatePicker 只会把「显示年月」推进，但不会 emit model-value。
// 所以我们监听 update:year / update:month 变化，在按月/按年模式下直接提交。
function onPickerYearUpdate(y) {
  if (period.value !== 'year') return
  const m = (pickerDate.value || '').match(/^\d{4}-(\d{2})(?:-(\d{2}))?/) || [];
  value.value = String(y);
  pickerDate.value = `${y}-${m[1] || '01'}-${m[2] || '01'}`;
  dateMenuOpen.value = false;
  load();
}
function onPickerMonthUpdate(v) {
  if (period.value === 'day') return
  // v 可能是 { year, month } 对象或字符串
  let y, mo;
  if (v && typeof v === 'object') {
    y = v.year; mo = v.month;
  } else if (typeof v === 'string') {
    const m0 = v.match(/^(\d{4})(?:-(\d{2}))?/);
    if (m0) { y = m0[1]; mo = m0[2]; }
  }
  if (!y || !mo) return
  if (period.value === 'year') {
    value.value = String(y);
  } else {
    value.value = `${y}-${String(mo).padStart(2, '0')}`;
  }
  pickerDate.value = `${y}-${String(mo).padStart(2, '0')}-01`;
  dateMenuOpen.value = false;
  load();
}
// 显示在输入框上的占位/当前值提示
const valuePlaceholder = computed(() => {
  if (period.value === 'year') return '2026'
  if (period.value === 'month') return '2026-08'
  return '2026-08-18'
});
// 仅展示具体站点（排除 GLOBAL 汇总行）用于柱状图
const siteRows = computed(() => records.value.filter((r) => r.site !== 'GLOBAL'));
const maxSiteBytes = computed(() => {
  let m = 0;
  for (const r of siteRows.value) {
    m = Math.max(m, Number(r.uploaded || 0), Number(r.downloaded || 0));
  }
  return m || 1
});
// 柱状图几何
function barUpWidth(r) {
  return (Number(r.uploaded || 0) / maxSiteBytes.value) * barW
}
function barDownWidth(r) {
  return (Number(r.downloaded || 0) / maxSiteBytes.value) * barW
}
const barSvgHeight = computed(() => siteRows.value.length * (barH + barGap) + 10);
// 折线图几何
const maxTrendBytes = computed(() => {
  let m = 0;
  for (const p of trend.value) {
    m = Math.max(m, Number(p.uploaded || 0), Number(p.downloaded || 0));
  }
  return m || 1
});
function linePoints(field) {
  const n = trend.value.length;
  if (n === 0) return ''
  const plotW = lineW - linePadL - 10;
  const plotH = lineH - linePadB - 10;
  return trend.value
    .map((p, i) => {
      const x = linePadL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const y = 10 + plotH - (Number(p[field] || 0) / maxTrendBytes.value) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
const lineXLabels = computed(() => {
  const n = trend.value.length;
  if (n === 0) return []
  const plotW = lineW - linePadL - 10;
  // 最多显示 8 个刻度
  const step = Math.max(1, Math.ceil(n / 8));
  const out = [];
  for (let i = 0; i < n; i += step) {
    const x = linePadL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    out.push({ x: x.toFixed(1), label: (trend.value[i].label || '').slice(-5) });
  }
  return out
});

return (_ctx, _cache) => {
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VSelect = _resolveComponent("VSelect");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VDatePicker = _resolveComponent("VDatePicker");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VMenu = _resolveComponent("VMenu");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VToolbar = _resolveComponent("VToolbar");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VDataTable = _resolveComponent("VDataTable");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_VToolbar, {
      density: "comfortable",
      color: "transparent"
    }, {
      default: _withCtx(() => [
        _cache[8] || (_cache[8] = _createElementVNode("div", { class: "text-h6 ms-3" }, "下载器流量统计", -1)),
        _createVNode(_component_VSpacer),
        _createVNode(_component_VSelect, {
          modelValue: period.value,
          "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((period).value = $event)),
          items: [
          { title: '按日', value: 'day' },
          { title: '按月', value: 'month' },
          { title: '按年', value: 'year' },
        ],
          density: "compact",
          "hide-details": "",
          style: {"max-width":"110px"},
          variant: "outlined"
        }, null, 8, ["modelValue"]),
        _createVNode(_component_VMenu, {
          modelValue: dateMenuOpen.value,
          "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((dateMenuOpen).value = $event)),
          "close-on-content-click": false,
          location: "bottom start",
          "min-width": "320",
          class: "ms-2"
        }, {
          activator: _withCtx(({ props: menuProps }) => [
            _createVNode(_component_VTextField, _mergeProps({
              modelValue: value.value,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((value).value = $event)),
              placeholder: valuePlaceholder.value,
              density: "compact",
              "hide-details": "",
              style: {"max-width":"170px","min-width":"150px"},
              variant: "outlined",
              readonly: "",
              "append-inner-icon": "mdi-calendar"
            }, menuProps), null, 16, ["modelValue", "placeholder"])
          ]),
          default: _withCtx(() => [
            _createVNode(_component_VCard, {
              class: "pa-0",
              variant: "flat"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_VDatePicker, {
                  modelValue: pickerDate.value,
                  "onUpdate:modelValue": [
                    _cache[2] || (_cache[2] = $event => ((pickerDate).value = $event)),
                    onPickerUpdate
                  ],
                  "view-mode": pickerViewMode.value,
                  title: period.value === 'year' ? '选择年份' : period.value === 'month' ? '选择月份' : '选择日期',
                  "show-adjacent-months": "",
                  color: "primary",
                  "onUpdate:year": onPickerYearUpdate,
                  "onUpdate:month": onPickerMonthUpdate
                }, null, 8, ["modelValue", "view-mode", "title"])
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["modelValue"]),
        _createVNode(_component_VTextField, {
          modelValue: downloader.value,
          "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((downloader).value = $event)),
          placeholder: "下载器(可选)",
          density: "compact",
          "hide-details": "",
          style: {"max-width":"150px"},
          variant: "outlined",
          class: "ms-2"
        }, null, 8, ["modelValue"]),
        _createVNode(_component_VBtn, {
          icon: "mdi-refresh",
          variant: "text",
          loading: loading.value,
          class: "ms-2",
          onClick: load
        }, null, 8, ["loading"]),
        _createVNode(_component_VBtn, {
          color: "primary",
          variant: "tonal",
          density: "comfortable",
          loading: collectBusy.value,
          class: "ms-2",
          onClick: doCollect
        }, {
          default: _withCtx(() => [...(_cache[6] || (_cache[6] = [
            _createTextVNode("立即采集", -1)
          ]))]),
          _: 1
        }, 8, ["loading"]),
        _createVNode(_component_VBtn, {
          color: "warning",
          variant: "tonal",
          density: "comfortable",
          loading: resetBusy.value,
          class: "ms-2",
          onClick: doReset
        }, {
          default: _withCtx(() => [...(_cache[7] || (_cache[7] = [
            _createTextVNode("解除限速", -1)
          ]))]),
          _: 1
        }, 8, ["loading"]),
        _createVNode(_component_VBtn, {
          icon: "mdi-close",
          variant: "text",
          onClick: _cache[5] || (_cache[5] = $event => (emit('close')))
        })
      ]),
      _: 1
    }),
    _createVNode(_component_VDivider),
    (actionMsg.value)
      ? (_openBlock(), _createElementBlock("div", _hoisted_2, [
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
    (error.value)
      ? (_openBlock(), _createElementBlock("div", _hoisted_3, _toDisplayString(error.value), 1))
      : _createCommentVNode("", true),
    _createElementVNode("div", _hoisted_4, [
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "green",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[9] || (_cache[9] = _createElementVNode("div", { class: "text-caption" }, "上传流量", -1)),
          _createElementVNode("div", _hoisted_5, _toDisplayString(fmtBytes(totalUp.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "blue",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[10] || (_cache[10] = _createElementVNode("div", { class: "text-caption" }, "下载流量", -1)),
          _createElementVNode("div", _hoisted_6, _toDisplayString(fmtBytes(totalDown.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[11] || (_cache[11] = _createElementVNode("div", { class: "text-caption" }, "分享率", -1)),
          _createElementVNode("div", _hoisted_7, _toDisplayString(totalDown.value > 0 ? (totalUp.value / totalDown.value).toFixed(2) : '—'), 1)
        ]),
        _: 1
      })
    ]),
    _createVNode(_component_VCard, {
      class: "dt-section",
      title: "按 PT 站点细分"
    }, {
      text: _withCtx(() => [
        (siteRows.value.length === 0)
          ? (_openBlock(), _createElementBlock("div", _hoisted_8, "暂无数据"))
          : (_openBlock(), _createElementBlock("svg", {
              key: 1,
              width: barLabelW + barW + 170,
              height: barSvgHeight.value,
              class: "dt-bars"
            }, [
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(siteRows.value, (r, i) => {
                return (_openBlock(), _createElementBlock("g", {
                  key: r.site
                }, [
                  _createElementVNode("text", {
                    x: 0,
                    y: i * (barH + barGap) + barH,
                    class: "dt-bar-label"
                  }, _toDisplayString(r.site), 9, _hoisted_10),
                  _createElementVNode("rect", {
                    x: barLabelW,
                    y: i * (barH + barGap) + 2,
                    width: Math.max(1, barUpWidth(r)),
                    height: barH / 2 - 2,
                    fill: "#4caf50",
                    rx: "2"
                  }, null, 8, _hoisted_11),
                  _createElementVNode("text", {
                    x: barLabelW + barW + 8,
                    y: i * (barH + barGap) + barH / 2,
                    class: "dt-bar-val"
                  }, "↑ " + _toDisplayString(fmtBytes(r.uploaded)), 9, _hoisted_12),
                  _createElementVNode("rect", {
                    x: barLabelW,
                    y: i * (barH + barGap) + barH / 2 + 2,
                    width: Math.max(1, barDownWidth(r)),
                    height: barH / 2 - 2,
                    fill: "#2196f3",
                    rx: "2"
                  }, null, 8, _hoisted_13),
                  _createElementVNode("text", {
                    x: barLabelW + barW + 8,
                    y: i * (barH + barGap) + barH + 2,
                    class: "dt-bar-val"
                  }, "↓ " + _toDisplayString(fmtBytes(r.downloaded)), 9, _hoisted_14)
                ]))
              }), 128))
            ], 8, _hoisted_9))
      ]),
      _: 1
    }),
    _createVNode(_component_VCard, {
      class: "dt-section",
      title: `时间趋势（${period.value === 'year' ? '逐月' : '逐日'}）`
    }, {
      text: _withCtx(() => [
        (trend.value.length === 0)
          ? (_openBlock(), _createElementBlock("div", _hoisted_15, "暂无数据"))
          : (_openBlock(), _createElementBlock("svg", {
              key: 1,
              width: lineW,
              height: lineH,
              class: "dt-line"
            }, [
              _createElementVNode("line", {
                x1: linePadL,
                y1: 10,
                x2: lineW - 10,
                y2: 10,
                stroke: "#eee"
              }, null, 8, _hoisted_16),
              _createElementVNode("line", {
                x1: linePadL,
                y1: lineH - linePadB,
                x2: lineW - 10,
                y2: lineH - linePadB,
                stroke: "#ccc"
              }, null, 8, _hoisted_17),
              _createElementVNode("text", _hoisted_18, _toDisplayString(fmtBytes(maxTrendBytes.value)), 1),
              _createElementVNode("text", {
                x: 4,
                y: lineH - linePadB,
                class: "dt-axis"
              }, "0", 8, _hoisted_19),
              _createElementVNode("polyline", {
                points: linePoints('uploaded'),
                fill: "none",
                stroke: "#4caf50",
                "stroke-width": "2"
              }, null, 8, _hoisted_20),
              _createElementVNode("polyline", {
                points: linePoints('downloaded'),
                fill: "none",
                stroke: "#2196f3",
                "stroke-width": "2"
              }, null, 8, _hoisted_21),
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(lineXLabels.value, (t, i) => {
                return (_openBlock(), _createElementBlock("text", {
                  key: i,
                  x: t.x,
                  y: lineH - linePadB + 16,
                  class: "dt-axis",
                  "text-anchor": "middle"
                }, _toDisplayString(t.label), 9, _hoisted_22))
              }), 128))
            ])),
        _cache[12] || (_cache[12] = _createElementVNode("div", { class: "dt-legend" }, [
          _createElementVNode("span", {
            class: "dt-dot",
            style: {"background":"#4caf50"}
          }),
          _createTextVNode(" 上传 "),
          _createElementVNode("span", {
            class: "dt-dot",
            style: {"background":"#2196f3"}
          }),
          _createTextVNode(" 下载 ")
        ], -1))
      ]),
      _: 1
    }, 8, ["title"]),
    _createVNode(_component_VCard, {
      class: "dt-section",
      title: "明细数据"
    }, {
      text: _withCtx(() => [
        _createVNode(_component_VDataTable, {
          items: records.value,
          "items-per-page": 15,
          density: "compact",
          "hide-default-footer": "",
          headers: [
            { title: '站点', key: 'site' },
            { title: '下载器', key: 'downloader' },
            { title: '上传', key: 'uploaded', align: 'end' },
            { title: '下载', key: 'downloaded', align: 'end' },
          ]
        }, {
          "item.uploaded": _withCtx(({ item }) => [
            _createElementVNode("span", _hoisted_23, _toDisplayString(fmtBytes(item.uploaded)), 1)
          ]),
          "item.downloaded": _withCtx(({ item }) => [
            _createElementVNode("span", _hoisted_24, _toDisplayString(fmtBytes(item.downloaded)), 1)
          ]),
          _: 1
        }, 8, ["items"])
      ]),
      _: 1
    })
  ]))
}
}

};
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-587a0e7c"]]);

export { Page as default };
