import { rowsToCsv } from "./csvParser.js";
import { createReportSummaryRows } from "./analyticsEngine.js";

export function formatCurrency(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return Math.round(value).toLocaleString("ja-JP");
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function formatRatio(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(2)}倍`;
}

export function buildExportRows(analysis, insights, parserResult) {
  const rows = [];

  createReportSummaryRows(analysis).forEach((item) => {
    rows.push({
      section: "summary",
      metric: item.metric,
      dimension: "all",
      value: serializeMetricValue(item.value, item.unit),
      note: item.note
    });
  });

  analysis.productRanking.forEach((product, index) => {
    rows.push({
      section: "product_ranking",
      metric: `rank_${index + 1}`,
      dimension: product.name,
      value: product.revenue,
      note: `orders=${product.orders}; roas=${nullableNumber(product.roas)}; cvr=${nullableNumber(product.cvr)}`
    });
  });

  analysis.channelSummary.forEach((channel) => {
    rows.push({
      section: "channel",
      metric: "revenue",
      dimension: channel.name,
      value: channel.revenue,
      note: `ad_spend=${channel.adSpend}; roas=${nullableNumber(channel.roas)}`
    });
  });

  analysis.dailySeries.forEach((day) => {
    rows.push({
      section: "daily",
      metric: "revenue",
      dimension: day.date,
      value: day.revenue,
      note: `orders=${day.orders}; ad_spend=${day.adSpend}`
    });
  });

  insights.recommendations.forEach((recommendation, index) => {
    rows.push({
      section: "recommendation",
      metric: `proposal_${index + 1}`,
      dimension: "ai_mock",
      value: recommendation,
      note: "rule_based"
    });
  });

  analysis.anomalies.forEach((anomaly, index) => {
    rows.push({
      section: "anomaly",
      metric: `anomaly_${index + 1}`,
      dimension: anomaly.target,
      value: anomaly.title,
      note: anomaly.detail
    });
  });

  (parserResult?.warnings ?? []).forEach((warning, index) => {
    rows.push({
      section: "data_quality",
      metric: `warning_${index + 1}`,
      dimension: "csv",
      value: warning,
      note: "parser_warning"
    });
  });

  return rows;
}

export function buildReportCsv(analysis, insights, parserResult) {
  return rowsToCsv(buildExportRows(analysis, insights, parserResult), [
    "section",
    "metric",
    "dimension",
    "value",
    "note"
  ]);
}

function serializeMetricValue(value, unit) {
  if (unit === "ratio" && Number.isFinite(value)) {
    return value.toFixed(4);
  }
  return value;
}

function nullableNumber(value) {
  return Number.isFinite(value) ? value.toFixed(4) : "";
}
