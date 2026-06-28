# 🍱 食堂AIカメラ 混雑状況リアルタイム監視システム

カメラ映像をAIで解析し、食堂・共用スペースの混雑状況をリアルタイムでモニタリングするWebアプリです。

---

## ✨ 主な機能

- **AIカメラ解析** — TensorFlow.js（COCO-SSD）でカメラ映像から人数をリアルタイム検出
- **混雑グラフ** — 時間帯別の利用人数をグラフで可視化（Recharts）
- **アラート機能** — 定員超過時に自動アラートを表示
- **Firebase リアルタイム同期** — 複数端末で同じ混雑状況データを共有

## 🛠️ 技術スタック

| 分類 | 技術 |
|------|------|
| フロントエンド | React 19 / TypeScript |
| AI/ML | TensorFlow.js（COCO-SSD モデル） |
| データ | Firebase Firestore |
| グラフ | Recharts |
| ビルド | Vite 6 |

## 🚀 ローカル実行

```bash
git clone https://github.com/tatagen/cafeteria-vision-ai.git
cd cafeteria-vision-ai
npm install
# .env.local に Firebase の設定を記入
npm run dev
```

> カメラへのアクセス許可と Firebase プロジェクトの設定が必要です。