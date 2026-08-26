export function dateForTick(tick: number): string {
  if (!Number.isSafeInteger(tick) || tick < 0) throw new Error("Invalid tick");
  const date = new Date(Date.UTC(2030, 0, 1 + tick));
  return date.toISOString().slice(0, 10);
}
