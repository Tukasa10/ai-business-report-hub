import { parseBusinessCsv } from "./csvParser.js";
import { analyzeRows, createReportSummaryRows } from "./analyticsEngine.js";
import { generateInsights } from "./aiInsightEngine.js";
import {
  buildReportCsv,
  buildExportRows,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRatio
} from "./reportEngine.js";
import { SAMPLE_CSV } from "./sampleData.js";

const state = {
  parserResult: null,
  analysis: null,
  insights: null,
  sourceName: ""
};

const elements = {
  loadSampleButton: document.querySelector("#loadSampleButton"),
  csvFileInput: document.querySelector("#csvFileInput"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  printButton: document.querySelector("#printButton"),
  dataStatus: document.querySelector("#dataStatus"),
  periodStatus: document.querySelector("#periodStatus"),
  qualityStatus: document.querySelector("#qualityStatus"),
  kpiGrid: document.querySelector("#kpiGrid"),
  trendBadge: document.querySelector("#trendBadge"),
  dailyTrendChart: document.querySelector("#dailyTrendChart"),
  productRankingChart: document.querySelector("#productRankingChart"),
  channelChart: document.querySelector("#channelChart"),
  productTable: document.querySelector("#productTable"),
  channelTable: document.querySelector("#channelTable"),
  insightSummary: document.querySelector("#insightSummary"),
  findingList: document.querySelector("#findingList"),
  actionList: document.querySelector("#actionList"),
  anomalyList: document.querySelector("#anomalyList"),
  exportPreview: document.querySelector("#exportPreview")
};

elements.loadSampleButton.addEventListener("click", () => loadSampleCsv());
elements.csvFileInput.addEventListener("change", handleFileInput);
elements.exportCsvButton.addEventListener("click", exportReportCsv);
elements.printButton.addEventListener("click", () => window.print());

renderEmptyState();
loadSampleCsv();

async function loadSampleCsv() {
  let csvText = SAMPLE_CSV;
  try {
    const response = await fetch("./sample_data/ec_sales_ads_sample.csv", { cache: "no-store" });
    if (response.ok) {
      csvText = await response.text();
    }
  } catch {
    csvText = SAMPLE_CSV;
  }
  processCsv(csvText, "ec_sales_ads_sample.csv");
}

async function handleFileInput(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const text = await file.text();
  processCsv(text, file.name);
}

function processCsv(csvText, sourceName) {
  const parserResult = parseBusinessCsv(csvText);

  if (parserResult.errors.length > 0 && parserResult.rows.length === 0) {
    state.parserResult = parserResult;
    state.analysis = null;
    state.insights = null;
    state.sourceName = sourceName;
    renderErrorState(parserResult);
    return;
  }

  const analysis = analyzeRows(parserResult.rows);
  const insights = generateInsights(analysis, {
    warningCount: parserResult.warnings.length,
    errorCount: parserResult.errors.length
  });

  state.parserResult = parserResult;
  state.analysis = analysis;
  state.insights = insights;
  state.sourceName = sourceName;
  renderReport();
}

function renderReport() {
  const { parserResult, analysis, insights, sourceName } = state;
  elements.dataStatus.textContent = `${sourceName} / ${analysis.sourceRowCount}行`;
  elements.periodStatus.textContent = formatPeriod(analysis.dailySeries);
  const issueCount = parserResult.errors.length + parserResult.warnings.length + analysis.anomalies.length;
  elements.qualityStatus.textContent = issueCount === 0 ? "重大な注意なし" : `注意 ${issueCount}件`;

  renderKpis(analysis);
  renderTables(analysis);
  renderInsights(analysis, insights, parserResult);
  drawDailyTrend(elements.dailyTrendChart, analysis.dailySeries);
  drawHorizontalBars(elements.productRankingChart, analysis.productRanking.slice(0, 5), "revenue");
  drawChannelBars(elements.channelChart, analysis.channelSummary);
  renderExportPreview(analysis, insights, parserResult);
}

function renderKpis(analysis) {
  const summaryRows = createReportSummaryRows(analysis);
  const cards = [
    { label: "合計売上", value: formatCurrency(analysis.totals.revenue), tone: "green" },
    { label: "注文数", value: `${formatNumber(analysis.totals.orders)}件`, tone: "ink" },
    { label: "広告費", value: formatCurrency(analysis.totals.adSpend), tone: "amber" },
    { label: "CVR", value: formatPercent(analysis.totals.cvr), tone: "teal" },
    { label: "CPA", value: formatCurrency(analysis.totals.cpa), tone: "red" },
    { label: "ROAS", value: formatRatio(analysis.totals.roas), tone: "green" },
    { label: "返金数", value: `${formatNumber(analysis.totals.refunds)}件`, tone: "red" },
    { label: "クリック数", value: formatNumber(analysis.totals.clicks), tone: "ink" }
  ];

  elements.kpiGrid.innerHTML = cards.map((card) => `
    <article class="kpi-card ${card.tone}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
    </article>
  `).join("");

  const revenueGrowth = analysis.periodComparison.revenueGrowthRate;
  elements.trendBadge.textContent = revenueGrowth == null
    ? "比較なし"
    : `後半 ${revenueGrowth >= 0 ? "+" : ""}${(revenueGrowth * 100).toFixed(1)}%`;

  elements.exportCsvButton.disabled = summaryRows.length === 0;
}

function renderTables(analysis) {
  elements.productTable.innerHTML = buildTable(
    ["商品", "売上", "注文", "ROAS", "返金率"],
    analysis.productRanking.slice(0, 6).map((product) => [
      product.name,
      formatCurrency(product.revenue),
      formatNumber(product.orders),
      formatRatio(product.roas),
      formatPercent(product.refundRate)
    ])
  );

  elements.channelTable.innerHTML = buildTable(
    ["チャネル", "売上", "広告費", "CVR", "CPA"],
    analysis.channelSummary.map((channel) => [
      channel.name,
      formatCurrency(channel.revenue),
      formatCurrency(channel.adSpend),
      formatPercent(channel.cvr),
      formatCurrency(channel.cpa)
    ])
  );
}

function renderInsights(analysis, insights, parserResult) {
  elements.insightSummary.textContent = insights.executiveSummary;
  elements.findingList.innerHTML = insights.keyFindings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("");
  elements.actionList.innerHTML = insights.nextActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("");

  const dataQualityItems = [
    ...parserResult.errors.map((message) => ({ level: "high", title: "CSVエラー", detail: message })),
    ...parserResult.warnings.map((message) => ({ level: "low", title: "CSV注意", detail: message })),
    ...analysis.anomalies
  ];

  elements.anomalyList.innerHTML = dataQualityItems.length === 0
    ? "<li class=\"muted\">重大な異常値は検出されていません。</li>"
    : dataQualityItems.map((item) => `
      <li class="${escapeHtml(item.level || "low")}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </li>
    `).join("");
}

function renderExportPreview(analysis, insights, parserResult) {
  const rows = buildExportRows(analysis, insights, parserResult);
  elements.exportPreview.innerHTML = `
    <p><strong>${rows.length}</strong> 行のレポートCSVを出力できます。</p>
    <ul>
      <li>summary: 主要KPI</li>
      <li>product_ranking: 商品別ランキング</li>
      <li>channel: チャネル別集計</li>
      <li>daily: 日別推移</li>
      <li>recommendation: 改善提案</li>
      <li>anomaly/data_quality: 異常値・CSV注意</li>
    </ul>
  `;
}

function renderEmptyState() {
  elements.exportCsvButton.disabled = true;
  elements.dataStatus.textContent = "未読込";
  elements.periodStatus.textContent = "-";
  elements.qualityStatus.textContent = "-";
  elements.kpiGrid.innerHTML = document.querySelector("#emptyStateTemplate").innerHTML;
  clearCanvas(elements.dailyTrendChart);
  clearCanvas(elements.productRankingChart);
  clearCanvas(elements.channelChart);
}

function renderErrorState(parserResult) {
  elements.exportCsvButton.disabled = true;
  elements.dataStatus.textContent = "読込エラー";
  elements.periodStatus.textContent = "-";
  elements.qualityStatus.textContent = `エラー ${parserResult.errors.length}件`;
  elements.kpiGrid.innerHTML = `
    <div class="empty-state error">
      <h2>CSVを読み込めませんでした</h2>
      <p>${escapeHtml(parserResult.errors.join(" / "))}</p>
    </div>
  `;
  elements.productTable.innerHTML = "";
  elements.channelTable.innerHTML = "";
  elements.insightSummary.textContent = "";
  elements.findingList.innerHTML = "";
  elements.actionList.innerHTML = "";
  elements.anomalyList.innerHTML = parserResult.errors.map((error) => `<li class="high"><strong>CSVエラー</strong><span>${escapeHtml(error)}</span></li>`).join("");
  elements.exportPreview.innerHTML = "";
  clearCanvas(elements.dailyTrendChart);
  clearCanvas(elements.productRankingChart);
  clearCanvas(elements.channelChart);
}

function exportReportCsv() {
  if (!state.analysis || !state.insights) {
    return;
  }
  const csv = buildReportCsv(state.analysis, state.insights, state.parserResult);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ai_business_report_export.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildTable(headers, rows) {
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function drawDailyTrend(canvas, dailySeries) {
  const context = prepareCanvas(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 30, right: 32, bottom: 48, left: 72 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...dailySeries.map((day) => Math.max(day.revenue, day.adSpend)));

  drawAxes(context, padding, width, height);
  drawLine(context, dailySeries.map((day) => day.revenue), maxValue, padding, plotWidth, plotHeight, "#159268");
  drawLine(context, dailySeries.map((day) => day.adSpend), maxValue, padding, plotWidth, plotHeight, "#d97706");

  context.fillStyle = "#293241";
  context.font = "24px system-ui";
  context.fillText("売上", padding.left, 24);
  context.fillStyle = "#d97706";
  context.fillText("広告費", padding.left + 68, 24);

  context.fillStyle = "#5f6c7b";
  context.font = "18px system-ui";
  dailySeries.forEach((day, index) => {
    if (index % 2 !== 0 && dailySeries.length > 8) {
      return;
    }
    const x = padding.left + (plotWidth * index) / Math.max(1, dailySeries.length - 1);
    context.save();
    context.translate(x, height - 16);
    context.rotate(-Math.PI / 8);
    context.fillText(day.date.slice(5), 0, 0);
    context.restore();
  });
}

function drawHorizontalBars(canvas, items, key) {
  const context = prepareCanvas(canvas);
  const width = canvas.width;
  const maxValue = Math.max(1, ...items.map((item) => item[key]));
  const barHeight = 36;
  const gap = 22;
  const left = 190;
  const top = 42;

  context.font = "20px system-ui";
  items.forEach((item, index) => {
    const y = top + index * (barHeight + gap);
    const barWidth = ((width - left - 44) * item[key]) / maxValue;
    context.fillStyle = "#edf7f2";
    context.fillRect(left, y, width - left - 44, barHeight);
    context.fillStyle = "#159268";
    context.fillRect(left, y, barWidth, barHeight);
    context.fillStyle = "#293241";
    context.fillText(trimText(context, item.name, 165), 20, y + 25);
    context.fillText(formatCurrency(item[key]), left + barWidth + 10, y + 25);
  });
}

function drawChannelBars(canvas, items) {
  const context = prepareCanvas(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const maxValue = Math.max(1, ...items.map((item) => item.revenue));
  const barWidth = Math.min(78, (width - 120) / Math.max(1, items.length) - 20);
  const baseY = height - 64;

  items.forEach((item, index) => {
    const x = 70 + index * ((width - 130) / Math.max(1, items.length));
    const barHeight = ((height - 130) * item.revenue) / maxValue;
    context.fillStyle = ["#159268", "#d97706", "#277da1", "#c2410c", "#64748b"][index % 5];
    context.fillRect(x, baseY - barHeight, barWidth, barHeight);
    context.fillStyle = "#293241";
    context.font = "18px system-ui";
    context.fillText(trimText(context, item.name, 110), x - 10, baseY + 28);
    context.fillStyle = "#5f6c7b";
    context.font = "16px system-ui";
    context.fillText(formatCurrency(item.revenue), x - 16, baseY - barHeight - 12);
  });

  drawAxes(context, { top: 24, right: 30, bottom: 64, left: 54 }, width, height);
}

function drawLine(context, values, maxValue, padding, plotWidth, plotHeight, color) {
  context.strokeStyle = color;
  context.lineWidth = 5;
  context.beginPath();
  values.forEach((value, index) => {
    const x = padding.left + (plotWidth * index) / Math.max(1, values.length - 1);
    const y = padding.top + plotHeight - (plotHeight * value) / maxValue;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();

  context.fillStyle = color;
  values.forEach((value, index) => {
    const x = padding.left + (plotWidth * index) / Math.max(1, values.length - 1);
    const y = padding.top + plotHeight - (plotHeight * value) / maxValue;
    context.beginPath();
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fill();
  });
}

function drawAxes(context, padding, width, height) {
  context.strokeStyle = "#d6dde4";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, height - padding.bottom);
  context.lineTo(width - padding.right, height - padding.bottom);
  context.stroke();
}

function prepareCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return context;
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function trimText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }
  let trimmed = text;
  while (trimmed.length > 1 && context.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function formatPeriod(dailySeries) {
  if (!dailySeries.length) {
    return "-";
  }
  return `${dailySeries[0].date} - ${dailySeries[dailySeries.length - 1].date}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
