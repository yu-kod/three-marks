import type { Target, ThrowRecord } from "@three-marks/engine";

/** めくり札 flip（めくった順の番号）が、狙い aim（左からの番号）にくっつく */
export type HitPair = { flip: number; aim: number; kind: "hit" | "wild" };

/**
 * 当たった札をどの狙いにくっつけて見せるか。照合の結果（result）をそのまま札に割り当てる。
 * 通常の命中を先に、めくった順・狙いの左から組にし、残りの札でワイルドを充てた狙いと組にする（解釈メモ1・4）。
 * 並びはめくった順（左から順に飛ばして見せる）。
 */
export function hitPairs(record: ThrowRecord): HitPair[] {
  const usedFlips = new Set<number>();
  const usedAims = new Set<number>();
  const take = (cards: ThrowRecord["flips"], used: Set<number>, target: Target) => {
    const index = cards.findIndex((c, i) => c.target === target && !used.has(i));
    used.add(index);
    return index;
  };
  const pairs: HitPair[] = record.result.hits.map((target) => ({
    flip: take(record.flips, usedFlips, target),
    aim: take(record.aims, usedAims, target),
    kind: "hit",
  }));
  for (const { aim, wild } of record.result.wildHits) {
    pairs.push({
      flip: take(record.flips, usedFlips, wild),
      aim: take(record.aims, usedAims, aim),
      kind: "wild",
    });
  }
  // 見せるのはめくった順
  return pairs.sort((a, b) => a.flip - b.flip);
}
