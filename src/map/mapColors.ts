const politicalPalette = [
  "#82c65d",
  "#e8d66d",
  "#e58074",
  "#74b9d5",
  "#a98bd5",
  "#e7a75f",
  "#72c6a0",
  "#d991ba",
] as const;

export function getPoliticalColor(code: string): string {
  return (
    politicalPalette[(Number(code) * 5 + 3) % politicalPalette.length] ??
    politicalPalette[0]
  );
}

export function getPrefectureName(prefectureId: string): string {
  const code = prefectureId.slice(-2);
  return (
    mapData.features.find((feature) => feature.code === code)?.name ??
    prefectureId
  );
}

import mapData from "../data/maps/prefectures.json";
