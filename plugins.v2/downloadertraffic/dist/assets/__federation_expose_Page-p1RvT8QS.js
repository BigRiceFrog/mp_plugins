import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const {createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment,createTextVNode:_createTextVNode} = await importShared('vue');


const _hoisted_1 = { class: "dt-page" };
const _hoisted_2 = {
  key: 0,
  class: "text-error pa-3"
};
const _hoisted_3 = { class: "dt-cards" };
const _hoisted_4 = { class: "text-h6" };
const _hoisted_5 = { class: "text-h6" };
const _hoisted_6 = { class: "text-h6" };
const _hoisted_7 = {
  key: 0,
  class: "text-medium-emphasis"
};
const _hoisted_8 = ["width", "height"];
const _hoisted_9 = ["y"];
const _hoisted_10 = ["y", "width", "height"];
const _hoisted_11 = ["x", "y"];
const _hoisted_12 = ["y", "width", "height"];
const _hoisted_13 = ["x", "y"];
const _hoisted_14 = {
  key: 0,
  class: "text-medium-emphasis"
};
const _hoisted_15 = ["x2"];
const _hoisted_16 = ["y1", "x2", "y2"];
const _hoisted_17 = {
  x: 4,
  y: 16,
  class: "dt-axis"
};
const _hoisted_18 = ["y"];
const _hoisted_19 = ["points"];
const _hoisted_20 = ["points"];
const _hoisted_21 = ["x", "y"];
const _hoisted_22 = { style: {"color":"#4caf50"} };
const _hoisted_23 = { style: {"color":"#2196f3"} };

const {ref,computed,onMounted,watch} = await importShared('vue');


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

const base = computed(() => `plugin/${props.pluginId}`);

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
    const rec = r1?.data ?? r1;
    const tr = r2?.data ?? r2;
    records.value = rec?.data || [];
    totalUp.value = rec?.total_uploaded || 0;
    totalDown.value = rec?.total_downloaded || 0;
    trend.value = tr?.data || [];
  } catch (e) {
    error.value = e?.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(period, () => {
  value.value = '';
  load();
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
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VToolbar = _resolveComponent("VToolbar");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VDataTable = _resolveComponent("VDataTable");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_VToolbar, {
      density: "comfortable",
      color: "transparent"
    }, {
      default: _withCtx(() => [
        _cache[4] || (_cache[4] = _createElementVNode("div", { class: "text-h6 ms-3" }, "下载器流量统计", -1)),
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
        _createVNode(_component_VTextField, {
          modelValue: value.value,
          "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((value).value = $event)),
          placeholder: period.value === 'year' ? '2026' : period.value === 'month' ? '2026-08' : '2026-08-18',
          density: "compact",
          "hide-details": "",
          style: {"max-width":"150px"},
          variant: "outlined",
          class: "ms-2"
        }, null, 8, ["modelValue", "placeholder"]),
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
          icon: "mdi-close",
          variant: "text",
          onClick: _cache[3] || (_cache[3] = $event => (emit('close')))
        })
      ]),
      _: 1
    }),
    _createVNode(_component_VDivider),
    (error.value)
      ? (_openBlock(), _createElementBlock("div", _hoisted_2, _toDisplayString(error.value), 1))
      : _createCommentVNode("", true),
    _createElementVNode("div", _hoisted_3, [
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "green",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[5] || (_cache[5] = _createElementVNode("div", { class: "text-caption" }, "上传流量", -1)),
          _createElementVNode("div", _hoisted_4, _toDisplayString(fmtBytes(totalUp.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        color: "blue",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[6] || (_cache[6] = _createElementVNode("div", { class: "text-caption" }, "下载流量", -1)),
          _createElementVNode("div", _hoisted_5, _toDisplayString(fmtBytes(totalDown.value)), 1)
        ]),
        _: 1
      }),
      _createVNode(_component_VCard, {
        variant: "tonal",
        class: "dt-card"
      }, {
        default: _withCtx(() => [
          _cache[7] || (_cache[7] = _createElementVNode("div", { class: "text-caption" }, "分享率", -1)),
          _createElementVNode("div", _hoisted_6, _toDisplayString(totalDown.value > 0 ? (totalUp.value / totalDown.value).toFixed(2) : '—'), 1)
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
          ? (_openBlock(), _createElementBlock("div", _hoisted_7, "暂无数据"))
          : (_openBlock(), _createElementBlock("svg", {
              key: 1,
              width: barLabelW + barW + 20,
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
                  }, _toDisplayString(r.site), 9, _hoisted_9),
                  _createElementVNode("rect", {
                    x: barLabelW,
                    y: i * (barH + barGap) + 2,
                    width: Math.max(1, barUpWidth(r)),
                    height: barH / 2 - 2,
                    fill: "#4caf50",
                    rx: "2"
                  }, null, 8, _hoisted_10),
                  _createElementVNode("text", {
                    x: barLabelW + Math.max(1, barUpWidth(r)) + 4,
                    y: i * (barH + barGap) + barH / 2,
                    class: "dt-bar-val"
                  }, "↑ " + _toDisplayString(fmtBytes(r.uploaded)), 9, _hoisted_11),
                  _createElementVNode("rect", {
                    x: barLabelW,
                    y: i * (barH + barGap) + barH / 2 + 2,
                    width: Math.max(1, barDownWidth(r)),
                    height: barH / 2 - 2,
                    fill: "#2196f3",
                    rx: "2"
                  }, null, 8, _hoisted_12),
                  _createElementVNode("text", {
                    x: barLabelW + Math.max(1, barDownWidth(r)) + 4,
                    y: i * (barH + barGap) + barH + 2,
                    class: "dt-bar-val"
                  }, "↓ " + _toDisplayString(fmtBytes(r.downloaded)), 9, _hoisted_13)
                ]))
              }), 128))
            ], 8, _hoisted_8))
      ]),
      _: 1
    }),
    _createVNode(_component_VCard, {
      class: "dt-section",
      title: `时间趋势（${period.value === 'year' ? '逐月' : '逐日'}）`
    }, {
      text: _withCtx(() => [
        (trend.value.length === 0)
          ? (_openBlock(), _createElementBlock("div", _hoisted_14, "暂无数据"))
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
              }, null, 8, _hoisted_15),
              _createElementVNode("line", {
                x1: linePadL,
                y1: lineH - linePadB,
                x2: lineW - 10,
                y2: lineH - linePadB,
                stroke: "#ccc"
              }, null, 8, _hoisted_16),
              _createElementVNode("text", _hoisted_17, _toDisplayString(fmtBytes(maxTrendBytes.value)), 1),
              _createElementVNode("text", {
                x: 4,
                y: lineH - linePadB,
                class: "dt-axis"
              }, "0", 8, _hoisted_18),
              _createElementVNode("polyline", {
                points: linePoints('uploaded'),
                fill: "none",
                stroke: "#4caf50",
                "stroke-width": "2"
              }, null, 8, _hoisted_19),
              _createElementVNode("polyline", {
                points: linePoints('downloaded'),
                fill: "none",
                stroke: "#2196f3",
                "stroke-width": "2"
              }, null, 8, _hoisted_20),
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(lineXLabels.value, (t, i) => {
                return (_openBlock(), _createElementBlock("text", {
                  key: i,
                  x: t.x,
                  y: lineH - linePadB + 16,
                  class: "dt-axis",
                  "text-anchor": "middle"
                }, _toDisplayString(t.label), 9, _hoisted_21))
              }), 128))
            ])),
        _cache[8] || (_cache[8] = _createElementVNode("div", { class: "dt-legend" }, [
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
            _createElementVNode("span", _hoisted_22, _toDisplayString(fmtBytes(item.uploaded)), 1)
          ]),
          "item.downloaded": _withCtx(({ item }) => [
            _createElementVNode("span", _hoisted_23, _toDisplayString(fmtBytes(item.downloaded)), 1)
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
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-c157dd48"]]);

export { Page as default };
