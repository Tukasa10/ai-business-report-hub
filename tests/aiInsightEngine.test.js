import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRows } from "../src/analyticsEngine.js";
import { generateInsights } from "../src/aiInsightEngine.js";

test("generateInsights creates summary, recommendations, and next actions", () => {
  const analysis = analyzeRows([
    {
      date: "2026-05-01",
      channel: "Google Ads",
      product_name: "Starter Coffee Set",
      orders: 10,
      revenue: 50000,
      ad_spend: 10000,
      impressions: 10000,
      clicks: 500,
      conversions: 20,
      refunds: 0
    },
    {
      date: "2026-05-02",
      channel: "Instagram",
      product_name: "Trial Tea Bags",
      orders: 3,
      revenue: 9000,
      ad_spend: 25000,
      impressions: 20000,
      clicks: 400,
      conversions: 0,
      refunds: 1
    }
  ]);

  const insights = generateInsights(analysis, { warningCount: 1 });

  assert.match(insights.executiveSummary, /EC売上・広告CSV/);
  assert.ok(insights.keyFindings.length >= 4);
  assert.ok(insights.recommendations.some((item) => item.includes("Trial Tea Bags")));
  assert.ok(insights.nextActions.length > 0);
});

test("generateInsights handles empty analysis", () => {
  const insights = generateInsights({ sourceRowCount: 0 });

  assert.match(insights.executiveSummary, /読み込まれていない/);
  assert.deepEqual(insights.keyFindings, []);
});
