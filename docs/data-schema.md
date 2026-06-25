# データスキーマ

## 必須列

| 列名 | 型 | 内容 |
| --- | --- | --- |
| `date` | string | 日付。`YYYY-MM-DD` を推奨 |
| `channel` | string | 流入チャネル、広告媒体、販売経路 |
| `product_name` | string | 商品名 |
| `orders` | number | 注文数 |
| `revenue` | number | 売上 |
| `ad_spend` | number | 広告費 |
| `impressions` | number | 表示回数 |
| `clicks` | number | クリック数 |
| `conversions` | number | CV数 |
| `refunds` | number | 返金数 |

## 派生指標

- CVR = `conversions / clicks`
- CTR = `clicks / impressions`
- CPA = `ad_spend / conversions`
- ROAS = `revenue / ad_spend`
- 返金率 = `refunds / orders`

## 欠損・不正値

- 数値列の空欄は `0`
- 数値ではない値は `0`
- 主要テキスト列が空の行は集計対象外
- 必須列が不足しているCSVは読み込みエラー
