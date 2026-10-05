import { strength, type Target } from "./targets.js";

export type ThrowInput = {
  /** 手札から出した狙い（ふつう3枚） */
  aims: readonly Target[];
  /** 山札からめくった札 */
  flips: readonly Target[];
  /** 投げる人がオープン済みの数字（投げる前の状態。解釈メモ3） */
  opened: ReadonlySet<Target>;
  /** 全員がオープンした数字（死に番。投げる前の状態） */
  dead: ReadonlySet<Target>;
};

export type ThrowResult = {
  /** 通常の命中。1件につきその数字に1マーク */
  hits: Target[];
  /** ワイルドで当たりにした狙い。1件につき aim に1マーク */
  wildHits: { aim: Target; wild: Target }[];
};

/**
 * 1回の投げを照合する（docs/spec.md 4.3、ルール解釈メモ 1〜6）。
 *
 * 1. オープン済みの数字の狙いは何も起こさない
 * 2. 残りの狙いとめくり札を、同じ数字どうし1対1で組にする（通常の命中）
 * 3. 外れた狙いに、ワイルドを当たりが最も多くなるように充てる
 */
export function resolveThrow({ aims, flips, opened, dead }: ThrowInput): ThrowResult {
  const live = aims.filter((aim) => !opened.has(aim));
  const unmatched = [...flips];
  const hits: Target[] = [];
  const missed: Target[] = [];

  for (const aim of live) {
    const index = unmatched.indexOf(aim);
    if (index === -1) {
      missed.push(aim);
    } else {
      unmatched.splice(index, 1);
      hits.push(aim);
    }
  }

  // 通常の命中に使っためくり札は、どれもまだオープンしていない数字なのでワイルドにはならない
  const wilds = unmatched
    .filter((flip) => opened.has(flip) && !dead.has(flip))
    .sort((a, b) => strength(a) - strength(b));

  // 強い狙いほど使えるワイルドが少ない。強い順に「使える中で最も弱いワイルド」を充てると最大になる
  const wildHits: ThrowResult["wildHits"] = [];
  for (const aim of [...missed].sort((a, b) => strength(b) - strength(a))) {
    const index = wilds.findIndex((wild) => strength(wild) > strength(aim));
    if (index !== -1) {
      wildHits.push({ aim, wild: wilds[index]! });
      wilds.splice(index, 1);
    }
  }

  return { hits, wildHits };
}
