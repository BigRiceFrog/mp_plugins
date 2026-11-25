import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { u as useNarrow } from './useNarrow-DoB6roQs.js';

const {resolveComponent:_resolveComponent$1,mergeProps:_mergeProps,createVNode:_createVNode$1,openBlock:_openBlock$2,createElementBlock:_createElementBlock$2,createCommentVNode:_createCommentVNode$2,createElementVNode:_createElementVNode$2,toDisplayString:_toDisplayString$2,unref:_unref$1,createTextVNode:_createTextVNode$1,Fragment:_Fragment$2,renderList:_renderList$2,normalizeClass:_normalizeClass$2,withCtx:_withCtx$1,createBlock:_createBlock$1} = await importShared('vue');


const _hoisted_1$2 = { class: "dt-cal-head" };
const _hoisted_2$2 = { class: "dt-cal-head-label" };
const _hoisted_3$2 = { key: 0 };
const _hoisted_4$2 = { key: 1 };
const _hoisted_5$2 = { key: 2 };
const _hoisted_6$2 = { class: "dt-cal-head-value" };
const _hoisted_7$2 = { class: "dt-cal-toolbar" };
const _hoisted_8$2 = { class: "dt-cal-toolbar-title" };
const _hoisted_9$2 = {
  key: 0,
  class: "dt-cal-body"
};
const _hoisted_10$2 = { class: "dt-wday-row" };
const _hoisted_11$2 = { class: "dt-grid" };
const _hoisted_12$2 = ["onClick"];
const _hoisted_13$2 = {
  key: 1,
  class: "dt-cal-body"
};
const _hoisted_14$2 = { class: "dt-m-grid" };
const _hoisted_15$2 = ["onClick"];
const _hoisted_16$2 = {
  key: 2,
  class: "dt-cal-body"
};
const _hoisted_17$1 = { class: "dt-m-grid" };
const _hoisted_18$1 = ["onClick"];
const _hoisted_19$1 = { class: "dt-cal-foot" };

const {ref: ref$2,computed: computed$2,watch: watch$1} = await importShared('vue');


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

const menuOpen = ref$2(false);
const selYear = ref$2(new Date().getFullYear());
const selMonth = ref$2(new Date().getMonth() + 1); // 1..12
const yearPageBase = ref$2(new Date().getFullYear() - 5);

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

  return (_openBlock$2(), _createBlock$1(_component_VMenu, {
    modelValue: menuOpen.value,
    "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((menuOpen).value = $event)),
    location: "bottom start",
    "close-on-content-click": false,
    "min-width": 0
  }, {
    activator: _withCtx$1(({ props: menuProps }) => [
      _createVNode$1(_component_VTextField, _mergeProps({
        "model-value": valueDisplay.value || __props.modelValue,
        readonly: "",
        density: "compact",
        "hide-details": "",
        class: "dt-cal-field",
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
                    _createTextVNode$1(_toDisplayString$2(selYear.value) + " 年 " + _toDisplayString$2(selMonth.value) + " 月 " + _toDisplayString$2(__props.modelValue?.slice(-2)?.replace(/^-/, '') || _unref$1(today).getDate()) + " 日 ", 1)
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
                      class: _normalizeClass$2(["dt-day", {
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
                        class: _normalizeClass$2(["dt-m-btn", { 'dt-selected': selMonth.value === i + 1 && Number(String(__props.modelValue).slice(0, 4)) === selYear.value }]),
                        onClick: $event => (pickMonth(i + 1))
                      }, _toDisplayString$2(name), 11, _hoisted_15$2)
                    }), 64))
                  ])
                ]))
              : (_openBlock$2(), _createElementBlock$2("div", _hoisted_16$2, [
                  _createElementVNode$2("div", _hoisted_17$1, [
                    (_openBlock$2(true), _createElementBlock$2(_Fragment$2, null, _renderList$2(yearGrid.value, (y) => {
                      return (_openBlock$2(), _createElementBlock$2("button", {
                        key: y,
                        type: "button",
                        class: _normalizeClass$2(["dt-m-btn", { 'dt-selected': String(__props.modelValue) === String(y) }]),
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
const CalendarPanel = /*#__PURE__*/_export_sfc(_sfc_main$2, [['__scopeId',"data-v-6c3d007b"]]);

const {toDisplayString:_toDisplayString$1,createElementVNode:_createElementVNode$1,openBlock:_openBlock$1,createElementBlock:_createElementBlock$1,createCommentVNode:_createCommentVNode$1,renderList:_renderList$1,Fragment:_Fragment$1,normalizeStyle:_normalizeStyle,normalizeClass:_normalizeClass$1} = await importShared('vue');


const _hoisted_1$1 = { class: "pc-head" };
const _hoisted_2$1 = { class: "pc-title" };
const _hoisted_3$1 = {
  key: 0,
  class: "pc-sub"
};
const _hoisted_4$1 = {
  key: 1,
  class: "pc-total"
};
const _hoisted_5$1 = {
  key: 0,
  class: "pc-empty"
};
const _hoisted_6$1 = {
  key: 1,
  class: "pc-body"
};
const _hoisted_7$1 = { class: "pc-svg-wrap" };
const _hoisted_8$1 = ["viewBox"];
const _hoisted_9$1 = ["d", "fill", "onPointermove", "onPointerdown"];
const _hoisted_10$1 = ["x", "y"];
const _hoisted_11$1 = { class: "pc-tip-name" };
const _hoisted_12$1 = { class: "pc-tip-val" };
const _hoisted_13$1 = { class: "pc-legend" };
const _hoisted_14$1 = ["title"];
const _hoisted_15$1 = { class: "pc-val" };
const _hoisted_16$1 = { class: "pc-pct" };

const {computed: computed$1,ref: ref$1,onUnmounted} = await importShared('vue');


// 纯 SVG 饼图（不依赖第三方图表库）：
// - items: [{label, value}]，内部按 value 从大到小排序
// - 只展示 value>0 的站点；图例展示 色块 + 站点名 + 数值 + 占比
// - 鼠标悬停 / 手指点按扇区显示 tooltip（站点名 + 数据量）
const SIZE = 260;
const R = 118;


const _sfc_main$1 = {
  __name: 'PieChart',
  props: {
  items: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  emptyText: { type: String, default: '暂无数据' },
  loading: { type: Boolean, default: false },
  // 窄屏：图例改为整行铺开（不再限高裁切），扇区上的数值隐藏（图例已有），避免小扇区文字互压
  narrow: { type: Boolean, default: false },
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
// 扇区角度足够大才在扇区上标数值，避免小扇区文字重叠；窄屏图例已给出数值，直接不标
function showLabel(s) {
  if (props.narrow) return false
  return s.a2 - s.a1 > 0.3
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

// ---------- tooltip ----------
const svgRef = ref$1(null);
const hover = ref$1(null);
let hideTimer = null;
function placeTip(e, s, i) {
  const el = svgRef.value;
  if (!el) return false
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return false
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  const tipW = 160, tipH = 34;
  if (x + tipW > rect.width - 4) x = x - tipW - 10;
  else x += 12;
  if (y + tipH > rect.height - 4) y = y - tipH - 8;
  else y -= 8;
  hover.value = {
    label: s.label,
    value: s.value,
    color: PALETTE[i % PALETTE.length],
    x: Math.max(4, Math.floor(x)),
    y: Math.max(4, Math.floor(y)),
  };
  return true
}
function onMove(e, s, i) {
  placeTip(e, s, i);
}
// 触摸屏没有 mouseover：点一下扇区就让 tooltip 显示 2 秒，避免手机上完全看不到数值
function onTap(e, s, i) {
  if (!placeTip(e, s, i)) return
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { hover.value = null; }, 2200);
}
function onLeave(e) {
  // 手指离开不立刻隐藏（否则 tap 的 tooltip 一闪而过）
  if (e && e.pointerType && e.pointerType !== 'mouse') return
  hover.value = null;
}
onUnmounted(() => { clearTimeout(hideTimer); });

return (_ctx, _cache) => {
  return (_openBlock$1(), _createElementBlock$1("div", {
    class: _normalizeClass$1(["pc-wrap", { 'pc-narrow': __props.narrow }])
  }, [
    _createElementVNode$1("div", _hoisted_1$1, [
      _createElementVNode$1("span", _hoisted_2$1, _toDisplayString$1(__props.title), 1),
      (__props.subtitle)
        ? (_openBlock$1(), _createElementBlock$1("span", _hoisted_3$1, _toDisplayString$1(__props.subtitle), 1))
        : _createCommentVNode$1("", true),
      (total.value > 0)
        ? (_openBlock$1(), _createElementBlock$1("span", _hoisted_4$1, "共 " + _toDisplayString$1(fmtBytes(total.value)), 1))
        : _createCommentVNode$1("", true)
    ]),
    (sorted.value.length === 0)
      ? (_openBlock$1(), _createElementBlock$1("div", _hoisted_5$1, _toDisplayString$1(__props.loading ? '加载中...' : __props.emptyText), 1))
      : (_openBlock$1(), _createElementBlock$1("div", _hoisted_6$1, [
          _createElementVNode$1("div", _hoisted_7$1, [
            (_openBlock$1(), _createElementBlock$1("svg", {
              ref_key: "svgRef",
              ref: svgRef,
              viewBox: `0 0 ${SIZE} ${SIZE}`,
              class: "pc-svg",
              onPointerleave: onLeave
            }, [
              (_openBlock$1(true), _createElementBlock$1(_Fragment$1, null, _renderList$1(segments.value, (s, i) => {
                return (_openBlock$1(), _createElementBlock$1("g", { key: i }, [
                  _createElementVNode$1("path", {
                    d: slicePath(s),
                    fill: PALETTE[i % PALETTE.length],
                    stroke: "#fff",
                    "stroke-width": "1.5",
                    onPointermove: $event => (onMove($event, s, i)),
                    onPointerdown: $event => (onTap($event, s, i))
                  }, null, 40, _hoisted_9$1),
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
            ], 40, _hoisted_8$1)),
            (hover.value)
              ? (_openBlock$1(), _createElementBlock$1("div", {
                  key: 0,
                  class: "pc-tip",
                  style: _normalizeStyle({ left: hover.value.x + 'px', top: hover.value.y + 'px', background: hover.value.color })
                }, [
                  _createElementVNode$1("span", _hoisted_11$1, _toDisplayString$1(hover.value.label), 1),
                  _createElementVNode$1("span", _hoisted_12$1, _toDisplayString$1(fmtBytes(hover.value.value)), 1)
                ], 4))
              : _createCommentVNode$1("", true)
          ]),
          _createElementVNode$1("div", _hoisted_13$1, [
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
                }, _toDisplayString$1(s.label), 9, _hoisted_14$1),
                _createElementVNode$1("span", _hoisted_15$1, _toDisplayString$1(fmtBytes(s.value)), 1),
                _createElementVNode$1("span", _hoisted_16$1, _toDisplayString$1(pct(s.value).toFixed(1)) + "%", 1)
              ]))
            }), 128))
          ])
        ]))
  ], 2))
}
}

};
const PieChart = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-2a7535e6"]]);

const {unref:_unref,createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,createTextVNode:_createTextVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode,normalizeClass:_normalizeClass,renderList:_renderList,Fragment:_Fragment,createBlock:_createBlock} = await importShared('vue');


const _hoisted_1 = { class: "dt-header" };
const _hoisted_2 = { class: "dt-header-row" };
const _hoisted_3 = { class: "dt-header-actions" };
const _hoisted_4 = { class: "dt-date" };
const _hoisted_5 = { class: "dt-buttons" };
const _hoisted_6 = {
  key: 0,
  class: "dt-notice"
};
const _hoisted_7 = {
  key: 1,
  class: "text-error dt-notice"
};
const _hoisted_8 = { class: "dt-cards" };
const _hoisted_9 = { class: "dt-kpi" };
const _hoisted_10 = { class: "dt-kpi" };
const _hoisted_11 = { class: "dt-kpi" };
const _hoisted_12 = { class: "dt-section-body" };
const _hoisted_13 = { class: "dt-pie-head" };
const _hoisted_14 = { class: "dt-pie-date" };
const _hoisted_15 = { class: "dt-pie-head" };
const _hoisted_16 = { class: "dt-pie-date" };
const _hoisted_17 = { class: "dt-pie-head" };
const _hoisted_18 = { class: "dt-pie-date" };
const _hoisted_19 = { class: "dt-section-body" };
const _hoisted_20 = {
  key: 0,
  class: "dt-rec-list"
};
const _hoisted_21 = {
  key: 0,
  class: "dt-empty"
};
const _hoisted_22 = { class: "dt-rec-main" };
const _hoisted_23 = { class: "dt-rec-site" };
const _hoisted_24 = { class: "dt-rec-dl" };
const _hoisted_25 = { class: "dt-rec-nums" };
const _hoisted_26 = { class: "dt-up" };
const _hoisted_27 = { class: "dt-down" };
const _hoisted_28 = {
  key: 1,
  class: "dt-rec-more"
};
const _hoisted_29 = { style: {"color":"#4caf50"} };
const _hoisted_30 = { style: {"color":"#2196f3"} };

const {ref,computed,onMounted,watch,nextTick} = await importShared('vue');

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

// 窄屏（手机 / 桌面窄弹窗）判定：按组件自身宽度，而不是视口宽度
const { target: rootEl, narrow, width: rootWidth } = useNarrow(640);
// 超窄（≤380px 容器）：日期框换到独占一行，避免「2026 年 11 月」被截断
const tiny = computed(() => rootWidth.value > 0 && rootWidth.value < 380);
// 够宽（≥900px）：饼图排成 2×2，否则单列（饼图 + 图例在窄卡片里上下排更易读）
const roomy = computed(() => rootWidth.value >= 900);

const period = ref('month');
const value = ref('');
const loading = ref(false);
const error = ref('');
const records = ref([]);
const totalUp = ref(0);
const totalDown = ref(0);
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
    const r1 = await props.api.get(`${base.value}/records?${q.toString()}`);
    const rec = unwrap(r1) || {};
    records.value = rec.data || [];
    totalUp.value = rec.total_uploaded || 0;
    totalDown.value = rec.total_downloaded || 0;
  } catch (e) {
    error.value = e?.message || '加载失败';
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  pieDay.value = defaultDay();
  pieMonth.value = defaultMonth();
  pieYear.value = defaultYear();
  load();
  loadDayPie();
  loadMonthPie();
  loadYearPie();
  loadAllPie();
});
watch(period, () => {
  value.value = defaultValue();
  nextTick(load);
});

// ============================================================
// 上传流量饼图：今日 / 本月 / 今年 / 历史总计，四张同款饼图，仅统计上传
// ============================================================
const pieDay = ref('');
const pieMonth = ref('');
const pieYear = ref('');
const dayPie = ref([]); // [{label, value}]
const monthPie = ref([]);
const yearPie = ref([]);
const allPie = ref([]);
const dayPieLoading = ref(false);
const monthPieLoading = ref(false);
const yearPieLoading = ref(false);
const allPieLoading = ref(false);

function defaultDay() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}
function defaultYear() {
  return String(new Date().getFullYear())
}
function aggregateBySite(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (!r || r.site === 'GLOBAL') continue
    map.set(r.site, (map.get(r.site) || 0) + Number(r.uploaded || 0));
  }
  return Array.from(map, ([label, value]) => ({ label, value }))
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
async function loadYearPie() {
  yearPieLoading.value = true;
  try {
    const v = pieYear.value || defaultYear();
    const r = await props.api.get(`${base.value}/records?period=year&value=${v}`);
    const rec = unwrap(r) || {};
    yearPie.value = aggregateBySite(rec.data || []);
  } catch (e) {
    yearPie.value = [];
  } finally {
    yearPieLoading.value = false;
  }
}
// 历史总计：period=all（后端不加时间过滤），只取一次，无日期选择器
async function loadAllPie() {
  allPieLoading.value = true;
  try {
    const r = await props.api.get(`${base.value}/records?period=all`);
    const rec = unwrap(r) || {};
    allPie.value = aggregateBySite(rec.data || []);
  } catch (e) {
    allPie.value = [];
  } finally {
    allPieLoading.value = false;
  }
}

// ---------- 明细数据：窄屏改用卡片列表，避免 4 列表格挤爆 ----------
const recordRows = computed(() => (records.value || []).slice(0, 15));

return (_ctx, _cache) => {
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VSelect = _resolveComponent("VSelect");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VDataTable = _resolveComponent("VDataTable");

  return (_openBlock(), _createElementBlock("div", {
    ref_key: "rootEl",
    ref: rootEl,
    class: _normalizeClass(["dt-page", { 'dt-narrow': _unref(narrow), 'dt-tiny': tiny.value }])
  }, [
    _createElementVNode("div", _hoisted_1, [
      _createElementVNode("div", _hoisted_2, [
        _cache[8] || (_cache[8] = _createElementVNode("div", { class: "dt-title" }, "下载器流量统计", -1)),
        _createVNode(_component_VBtn, {
          icon: "mdi-close",
          variant: "text",
          class: "dt-close",
          "aria-label": "关闭",
          onClick: _cache[0] || (_cache[0] = $event => (emit('close')))
        }),
        _createElementVNode("div", _hoisted_3, [
          _createVNode(_component_VSelect, {
            modelValue: period.value,
            "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((period).value = $event)),
            items: [
              { title: '按日', value: 'day' },
              { title: '按月', value: 'month' },
              { title: '按年', value: 'year' },
            ],
            density: "compact",
            "hide-details": "",
            class: "dt-period",
            variant: "outlined"
          }, null, 8, ["modelValue"]),
          _createElementVNode("div", _hoisted_4, [
            _createVNode(CalendarPanel, {
              modelValue: value.value,
              "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((value).value = $event)),
              mode: period.value,
              onClose: load
            }, null, 8, ["modelValue", "mode"])
          ]),
          _createVNode(_component_VBtn, {
            icon: "mdi-refresh",
            variant: "text",
            loading: loading.value,
            class: "dt-refresh",
            "aria-label": "刷新",
            onClick: load
          }, null, 8, ["loading"]),
          _createElementVNode("div", _hoisted_5, [
            _createVNode(_component_VBtn, {
              color: "primary",
              variant: "tonal",
              density: "comfortable",
              loading: collectBusy.value,
              class: "dt-action",
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
              class: "dt-action",
              onClick: doReset
            }, {
              default: _withCtx(() => [...(_cache[7] || (_cache[7] = [
                _createTextVNode("解除限速", -1)
              ]))]),
              _: 1
            }, 8, ["loading"])
          ])
        ])
      ])
    ]),
    _createVNode(_component_VDivider),
    (actionMsg.value)
      ? (_openBlock(), _createElementBlock("div", _hoisted_6, [
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
      ? (_openBlock(), _createElementBlock("div", _hoisted_7, _toDisplayString(error.value), 1))
      : _createCommentVNode("", true),
    _createElementVNode("div", _hoisted_8, [
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "green",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[9] || (_cache[9] = _createElementVNode("div", { class: "dt-kpi-label" }, "上传流量", -1)),
          _createElementVNode("div", _hoisted_9, _toDisplayString(fmtBytes(totalUp.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "blue",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[10] || (_cache[10] = _createElementVNode("div", { class: "dt-kpi-label" }, "下载流量", -1)),
          _createElementVNode("div", _hoisted_10, _toDisplayString(fmtBytes(totalDown.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[11] || (_cache[11] = _createElementVNode("div", { class: "dt-kpi-label" }, "分享率", -1)),
          _createElementVNode("div", _hoisted_11, _toDisplayString(totalDown.value > 0 ? (totalUp.value / totalDown.value).toFixed(2) : '—'), 1)
        ]),
        _: 1
      })
    ]),
    _createVNode(_component_VCard, { class: "dt-section" }, {
      default: _withCtx(() => [
        _cache[16] || (_cache[16] = _createElementVNode("div", { class: "dt-section-head" }, [
          _createElementVNode("span", { class: "dt-section-title" }, "上传流量分布（今日 / 本月 / 今年 / 历史总计）")
        ], -1)),
        _createElementVNode("div", _hoisted_12, [
          _createElementVNode("div", {
            class: _normalizeClass(["dt-pies", { 'dt-pies-roomy': roomy.value }])
          }, [
            _createVNode(_component_VCard, {
              variant: "tonal",
              class: "dt-pie-card"
            }, {
              default: _withCtx(() => [
                _createElementVNode("div", _hoisted_13, [
                  _cache[12] || (_cache[12] = _createElementVNode("span", { class: "dt-pie-title" }, "今日上传", -1)),
                  _createElementVNode("div", _hoisted_14, [
                    _createVNode(CalendarPanel, {
                      modelValue: pieDay.value,
                      "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((pieDay).value = $event)),
                      mode: "day",
                      onClose: loadDayPie
                    }, null, 8, ["modelValue"])
                  ])
                ]),
                _createVNode(PieChart, {
                  items: dayPie.value,
                  subtitle: pieDay.value,
                  loading: dayPieLoading.value,
                  narrow: _unref(narrow)
                }, null, 8, ["items", "subtitle", "loading", "narrow"])
              ]),
              _: 1
            }),
            _createVNode(_component_VCard, {
              variant: "tonal",
              class: "dt-pie-card"
            }, {
              default: _withCtx(() => [
                _createElementVNode("div", _hoisted_15, [
                  _cache[13] || (_cache[13] = _createElementVNode("span", { class: "dt-pie-title" }, "本月上传", -1)),
                  _createElementVNode("div", _hoisted_16, [
                    _createVNode(CalendarPanel, {
                      modelValue: pieMonth.value,
                      "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((pieMonth).value = $event)),
                      mode: "month",
                      onClose: loadMonthPie
                    }, null, 8, ["modelValue"])
                  ])
                ]),
                _createVNode(PieChart, {
                  items: monthPie.value,
                  subtitle: pieMonth.value,
                  loading: monthPieLoading.value,
                  narrow: _unref(narrow)
                }, null, 8, ["items", "subtitle", "loading", "narrow"])
              ]),
              _: 1
            }),
            _createVNode(_component_VCard, {
              variant: "tonal",
              class: "dt-pie-card"
            }, {
              default: _withCtx(() => [
                _createElementVNode("div", _hoisted_17, [
                  _cache[14] || (_cache[14] = _createElementVNode("span", { class: "dt-pie-title" }, "今年上传", -1)),
                  _createElementVNode("div", _hoisted_18, [
                    _createVNode(CalendarPanel, {
                      modelValue: pieYear.value,
                      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((pieYear).value = $event)),
                      mode: "year",
                      onClose: loadYearPie
                    }, null, 8, ["modelValue"])
                  ])
                ]),
                _createVNode(PieChart, {
                  items: yearPie.value,
                  subtitle: pieYear.value,
                  loading: yearPieLoading.value,
                  narrow: _unref(narrow)
                }, null, 8, ["items", "subtitle", "loading", "narrow"])
              ]),
              _: 1
            }),
            _createVNode(_component_VCard, {
              variant: "tonal",
              class: "dt-pie-card"
            }, {
              default: _withCtx(() => [
                _cache[15] || (_cache[15] = _createElementVNode("div", { class: "dt-pie-head" }, [
                  _createElementVNode("span", { class: "dt-pie-title" }, "历史总计上传")
                ], -1)),
                _createVNode(PieChart, {
                  items: allPie.value,
                  subtitle: "全部历史",
                  loading: allPieLoading.value,
                  narrow: _unref(narrow)
                }, null, 8, ["items", "loading", "narrow"])
              ]),
              _: 1
            })
          ], 2)
        ])
      ]),
      _: 1
    }),
    _createVNode(_component_VCard, { class: "dt-section" }, {
      default: _withCtx(() => [
        _cache[17] || (_cache[17] = _createElementVNode("div", { class: "dt-section-head" }, [
          _createElementVNode("span", { class: "dt-section-title" }, "明细数据")
        ], -1)),
        _createElementVNode("div", _hoisted_19, [
          (_unref(narrow))
            ? (_openBlock(), _createElementBlock("div", _hoisted_20, [
                (!recordRows.value.length)
                  ? (_openBlock(), _createElementBlock("div", _hoisted_21, "暂无数据"))
                  : _createCommentVNode("", true),
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(recordRows.value, (r, i) => {
                  return (_openBlock(), _createElementBlock("div", {
                    key: i,
                    class: "dt-rec"
                  }, [
                    _createElementVNode("div", _hoisted_22, [
                      _createElementVNode("span", _hoisted_23, _toDisplayString(r.site), 1),
                      _createElementVNode("span", _hoisted_24, _toDisplayString(r.downloader), 1)
                    ]),
                    _createElementVNode("div", _hoisted_25, [
                      _createElementVNode("span", _hoisted_26, "↑ " + _toDisplayString(fmtBytes(r.uploaded)), 1),
                      _createElementVNode("span", _hoisted_27, "↓ " + _toDisplayString(fmtBytes(r.downloaded)), 1)
                    ])
                  ]))
                }), 128)),
                (records.value.length > recordRows.value.length)
                  ? (_openBlock(), _createElementBlock("div", _hoisted_28, " 共 " + _toDisplayString(records.value.length) + " 条，此处显示前 " + _toDisplayString(recordRows.value.length) + " 条 ", 1))
                  : _createCommentVNode("", true)
              ]))
            : (_openBlock(), _createBlock(_component_VDataTable, {
                key: 1,
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
                  _createElementVNode("span", _hoisted_29, _toDisplayString(fmtBytes(item.uploaded)), 1)
                ]),
                "item.downloaded": _withCtx(({ item }) => [
                  _createElementVNode("span", _hoisted_30, _toDisplayString(fmtBytes(item.downloaded)), 1)
                ]),
                _: 1
              }, 8, ["items"]))
        ])
      ]),
      _: 1
    })
  ], 2))
}
}

};
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-72994ad6"]]);

export { Page as default };
