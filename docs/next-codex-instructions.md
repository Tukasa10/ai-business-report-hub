# 次回Codexに渡す指示

## Phase 2候補: Google Sheets / GAS連携設計

このプロジェクトは `/Users/asoutsukasa/Documents/Work/20_Portfolio_Projects/ai-business-report-hub` にあります。

Phase 1では、サンプルCSVを使ったローカルデモとして、CSV読込、集計、可視化、AI風分析コメント、改善提案、HTMLレポート、PDF印刷向けCSS、CSV出力、テスト、ドキュメント整備まで完了しています。

次回は以下を進めてください。

1. 現在のファイル構成と `README.md` / `ROADMAP.md` / `docs/data-schema.md` を確認する。
2. Phase 1のローカル動作を壊さず、Google Sheets連携の設計だけを追加する。
3. 実APIキー、認証情報、実データは使わない。
4. `docs/google-sheets-integration-plan.md` を作成し、シート列、GAS出力形式、CSV互換方針を整理する。
5. 必要なら `src/dataSourceAdapter.js` のような入力抽象化を追加する。
6. テストを追加し、既存のサンプルCSV動作が壊れていないことを確認する。
7. README / PORTFOLIO / ROADMAP / TEST_CHECKLIST を更新する。

## 守ること

- 既存の「AI営業・問い合わせ対応ハブ」と混ぜない。
- 外部APIをPhase 2設計時点で呼ばない。
- APIキーを作らない、書かない、保存しない。
- サンプルCSVで再現できる状態を維持する。
- 0除算、欠損値、不正CSV対応を壊さない。

## 最終報告でほしいこと

- 実装サマリー
- 変更ファイル
- 動作確認結果
- 3人レビュー
- 品質ゲート結果
- 手動確認リスト
- 次回やるべきこと
