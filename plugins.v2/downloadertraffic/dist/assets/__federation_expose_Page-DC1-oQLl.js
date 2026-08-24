import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const {resolveComponent:_resolveComponent$1,mergeProps:_mergeProps,createVNode:_createVNode$1,openBlock:_openBlock$2,createElementBlock:_createElementBlock$2,createCommentVNode:_createCommentVNode$2,createElementVNode:_createElementVNode$2,toDisplayString:_toDisplayString$2,unref:_unref,createTextVNode:_createTextVNode$1,Fragment:_Fragment$2,renderList:_renderList$2,normalizeClass:_normalizeClass,withCtx:_withCtx$1,createBlock:_createBlock} = await importShared('vue');


const _hoisted_1$2 = { class: "dt-cal-head" };
const _hoisted_2$2 = { class: "dt-cal-head-label" };
const _hoisted_3$2 = { key: 0 };
const _hoisted_4$2 = { key: 1 };
const _hoisted_5$2 = { key: 2 };
const _hoisted_6$2 = { class: "dt-cal-head-value" };
const _hoisted_7$2 = { class: "dt-cal-toolbar d-flex align-center justify-space-between pa-2" };
const _hoisted_8$2 = { class: "dt-cal-toolbar-title" };
const _hoisted_9$2 = {
  key: 0,
  class: "px-2 pb-2"
};
const _hoisted_10$2 = { class: "dt-wday-row" };
const _hoisted_11$2 = { class: "dt-grid" };
const _hoisted_12$2 = ["onClick"];
const _hoisted_13$2 = {
  key: 1,
  class: "px-3 pb-3"
};
const _hoisted_14$2 = { class: "dt-m-grid" };
const _hoisted_15$1 = ["onClick"];
const _hoisted_16$1 = {
  key: 2,
  class: "px-3 pb-3"
};
const _hoisted_17$1 = { class: "dt-m-grid" };
const _hoisted_18$1 = ["onClick"];
const _hoisted_19$1 = { class: "d-flex justify-end ga-1 px-2 pb-2" };

const {ref: ref$1,computed: computed$2,watch: watch$1} = await importShared('vue');


// 自研中文日期/月/年选择面板（不依赖 Vuetify 内部本地化 / locale / date adapter）
// mode: day | month | year；modelValue 为 'YYYY-MM-DD' / 'YYYY-MM' / 'YYYY'

const _sfc_main$2 = {
  __name: 'CalendarPanel',
  props: {
  mode: { type: String, default: 'day' },
  modelValue: { type: String, default: '' },
},
  emits: ['update:modelValue', 'close'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

const menuOpen = ref$1(false);
const selYear = ref$1(new Date().getFullYear());
const selMonth = ref$1(new Date().getMonth() + 1); // 1..12
const yearPageBase = ref$1(new Date().getFullYear() - 5);

function pad2(n) { return String(n).padStart(2, '0') }
function defaultValue() {
  const d = new Date();
  if (props.mode === 'year') return String(d.getFullYear())
  if (props.mode === 'month') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function syncFromValue() {
  const v = props.modelValue || defaultValue();
  const ym = String(v).match(/(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (ym) {
    selYear.value = Number(ym[1]);
    if (ym[2]) selMonth.value = Number(ym[2]);
  }
}
watch$1(() => props.modelValue, syncFromValue, { immediate: true });

const valueDisplay = computed$2(() => {
  const v = props.modelValue;
  if (!v) return ''
  if (props.mode === 'day') return String(v).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1 年 $2 月 $3 日')
  if (props.mode === 'month') return String(v).replace(/^(\d{4})-(\d{2})$/, '$1 年 $2 月')
  return `${v} 年`
});
const valuePlaceholder = computed$2(() => {
  if (props.mode === 'year') return '请选择年份'
  if (props.mode === 'month') return '请选择月份'
  return '请选择日期'
});
const pickerHeaderTitle = computed$2(() => {
  if (props.mode === 'day') return `${selYear.value} 年 ${selMonth.value} 月`
  if (props.mode === 'month') return `${selYear.value} 年`
  return `${yearPageBase.value} — ${yearPageBase.value + 11} 年`
});

function buildMonthGrid(y, m) {
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
const grid = computed$2(() => buildMonthGrid(selYear.value, selMonth.value));
const yearGrid = computed$2(() => {
  const out = [];
  for (let i = 0; i < 12; i++) out.push(yearPageBase.value + i);
  return out
});

const today = new Date();
const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
function cellKey(g) { return `${g.y}-${pad2(g.m)}-${pad2(g.d)}` }
function isSelectedDay(g) { return props.mode === 'day' && props.modelValue === cellKey(g) }
function isToday(g) { return cellKey(g) === todayKey }

function headerLeft() {
  if (props.mode === 'day') {
    selMonth.value--;
    if (selMonth.value < 1) { selMonth.value = 12; selYear.value--; }
  } else if (props.mode === 'month') {
    selYear.value--;
  } else {
    yearPageBase.value -= 12;
  }
}
function headerRight() {
  if (props.mode === 'day') {
    selMonth.value++;
    if (selMonth.value > 12) { selMonth.value = 1; selYear.value++; }
  } else if (props.mode === 'month') {
    selYear.value++;
  } else {
    yearPageBase.value += 12;
  }
}
function pick(v) {
  emit('update:modelValue', v);
  menuOpen.value = false;
  emit('close');
}
function goToday() {
  const d = new Date();
  selYear.value = d.getFullYear();
  selMonth.value = d.getMonth() + 1;
  yearPageBase.value = d.getFullYear() - 5;
  if (props.mode === 'day') pick(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  else if (props.mode === 'month') pick(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  else pick(String(d.getFullYear()));
}
function pickDay(g) {
  selYear.value = g.y; selMonth.value = g.m;
  pick(`${g.y}-${pad2(g.m)}-${pad2(g.d)}`);
}
function pickMonth(mi) {
  pick(`${selYear.value}-${pad2(mi)}`);
}
function pickYear(y) {
  selYear.value = y;
  pick(String(y));
}

return (_ctx, _cache) => {
  const _component_VTextField = _resolveComponent$1("VTextField");
  const _component_VBtn = _resolveComponent$1("VBtn");
  const _component_VCard = _resolveComponent$1("VCard");
  const _component_VMenu = _resolveComponent$1("VMenu");

  return (_openBlock$2(), _createBlock(_component_VMenu, {
    modelValue: menuOpen.value,
    "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((menuOpen).value = $event)),
    location: "bottom start",
    "close-on-content-click": false,
    "min-width": "320"
  }, {
    activator: _withCtx$1(({ props: menuProps }) => [
      _createVNode$1(_component_VTextField, _mergeProps({
        "model-value": valueDisplay.value || __props.modelValue,
        readonly: "",
        density: "compact",
        "hide-details": "",
        style: {"max-width":"260px","min-width":"210px"},
        variant: "outlined",
        placeholder: valuePlaceholder.value,
        "append-inner-icon": "mdi-calendar"
      }, menuProps), null, 16, ["model-value", "placeholder"])
    ]),
    default: _withCtx$1(() => [
      _createVNode$1(_component_VCard, {
        class: "dt-calendar-card",
        variant: "elevated"
      }, {
        default: _withCtx$1(() => [
          _createElementVNode$2("div", _hoisted_1$2, [
            _createElementVNode$2("div", _hoisted_2$2, [
              (__props.mode === 'year')
                ? (_openBlock$2(), _createElementBlock$2("span", _hoisted_3$2, "选择年份"))
                : (__props.mode === 'month')
                  ? (_openBlock$2(), _createElementBlock$2("span", _hoisted_4$2, "选择月份"))
                  : (_openBlock$2(), _createElementBlock$2("span", _hoisted_5$2, "选择日期"))
            ]),
            _createElementVNode$2("div", _hoisted_6$2, [
              (__props.mode === 'day')
                ? (_openBlock$2(), _createElementBlock$2(_Fragment$2, { key: 0 }, [
                    _createTextVNode$1(_toDisplayString$2(selYear.value) + " 年 " + _toDisplayString$2(selMonth.value) + " 月 " + _toDisplayString$2(__props.modelValue?.slice(-2)?.replace(/^-/, '') || _unref(today).getDate()) + " 日 ", 1)
                  ], 64))
                : (__props.mode === 'month')
                  ? (_openBlock$2(), _createElementBlock$2(_Fragment$2, { key: 1 }, [
                      _createTextVNode$1(_toDisplayString$2(selYear.value) + " 年 " + _toDisplayString$2(selMonth.value) + " 月 ", 1)
                    ], 64))
                  : (_openBlock$2(), _createElementBlock$2(_Fragment$2, { key: 2 }, [
                      _createTextVNode$1(_toDisplayString$2(__props.modelValue || selYear.value) + " 年 ", 1)
                    ], 64))
            ])
          ]),
          _createElementVNode$2("div", _hoisted_7$2, [
            _createVNode$1(_component_VBtn, {
              variant: "text",
              icon: "mdi-chevron-left",
              size: "small",
              onClick: headerLeft
            }),
            _createElementVNode$2("div", _hoisted_8$2, _toDisplayString$2(pickerHeaderTitle.value), 1),
            _createVNode$1(_component_VBtn, {
              variant: "text",
              icon: "mdi-chevron-right",
              size: "small",
              onClick: headerRight
            })
          ]),
          (__props.mode === 'day')
            ? (_openBlock$2(), _createElementBlock$2("div", _hoisted_9$2, [
                _createElementVNode$2("div", _hoisted_10$2, [
                  (_openBlock$2(), _createElementBlock$2(_Fragment$2, null, _renderList$2(WDAYS_ZH, (w, i) => {
                    return _createElementVNode$2("div", {
                      key: i,
                      class: "dt-wday"
                    }, _toDisplayString$2(w), 1)
                  }), 64))
                ]),
                _createElementVNode$2("div", _hoisted_11$2, [
                  (_openBlock$2(true), _createElementBlock$2(_Fragment$2, null, _renderList$2(grid.value, (g, idx) => {
                    return (_openBlock$2(), _createElementBlock$2("button", {
                      key: idx,
                      type: "button",
                      class: _normalizeClass(["dt-day", {
              'dt-day-out': !g.inMonth,
              'dt-day-today': isToday(g),
              'dt-day-selected': isSelectedDay(g),
            }]),
                      onClick: $event => (pickDay(g))
                    }, _toDisplayString$2(g.label), 11, _hoisted_12$2))
                  }), 128))
                ])
              ]))
            : (__props.mode === 'month')
              ? (_openBlock$2(), _createElementBlock$2("div", _hoisted_13$2, [
                  _createElementVNode$2("div", _hoisted_14$2, [
                    (_openBlock$2(), _createElementBlock$2(_Fragment$2, null, _renderList$2(MONTHS_ZH, (name, i) => {
                      return _createElementVNode$2("button", {
                        key: i,
                        type: "button",
                        class: _normalizeClass(["dt-m-btn", { 'dt-selected': selMonth.value === i + 1 && Number(String(__props.modelValue).slice(0, 4)) === selYear.value }]),
                        onClick: $event => (pickMonth(i + 1))
                      }, _toDisplayString$2(name), 11, _hoisted_15$1)
                    }), 64))
                  ])
                ]))
              : (_openBlock$2(), _createElementBlock$2("div", _hoisted_16$1, [
                  _createElementVNode$2("div", _hoisted_17$1, [
                    (_openBlock$2(true), _createElementBlock$2(_Fragment$2, null, _renderList$2(yearGrid.value, (y) => {
                      return (_openBlock$2(), _createElementBlock$2("button", {
                        key: y,
                        type: "button",
                        class: _normalizeClass(["dt-m-btn", { 'dt-selected': String(__props.modelValue) === String(y) }]),
                        onClick: $event => (pickYear(y))
                      }, _toDisplayString$2(y), 11, _hoisted_18$1))
                    }), 128))
                  ])
                ])),
          _createElementVNode$2("div", _hoisted_19$1, [
            _createVNode$1(_component_VBtn, {
              size: "small",
              variant: "text",
              onClick: goToday
            }, {
              default: _withCtx$1(() => [...(_cache[2] || (_cache[2] = [
                _createTextVNode$1("今天", -1)
              ]))]),
              _: 1
            }),
            _createVNode$1(_component_VBtn, {
              size: "small",
              variant: "text",
              onClick: _cache[0] || (_cache[0] = $event => (menuOpen.value = false))
            }, {
              default: _withCtx$1(() => [...(_cache[3] || (_cache[3] = [
                _createTextVNode$1("关闭", -1)
              ]))]),
              _: 1
            })
          ])
        ]),
        _: 1
      })
    ]),
    _: 1
  }, 8, ["modelValue"]))
}
}

};
const CalendarPanel = /*#__PURE__*/_export_sfc(_sfc_main$2, [['__scopeId',"data-v-5fe7de4e"]]);

const {toDisplayString:_toDisplayString$1,createElementVNode:_createElementVNode$1,openBlock:_openBlock$1,createElementBlock:_createElementBlock$1,createCommentVNode:_createCommentVNode$1,renderList:_renderList$1,Fragment:_Fragment$1,normalizeStyle:_normalizeStyle} = await importShared('vue');


const _hoisted_1$1 = { class: "pc-wrap" };
const _hoisted_2$1 = { class: "pc-head" };
const _hoisted_3$1 = { class: "pc-title" };
const _hoisted_4$1 = {
  key: 0,
  class: "pc-sub"
};
const _hoisted_5$1 = {
  key: 1,
  class: "pc-total"
};
const _hoisted_6$1 = {
  key: 0,
  class: "pc-empty"
};
const _hoisted_7$1 = {
  key: 1,
  class: "pc-body"
};
const _hoisted_8$1 = ["viewBox"];
const _hoisted_9$1 = ["d", "fill"];
const _hoisted_10$1 = ["x", "y"];
const _hoisted_11$1 = { class: "pc-legend" };
const _hoisted_12$1 = ["title"];
const _hoisted_13$1 = { class: "pc-val" };
const _hoisted_14$1 = { class: "pc-pct" };

const {computed: computed$1} = await importShared('vue');


// 纯 SVG 饼图（不依赖第三方图表库）：
// - items: [{label, value}]，内部按 value 从大到小排序
// - 只展示 value>0 的站点；图例展示 色块 + 站点名 + 数值 + 占比
const SIZE = 220;
const R = 100;


const _sfc_main$1 = {
  __name: 'PieChart',
  props: {
  items: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  emptyText: { type: String, default: '暂无数据' },
  loading: { type: Boolean, default: false },
},
  setup(__props) {

const props = __props;

const PALETTE = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#10b981', '#f43f5e',
  '#0ea5e9', '#d946ef', '#eab308', '#64748b', '#7c3aed',
];

const CX = SIZE / 2;
const CY = SIZE / 2;
const sorted = computed$1(() => {
  return props.items
    .map((it) => ({ label: String(it.label || ''), value: Number(it.value || 0) }))
    .filter((it) => it.value > 0)
    .sort((a, b) => b.value - a.value)
});
const total = computed$1(() => sorted.value.reduce((s, it) => s + it.value, 0));

const segments = computed$1(() => {
  const segs = [];
  let acc = 0;
  for (const it of sorted.value) {
    const a1 = (acc / total.value) * 2 * Math.PI;
    acc += it.value;
    const a2 = (acc / total.value) * 2 * Math.PI;
    segs.push({ ...it, a1, a2 });
  }
  return segs
});

function slicePath(s) {
  const x1 = CX + R * Math.sin(s.a1);
  const y1 = CY - R * Math.cos(s.a1);
  const x2 = CX + R * Math.sin(s.a2);
  const y2 = CY - R * Math.cos(s.a2);
  const large = s.a2 - s.a1 > Math.PI ? 1 : 0;
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}
function labelPos(s) {
  const mid = (s.a1 + s.a2) / 2;
  const lr = R * 0.62;
  return { x: CX + lr * Math.sin(mid), y: CY - lr * Math.cos(mid) }
}
// 扇区角度足够大才在扇区上标数值，避免小扇区文字重叠
function showLabel(s) {
  return s.a2 - s.a1 > 0.28
}
function pct(v) {
  return total.value ? (v / total.value) * 100 : 0
}
function fmtBytes(n) {
  const num = Number(n || 0);
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(2) + ' TB'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(2) + ' GB'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(2) + ' MB'
  if (num >= 1024) return (num / 1024).toFixed(2) + ' KB'
  return num + ' B'
}
// 扇区上的紧凑数值：47.1G / 39.4M 等
function fmtCompact(n) {
  const num = Number(n || 0);
  if (num >= 1024 ** 4) return (num / 1024 ** 4).toFixed(1) + 'T'
  if (num >= 1024 ** 3) return (num / 1024 ** 3).toFixed(1) + 'G'
  if (num >= 1024 ** 2) return (num / 1024 ** 2).toFixed(1) + 'M'
  if (num >= 1024) return (num / 1024).toFixed(1) + 'K'
  return num + 'B'
}

return (_ctx, _cache) => {
  return (_openBlock$1(), _createElementBlock$1("div", _hoisted_1$1, [
    _createElementVNode$1("div", _hoisted_2$1, [
      _createElementVNode$1("span", _hoisted_3$1, _toDisplayString$1(__props.title), 1),
      (__props.subtitle)
        ? (_openBlock$1(), _createElementBlock$1("span", _hoisted_4$1, _toDisplayString$1(__props.subtitle), 1))
        : _createCommentVNode$1("", true),
      (total.value > 0)
        ? (_openBlock$1(), _createElementBlock$1("span", _hoisted_5$1, "共 " + _toDisplayString$1(fmtBytes(total.value)), 1))
        : _createCommentVNode$1("", true)
    ]),
    (sorted.value.length === 0)
      ? (_openBlock$1(), _createElementBlock$1("div", _hoisted_6$1, _toDisplayString$1(__props.loading ? '加载中...' : __props.emptyText), 1))
      : (_openBlock$1(), _createElementBlock$1("div", _hoisted_7$1, [
          (_openBlock$1(), _createElementBlock$1("svg", {
            viewBox: `0 0 ${SIZE} ${SIZE}`,
            class: "pc-svg"
          }, [
            (_openBlock$1(true), _createElementBlock$1(_Fragment$1, null, _renderList$1(segments.value, (s, i) => {
              return (_openBlock$1(), _createElementBlock$1("g", { key: i }, [
                _createElementVNode$1("path", {
                  d: slicePath(s),
                  fill: PALETTE[i % PALETTE.length],
                  stroke: "#fff",
                  "stroke-width": "1.5"
                }, null, 8, _hoisted_9$1),
                (showLabel(s))
                  ? (_openBlock$1(), _createElementBlock$1("text", {
                      key: 0,
                      x: labelPos(s).x,
                      y: labelPos(s).y,
                      class: "pc-slice-label",
                      "text-anchor": "middle",
                      "dominant-baseline": "middle"
                    }, _toDisplayString$1(fmtCompact(s.value)), 9, _hoisted_10$1))
                  : _createCommentVNode$1("", true)
              ]))
            }), 128))
          ], 8, _hoisted_8$1)),
          _createElementVNode$1("div", _hoisted_11$1, [
            (_openBlock$1(true), _createElementBlock$1(_Fragment$1, null, _renderList$1(sorted.value, (s, i) => {
              return (_openBlock$1(), _createElementBlock$1("div", {
                key: i,
                class: "pc-legend-item"
              }, [
                _createElementVNode$1("span", {
                  class: "pc-dot",
                  style: _normalizeStyle({ background: PALETTE[i % PALETTE.length] })
                }, null, 4),
                _createElementVNode$1("span", {
                  class: "pc-name",
                  title: s.label
                }, _toDisplayString$1(s.label), 9, _hoisted_12$1),
                _createElementVNode$1("span", _hoisted_13$1, _toDisplayString$1(fmtBytes(s.value)), 1),
                _createElementVNode$1("span", _hoisted_14$1, _toDisplayString$1(pct(s.value).toFixed(1)) + "%", 1)
              ]))
            }), 128))
          ])
        ]))
  ]))
}
}

};
const PieChart = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-410787de"]]);

const {createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,createTextVNode:_createTextVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment} = await importShared('vue');


const _hoisted_1 = { class: "dt-page" };
const _hoisted_2 = { class: "ms-2" };
const _hoisted_3 = {
  key: 0,
  class: "pa-3"
};
const _hoisted_4 = {
  key: 1,
  class: "text-error pa-3"
};
const _hoisted_5 = { class: "dt-cards" };
const _hoisted_6 = { class: "text-h6" };
const _hoisted_7 = { class: "text-h6" };
const _hoisted_8 = { class: "text-h6" };
const _hoisted_9 = { class: "dt-pies" };
const _hoisted_10 = { class: "dt-pie-head" };
const _hoisted_11 = { class: "dt-pie-head" };
const _hoisted_12 = {
  key: 0,
  class: "text-medium-emphasis"
};
const _hoisted_13 = ["x2"];
const _hoisted_14 = ["y1", "x2", "y2"];
const _hoisted_15 = {
  x: 4,
  y: 16,
  class: "dt-axis"
};
const _hoisted_16 = ["y"];
const _hoisted_17 = ["points"];
const _hoisted_18 = ["points"];
const _hoisted_19 = ["x", "y"];
const _hoisted_20 = { style: {"color":"#4caf50"} };
const _hoisted_21 = { style: {"color":"#2196f3"} };

const {ref,computed,onMounted,watch,nextTick} = await importShared('vue');
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
onMounted(() => {
  pieMonth.value = defaultMonth();
  pieDay.value = defaultDay();
  load();
  loadMonthPie();
  loadDayPie();
});
watch(period, () => {
  value.value = defaultValue();
  nextTick(load);
});

// ============================================================
// 上传流量饼图：左=按月（默认当前月），右=按日（默认今日），仅统计上传
// ============================================================
const pieMonth = ref('');
const pieDay = ref('');
const monthPie = ref([]); // [{label, value}]
const dayPie = ref([]);
const monthPieLoading = ref(false);
const dayPieLoading = ref(false);

function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}
function defaultDay() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function aggregateBySite(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (!r || r.site === 'GLOBAL') continue
    map.set(r.site, (map.get(r.site) || 0) + Number(r.uploaded || 0));
  }
  return Array.from(map, ([label, value]) => ({ label, value }))
}
async function loadMonthPie() {
  monthPieLoading.value = true;
  try {
    const r = await props.api.get(`${base.value}/records?period=month&value=${pieMonth.value}`);
    const rec = unwrap(r) || {};
    monthPie.value = aggregateBySite(rec.data || []);
  } catch (e) {
    monthPie.value = [];
  } finally {
    monthPieLoading.value = false;
  }
}
async function loadDayPie() {
  dayPieLoading.value = true;
  try {
    const r = await props.api.get(`${base.value}/records?period=day&value=${pieDay.value}`);
    const rec = unwrap(r) || {};
    dayPie.value = aggregateBySite(rec.data || []);
  } catch (e) {
    dayPie.value = [];
  } finally {
    dayPieLoading.value = false;
  }
}

// ---------- 折线图（原逻辑未动）----------
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
  const _component_VToolbar = _resolveComponent("VToolbar");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VCard = _resolveComponent("VCard");
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
        _createElementVNode("div", _hoisted_2, [
          _createVNode(CalendarPanel, {
            modelValue: value.value,
            "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((value).value = $event)),
            mode: period.value,
            onClose: load
          }, null, 8, ["modelValue", "mode"])
        ]),
        _createVNode(_component_VTextField, {
          modelValue: downloader.value,
          "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((downloader).value = $event)),
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
          onClick: _cache[3] || (_cache[3] = $event => (emit('close')))
        })
      ]),
      _: 1
    }),
    _createVNode(_component_VDivider),
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
    (error.value)
      ? (_openBlock(), _createElementBlock("div", _hoisted_4, _toDisplayString(error.value), 1))
      : _createCommentVNode("", true),
    _createElementVNode("div", _hoisted_5, [
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "green",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[9] || (_cache[9] = _createElementVNode("div", { class: "text-caption" }, "上传流量", -1)),
          _createElementVNode("div", _hoisted_6, _toDisplayString(fmtBytes(totalUp.value)), 1)
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
          _createElementVNode("div", _hoisted_7, _toDisplayString(fmtBytes(totalDown.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[11] || (_cache[11] = _createElementVNode("div", { class: "text-caption" }, "分享率", -1)),
          _createElementVNode("div", _hoisted_8, _toDisplayString(totalDown.value > 0 ? (totalUp.value / totalDown.value).toFixed(2) : '—'), 1)
        ]),
        _: 1
      })
    ]),
    _createVNode(_component_VCard, {
      class: "dt-section",
      title: "上传流量分布（按月 / 按日）"
    }, {
      text: _withCtx(() => [
        _createElementVNode("div", _hoisted_9, [
          _createVNode(_component_VCard, {
            variant: "tonal",
            class: "dt-pie-card"
          }, {
            default: _withCtx(() => [
              _createElementVNode("div", _hoisted_10, [
                _cache[12] || (_cache[12] = _createElementVNode("span", { class: "dt-pie-title" }, "本月上传", -1)),
                _createVNode(CalendarPanel, {
                  modelValue: pieMonth.value,
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((pieMonth).value = $event)),
                  mode: "month",
                  onClose: loadMonthPie
                }, null, 8, ["modelValue"])
              ]),
              _createVNode(PieChart, {
                items: monthPie.value,
                subtitle: pieMonth.value,
                loading: monthPieLoading.value
              }, null, 8, ["items", "subtitle", "loading"])
            ]),
            _: 1
          }),
          _createVNode(_component_VCard, {
            variant: "tonal",
            class: "dt-pie-card"
          }, {
            default: _withCtx(() => [
              _createElementVNode("div", _hoisted_11, [
                _cache[13] || (_cache[13] = _createElementVNode("span", { class: "dt-pie-title" }, "今日上传", -1)),
                _createVNode(CalendarPanel, {
                  modelValue: pieDay.value,
                  "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((pieDay).value = $event)),
                  mode: "day",
                  onClose: loadDayPie
                }, null, 8, ["modelValue"])
              ]),
              _createVNode(PieChart, {
                items: dayPie.value,
                subtitle: pieDay.value,
                loading: dayPieLoading.value
              }, null, 8, ["items", "subtitle", "loading"])
            ]),
            _: 1
          })
        ])
      ]),
      _: 1
    }),
    _createVNode(_component_VCard, {
      class: "dt-section",
      title: `时间趋势（${period.value === 'year' ? '逐月' : '逐日'}）`
    }, {
      text: _withCtx(() => [
        (trend.value.length === 0)
          ? (_openBlock(), _createElementBlock("div", _hoisted_12, "暂无数据"))
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
              }, null, 8, _hoisted_13),
              _createElementVNode("line", {
                x1: linePadL,
                y1: lineH - linePadB,
                x2: lineW - 10,
                y2: lineH - linePadB,
                stroke: "#ccc"
              }, null, 8, _hoisted_14),
              _createElementVNode("text", _hoisted_15, _toDisplayString(fmtBytes(maxTrendBytes.value)), 1),
              _createElementVNode("text", {
                x: 4,
                y: lineH - linePadB,
                class: "dt-axis"
              }, "0", 8, _hoisted_16),
              _createElementVNode("polyline", {
                points: linePoints('uploaded'),
                fill: "none",
                stroke: "#4caf50",
                "stroke-width": "2"
              }, null, 8, _hoisted_17),
              _createElementVNode("polyline", {
                points: linePoints('downloaded'),
                fill: "none",
                stroke: "#2196f3",
                "stroke-width": "2"
              }, null, 8, _hoisted_18),
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(lineXLabels.value, (t, i) => {
                return (_openBlock(), _createElementBlock("text", {
                  key: i,
                  x: t.x,
                  y: lineH - linePadB + 16,
                  class: "dt-axis",
                  "text-anchor": "middle"
                }, _toDisplayString(t.label), 9, _hoisted_19))
              }), 128))
            ])),
        _cache[14] || (_cache[14] = _createElementVNode("div", { class: "dt-legend" }, [
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
            _createElementVNode("span", _hoisted_20, _toDisplayString(fmtBytes(item.uploaded)), 1)
          ]),
          "item.downloaded": _withCtx(({ item }) => [
            _createElementVNode("span", _hoisted_21, _toDisplayString(fmtBytes(item.downloaded)), 1)
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
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-d241d328"]]);

export { Page as default };
