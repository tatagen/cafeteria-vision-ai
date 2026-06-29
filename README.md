# 🍽️ 食堂AIカメラ混雑監視システム

食堂の混雑状況をリアルタイムで監視・管理するWebアプリです。カメラ映像解析（AIビジョン）と手動更新の両方に対応しています。

🖥️ **[デモを見る](https://cafeteria-vision-ai.pages.dev/)**

---

## ✨ 主な機能

- **リアルタイム混雑表示** — 在席人数・空席状況をリアルタイムで可視化
- **AIカメラ連携** — カメラ映像から自動で着席・空席を判定
- **手動更新モード** — カメラなしでも手動で混雑状況を更新可能
- **混雑履歴グラフ** — 時間帯別の混雑推移をグラフで確認

## 🛠️ 技術スタック

| 分類 | 技術 |
|------|------|
| フロントエンド | React 19 / TypeScript |
| スタイリング | Tailwind CSS 4 |
| データ | Firebase Firestore（リアルタイム同期） |
| AI | Gemini API（画像解析） |
| ビルド | Vite 6 |
| デプロイ | Cloudflare Pages |

## 🚀 ローカル実行

```bash
git clone https://github.com/tatagen/cafeteria-vision-ai.git
cd cafeteria-vision-ai
cp firebase-applet-config.example.json firebase-applet-config.json
# firebase-applet-config.json にFirebaseプロジェクト情報を入力
npm install
npm run dev
```