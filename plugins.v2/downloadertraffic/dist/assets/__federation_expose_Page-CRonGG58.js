import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const {createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,mergeProps:_mergeProps,openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode,toDisplayString:_toDisplayString,unref:_unref,createTextVNode:_createTextVNode,Fragment:_Fragment,renderList:_renderList,normalizeClass:_normalizeClass,withCtx:_withCtx} = await importShared('vue');


const _hoisted_1 = { class: "dt-page" };
const _hoisted_2 = { class: "dt-cal-head" };
const _hoisted_3 = { class: "dt-cal-head-label" };
const _hoisted_4 = { key: 0 };
const _hoisted_5 = { key: 1 };
const _hoisted_6 = { key: 2 };
const _hoisted_7 = { class: "dt-cal-head-value" };
const _hoisted_8 = { class: "dt-cal-toolbar d-flex align-center justify-space-between pa-2" };
const _hoisted_9 = { class: "dt-cal-toolbar-title" };
const _hoisted_10 = {
  key: 0,
  class: "px-2 pb-2"
};
const _hoisted_11 = { class: "dt-wday-row" };
const _hoisted_12 = { class: "dt-grid" };
const _hoisted_13 = ["onClick"];
const _hoisted_14 = {
  key: 1,
  class: "px-3 pb-3"
};
const _hoisted_15 = { class: "dt-m-grid" };
const _hoisted_16 = ["onClick"];
const _hoisted_17 = {
  key: 2,
  class: "px-3 pb-3"
};
const _hoisted_18 = { class: "dt-m-grid" };
const _hoisted_19 = ["onClick"];
const _hoisted_20 = { class: "d-flex justify-end ga-1 px-2 pb-2" };
const _hoisted_21 = {
  key: 0,
  class: "pa-3"
};
const _hoisted_22 = {
  key: 1,
  class: "text-error pa-3"
};
const _hoisted_23 = { class: "dt-cards" };
const _hoisted_24 = { class: "text-h6" };
const _hoisted_25 = { class: "text-h6" };
const _hoisted_26 = { class: "text-h6" };
const _hoisted_27 = {
  key: 0,
  class: "text-medium-emphasis"
};
const _hoisted_28 = ["width", "height"];
const _hoisted_29 = ["y"];
const _hoisted_30 = ["y", "width", "height"];
const _hoisted_31 = ["x", "y"];
const _hoisted_32 = ["y", "width", "height"];
const _hoisted_33 = ["x", "y"];
const _hoisted_34 = {
  key: 0,
  class: "text-medium-emphasis"
};
const _hoisted_35 = ["x2"];
const _hoisted_36 = ["y1", "x2", "y2"];
const _hoisted_37 = {
  x: 4,
  y: 16,
  class: "dt-axis"
};
const _hoisted_38 = ["y"];
const _hoisted_39 = ["points"];
const _hoisted_40 = ["points"];
const _hoisted_41 = ["x", "y"];
const _hoisted_42 = { style: {"color":"#4caf50"} };
const _hoisted_43 = { style: {"color":"#2196f3"} };

const {ref,computed,onMounted,watch,nextTick} = await importShared('vue');

const barW = 360, barH = 26, barGap = 14, barLabelW = 120;
const lineW = 640, lineH = 220, linePadL = 48, linePadB = 28;

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
// 后端 API 路由由 MoviePilot 以「插件类名 DownloaderTraffic」为前缀注册；
// 这里固定使用类名，兼容宿主传入小写文件夹名 / 未传 pluginId 的情况。
const pid = computed(() => {
  const v = props.pluginId;
  return v && v !== 'downloadertraffic' ? v : 'DownloaderTraffic'
});
const base = computed(() => `plugin/${pid.value}`);

// 立即采集 / 解除限速
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
function pad2(n) { return String(n).padStart(2, '0') }
function defaultValue() {
  const d = new Date();
  if (period.value === 'year') return String(d.getFullYear())
  if (period.value === 'month') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
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
watch(period, () => {
  value.value = defaultValue();
  nextTick(load);
});

// ============================================================
// 自研日期 / 月 / 年选择面板（v1.4.2 起不再依赖 Vuetify 内部本地化）
// ============================================================
// 关键点：
// - 完全自己拼中文，不依赖 Vuetify 实例的 locale / date adapter / 宿主的 zh 语言包。
// - 面板与 period 联动：period=day 只看日面板；period=month 只看月面板；period=year 只看年面板。
// - 点击后立刻写 value、关面板、刷新。
const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

const dateMenuOpen = ref(false);
const selYear = ref(new Date().getFullYear());
const selMonth = ref(new Date().getMonth() + 1); // 1..12
// 选月/选年模式时，也保留展示的「当前月」与「当前年」
function syncFromValue() {
  const v = value.value || defaultValue();
  const ym = String(v).match(/(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (ym) {
    selYear.value = Number(ym[1]);
    if (ym[2]) selMonth.value = Number(ym[2]);
  }
}
watch(value, syncFromValue, { immediate: true });

// 日历网格（按日面板用）
function buildMonthGrid(y, m) {
  // 返回 42 格（6 周）；每格 {y,m,d,inMonth,label}
  const first = new Date(y, m - 1, 1);
  const startOffset = first.getDay(); // 周日=0
  const grid = [];
  const from = new Date(y, m - 1, 1 - startOffset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    grid.push({
      y: d.getFullYear(),
      m: d.getMonth() + 1,
      d: d.getDate(),
      inMonth: d.getFullYear() === y && (d.getMonth() + 1) === m,
      label: d.getDate(),
    });
  }
  return grid
}
const grid = computed(() => buildMonthGrid(selYear.value, selMonth.value));

// 年面板：当前年前后 11 年，共 12 格；点标题栏左右翻 12 年
const yearPageBase = ref(new Date().getFullYear() - 5); // 第一个显示的年份
const yearGrid = computed(() => {
  const out = [];
  for (let i = 0; i < 12; i++) out.push(yearPageBase.value + i);
  return out
});

// 今日高亮
const today = new Date();
const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
function cellKey(g) { return `${g.y}-${pad2(g.m)}-${pad2(g.d)}` }
function isSelectedDay(g) {
  if (period.value !== 'day') return false
  return value.value === cellKey(g)
}
function isToday(g) { return cellKey(g) === todayKey }

// 显示用：当前输入框的中文语义化显示（仅用于 placeholder，绑定值仍是原始 YYYY...）
const valueDisplay = computed(() => {
  if (!value.value) return ''
  if (period.value === 'day') return value.value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1 年 $2 月 $3 日')
  if (period.value === 'month') return value.value.replace(/^(\d{4})-(\d{2})$/, '$1 年 $2 月')
  return `${value.value} 年`
});
const valuePlaceholder = computed(() => {
  if (period.value === 'year') return '请选择年份'
  if (period.value === 'month') return '请选择月份'
  return '请选择日期'
});
const pickerHeaderTitle = computed(() => {
  if (period.value === 'day') return `${selYear.value} 年 ${selMonth.value} 月`
  if (period.value === 'month') return `${selYear.value} 年`
  return `${yearPageBase.value} — ${yearPageBase.value + 11} 年`
});
function headerLeft() {
  if (period.value === 'day') {
    selMonth.value--;
    if (selMonth.value < 1) { selMonth.value = 12; selYear.value--; }
  } else if (period.value === 'month') {
    selYear.value--;
  } else {
    yearPageBase.value -= 12;
  }
}
function headerRight() {
  if (period.value === 'day') {
    selMonth.value++;
    if (selMonth.value > 12) { selMonth.value = 1; selYear.value++; }
  } else if (period.value === 'month') {
    selYear.value++;
  } else {
    yearPageBase.value += 12;
  }
}
function goToday() {
  selYear.value = today.getFullYear();
  selMonth.value = today.getMonth() + 1;
  yearPageBase.value = today.getFullYear() - 5;
  if (period.value === 'day') {
    value.value = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    dateMenuOpen.value = false;
    load();
  }
}
function pickDay(g) {
  selYear.value = g.y; selMonth.value = g.m;
  value.value = `${g.y}-${pad2(g.m)}-${pad2(g.d)}`;
  dateMenuOpen.value = false;
  load();
}
function pickMonth(mi /*1..12*/) {
  value.value = `${selYear.value}-${pad2(mi)}`;
  dateMenuOpen.value = false;
  load();
}
function pickYear(y) {
  selYear.value = y;
  value.value = String(y);
  dateMenuOpen.value = false;
  load();
}

// ---------- 柱状图 / 折线图（原逻辑未动）----------
const siteRows = computed(() => records.value.filter((r) => r.site !== 'GLOBAL'));
const maxSiteBytes = computed(() => {
  let m = 0;
  for (const r of siteRows.value) {
    m = Math.max(m, Number(r.uploaded || 0), Number(r.downloaded || 0));
  }
  return m || 1
});
function barUpWidth(r) { return (Number(r.uploaded || 0) / maxSiteBytes.value) * barW }
function barDownWidth(r) { return (Number(r.downloaded || 0) / maxSiteBytes.value) * barW }
const barSvgHeight = computed(() => Math.max(60, siteRows.value.length * (barH + barGap) + 10));

const maxTrendBytes = computed(() => {
  let m = 0;
  for (const p of trend.value) m = Math.max(m, Number(p.uploaded || 0), Number(p.downloaded || 0));
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
    }).join(' ')
}
const lineXLabels = computed(() => {
  const n = trend.value.length;
  if (n === 0) return []
  const plotW = lineW - linePadL - 10;
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
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VMenu = _resolveComponent("VMenu");
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
        _cache[9] || (_cache[9] = _createElementVNode("div", { class: "text-h6 ms-3" }, "下载器流量统计", -1)),
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
          "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((dateMenuOpen).value = $event)),
          location: "bottom start",
          "close-on-content-click": false,
          "min-width": "320",
          class: "ms-2"
        }, {
          activator: _withCtx(({ props: menuProps }) => [
            _createVNode(_component_VTextField, _mergeProps({
              "model-value": valueDisplay.value || value.value,
              readonly: "",
              density: "compact",
              "hide-details": "",
              style: {"max-width":"260px","min-width":"210px"},
              variant: "outlined",
              placeholder: valuePlaceholder.value,
              "append-inner-icon": "mdi-calendar"
            }, menuProps), null, 16, ["model-value", "placeholder"])
          ]),
          default: _withCtx(() => [
            _createVNode(_component_VCard, {
              class: "dt-calendar-card",
              variant: "elevated"
            }, {
              default: _withCtx(() => [
                _createElementVNode("div", _hoisted_2, [
                  _createElementVNode("div", _hoisted_3, [
                    (period.value === 'year')
                      ? (_openBlock(), _createElementBlock("span", _hoisted_4, "选择年份"))
                      : (period.value === 'month')
                        ? (_openBlock(), _createElementBlock("span", _hoisted_5, "选择月份"))
                        : (_openBlock(), _createElementBlock("span", _hoisted_6, "选择日期"))
                  ]),
                  _createElementVNode("div", _hoisted_7, [
                    (period.value === 'day')
                      ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                          _createTextVNode(_toDisplayString(selYear.value) + " 年 " + _toDisplayString(selMonth.value) + " 月 " + _toDisplayString(value.value?.slice(-2)?.replace(/^-/, '') || _unref(today).getDate()) + " 日 ", 1)
                        ], 64))
                      : (period.value === 'month')
                        ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                            _createTextVNode(_toDisplayString(selYear.value) + " 年 " + _toDisplayString(selMonth.value) + " 月 ", 1)
                          ], 64))
                        : (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                            _createTextVNode(_toDisplayString(value.value || selYear.value) + " 年 ", 1)
                          ], 64))
                  ])
                ]),
                _createElementVNode("div", _hoisted_8, [
                  _createVNode(_component_VBtn, {
                    variant: "text",
                    icon: "mdi-chevron-left",
                    size: "small",
                    onClick: headerLeft
                  }),
                  _createElementVNode("div", _hoisted_9, _toDisplayString(pickerHeaderTitle.value), 1),
                  _createVNode(_component_VBtn, {
                    variant: "text",
                    icon: "mdi-chevron-right",
                    size: "small",
                    onClick: headerRight
                  })
                ]),
                (period.value === 'day')
                  ? (_openBlock(), _createElementBlock("div", _hoisted_10, [
                      _createElementVNode("div", _hoisted_11, [
                        (_openBlock(), _createElementBlock(_Fragment, null, _renderList(WDAYS_ZH, (w, i) => {
                          return _createElementVNode("div", {
                            key: i,
                            class: "dt-wday"
                          }, _toDisplayString(w), 1)
                        }), 64))
                      ]),
                      _createElementVNode("div", _hoisted_12, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(grid.value, (g, idx) => {
                          return (_openBlock(), _createElementBlock("button", {
                            key: idx,
                            type: "button",
                            class: _normalizeClass(["dt-day", {
                  'dt-day-out': !g.inMonth,
                  'dt-day-today': isToday(g),
                  'dt-day-selected': isSelectedDay(g),
                }]),
                            onClick: $event => (pickDay(g))
                          }, _toDisplayString(g.label), 11, _hoisted_13))
                        }), 128))
                      ])
                    ]))
                  : (period.value === 'month')
                    ? (_openBlock(), _createElementBlock("div", _hoisted_14, [
                        _createElementVNode("div", _hoisted_15, [
                          (_openBlock(), _createElementBlock(_Fragment, null, _renderList(MONTHS_ZH, (name, i) => {
                            return _createElementVNode("button", {
                              key: i,
                              type: "button",
                              class: _normalizeClass(["dt-m-btn", { 'dt-selected': selMonth.value === i + 1 && Number(String(value.value).slice(0,4)) === selYear.value }]),
                              onClick: $event => (pickMonth(i + 1))
                            }, _toDisplayString(name), 11, _hoisted_16)
                          }), 64))
                        ])
                      ]))
                    : (_openBlock(), _createElementBlock("div", _hoisted_17, [
                        _createElementVNode("div", _hoisted_18, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(yearGrid.value, (y) => {
                            return (_openBlock(), _createElementBlock("button", {
                              key: y,
                              type: "button",
                              class: _normalizeClass(["dt-m-btn", { 'dt-selected': String(value.value) === String(y) }]),
                              onClick: $event => (pickYear(y))
                            }, _toDisplayString(y), 11, _hoisted_19))
                          }), 128))
                        ])
                      ])),
                _createElementVNode("div", _hoisted_20, [
                  _createVNode(_component_VBtn, {
                    size: "small",
                    variant: "text",
                    onClick: goToday
                  }, {
                    default: _withCtx(() => [...(_cache[5] || (_cache[5] = [
                      _createTextVNode("今天", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VBtn, {
                    size: "small",
                    variant: "text",
                    onClick: _cache[1] || (_cache[1] = $event => (dateMenuOpen.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[6] || (_cache[6] = [
                      _createTextVNode("关闭", -1)
                    ]))]),
                    _: 1
                  })
                ])
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["modelValue"]),
        _createVNode(_component_VTextField, {
          modelValue: downloader.value,
          "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((downloader).value = $event)),
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
          default: _withCtx(() => [...(_cache[7] || (_cache[7] = [
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
          default: _withCtx(() => [...(_cache[8] || (_cache[8] = [
            _createTextVNode("解除限速", -1)
          ]))]),
          _: 1
        }, 8, ["loading"]),
        _createVNode(_component_VBtn, {
          icon: "mdi-close",
          variant: "text",
          onClick: _cache[4] || (_cache[4] = $event => (emit('close')))
        })
      ]),
      _: 1
    }),
    _createVNode(_component_VDivider),
    (actionMsg.value)
      ? (_openBlock(), _createElementBlock("div", _hoisted_21, [
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
      ? (_openBlock(), _createElementBlock("div", _hoisted_22, _toDisplayString(error.value), 1))
      : _createCommentVNode("", true),
    _createElementVNode("div", _hoisted_23, [
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "green",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[10] || (_cache[10] = _createElementVNode("div", { class: "text-caption" }, "上传流量", -1)),
          _createElementVNode("div", _hoisted_24, _toDisplayString(fmtBytes(totalUp.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "blue",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[11] || (_cache[11] = _createElementVNode("div", { class: "text-caption" }, "下载流量", -1)),
          _createElementVNode("div", _hoisted_25, _toDisplayString(fmtBytes(totalDown.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[12] || (_cache[12] = _createElementVNode("div", { class: "text-caption" }, "分享率", -1)),
          _createElementVNode("div", _hoisted_26, _toDisplayString(totalDown.value > 0 ? (totalUp.value / totalDown.value).toFixed(2) : '—'), 1)
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
          ? (_openBlock(), _createElementBlock("div", _hoisted_27, "暂无数据"))
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
                  }, _toDisplayString(r.site), 9, _hoisted_29),
                  _createElementVNode("rect", {
                    x: barLabelW,
                    y: i * (barH + barGap) + 2,
                    width: Math.max(1, barUpWidth(r)),
                    height: barH / 2 - 2,
                    fill: "#4caf50",
                    rx: "2"
                  }, null, 8, _hoisted_30),
                  _createElementVNode("text", {
                    x: barLabelW + barW + 8,
                    y: i * (barH + barGap) + barH / 2,
                    class: "dt-bar-val"
                  }, " ↑ " + _toDisplayString(fmtBytes(r.uploaded)), 9, _hoisted_31),
                  _createElementVNode("rect", {
                    x: barLabelW,
                    y: i * (barH + barGap) + barH / 2 + 2,
                    width: Math.max(1, barDownWidth(r)),
                    height: barH / 2 - 2,
                    fill: "#2196f3",
                    rx: "2"
                  }, null, 8, _hoisted_32),
                  _createElementVNode("text", {
                    x: barLabelW + barW + 8,
                    y: i * (barH + barGap) + barH + 2,
                    class: "dt-bar-val"
                  }, " ↓ " + _toDisplayString(fmtBytes(r.downloaded)), 9, _hoisted_33)
                ]))
              }), 128))
            ], 8, _hoisted_28))
      ]),
      _: 1
    }),
    _createVNode(_component_VCard, {
      class: "dt-section",
      title: `时间趋势（${period.value === 'year' ? '逐月' : '逐日'}）`
    }, {
      text: _withCtx(() => [
        (trend.value.length === 0)
          ? (_openBlock(), _createElementBlock("div", _hoisted_34, "暂无数据"))
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
              }, null, 8, _hoisted_35),
              _createElementVNode("line", {
                x1: linePadL,
                y1: lineH - linePadB,
                x2: lineW - 10,
                y2: lineH - linePadB,
                stroke: "#ccc"
              }, null, 8, _hoisted_36),
              _createElementVNode("text", _hoisted_37, _toDisplayString(fmtBytes(maxTrendBytes.value)), 1),
              _createElementVNode("text", {
                x: 4,
                y: lineH - linePadB,
                class: "dt-axis"
              }, "0", 8, _hoisted_38),
              _createElementVNode("polyline", {
                points: linePoints('uploaded'),
                fill: "none",
                stroke: "#4caf50",
                "stroke-width": "2"
              }, null, 8, _hoisted_39),
              _createElementVNode("polyline", {
                points: linePoints('downloaded'),
                fill: "none",
                stroke: "#2196f3",
                "stroke-width": "2"
              }, null, 8, _hoisted_40),
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(lineXLabels.value, (t, i) => {
                return (_openBlock(), _createElementBlock("text", {
                  key: i,
                  x: t.x,
                  y: lineH - linePadB + 16,
                  class: "dt-axis",
                  "text-anchor": "middle"
                }, _toDisplayString(t.label), 9, _hoisted_41))
              }), 128))
            ])),
        _cache[13] || (_cache[13] = _createElementVNode("div", { class: "dt-legend" }, [
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
            _createElementVNode("span", _hoisted_42, _toDisplayString(fmtBytes(item.uploaded)), 1)
          ]),
          "item.downloaded": _withCtx(({ item }) => [
            _createElementVNode("span", _hoisted_43, _toDisplayString(fmtBytes(item.downloaded)), 1)
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
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-8a4fb700"]]);

export { Page as default };
