import { safeDivide } from "./analyticsEngine.js";

export function generateInsights(analysis, dataQuality = {}) {
  if (!analysis || analysis.sourceRowCount === 0) {
    return {
      executiveSummary: "CSVデータが読み込まれていないため、分析コメントを生成できません。",
      keyFindings: [],
      recommendations: [],
      nextActions: [],
      anomalyComments: []
    };
  }

  const totals = analysis.totals;
  const topProduct = analysis.productRanking[0];
  const topChannel = analysis.channelSummary[0];
  const weakProducts = analysis.productsNeedingAttention.slice(0, 3);
  const growingProducts = analysis.growingProducts.slice(0, 3);
  const revenueGrowth = analysis.periodComparison.revenueGrowthRate;
  const roasText = totals.roas == null ? "算出不可" : `${totals.roas.toFixed(2)}倍`;
  const cvrText = totals.cvr == null ? "算出不可" : `${(totals.cvr * 100).toFixed(1)}%`;

  const trendText = revenueGrowth == null
    ? "前半・後半比較は算出できません"
    : revenueGrowth >= 0
      ? `後半売上は前半比 ${(revenueGrowth * 100).toFixed(1)}% 増加しています`
      : `後半売上は前半比 ${Math.abs(revenueGrowth * 100).toFixed(1)}% 減少しています`;

  const keyFindings = [
    `全体売上は ${totals.revenue.toLocaleString("ja-JP")} 円、注文数は ${totals.orders.toLocaleString("ja-JP")} 件です。`,
    `広告費は ${totals.adSpend.toLocaleString("ja-JP")} 円、CVRは ${cvrText}、ROASは ${roasText} です。`,
    topProduct ? `売上トップ商品は ${topProduct.name} で、売上構成比は ${(topProduct.revenueShare * 100).toFixed(1)}% です。` : "商品別売上は算出できません。",
    topChannel ? `最も売上が大きいチャネルは ${topChannel.name} です。` : "チャネル別売上は算出できません。",
    trendText
  ];

  if (growingProducts.length > 0) {
    keyFindings.push(`伸びている商品は ${growingProducts.map((item) => item.name).join("、")} です。`);
  }

  const recommendations = buildRecommendations(analysis, weakProducts);
  const nextActions = buildNextActions(analysis, weakProducts, growingProducts);
  const anomalyComments = analysis.anomalies.slice(0, 6).map((anomaly) => `${anomaly.title}: ${anomaly.detail}`);
  const warningCount = dataQuality.warningCount ?? 0;

  return {
    executiveSummary: [
      "EC売上・広告CSVをもとに、売上貢献の大きい商品と広告効率の悪い商品を分けて確認できます。",
      `${trendText}。`,
      weakProducts.length > 0
        ? `優先改善対象は ${weakProducts.map((item) => item.name).join("、")} です。`
        : "大きな改善対象は限定的で、伸びている商品の再現性確認が優先です。",
      warningCount > 0 ? `データ品質の注意点が ${warningCount} 件あります。` : "CSVの必須項目は読み込めています。"
    ].join(""),
    keyFindings,
    recommendations,
    nextActions,
    anomalyComments
  };
}

function buildRecommendations(analysis, weakProducts) {
  const recommendations = [];
  const totals = analysis.totals;

  if (totals.roas != null && totals.roas < 2.5) {
    recommendations.push("ROASが低めのため、広告配信を商品別に分解し、低効率商品の入札・配信面・キーワードを見直してください。");
  } else {
    recommendations.push("全体ROASは一定水準を保っているため、売上上位商品の予算増額余地を検証してください。");
  }

  if (totals.cvr != null && totals.cvr < 0.04) {
    recommendations.push("CVR改善のため、商品ページのファーストビュー、価格訴求、レビュー表示、購入導線を優先的に確認してください。");
  }

  weakProducts.forEach((product) => {
    const reasons = [];
    if (product.roas != null && product.roas < 2) {
      reasons.push(`ROAS ${product.roas.toFixed(2)}倍`);
    }
    if (product.conversions === 0 && product.adSpend > 0) {
      reasons.push("広告費あり・CVなし");
    }
    if (product.refundRate != null && product.refundRate >= 0.08) {
      reasons.push(`返金率 ${(product.refundRate * 100).toFixed(1)}%`);
    }
    recommendations.push(`${product.name} は ${reasons.join("、")} のため、広告停止・LP改善・商品説明見直しの優先候補です。`);
  });

  const adSpendGrowth = analysis.periodComparison.adSpendGrowthRate;
  const revenueGrowth = analysis.periodComparison.revenueGrowthRate;
  if (adSpendGrowth != null && revenueGrowth != null && adSpendGrowth > revenueGrowth + 0.2) {
    recommendations.push("広告費の伸びに対して売上伸び率が弱いため、直近キャンペーンのCPA上昇要因を確認してください。");
  }

  return unique(recommendations).slice(0, 6);
}

function buildNextActions(analysis, weakProducts, growingProducts) {
  const actions = [];
  const topProduct = analysis.productRanking[0];
  const topChannel = analysis.channelSummary[0];
  const worstProduct = weakProducts[0];

  if (worstProduct) {
    actions.push(`${worstProduct.name} の広告費、CVR、返金理由を確認し、改善まで一時的に配信を絞る。`);
  }

  if (topProduct && topChannel) {
    actions.push(`${topProduct.name} と ${topChannel.name} の組み合わせで、勝ちパターンの訴求・配信条件を洗い出す。`);
  }

  if (growingProducts.length > 0) {
    actions.push(`${growingProducts[0].name} の在庫・広告予算・商品ページを確認し、伸びている要因を横展開する。`);
  }

  const cpa = analysis.totals.cpa;
  const averageOrderValue = safeDivide(analysis.totals.revenue, analysis.totals.orders, 0);
  if (cpa != null && averageOrderValue > 0) {
    actions.push(`平均注文単価 ${Math.round(averageOrderValue).toLocaleString("ja-JP")} 円に対して、許容CPAを再設定する。`);
  }

  actions.push("同じCSV形式で週次レポートを更新し、異常値と改善施策の結果を継続比較する。");
  return unique(actions).slice(0, 5);
}

function unique(items) {
  return Array.from(new Set(items));
}
