# SmartCafé Intelligence

AIカメラ分析を活用した食堂リアルタイム混雑モニタリングシステムです。

## 概要

定点カメラの映像をAIで解析し、食堂の混雑状況（利用者数・占有率・混雑レベル・行列の有無）をリアルタイムで把握・共有するWebアプリケーションです。利用者向けの公開画面と、管理者向けの分析ダッシュボードの2画面構成になっています。

## 機能

### 利用者向け画面
- 現在の混雑レベル（空き・普通・混雑）の表示
- 占有率・利用者数のリアルタイム表示
- 行列の有無の確認

### 管理者向けダッシュボード
- カメラ映像の手動・自動解析（90秒間隔）
- 時間帯別の混雑履歴・トレンド分析
- データのエクスポート機能

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フロントエンド | React / TypeScript / Vite |
| スタイリング | Tailwind CSS |
| データベース | Firebase Firestore |
| ストレージ | Firebase Storage |
| AI | Google Gemini 1.5 Flash |
| 認証 | Firebase Auth |

## 動作の仕組み

1. 管理者がカメラ映像のスナップショットをアップロード
2. Gemini 1.5 Flash APIが画像を解析し、利用者数・混雑度・占有率・行列有無・分析根拠の5項目を抽出
3. Firebase Firestoreにリアルタイム保存
4. 利用者画面に即時反映

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に Firebase と Gemini の API キーを設定
npm run dev
```

環境変数の詳細は `.env.example` を参照してください。
