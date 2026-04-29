# Cafeteria Vision AI (食堂なう) 技術仕様書

## 1. プロジェクト概要
「Cafeteria Vision AI」は、AI（Gemini API）を活用して食堂の混雑状況をリアルタイムで可視化・分析するための統合ソリューションです。
複数のカメラノード（スマートフォンやWebカメラ等）をセンサーとして配置し、収集されたデータをクラウド上で自動統合。単なる「人数カウント」に留まらず、AIによる利用傾向の分析と、利用者への最適な行動提案（インサイト）を提供します。

## 2. 技術スタック
- **Frontend**: React 19 / TypeScript / Vite
- **UI/Animation**: Tailwind CSS 4.x / Motion (Framer Motion)
- **Database**: Firebase Firestore (リアルタイム同期 / マルチノード管理)
- **AI Engine**: Google Gemini 1.5 Flash
  - `analyzeCafeteriaImage`: 画像解析（人数、占有率、行列の判定）
  - `getTrendAnalysis`: トレンド分析（履歴に基づいた利用者への助言生成）
- **Charts**: Recharts (時系列データ分析画面用)

## 3. 主要機能詳細

### 3.1 リアルタイム・デジタルツイン (Public View)
- **ライブ統合ステータス**: すべての稼働中ノードのデータを加重平均し、食堂全体の「現在の姿」を表示。
- **Gemini Insight**: AIが過去5件のログと現在の状況を比較し、「徐々に空いてきました」「ピークを過ぎました」といった15文字程度の知的なアドバイスを自動生成。
- **動的ビジュアライザー**: 混雑度に応じたカラーリングとプログレスバーによる直感的なUI。

### 3.2 センサーノード管理 (Admin Panel / Node View)
- **エッジ解析**: 各カメラ端末が個別にGemini APIを叩き、解析結果のみをFirestoreへ送信。
- **手動オーバーライド**: 精度向上のためのキャリブレーション機能。管理者が解析値を直接修正可能。
- **自動シャットダウン**: 10分以上通信が途絶えたノードは集計対象から自動除外。

### 3.3 運用分析 (Dashboard)
- **時系列推移**: 人数と占有率の変化をレイヤーグラフで表示。
- **分析データ出力**: 蓄積された履歴データをCSV形式でエクスポート可能。

## 4. データ・アーキテクチャ (Firestore)

### nodes (現在の各ノード状態)
```json
{
  "id": "uuid",
  "personCount": 42,
  "congestionLevel": "やや混雑",
  "occupancyRate": 55,
  "hasQueue": false,
  "lastUpdate": "Timestamp"
}
```

### history (集計済み履歴)
```json
{
  "personCount": 120,
  "congestionLevel": "混雑",
  "occupancyRate": 85,
  "timestamp": "Timestamp"
}
```

## 5. デザイン原則
- **Technical Minimalism**: モノクロの背景にデータのアクセントカラー。
- **Motion First**: 状態変化（データ更新時）に滑らかなアニメーションを適用。
- **Internal Tool Aesthetic**: 内部ツールらしいフォント（Mono/Sans混合）とグリッドレイアウト。

## 6. 今後の展望
- 混雑予測アルゴリズムの強化（機械学習による1時間後の予測）。
- 社内チャットツール（Slack等）への自動通知連携。
