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
  storeCapacity: number,
): Promise<CafeteriaAnalysis> {
  const model = await getModel();
  const predictions = await model.detect(source);

  const persons = predictions.filter((p) => p.class === "person");
  const personCount = persons.length;

  const frameWidth =
    source instanceof HTMLVideoElement ? source.videoWidth || 1 : source.width || 1;
  const frameHeight =
    source instanceof HTMLVideoElement ? source.videoHeight || 1 : source.height || 1;

  const occupancyRate = Math.round((personCount / storeCapacity) * 100);

  let congestionLevel: CafeteriaAnalysis["congestionLevel"] = "空席あり";
  if (occupancyRate > 90) congestionLevel = "満席";
  else if (occupancyRate > 70) congestionLevel = "混雑";
  else if (occupancyRate > 40) congestionLevel = "やや混雑";

  console.log("DEBUG occupancy calc", storeCapacity, personCount, occupancyRate);

  return {
    personCount,
    congestionLevel,
    occupancyRate,
    hasQueue: false,
    reasoning: `無料ローカルAI（COCO-SSD）で人物検出を実行。定員${storeCapacity}名を基準に算出。`,
  };
}
