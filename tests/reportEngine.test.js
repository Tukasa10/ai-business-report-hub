import test from "node:test";
import assert from "node:assert/strict";
import { parseBusinessCsv } from "../src/csvParser.js";
import { analyzeRows } from "../src/analyticsEngine.js";
import { generateInsights } from "../src/aiInsightEngine.js";
import { buildReportCsv, buildExportRows } from "../src/reportEngine.js";

test("buildReportCsv exports summary, rankings, recommendations, and anomalies", () => {
  const parserResult = parseBusinessCsv([
    "date,channel,product_name,orders,revenue,ad_spend,impressions,clicks,conversions,refunds",
    "2026-05-01,Google Ads,Starter Coffee Set,10,50000,10000,10000,500,20,0",
    "2026-05-02,Instagram,Trial Tea Bags,3,9000,25000,20000,400,0,1"
  ].join("\n"));
  const analysis = analyzeRows(parserResult.rows);
  const insights = generateInsights(analysis, { warningCount: 0 });
  const rows = buildExportRows(analysis, insights, parserResult);
  const csv = buildReportCsv(analysis, insights, parserResult);

  assert.ok(rows.some((row) => row.section === "summary" && row.metric === "合計売上"));
  assert.ok(rows.some((row) => row.section === "recommendation"));
  assert.match(csv, /product_ranking/);
});
