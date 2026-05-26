/**
 * Shared combination generator. Yields all k-combinations of indices [0..n-1]
 * in lexicographic order using a non-recursive algorithm.
 */
export function* combinations(n: number, k: number): Generator<number[]> {
  if (k <= 0 || k > n) return;

  const indices = Array.from({ length: k }, (_, i) => i);

  while (true) {
    yield [...indices];

    let i = k - 1;
    while (i >= 0 && indices[i] === n - k + i) i--;
    if (i < 0) break;

    indices[i]++;
    for (let j = i + 1; j < k; j++) {
      indices[j] = indices[j - 1] + 1;
    }
  }
}
