export type RngPart = string | number | boolean;

function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

function key(seed: string, parts: readonly RngPart[]): string {
  return [
    `string:${seed.length}:${seed}`,
    ...parts.map(
      (part) => `${typeof part}:${String(part).length}:${String(part)}`,
    ),
  ].join("|");
}

export function randomUint32(
  seed: string,
  ...semanticParts: readonly RngPart[]
): number {
  return hash32(key(seed, semanticParts));
}

export function randomInt(
  seed: string,
  minInclusive: number,
  maxInclusive: number,
  ...semanticParts: readonly RngPart[]
): number {
  if (
    !Number.isSafeInteger(minInclusive) ||
    !Number.isSafeInteger(maxInclusive) ||
    minInclusive > maxInclusive
  ) {
    throw new Error("RNG bounds must be ordered safe integers");
  }
  const range = maxInclusive - minInclusive + 1;
  return minInclusive + (randomUint32(seed, ...semanticParts) % range);
}
