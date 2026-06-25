import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRows, safeDivide } from "../src/analyticsEngine.js";

const rows = [
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
  },
  {
    date: "2026-05-03",
    channel: "Google Ads",
    product_name: "Starter Coffee Set",
    orders: 14,
    revenue: 70000,
    ad_spend: 12000,
    impressions: 12000,
    clicks: 600,
    conversions: 28,
    refunds: 0
  }
];

test("safeDivide returns fallback for zero denominator", () => {
  assert.equal(safeDivide(10, 0), null);
  assert.equal(safeDivide(10, 0, 0), 0);
});

test("analyzeRows calculates totals and core ad metrics", () => {
  const analysis = analyzeRows(rows);

  assert.equal(analysis.totals.revenue, 129000);
  assert.equal(analysis.totals.orders, 27);
  assert.equal(analysis.totals.adSpend, 47000);
  assert.equal(analysis.totals.conversions, 48);
  assert.equal(Number(analysis.totals.cvr.toFixed(4)), 0.032);
  assert.equal(Number(analysis.totals.roas.toFixed(4)), 2.7447);
  assert.equal(Number(analysis.totals.cpa.toFixed(4)), 979.1667);
});

test("analyzeRows builds product ranking and channel summary", () => {
  const analysis = analyzeRows(rows);

  assert.equal(analysis.productRanking[0].name, "Starter Coffee Set");
  assert.equal(analysis.productRanking[0].revenue, 120000);
  assert.equal(analysis.channelSummary[0].name, "Google Ads");
  assert.equal(analysis.dailySeries.length, 3);
});

test("analyzeRows detects weak products and anomalies", () => {
  const analysis = analyzeRows(rows);

  assert.equal(analysis.productsNeedingAttention[0].name, "Trial Tea Bags");
  assert.ok(analysis.anomalies.some((anomaly) => anomaly.title.includes("CVがありません")));
  assert.ok(analysis.anomalies.some((anomaly) => anomaly.title.includes("返金率")));
});

test("analyzeRows handles empty input without throwing", () => {
  const analysis = analyzeRows([]);

  assert.equal(analysis.sourceRowCount, 0);
  assert.equal(analysis.totals.revenue, 0);
  assert.equal(analysis.totals.cvr, null);
  assert.deepEqual(analysis.productRanking, []);
});

test("analyzeRows does not mark one-row products as growing", () => {
  const analysis = analyzeRows([
    {
      date: "2026-05-01",
      channel: "Organic",
      product_name: "Single Row Item",
      orders: 1,
      revenue: 1000,
      ad_spend: 0,
      impressions: 10,
      clicks: 1,
      conversions: 1,
      refunds: 0
    }
  ]);

  assert.equal(analysis.productRanking[0].growthRate, null);
  assert.deepEqual(analysis.growingProducts, []);
});
