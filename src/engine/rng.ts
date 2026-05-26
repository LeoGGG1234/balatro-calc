export type RngFn = () => number;

export function hashSeedString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export function createRng(seed: number | string): RngFn {
  const n = typeof seed === 'string' ? hashSeedString(seed) : seed;
  let s = n | 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
