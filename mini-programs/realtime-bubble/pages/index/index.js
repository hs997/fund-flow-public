const mini = typeof tt !== "undefined" ? tt : wx;
const { DATA_URLS, DEFAULT_REFRESH_SECONDS } = require("../../utils/config");

function formatValue(value, digits = 1) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : "-"}${Math.abs(number).toFixed(digits)}亿`;
}

function valueKind(value) {
  return Number(value || 0) >= 0 ? "positive" : "negative";
}

function shortTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(5, 16);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

function mixHex(a, b, t) {
  const av = parseInt(a.slice(1), 16);
  const bv = parseInt(b.slice(1), 16);
  const ar = av >> 16;
  const ag = (av >> 8) & 255;
  const ab = av & 255;
  const br = bv >> 16;
  const bg = (bv >> 8) & 255;
  const bb = bv & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${blue})`;
}

function compactLabel(label, radius) {
  const aliases = {
    人形机器人: "人形机器",
    新能源车: "新能源",
    新能源汽车: "新能源",
    存储芯片: "存储",
    商业航天: "航天",
    有色金属: "有色",
    细分化工: "化工"
  };
  if (radius >= 34 || String(label).length <= 4) return label;
  return aliases[label] || String(label).slice(0, 4);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    mini.request({
      url,
      method: "GET",
      dataType: "json",
      timeout: 10000,
      header: { Accept: "application/vnd.github.raw+json, application/json" },
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`数据返回 ${res.statusCode}`));
          return;
        }
        const payload = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        resolve(payload);
      },
      fail(err) {
        reject(new Error(err.errMsg || "网络请求失败"));
      }
    });
  });
}

Page({
  data: {
    loading: false,
    marketCode: "closed",
    marketLabel: "等待数据",
    tradeDate: "----",
    dataTime: "--:--",
    updatedAtText: "发布 --",
    statusText: "",
    summaryCards: [],
    activeFilter: "all",
    keyword: "",
    canvasWidth: 351,
    canvasHeight: 620,
    selected: null,
    nextRefreshText: "60 秒后刷新"
  },

  onLoad() {
    this.payload = null;
    this.nodes = [];
    this.refreshTimer = null;
    this.countdownTimer = null;
    this.nextRefreshAt = 0;
    this.setCanvasSize();
    this.loadFlow();
  },

  onUnload() {
    this.clearTimers();
  },

  onPullDownRefresh() {
    this.loadFlow({ silent: false }).finally(() => {
      if (mini.stopPullDownRefresh) mini.stopPullDownRefresh();
    });
  },

  setCanvasSize() {
    const system = mini.getSystemInfoSync();
    const width = Math.max(300, Math.floor(system.windowWidth - 24));
    const height = Math.max(580, Math.min(760, Math.floor(system.windowHeight - 260)));
    this.setData({ canvasWidth: width, canvasHeight: height });
  },

  refreshNow() {
    this.loadFlow({ silent: false });
  },

  switchFilter(event) {
    this.setData({ activeFilter: event.currentTarget.dataset.filter || "all" }, () => {
      this.drawBubbles();
    });
  },

  onSearchInput(event) {
    this.setData({ keyword: event.detail.value || "" }, () => {
      this.drawBubbles();
    });
  },

  async loadFlow({ silent = false } = {}) {
    if (!silent) this.setData({ loading: true, statusText: "" });
    const cacheMinute = Math.floor(Date.now() / 60000);
    try {
      let payload = null;
      let lastError = null;
      for (const dataUrl of DATA_URLS) {
        const separator = dataUrl.includes("?") ? "&" : "?";
        try {
          payload = await requestJson(`${dataUrl}${separator}v=${cacheMinute}`);
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!payload) throw lastError || new Error("暂无可用数据源");
      this.validatePayload(payload);
      this.payload = payload;
      this.applyPayload(payload);
      this.scheduleRefresh(payload.refresh_seconds || DEFAULT_REFRESH_SECONDS);
    } catch (error) {
      this.setData({
        statusText: `公开快照刷新失败：${error.message}。页面会继续显示最近一次成功数据。`
      });
      this.scheduleRefresh(DEFAULT_REFRESH_SECONDS);
    } finally {
      if (!silent) this.setData({ loading: false });
    }
  },

  validatePayload(payload) {
    if (!payload || !Array.isArray(payload.sectors) || payload.sectors.length === 0) {
      throw new Error("缺少板块数据");
    }
    payload.sectors.forEach((item) => {
      if (!item.board_code || !item.label || typeof item.value !== "number") {
        throw new Error("快照字段不完整");
      }
    });
  },

  applyPayload(payload) {
    const summary = payload.summary || {};
    const market = payload.market || {};
    const selectedCode = this.data.selected && this.data.selected.board_code;
    this.setData({
      marketCode: market.code || "closed",
      marketLabel: market.label || "未知",
      tradeDate: payload.trade_date || "----",
      dataTime: String(payload.latest_time || "--:--").slice(-5),
      updatedAtText: `发布 ${shortTime(payload.updated_at)}`,
      statusText: payload.ok === false ? "公开快照暂不可用，当前显示最近可用数据。" : "",
      summaryCards: [
        { label: "净流入合计", value: formatValue(summary.inflow_total), name: "", kind: "positive" },
        { label: "净流出合计", value: formatValue(summary.outflow_total), name: "", kind: "negative" },
        { label: "领涨流入", value: formatValue(summary.leader_value), name: summary.leader || "--", kind: "positive" },
        { label: "最大流出", value: formatValue(summary.laggard_value), name: summary.laggard || "--", kind: "negative" }
      ]
    }, () => {
      this.drawBubbles();
      const selected = payload.sectors.find((item) => item.board_code === selectedCode)
        || payload.sectors.find((item) => item.label === summary.leader)
        || payload.sectors[0];
      this.selectSector(selected);
    });
  },

  getFilteredSectors() {
    if (!this.payload) return [];
    const keyword = this.data.keyword.trim().toLowerCase();
    return this.payload.sectors.filter((sector) => {
      if (this.data.activeFilter === "inflow" && sector.value < 0) return false;
      if (this.data.activeFilter === "outflow" && sector.value >= 0) return false;
      if (!keyword) return true;
      return `${sector.label} ${sector.board_name || ""} ${sector.board_code}`.toLowerCase().includes(keyword);
    });
  },

  layoutBubbles(sectors) {
    const width = this.data.canvasWidth;
    const height = this.data.canvasHeight;
    const axisY = height / 2;
    const maxMagnitude = sectors.reduce((max, item) => Math.max(max, Math.abs(item.value)), 1);
    const maxRadius = Math.min(58, Math.max(40, width / 5.2));
    const minRadius = 20;
    const decorate = (item) => {
      const magnitude = Math.abs(item.value);
      const ratio = Math.sqrt(magnitude / maxMagnitude);
      return {
        ...item,
        magnitude,
        radius: minRadius + (maxRadius - minRadius) * ratio
      };
    };
    const positives = sectors.filter((item) => item.value >= 0).map(decorate);
    const negatives = sectors.filter((item) => item.value < 0).map(decorate);
    const place = (items, side) => {
      let x = 12;
      let y = side > 0 ? axisY - 50 : axisY + 50;
      let rowHeight = 0;
      items.sort((a, b) => b.magnitude - a.magnitude).forEach((item) => {
        const diameter = item.radius * 2;
        if (x + diameter + 12 > width) {
          x = 12;
          y += side > 0 ? -(rowHeight + 14) : rowHeight + 14;
          rowHeight = 0;
        }
        item.x = x + item.radius;
        item.y = y + (side > 0 ? -item.radius : item.radius);
        item.y = Math.max(item.radius + 16, Math.min(height - item.radius - 16, item.y));
        item.side = side;
        x += diameter + 10;
        rowHeight = Math.max(rowHeight, diameter);
      });
      return items;
    };
    return [...place(positives, 1), ...place(negatives, -1)];
  },

  drawBubbles() {
    const sectors = this.getFilteredSectors();
    const ctx = mini.createCanvasContext("bubbleCanvas", this);
    const width = this.data.canvasWidth;
    const height = this.data.canvasHeight;
    const axisY = height / 2;
    ctx.clearRect(0, 0, width, height);
    ctx.setFillStyle("#0a1319");
    ctx.fillRect(0, 0, width, height);
    ctx.setFillStyle("rgba(255, 59, 48, 0.035)");
    ctx.fillRect(0, 0, width, axisY);
    ctx.setFillStyle("rgba(0, 209, 125, 0.045)");
    ctx.fillRect(0, axisY, width, axisY);
    ctx.setStrokeStyle("rgba(185, 213, 220, 0.58)");
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(16, axisY);
    ctx.lineTo(width - 16, axisY);
    ctx.stroke();
    ctx.setFillStyle("#dce8eb");
    ctx.setFontSize(12);
    ctx.setTextAlign("center");
    ctx.fillText("主力净流入", width / 2, axisY - 10);
    ctx.fillText("主力净流出", width / 2, axisY + 22);

    this.nodes = this.layoutBubbles(sectors);
    this.nodes.forEach((item) => {
      const ratio = Math.min(1, Math.sqrt(item.magnitude / Math.max(1, this.nodes[0]?.magnitude || 1)));
      const fill = item.side > 0 ? mixHex("#a33934", "#ff4d3d", ratio) : mixHex("#176c4d", "#00d17d", ratio);
      ctx.beginPath();
      ctx.setFillStyle(fill);
      const selectedCode = this.data.selected ? this.data.selected.board_code : "";
      ctx.setStrokeStyle(item.board_code === selectedCode ? "#ffffff" : (item.side > 0 ? "#ffaaa0" : "#7cf0b9"));
      ctx.setLineWidth(item.board_code === selectedCode ? 3 : 1.5);
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setFillStyle("#ffffff");
      ctx.setTextAlign("center");
      ctx.setFontSize(Math.max(12, Math.min(18, item.radius * 0.34)));
      ctx.fillText(compactLabel(item.label, item.radius), item.x, item.y - (item.radius > 34 ? 3 : -4));
      if (item.radius > 30) {
        ctx.setFontSize(Math.max(11, Math.min(16, item.radius * 0.28)));
        ctx.fillText(formatValue(item.value), item.x, item.y + 17);
      }
    });
    ctx.draw();
  },

  onCanvasTap(event) {
    const point = event.detail || {};
    const touch = event.changedTouches && event.changedTouches[0];
    const x = Number(point.x !== undefined ? point.x : (touch ? touch.x : -1));
    const y = Number(point.y !== undefined ? point.y : (touch ? touch.y : -1));
    const hit = this.nodes.find((item) => {
      const dx = x - item.x;
      const dy = y - item.y;
      return Math.sqrt(dx * dx + dy * dy) <= item.radius;
    });
    if (hit) this.selectSector(hit);
  },

  selectSector(sector) {
    if (!sector) return;
    const selected = {
      ...sector,
      kind: valueKind(sector.value),
      formattedValue: formatValue(sector.value, 2),
      superText: formatValue(sector.super_large, 2),
      superKind: valueKind(sector.super_large),
      largeText: formatValue(sector.large, 2),
      largeKind: valueKind(sector.large),
      mediumText: formatValue(sector.medium, 2),
      mediumKind: valueKind(sector.medium),
      smallText: formatValue(sector.small, 2),
      smallKind: valueKind(sector.small)
    };
    this.setData({ selected }, () => this.drawBubbles());
  },

  scheduleRefresh(seconds) {
    this.clearTimers();
    const interval = Math.max(15, Number(seconds || DEFAULT_REFRESH_SECONDS));
    this.nextRefreshAt = Date.now() + interval * 1000;
    this.refreshTimer = setTimeout(() => this.loadFlow({ silent: true }), interval * 1000);
    this.countdownTimer = setInterval(() => {
      const left = Math.max(0, Math.ceil((this.nextRefreshAt - Date.now()) / 1000));
      this.setData({ nextRefreshText: `${left} 秒后刷新` });
    }, 1000);
  },

  clearTimers() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.refreshTimer = null;
    this.countdownTimer = null;
  }
});
