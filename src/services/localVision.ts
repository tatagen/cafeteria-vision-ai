import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

import type { CafeteriaAnalysis } from "./gemini";

let modelPromise: Promise<cocoSsd.ObjectDetection> | null = null;

function getModel() {
  if (!modelPromise) {
    modelPromise = cocoSsd.load({ base: "lite_mobilenet_v2" });
  }
  return modelPromise;
}

export async function analyzeLocalCafeteriaFrame(
  source: HTMLCanvasElement | HTMLVideoElement,
): Promise<CafeteriaAnalysis> {
  const model = await getModel();
  const predictions = await model.detect(source);

  const persons = predictions.filter((p) => p.class === "person");
  const personCount = persons.length;

  const frameWidth =
    source instanceof HTMLVideoElement ? source.videoWidth || 1 : source.width || 1;
  const frameHeight =
    source instanceof HTMLVideoElement ? source.videoHeight || 1 : source.height || 1;

  // A simple queue heuristic: several people in the lower-center region.
  const inQueueZone = persons.filter((p) => {
    const [x, y, width, height] = p.bbox;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    return (
      centerX > frameWidth * 0.35 &&
      centerX < frameWidth * 0.65 &&
      centerY > frameHeight * 0.6
    );
  }).length;

  const hasQueue = inQueueZone >= 3 || personCount >= 12;
  const occupancyRate = Math.min(100, Math.round((personCount / 120) * 100));

  let congestionLevel: CafeteriaAnalysis["congestionLevel"] = "空席あり";
  if (occupancyRate > 90) congestionLevel = "満席";
  else if (occupancyRate > 70) congestionLevel = "混雑";
  else if (occupancyRate > 40) congestionLevel = "やや混雑";

  return {
    personCount,
    congestionLevel,
    occupancyRate,
    hasQueue,
    reasoning: "無料ローカルAI（COCO-SSD）で人物検出を実行しました。",
  };
}
