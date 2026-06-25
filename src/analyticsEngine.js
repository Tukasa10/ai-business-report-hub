export function safeDivide(numerator, denominator, fallback = null) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

export function analyzeRows(rows) {
  const cleanRows = Array.isArray(rows) ? rows : [];
  const totals = createEmptyAggregate("全体");
  const productMap = new Map();
  const channelMap = new Map();
  const dateMap = new Map();

  cleanRows.forEach((row) => {
    addToAggregate(totals, row);
    addToAggregate(getAggregate(productMap, row.product_name), row);
    addToAggregate(getAggregate(channelMap, row.channel), row);
    addToAggregate(getAggregate(dateMap, row.date), row);
  });

  finalizeAggregate(totals);

  const productRanking = finalizeList(Array.from(productMap.values()))
    .map((item) => ({
      ...item,
      revenueShare: safeDivide(item.revenue, totals.revenue, 0),
      growthRate: calculateGrowthRate(cleanRows, "product_name", item.name)
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const channelSummary = finalizeList(Array.from(channelMap.values()))
    .map((item) => ({
      ...item,
      revenueShare: safeDivide(item.revenue, totals.revenue, 0)
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const dailySeries = finalizeList(Array.from(dateMap.values()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({ ...item, date: item.name }));

  const previousPeriod = splitPeriod(cleanRows, "previous");
  const currentPeriod = splitPeriod(cleanRows, "current");
  const periodComparison = {
    previousRevenue: sumBy(previousPeriod, "revenue"),
    currentRevenue: sumBy(currentPeriod, "revenue"),
    previousAdSpend: sumBy(previousPeriod, "ad_spend"),
    currentAdSpend: sumBy(currentPeriod, "ad_spend"),
    revenueGrowthRate: growthRate(sumBy(currentPeriod, "revenue"), sumBy(previousPeriod, "revenue")),
    adSpendGrowthRate: growthRate(sumBy(currentPeriod, "ad_spend"), sumBy(previousPeriod, "ad_spend"))
  };

  return {
    totals,
    productRanking,
    channelSummary,
    dailySeries,
    periodComparison,
    growingProducts: productRanking.filter((product) => product.growthRate != null && product.growthRate >= 0.2),
    productsNeedingAttention: productRanking.filter((product) => {
      const lowRoas = product.roas != null && product.roas < 2;
      const noConversionSpend = product.adSpend > 0 && product.conversions === 0;
      const refundRate = safeDivide(product.refunds, product.orders, 0);
      return lowRoas || noConversionSpend || refundRate >= 0.08;
    }),
    anomalies: detectAnomalies(cleanRows, productRanking, dailySeries, totals),
    sourceRowCount: cleanRows.length
  };
}

export function createReportSummaryRows(analysis) {
  const totals = analysis?.totals ?? createEmptyAggregate("全体");
  const topProduct = analysis?.productRanking?.[0];
  const topChannel = analysis?.channelSummary?.[0];

  return [
    { metric: "合計売上", value: totals.revenue, unit: "JPY", note: "CSV全体の売上合計" },
    { metric: "合計注文数", value: totals.orders, unit: "orders", note: "CSV全体の注文数" },
    { metric: "広告費", value: totals.adSpend, unit: "JPY", note: "広告費合計" },
    { metric: "CVR", value: totals.cvr, unit: "ratio", note: "conversions / clicks" },
    { metric: "CPA", value: totals.cpa, unit: "JPY", note: "ad_spend / conversions" },
    { metric: "ROAS", value: totals.roas, unit: "ratio", note: "revenue / ad_spend" },
    { metric: "返金数", value: totals.refunds, unit: "refunds", note: "返金件数合計" },
    { metric: "トップ商品", value: topProduct?.name ?? "-", unit: "text", note: topProduct ? `${topProduct.revenue}円` : "" },
    { metric: "トップチャネル", value: topChannel?.name ?? "-", unit: "text", note: topChannel ? `${topChannel.revenue}円` : "" }
  ];
}

function createEmptyAggregate(name) {
  return {
    name,
    orders: 0,
    revenue: 0,
    adSpend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    refunds: 0,
    cvr: null,
    ctr: null,
    cpa: null,
    roas: null,
    refundRate: null
  };
}

function getAggregate(map, key) {
  const safeKey = key || "未分類";
  if (!map.has(safeKey)) {
    map.set(safeKey, createEmptyAggregate(safeKey));
  }
  return map.get(safeKey);
}

function addToAggregate(aggregate, row) {
  aggregate.orders += toNumber(row.orders);
  aggregate.revenue += toNumber(row.revenue);
  aggregate.adSpend += toNumber(row.ad_spend);
  aggregate.impressions += toNumber(row.impressions);
  aggregate.clicks += toNumber(row.clicks);
  aggregate.conversions += toNumber(row.conversions);
  aggregate.refunds += toNumber(row.refunds);
}

function finalizeAggregate(aggregate) {
  aggregate.cvr = safeDivide(aggregate.conversions, aggregate.clicks);
  aggregate.ctr = safeDivide(aggregate.clicks, aggregate.impressions);
  aggregate.cpa = safeDivide(aggregate.adSpend, aggregate.conversions);
  aggregate.roas = safeDivide(aggregate.revenue, aggregate.adSpend);
  aggregate.refundRate = safeDivide(aggregate.refunds, aggregate.orders);
  return aggregate;
}

function finalizeList(items) {
  return items.map((item) => finalizeAggregate(item));
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function splitPeriod(rows, target) {
  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const midpoint = Math.floor(sorted.length / 2);
  return target === "previous" ? sorted.slice(0, midpoint) : sorted.slice(midpoint);
}

function calculateGrowthRate(rows, key, value) {
  const targetRows = rows.filter((row) => row[key] === value);
  const previous = splitPeriod(targetRows, "previous");
  const current = splitPeriod(targetRows, "current");
  if (previous.length === 0 || current.length === 0) {
    return null;
  }
  return growthRate(sumBy(current, "revenue"), sumBy(previous, "revenue"));
}

function growthRate(current, previous) {
  if (previous === 0 && current > 0) {
    return 1;
  }
  return safeDivide(current - previous, previous);
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + toNumber(row[key]), 0);
}

function detectAnomalies(rows, products, dailySeries, totals) {
  const anomalies = [];
  const averageDailyRevenue = safeDivide(totals.revenue, dailySeries.length, 0) ?? 0;

  products.forEach((product) => {
    if (product.adSpend >= 20000 && product.conversions === 0) {
      anomalies.push({
        level: "high",
        title: "広告費が発生しているがCVがありません",
        target: product.name,
        detail: `${product.name} は広告費 ${product.adSpend} 円に対してCVが0件です。`
      });
    }

    if (product.roas != null && product.roas < 1.5 && product.adSpend > 0) {
      anomalies.push({
        level: "medium",
        title: "ROASが低い商品があります",
        target: product.name,
        detail: `${product.name} のROASは ${product.roas.toFixed(2)} です。`
      });
    }

    if (product.refundRate != null && product.refundRate >= 0.08) {
      anomalies.push({
        level: "medium",
        title: "返金率が高い商品があります",
        target: product.name,
        detail: `${product.name} の返金率は ${(product.refundRate * 100).toFixed(1)}% です。`
      });
    }
  });

  dailySeries.forEach((day, index) => {
    const previousDay = dailySeries[index - 1];
    if (previousDay && previousDay.revenue > 0) {
      const dailyDrop = safeDivide(day.revenue - previousDay.revenue, previousDay.revenue, 0);
      if (dailyDrop <= -0.35) {
        anomalies.push({
          level: "medium",
          title: "日別売上が大きく下落しています",
          target: day.date,
          detail: `${day.date} は前日比 ${(dailyDrop * 100).toFixed(1)}% です。`
        });
      }
    }

    if (averageDailyRevenue > 0 && day.revenue >= averageDailyRevenue * 1.6) {
      anomalies.push({
        level: "low",
        title: "売上が平均より大きく伸びた日があります",
        target: day.date,
        detail: `${day.date} の売上は日次平均の1.6倍以上です。成功要因を確認してください。`
      });
    }
  });

  rows.forEach((row) => {
    if (toNumber(row.clicks) === 0 && toNumber(row.conversions) > 0) {
      anomalies.push({
        level: "high",
        title: "クリック0でCVが記録されています",
        target: `${row.date} ${row.product_name}`,
        detail: "計測タグ、媒体連携、CSV抽出条件の確認が必要です。"
      });
    }
  });

  return anomalies;
}
