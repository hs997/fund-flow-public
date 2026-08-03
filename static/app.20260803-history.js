const PUBLIC_DATA_URLS = [
  "data/latest.json",
  "https://raw.githubusercontent.com/hs997/fund-flow-public/main/data/latest.json",
];
const PUBLIC_HISTORY_URLS = [
  "data/history.json",
  "https://raw.githubusercontent.com/hs997/fund-flow-public/main/data/history.json",
];
const DEFAULT_POLL_SECONDS = 60;
const MARKET_HISTORY_KEY = "__market__";

const state = {
  payload: null,
  historyPayload: null,
  view: "realtime",
  historyRange: 7,
  historySelection: MARKET_HISTORY_KEY,
  filter: "all",
  query: "",
  selectedCode: null,
  simulation: null,
  nodePositions: new Map(),
  refreshTimer: null,
  countdownTimer: null,
  nextRefreshAt: null,
};

const els = {
  loading: document.querySelector("#loading-layer"),
  toast: document.querySelector("#toast"),
  status: document.querySelector("#status-banner"),
  tooltip: document.querySelector("#tooltip"),
  refresh: document.querySelector("#refresh-button"),
  market: document.querySelector("#market-state"),
  dataTime: document.querySelector("#data-time"),
  tradeDate: document.querySelector("#trade-date"),
  updatedAt: document.querySelector("#updated-at"),
  nextRefresh: document.querySelector("#next-refresh"),
  search: document.querySelector("#search-input"),
  chartCanvas: document.querySelector("#chart-canvas"),
  chart: document.querySelector("#bubble-chart"),
  empty: document.querySelector("#empty-state"),
  detail: document.querySelector("#detail-panel"),
  realtimeView: document.querySelector("#realtime-view"),
  historyView: document.querySelector("#history-view"),
  realtimeFilters: document.querySelector(".realtime-filters"),
  historyEntity: document.querySelector("#history-entity"),
  historyChart: document.querySelector("#history-chart"),
  historyRows: document.querySelector("#history-rows"),
  historyEmpty: document.querySelector("#history-empty"),
};

function formatValue(value, digits = 1) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : "-"}${Math.abs(number).toFixed(digits)}亿`;
}

function valueClass(value) {
  return Number(value) >= 0 ? "positive" : "negative";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { els.toast.hidden = true; }, 3200);
}

function showStatus(message) {
  els.status.textContent = message;
  els.status.hidden = false;
}

function hideStatus() {
  els.status.textContent = "";
  els.status.hidden = true;
}

function sectorKey(sector) {
  return `${sector.order ?? ""}:${sector.label || sector.board_name || ""}`;
}

function filteredSectors() {
  if (!state.payload) return [];
  const query = state.query.trim().toLowerCase();
  return state.payload.sectors.filter((sector) => {
    if (state.filter === "inflow" && sector.value < 0) return false;
    if (state.filter === "outflow" && sector.value >= 0) return false;
    if (!query) return true;
    return `${sector.label} ${sector.board_name || ""}`.toLowerCase().includes(query);
  });
}

function formatPublishedAt(value) {
  if (!value) return "发布 --";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `发布 ${value}`;
  const text = date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `发布 ${text}`;
}

function renderHeader() {
  const payload = state.payload;
  if (!payload) return;
  const market = payload.market || { code: "closed", label: "未知" };
  els.market.className = `market-state ${market.code}`;
  els.market.querySelector("b").textContent = market.label;
  els.dataTime.textContent = String(payload.latest_time || "--:--").slice(-5);
  els.tradeDate.textContent = payload.trade_date || "----";
  els.updatedAt.textContent = formatPublishedAt(payload.updated_at);
  document.querySelector("#source-label").textContent = `数据来源：${payload.source || "公开板块分钟资金流"}`;

  const errors = payload.errors || [];
  if (payload.ok === false || payload.from_cache || errors.length) {
    const prefix = payload.ok === false ? "公开快照暂时不可用，当前显示最近可用数据。" : "部分板块刷新失败，页面已使用可用数据继续展示。";
    showStatus(errors[0] ? `${prefix} ${errors[0]}` : prefix);
  } else {
    hideStatus();
  }

  const summary = payload.summary || {};
  document.querySelector("#inflow-total").textContent = formatValue(summary.inflow_total);
  document.querySelector("#outflow-total").textContent = formatValue(summary.outflow_total);
  document.querySelector("#leader-name").textContent = summary.leader || "--";
  document.querySelector("#leader-value").textContent = formatValue(summary.leader_value);
  document.querySelector("#laggard-name").textContent = summary.laggard || "--";
  document.querySelector("#laggard-value").textContent = formatValue(summary.laggard_value);
}

function bubbleColor(side, magnitude, maxMagnitude) {
  const ratio = Math.min(1, Math.sqrt(magnitude / Math.max(maxMagnitude, 1)));
  if (side > 0) return d3.interpolateRgb("#a33934", "#ff3b30")(0.38 + ratio * 0.62);
  return d3.interpolateRgb("#176c4d", "#00d17d")(0.38 + ratio * 0.62);
}

function bubbleStroke(side) {
  return side > 0 ? "#ff9d92" : "#7cf0b9";
}

function renderBubbles() {
  const sectors = filteredSectors();
  els.empty.hidden = sectors.length > 0;
  if (!sectors.length) {
    d3.select(els.chart).selectAll("*").remove();
    return;
  }

  const bounds = els.chartCanvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(bounds.width));
  const height = Math.max(620, Math.floor(bounds.height));
  const axisY = height / 2;
  const topPad = 70;
  const bottomPad = 30;
  const sideGap = 36;
  const maxMagnitude = d3.max(sectors, (item) => Math.abs(item.value)) || 1;
  const maxRadius = Math.min(width < 620 ? 74 : 112, width / 6.2, height / 7.4);
  const radius = d3.scaleSqrt().domain([0, maxMagnitude]).range([26, maxRadius]);
  const svg = d3.select(els.chart).attr("viewBox", `0 0 ${width} ${height}`);

  const axis = svg.selectAll("g.zero-axis").data([null]).join("g").attr("class", "zero-axis");
  const labelWidth = width < 540 ? 142 : 180;
  axis.selectAll("line.left").data([null]).join("line").attr("class", "axis-line left")
    .attr("x1", 24).attr("x2", width / 2 - labelWidth / 2 - 12).attr("y1", axisY).attr("y2", axisY);
  axis.selectAll("line.right").data([null]).join("line").attr("class", "axis-line right")
    .attr("x1", width / 2 + labelWidth / 2 + 12).attr("x2", width - 24).attr("y1", axisY).attr("y2", axisY);
  axis.selectAll("circle.node-left").data([null]).join("circle").attr("class", "axis-node node-left").attr("r", 3).attr("cx", 24).attr("cy", axisY);
  axis.selectAll("circle.node-right").data([null]).join("circle").attr("class", "axis-node node-right").attr("r", 3).attr("cx", width - 24).attr("cy", axisY);
  axis.selectAll("rect").data([null]).join("rect").attr("class", "axis-label-bg").attr("x", width / 2 - labelWidth / 2).attr("y", axisY - 18).attr("width", labelWidth).attr("height", 36);
  axis.selectAll("text").data([null]).join("text").attr("class", "axis-label").attr("x", width / 2).attr("y", axisY + 5).text("水哥养基 · 公开快照");

  const nodes = sectors.map((sector) => {
    const key = sectorKey(sector);
    const previous = state.nodePositions.get(key);
    const sign = sector.value >= 0 ? 1 : -1;
    const magnitude = Math.abs(sector.value);
    const r = radius(magnitude);
    const available = sign > 0 ? axisY - topPad - r - sideGap : height - axisY - bottomPad - r - sideGap;
    const distance = sideGap + r + Math.max(0, available) * (0.18 + 0.72 * Math.pow(magnitude / maxMagnitude, .58));
    const targetY = axisY - sign * distance;
    const phase = (sector.order * 0.61803398875) % 1;
    const targetX = 30 + r + phase * Math.max(1, width - 60 - r * 2);
    return { ...sector, r, targetX, targetY, x: previous?.x ?? targetX, y: previous?.y ?? targetY };
  });

  const groups = svg.selectAll("g.bubble").data(nodes, sectorKey);
  groups.exit().transition().duration(220).style("opacity", 0).remove();
  const entered = groups.enter().append("g").attr("class", "bubble").style("opacity", 0);
  entered.append("circle");
  entered.append("text").attr("class", "bubble-label");
  entered.append("text").attr("class", "bubble-value");
  const merged = entered.merge(groups)
    .classed("selected", (item) => sectorKey(item) === state.selectedCode)
    .on("click", (_, item) => selectSector(sectorKey(item)))
    .on("mouseenter", (event, item) => showTooltip(event, item))
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
  entered.transition().duration(240).style("opacity", 1);
  merged.select("circle").attr("r", (item) => item.r);

  if (state.simulation) state.simulation.stop();
  state.simulation = d3.forceSimulation(nodes)
    .alpha(0.9)
    .alphaDecay(0.045)
    .velocityDecay(0.38)
    .force("x", d3.forceX((item) => item.targetX).strength(0.10))
    .force("y", d3.forceY((item) => item.targetY).strength(0.24))
    .force("charge", d3.forceManyBody().strength(-6))
    .force("collide", d3.forceCollide((item) => item.r + 5).iterations(3))
    .on("tick", () => {
      nodes.forEach((item) => {
        item.x = Math.max(item.r + 8, Math.min(width - item.r - 8, item.x));
        item.y = Math.max(topPad + item.r, Math.min(height - bottomPad - item.r, item.y));
        state.nodePositions.set(sectorKey(item), { x: item.x, y: item.y });
      });
      merged.attr("transform", (item) => `translate(${item.x},${item.y})`);
      merged.select("circle")
        .attr("fill", (item) => bubbleColor(item.y < axisY ? 1 : -1, Math.abs(item.value), maxMagnitude))
        .attr("stroke", (item) => bubbleStroke(item.y < axisY ? 1 : -1));
      merged.select("text.bubble-label")
        .attr("y", (item) => item.r < 40 ? 5 : -3)
        .style("font-size", (item) => `${Math.max(13, Math.min(24, item.r * .24))}px`)
        .text((item) => compactLabel(item.label, item.r));
      merged.select("text.bubble-value")
        .attr("y", (item) => item.r < 40 ? 0 : Math.max(17, item.r * .22))
        .style("display", (item) => item.r < 40 ? "none" : null)
        .style("font-size", (item) => `${Math.max(12, Math.min(22, item.r * .20))}px`)
        .text((item) => {
          const side = item.y < axisY ? 1 : -1;
          return formatValue(Math.abs(item.value) * side);
        });
    });
}

function compactLabel(label, radius) {
  if (radius >= 45 || label.length <= 4) return label;
  const aliases = { 人形机器人: "人形机器", 新能源车: "新能源", 存储芯片: "存储", 商业航天: "航天", 有色金属: "有色", 细分化工: "化工" };
  return aliases[label] || label.slice(0, 4);
}

function showTooltip(event, item) {
  els.tooltip.innerHTML = `<b>${item.label}</b><strong class="${valueClass(item.value)}">${formatValue(item.value)}</strong><div>${item.board_type_cn || "板块"} · ${item.minute || "--:--"}</div>`;
  els.tooltip.hidden = false;
  moveTooltip(event);
}

function moveTooltip(event) {
  const x = Math.min(window.innerWidth - 180, event.clientX + 14);
  const y = Math.min(window.innerHeight - 90, event.clientY + 14);
  els.tooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function hideTooltip() {
  els.tooltip.hidden = true;
}

function selectSector(code) {
  const sector = state.payload?.sectors.find((item) => sectorKey(item) === code);
  if (!sector) return;
  state.selectedCode = code;
  document.querySelector("#detail-type").textContent = sector.board_type_cn || "板块";
  document.querySelector("#detail-name").textContent = sector.label;
  const value = document.querySelector("#detail-value");
  value.textContent = formatValue(sector.value, 2);
  value.className = `detail-value ${valueClass(sector.value)}`;
  document.querySelector("#detail-time").textContent = `数据时间 ${sector.trade_time || sector.minute || "--:--"}`;
  document.querySelector("#detail-source").textContent = `数据来源：${state.payload.source || "--"}`;
  setFlowValue("#flow-super", sector.super_large);
  setFlowValue("#flow-large", sector.large);
  setFlowValue("#flow-medium", sector.medium);
  setFlowValue("#flow-small", sector.small);
  renderSparkline(sector);
  d3.select(els.chart).selectAll("g.bubble").classed("selected", (item) => sectorKey(item) === code);
}

function setFlowValue(selector, amount) {
  const node = document.querySelector(selector);
  node.textContent = formatValue(amount, 2);
  node.className = valueClass(amount);
}

function renderSparkline(sector) {
  const svg = d3.select("#detail-sparkline");
  svg.selectAll("*").remove();
  const data = sector.history || [];
  const width = 266;
  const height = 126;
  svg.attr("viewBox", `0 0 ${width} ${height}`);
  if (data.length < 2) return;
  const x = d3.scaleLinear().domain([0, data.length - 1]).range([4, width - 4]);
  const extent = d3.extent(data, (item) => item.value);
  const pad = Math.max(1, (extent[1] - extent[0]) * .14);
  const y = d3.scaleLinear().domain([extent[0] - pad, extent[1] + pad]).range([height - 8, 8]);
  if (y.domain()[0] <= 0 && y.domain()[1] >= 0) {
    svg.append("line").attr("class", "spark-zero").attr("x1", 0).attr("x2", width).attr("y1", y(0)).attr("y2", y(0));
  }
  const kind = sector.value >= 0 ? "positive" : "negative";
  const line = d3.line().x((_, index) => x(index)).y((item) => y(item.value)).curve(d3.curveMonotoneX);
  const area = d3.area().x((_, index) => x(index)).y0(height).y1((item) => y(item.value)).curve(d3.curveMonotoneX);
  svg.append("path").datum(data).attr("class", `spark-area ${kind}`).attr("d", area);
  svg.append("path").datum(data).attr("class", `spark-path ${kind}`).attr("d", line);
}

function populateHistoryEntities() {
  if (!state.historyPayload) return;
  const options = [
    { value: MARKET_HISTORY_KEY, label: state.historyPayload.market_label || "整个市场（板块池合计）" },
    ...state.historyPayload.sectors.map((sector) => ({ value: sector.label, label: sector.label })),
  ];
  els.historyEntity.replaceChildren(...options.map((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    return option;
  }));
  if (!options.some((item) => item.value === state.historySelection)) {
    state.historySelection = MARKET_HISTORY_KEY;
  }
  els.historyEntity.value = state.historySelection;
}

function selectedHistorySeries() {
  const payload = state.historyPayload;
  if (!payload) return { title: "--", type: "历史记录", records: [] };
  if (state.historySelection === MARKET_HISTORY_KEY) {
    return {
      title: payload.market_label || "整个市场（板块池合计）",
      type: "整个市场",
      records: payload.market || [],
    };
  }
  const sector = payload.sectors.find((item) => item.label === state.historySelection);
  return {
    title: sector?.label || state.historySelection,
    type: sector?.board_type_cn || "板块",
    records: sector?.records || [],
  };
}

function setHistorySummary(selector, value) {
  const node = document.querySelector(selector);
  node.textContent = formatValue(value, 2);
  node.className = valueClass(value);
}

function renderHistory() {
  if (!state.historyPayload) return;
  const selected = selectedHistorySeries();
  const records = selected.records.slice(-state.historyRange);
  const total = d3.sum(records, (item) => Number(item.value || 0));
  const average = records.length ? total / records.length : 0;
  const latest = records.at(-1)?.value || 0;
  document.querySelector("#history-title").textContent = selected.title;
  document.querySelector("#history-type").textContent = selected.type;
  document.querySelector("#history-count").textContent = records.length
    ? `最近 ${records.length} 个交易日`
    : "暂无记录";
  document.querySelector("#history-note").textContent = state.historySelection === MARKET_HISTORY_KEY
    ? (state.historyPayload.scope_note || "")
    : "按交易日记录该板块当日累计主力净额。";
  setHistorySummary("#history-total", total);
  setHistorySummary("#history-average", average);
  setHistorySummary("#history-latest", latest);
  els.historyEmpty.hidden = records.length > 0;
  document.querySelector(".history-content").hidden = records.length === 0;

  els.historyRows.replaceChildren(...records.slice().reverse().map((item) => {
    const row = document.createElement("tr");
    const direction = Number(item.value) >= 0 ? "净流入" : "净流出";
    row.innerHTML = `<td>${item.date}</td><td class="${valueClass(item.value)}">${direction}</td><td class="${valueClass(item.value)}">${formatValue(item.value, 2)}</td>`;
    return row;
  }));
  renderHistoryChart(records);
}

function renderHistoryChart(records) {
  const svg = d3.select(els.historyChart);
  svg.selectAll("*").remove();
  if (!records.length) return;
  const bounds = els.historyChart.getBoundingClientRect();
  const width = Math.max(320, Math.floor(bounds.width || 760));
  const height = Math.max(320, Math.floor(bounds.height || 430));
  const margin = { top: 20, right: 16, bottom: 42, left: width < 520 ? 48 : 62 };
  svg.attr("viewBox", `0 0 ${width} ${height}`);
  const x = d3.scaleBand()
    .domain(records.map((item) => item.date))
    .range([margin.left, width - margin.right])
    .padding(records.length > 12 ? .24 : .38);
  const extent = d3.extent(records, (item) => Number(item.value));
  const padding = Math.max(1, Math.max(Math.abs(extent[0] || 0), Math.abs(extent[1] || 0)) * .12);
  const y = d3.scaleLinear()
    .domain([Math.min(0, extent[0] || 0) - padding, Math.max(0, extent[1] || 0) + padding])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const zeroY = y(0);
  svg.append("g").attr("class", "history-grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickSize(-(width - margin.left - margin.right)).tickFormat(""));
  svg.append("g").attr("class", "history-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(records.filter((_, index) => records.length <= 10 || index % Math.ceil(records.length / 7) === 0).map((item) => item.date)).tickFormat((date) => date.slice(5)));
  svg.append("g").attr("class", "history-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat((value) => `${value}亿`));
  svg.append("line").attr("class", "axis-line")
    .attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", zeroY).attr("y2", zeroY);
  svg.selectAll("rect.history-bar").data(records).join("rect")
    .attr("class", (item) => `history-bar ${valueClass(item.value)}`)
    .attr("x", (item) => x(item.date))
    .attr("width", x.bandwidth())
    .attr("y", (item) => item.value >= 0 ? y(item.value) : zeroY)
    .attr("height", (item) => Math.max(1, Math.abs(y(item.value) - zeroY)))
    .on("mouseenter", (event, item) => {
      els.tooltip.innerHTML = `<b>${item.date}</b><strong class="${valueClass(item.value)}">${formatValue(item.value, 2)}</strong>`;
      els.tooltip.hidden = false;
      moveTooltip(event);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
}

function renderAll() {
  renderHeader();
  renderBubbles();
  populateHistoryEntities();
  renderHistory();
  if (!state.selectedCode && state.payload?.summary?.leader) {
    const leader = state.payload.sectors.find((item) => item.label === state.payload.summary.leader);
    if (leader) selectSector(sectorKey(leader));
  } else if (state.selectedCode) {
    selectSector(state.selectedCode);
  }
}

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.sectors) || payload.sectors.length === 0) {
    throw new Error("公开快照缺少板块数据");
  }
  for (const item of payload.sectors) {
    if (!item.label || typeof item.value !== "number") {
      throw new Error("公开快照字段不完整");
    }
  }
}

function validateHistoryPayload(payload) {
  if (!payload || !Array.isArray(payload.market) || !Array.isArray(payload.sectors)) {
    throw new Error("历史快照字段不完整");
  }
}

async function fetchFlow({ silent = false } = {}) {
  try {
    if (!silent && !state.payload) els.loading.hidden = false;
    els.refresh.classList.add("spinning");
    const cacheMinute = Math.floor(Date.now() / 60000);
    const [payload, historyPayload] = await Promise.all([
      fetchFirstJson(PUBLIC_DATA_URLS, cacheMinute),
      fetchFirstJson(PUBLIC_HISTORY_URLS, cacheMinute).catch(() => state.historyPayload),
    ]);
    validatePayload(payload);
    state.payload = payload;
    if (historyPayload) {
      validateHistoryPayload(historyPayload);
      state.historyPayload = historyPayload;
    }
    renderAll();
    scheduleRefresh(payload.refresh_seconds || DEFAULT_POLL_SECONDS);
    if (payload.errors?.length) showToast(`部分板块使用缓存：${payload.errors.length}项`);
  } catch (error) {
    const message = `公开快照刷新失败：${error.message}`;
    showToast(message);
    showStatus(`${message}。页面会继续显示最近一次成功数据。`);
    scheduleRefresh(DEFAULT_POLL_SECONDS);
  } finally {
    els.loading.hidden = true;
    els.refresh.classList.remove("spinning");
  }
}

async function fetchFirstJson(urls, cacheMinute) {
  let lastError = null;
  for (const dataUrl of urls) {
    const separator = dataUrl.includes("?") ? "&" : "?";
    try {
      const response = await fetch(`${dataUrl}${separator}v=${cacheMinute}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`公开数据返回 ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("公开快照暂不可用");
}

function scheduleRefresh(seconds) {
  const pollSeconds = Math.max(15, Number(seconds || DEFAULT_POLL_SECONDS));
  window.clearInterval(state.refreshTimer);
  state.refreshTimer = window.setInterval(() => fetchFlow({ silent: true }), pollSeconds * 1000);
  state.nextRefreshAt = Date.now() + pollSeconds * 1000;
  updateCountdown();
  window.clearInterval(state.countdownTimer);
  state.countdownTimer = window.setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  if (!state.nextRefreshAt) return;
  const seconds = Math.max(0, Math.ceil((state.nextRefreshAt - Date.now()) / 1000));
  els.nextRefresh.textContent = `${seconds} 秒后自动检查`;
}

document.querySelectorAll(".filter-segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter-segment").forEach((item) => item.classList.toggle("active", item === button));
    renderBubbles();
  });
});

document.querySelectorAll(".view-segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".view-segment").forEach((item) => item.classList.toggle("active", item === button));
    const showingHistory = state.view === "history";
    els.realtimeView.hidden = showingHistory;
    els.historyView.hidden = !showingHistory;
    els.realtimeFilters.hidden = showingHistory;
    els.search.closest("label").hidden = showingHistory;
    if (showingHistory) window.requestAnimationFrame(renderHistory);
  });
});

document.querySelectorAll(".range-segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.historyRange = Number(button.dataset.days);
    document.querySelectorAll(".range-segment").forEach((item) => item.classList.toggle("active", item === button));
    renderHistory();
  });
});

els.historyEntity.addEventListener("change", () => {
  state.historySelection = els.historyEntity.value;
  renderHistory();
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  renderBubbles();
});

els.refresh.addEventListener("click", () => fetchFlow({ silent: false }));
window.addEventListener("resize", debounce(() => {
  if (state.view === "history") renderHistory();
  else renderBubbles();
}, 160));

function debounce(callback, delay) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

if (window.lucide) window.lucide.createIcons();
fetchFlow();
