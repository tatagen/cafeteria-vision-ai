# SmartCafé Intelligence

> AIカメラで食堂の混雑状況をリアルタイム監視するWebアプリ

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FF6C37?style=flat-square&logo=firebase&logoColor=white)
![Gemini API](https://img.shields.io/badge/Gemini_API-4285F4?style=flat-square&logo=google&logoColor=white)

---

## 解決する課題

「食堂が混んでいるか確認したいが、行ってみないとわからない」という問題を解消します。定点カメラの映像をAIが自動解析し、混雑状況をリアルタイムでWeb上に公開します。

---

## 機能

### 利用者向け公開画面
- 現在の混雑レベル（空き / 普通 / 混雑）を一目で確認
- 占有率・利用者数のリアルタイム表示
- 行列の有無を確認

### 管理者向けダッシュボード
- カメラ映像のスナップショットを手動または自動（90秒間隔）で解析
- 時間帯別の混雑履歴・トレンドグラフ
- 解析データのCSVエクスポート

---

## 技術的なポイント

- **Gemini 1.5 Flash** による画像解析：利用者数・混雑度・占有率・行列有無・分析根拠の5項目を1リクエストで抽出
- **Firebase Firestore** のリアルタイムリスナーにより、解析結果を全クライアントへ即時反映（ポーリング不要）
- **Firebase Auth** で管理者画面を保護しつつ、利用者画面は認証不要で公開
- **Firebase Storage** にカメラ画像を保存し、解析履歴を完全に追跡可能

---

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フロントエンド | React / TypeScript / Vite |
| スタイリング | Tailwind CSS |
| データベース | Firebase Firestore |
| ストレージ | Firebase Storage |
| 認証 | Firebase Auth |
| AI | Google Gemini 1.5 Flash |

---

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に Firebase と Gemini の API キーを設定
npm run dev
```

環境変数の詳細は `.env.example` を参照してください。
