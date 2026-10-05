/**
 * エンジンに注入する乱数。エンジンは Math.random を呼ばず、必ずこれを受け取る（CLAUDE.md）。
 *
 * シードを残しておけば、同じゲームを最初から再現できる（不具合の調査、シミュレーション）。
 */
export type Rng = {
  /** 0 以上 maxExclusive 未満の整数 */
  nextInt(maxExclusive: number): number;
};

/**
 * シード付きの乱数（mulberry32）。
 *
 * 32 ビット整数の演算（Math.imul）だけで回す。number の掛け算で書いた線形合同法は
 * 2^53 を超えて下位ビットが崩れ、偏る。
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    nextInt(maxExclusive) {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const unit = ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
      return Math.floor(unit * maxExclusive);
    },
  };
}

/** Fisher–Yates で並べ替えた新しい配列を返す */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
