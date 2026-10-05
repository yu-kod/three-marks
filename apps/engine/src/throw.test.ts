import { describe, expect, it } from "vitest";
import { resolveThrow } from "./throw.js";
import { TARGETS, type Target } from "./targets.js";

const none = new Set<Target>();

function resolve(
  aims: Target[],
  flips: Target[],
  { opened = none, dead = none }: { opened?: Set<Target>; dead?: Set<Target> } = {}
) {
  return resolveThrow({ aims, flips, opened, dead });
}

describe("resolveThrow — 通常の命中（4.3-1）", () => {
  it("狙いとめくり札の同じ数字が1組になれば、その数字に1マーク", () => {
    expect(resolve([18, 17, "bull"], [17, 15, 16, 19, 20])).toEqual({ hits: [17], wildHits: [] });
  });

  it("組は1対1。めくり札が多くても狙い1枚につき1組まで", () => {
    expect(resolve([18, 15, 16], [18, 18, 18, 20, 20]).hits).toEqual([18]);
  });

  it("狙いが多くても、めくり札1枚につき1組まで", () => {
    expect(resolve([18, 18, 18], [18, 15, 16, 17, 20]).hits).toEqual([18]);
  });

  it("同じ数字を重ねて狙えば、1投で同じ数字に複数マーク入る（解釈メモ6）", () => {
    expect(resolve([18, 18, 15], [18, 18, 16, 17, 20]).hits).toEqual([18, 18]);
  });

  it("何も当たらなければ空振り", () => {
    expect(resolve([15, 16, 17], [18, 19, 20, "bull", 18])).toEqual({ hits: [], wildHits: [] });
  });
});

describe("resolveThrow — ワイルド（4.3-2, 3）", () => {
  it("spec の例: 17 は命中、20 のワイルドを 18 に充てる、Bull には充てられない", () => {
    const result = resolve([18, 17, "bull"], [20, 20, 17, 15, 16], { opened: new Set([20]) });

    expect(result).toEqual({ hits: [17], wildHits: [{ aim: 18, wild: 20 }] });
  });

  it("自分がオープンしていない数字のめくり札はワイルドにならない", () => {
    expect(resolve([18, 15, 16], [20, 19, 17, 17, 17]).wildHits).toEqual([]);
  });

  it("全員がオープンした数字（死に番）はワイルドにならない", () => {
    const opened = new Set<Target>([20]);

    expect(resolve([18, 15, 16], [20, 19, 17, 17, 17], { opened, dead: opened }).wildHits).toEqual(
      []
    );
  });

  it("ワイルドより強い狙いには使えない（Bull はどのワイルドでも当たらない）", () => {
    const result = resolve(["bull", 20, 19], [20, 19, 15, 15, 15], { opened: new Set([20, 19]) });

    expect(result.wildHits).toEqual([]);
  });

  it("Bull のワイルドは 20 にも使える", () => {
    const result = resolve([20, 15, 15], ["bull", 16, 16, 16, 16], { opened: new Set(["bull"]) });

    expect(result.wildHits).toEqual([{ aim: 20, wild: "bull" }]);
  });

  it("ワイルド1枚で当たりにできる狙いは1枚", () => {
    const result = resolve([18, 17, 16], [20, 15, 15, 15, 15], { opened: new Set([20]) });

    expect(result.wildHits).toHaveLength(1);
  });

  it("当たりが最も多くなるように充てる（強いワイルドを弱い狙いで使い切らない）", () => {
    // 15 に 20 を充てると 19 に充てられるものが無くなる。19←20、15←16 で2つ
    const result = resolve([15, 19, 17], [20, 16, 18, 18, 18], { opened: new Set([20, 16]) });

    expect(result.wildHits).toHaveLength(2);
    expect(result.wildHits).toContainEqual({ aim: 19, wild: 20 });
    expect(result.wildHits).toContainEqual({ aim: 15, wild: 16 });
  });

  it("通常の命中で当たった狙いにはワイルドを充てない（解釈メモ1）", () => {
    const result = resolve([17, 15, 16], [17, 20, 18, 18, 18], { opened: new Set([20]) });

    expect(result).toEqual({ hits: [17], wildHits: [{ aim: 16, wild: 20 }] });
  });
});

describe("resolveThrow — オープン済みの数字の狙い（4.3-4, 解釈メモ5）", () => {
  it("命中しても何も起きない", () => {
    expect(resolve([19, 15, 16], [19, 18, 18, 18, 18], { opened: new Set([19]) }).hits).toEqual([]);
  });

  it("ワイルドの充て先にもならない", () => {
    const result = resolve([19, 15, 16], [20, 18, 18, 18, 18], { opened: new Set([19, 20]) });

    expect(result.wildHits.map((w) => w.aim)).not.toContain(19);
  });

  it("その数字のめくり札は、ワイルドとして他の狙いに使える", () => {
    const result = resolve([19, 15, 16], [19, 18, 18, 18, 18], { opened: new Set([19]) });

    expect(result.wildHits).toHaveLength(1);
    expect(result.wildHits[0]).toMatchObject({ wild: 19 });
  });
});

describe("resolveThrow — ワイルドの割り当てが最適であること", () => {
  /** 外れた狙いとワイルドの組み合わせを総当たりして、当たりの最大数を求める */
  function bruteForceMax(missed: Target[], wilds: Target[]): number {
    const [aim, ...rest] = missed;
    if (aim === undefined) return 0;
    let best = bruteForceMax(rest, wilds); // この狙いには充てない
    wilds.forEach((wild, i) => {
      if (TARGETS.indexOf(wild) > TARGETS.indexOf(aim)) {
        const remaining = wilds.filter((_, j) => j !== i);
        best = Math.max(best, 1 + bruteForceMax(rest, remaining));
      }
    });
    return best;
  }

  /**
   * テスト専用の決定的な乱数（mulberry32）。
   * 32 ビット整数の演算（Math.imul）で回す。素朴な線形合同法を number の掛け算で書くと
   * 2^53 を超えて下位ビットが崩れ、偏った入力しか作れない
   */
  function seeded(seed: number) {
    let s = seed >>> 0;
    return (n: number) => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 2 ** 32) * n);
    };
  }

  it("2000 通りの投げで、総当たりの最大と同じ数だけ当たりにする", () => {
    const next = seeded(42);
    const pick = () => TARGETS[next(TARGETS.length)]!;

    for (let i = 0; i < 2000; i++) {
      const opened = new Set(TARGETS.filter(() => next(2) === 0));
      const aims = [pick(), pick(), pick()];
      const flips = [pick(), pick(), pick(), pick(), pick()];

      const { hits, wildHits } = resolveThrow({ aims, flips, opened, dead: none });

      const live = aims.filter((a) => !opened.has(a));
      const missed = [...live];
      hits.forEach((h) => missed.splice(missed.indexOf(h), 1));
      const unmatched = [...flips];
      hits.forEach((h) => unmatched.splice(unmatched.indexOf(h), 1));
      const wilds = unmatched.filter((f) => opened.has(f));

      expect(wildHits.length).toBe(bruteForceMax(missed, wilds));
    }
  });
});
