import { parseBusinessCsv, parseCsv, rowsToCsv } from "../src/csvParser.js";
import { analyzeRows, safeDivide } from "../src/analyticsEngine.js";
import { generateInsights } from "../src/aiInsightEngine.js";
import { buildExportRows, buildReportCsv } from "../src/reportEngine.js";
import { SAMPLE_CSV } from "../src/sampleData.js";

const results = [];

test("サンプルCSVを読み込める", () => {
  const parsed = parseBusinessCsv(SAMPLE_CSV);
  assert(parsed.errors.length === 0, parsed.errors.join(" / "));
  assert(parsed.rows.length === 30, `${parsed.rows.length} rows`);
  assert(parsed.warnings.length === 1, `${parsed.warnings.length} warnings`);
});

test("売上・注文・広告費・CVR・CPA・ROASを集計できる", () => {
  const analysis = analyzeRows(parseBusinessCsv(SAMPLE_CSV).rows);
  assert(analysis.totals.revenue === 3521000, String(analysis.totals.revenue));
  assert(analysis.totals.orders === 558, String(analysis.totals.orders));
  assert(analysis.totals.adSpend === 550000, String(analysis.totals.adSpend));
  assert(Number.isFinite(analysis.totals.cvr), "CVR is not finite");
  assert(Number.isFinite(analysis.totals.cpa), "CPA is not finite");
  assert(Number.isFinite(analysis.totals.roas), "ROAS is not finite");
});

test("商品別ランキング・チャネル別集計・日別推移を生成できる", () => {
  const analysis = analyzeRows(parseBusinessCsv(SAMPLE_CSV).rows);
  assert(analysis.productRanking[0].name === "Starter Coffee Set", analysis.productRanking[0]?.name);
  assert(analysis.channelSummary.length >= 4, String(analysis.channelSummary.length));
  assert(analysis.dailySeries.length === 10, String(analysis.dailySeries.length));
});

test("異常値と改善対象を検出できる", () => {
  const analysis = analyzeRows(parseBusinessCsv(SAMPLE_CSV).rows);
  assert(analysis.productsNeedingAttention.length > 0, "no weak products");
  assert(analysis.anomalies.length > 0, "no anomalies");
});

test("AI風分析コメントと次アクションを生成できる", () => {
  const parsed = parseBusinessCsv(SAMPLE_CSV);
  const analysis = analyzeRows(parsed.rows);
  const insights = generateInsights(analysis, { warningCount: parsed.warnings.length });
  assert(insights.executiveSummary.includes("EC売上・広告CSV"), insights.executiveSummary);
  assert(insights.recommendations.length > 0, "no recommendations");
  assert(insights.nextActions.length > 0, "no next actions");
});

test("0除算で壊れない", () => {
  assert(safeDivide(10, 0) === null, "default fallback should be null");
  assert(safeDivide(10, 0, 0) === 0, "custom fallback should be 0");
  const analysis = analyzeRows([
    {
      date: "2026-05-01",
      channel: "Organic",
      product_name: "No Ads",
      orders: 1,
      revenue: 1000,
      ad_spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      refunds: 0
    }
  ]);
  assert(analysis.totals.cvr === null, "CVR should be null");
  assert(analysis.totals.cpa === null, "CPA should be null");
  assert(analysis.totals.roas === null, "ROAS should be null");
  assert(analysis.productRanking[0].growthRate === null, "one-row growth should be null");
  assert(analysis.growingProducts.length === 0, "one-row product should not be growing");
});

test("欠損値を警告として扱い、処理を継続できる", () => {
  const csv = [
    "date,channel,product_name,orders,revenue,ad_spend,impressions,clicks,conversions,refunds",
    "2026-05-01,Email,Refill Pack,2,,0,1000,100,5,"
  ].join("\n");
  const parsed = parseBusinessCsv(csv);
  assert(parsed.rows.length === 1, `${parsed.rows.length} rows`);
  assert(parsed.rows[0].revenue === 0, String(parsed.rows[0].revenue));
  assert(parsed.rows[0].refunds === 0, String(parsed.rows[0].refunds));
  assert(parsed.warnings.length === 2, `${parsed.warnings.length} warnings`);
});

test("不正CSVフォーマットで壊れない", () => {
  const missingColumns = parseBusinessCsv("date,channel\n2026-05-01,Email");
  assert(missingColumns.rows.length === 0, "missing column CSV should not be accepted");
  assert(missingColumns.errors.some((error) => error.includes("必須列")), missingColumns.errors.join(" / "));
  const quote = parseCsv("a,b\n\"broken,value");
  assert(quote.errors.some((error) => error.includes("引用符")), quote.errors.join(" / "));
});

test("レポートCSVを出力できる", () => {
  const parsed = parseBusinessCsv(SAMPLE_CSV);
  const analysis = analyzeRows(parsed.rows);
  const insights = generateInsights(analysis, { warningCount: parsed.warnings.length });
  const rows = buildExportRows(analysis, insights, parsed);
  const csv = buildReportCsv(analysis, insights, parsed);
  assert(rows.length === 39, `${rows.length} rows`);
  assert(csv.includes("product_ranking"), "missing product_ranking");
  assert(csv.includes("recommendation"), "missing recommendation");
});

test("CSV出力時にカンマ・引用符・改行をエスケープできる", () => {
  const csv = rowsToCsv([{ a: "x,y", b: "quote \" test", c: "line\nbreak" }], ["a", "b", "c"]);
  assert(csv === "a,b,c\n\"x,y\",\"quote \"\" test\",\"line\nbreak\"", csv);
});

renderResults();

function test(name, callback) {
  try {
    callback();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, message: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "assertion failed");
  }
}

function renderResults() {
  const status = document.querySelector("#status");
  const list = document.querySelector("#results");
  const failed = results.filter((result) => !result.ok);
  document.body.dataset.status = failed.length === 0 ? "passed" : "failed";
  status.className = failed.length === 0 ? "passed" : "failed";
  status.textContent = failed.length === 0
    ? `${results.length}件すべて合格`
    : `${failed.length}件失敗 / ${results.length}件`;
  list.innerHTML = results.map((result) => `
    <li class="${result.ok ? "passed" : "failed"}">
      <strong>${result.ok ? "PASS" : "FAIL"}</strong>
      ${escapeHtml(result.name)}
      ${result.message ? `<div>${escapeHtml(result.message)}</div>` : ""}
    </li>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
