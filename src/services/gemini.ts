import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface CafeteriaAnalysis {
  personCount: number;
  congestionLevel: "空席あり" | "やや混雑" | "混雑" | "満席";
  occupancyRate: number;
  hasQueue: boolean;
  reasoning?: string;
}

export async function analyzeCafeteriaImage(base64Image: string): Promise<CafeteriaAnalysis> {
  if (!ai) {
    throw new Error("Missing VITE_GEMINI_API_KEY");
  }

  const prompt = `あなたは食堂の混雑状況を正確に分析する専門の画像解析アシスタントです。
提出された画像（食堂の定点カメラ映像）を確認し、以下のルールに従って解析結果をJSON形式で出力してください。

### 解析ルール:
1. 人数のカウント: 画像内に写っている人物の総数を推測してください。重なっている場合も可能な限りカウントします。
2. 混雑度の判定: 以下の4段階で判定してください。
   - "空席あり": 席に余裕がある。
   - "やや混雑": 半数程度の席が埋まっている。
   - "混雑": ほとんどの席が埋まっているが、数席は空いている。
   - "満席": 座る場所がない、または行列ができている。
3. 占有率: 食堂全体のキャパシティに対する混雑具合を0〜100%の数値で示してください。
4. 行列の有無: 注文カウンターや入り口に行列ができているか（true / false）。`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          personCount: {
            type: Type.INTEGER,
            description: "Number of people detected in the image.",
          },
          congestionLevel: {
            type: Type.STRING,
            enum: ["空席あり", "やや混雑", "混雑", "満席"],
            description: "Congestion level description.",
          },
          occupancyRate: {
            type: Type.NUMBER,
            description: "Occupancy rate from 0 to 100.",
          },
          hasQueue: {
            type: Type.BOOLEAN,
            description: "Whether a queue is detected.",
          },
          reasoning: {
            type: Type.STRING,
            description: "Brief reasoning for the analysis.",
          }
        },
        required: ["personCount", "congestionLevel", "occupancyRate", "hasQueue"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Failed to get analysis response from Gemini");
  }

  return JSON.parse(text);
}

export async function getTrendAnalysis(historyData: any[], currentStatus: any): Promise<string> {
  if (!ai) {
    return "AIキー未設定のためローカル表示中";
  }

  const prompt = `あなたは食堂のデータサイエンティストです。
以下の過去のログと現在の混雑状況から、利用者に向けた「気の利いた一言アドバイス」を15文字程度で生成してください。
トレンド（人が増えている、減っている、いつもこの時間は混む等）を考慮してください。

### 現在の状況:
人数: ${currentStatus?.personCount}名
占有率: ${currentStatus?.occupancyRate}%
混雑度: ${currentStatus?.congestionLevel}

### 過去のログ (直近5件):
${historyData.slice(0, 5).map(h => `- ${new Date(h.timestamp).toLocaleTimeString()}: ${h.personCount}名 (${h.congestionLevel})`).join("\n")}

出力は純粋にメッセージのみにしてください。例：「徐々に空いてきました。今がチャンスです」「間もなく混雑のピークを迎えます」`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || "状況をAIが分析中です...";
  } catch (e) {
    return "AIによる最適化アドバイス準備中";
  }
}
