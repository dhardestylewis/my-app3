// src/utils/shuffle.ts
/**
 * In-place Fisher-Yates shuffle that returns a *new* array,
 * leaving the original untouched.
 */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
