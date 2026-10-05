import { deadTargets, MARKS_TO_OPEN, openedTargets, type Marks } from "./marks.js";
import type { Rng } from "./rng.js";
import { TARGETS, type Target } from "./targets.js";
import { resolveThrow, type ThrowResult } from "./throw.js";
import type { GameView } from "./view.js";

/** めくりを試す回数（9章のモデル） */
export const CPU_SAMPLES = 24;

/**
 * 選び方の揺らぎ（softmax の温度）。0 ならいつも一番の手。大きいほど悪い手も選ぶ。
 * 値打ちの差が 1（だいたい1マーク）なら、良い方が約 7 倍選ばれやすい。遊んでみて調整する
 */
export const CPU_TEMPERATURE = 0.5;

/** 値打ちの重み：相手がオープンまでに要るマーク1つにつき（9章のモデル） */
const OPPONENT_NEED_WEIGHT = 0.1;

export type ChooseAimsOptions = {
  temperature?: number;
  samples?: number;
};

/**
 * 1回の投げの値打ち（9章のモデル）。1マーク = 1 ＋ 0.1 ×（相手それぞれがその数字のオープンまでに要るマークの合計）。
 * オープンまでに要る分を超えたマークは数えない（解釈メモ14）。
 */
export function throwValue(result: ThrowResult, me: Marks, opponents: readonly Marks[]): number {
  const gained = new Map<Target, number>();
  for (const target of [...result.hits, ...result.wildHits.map((w) => w.aim)]) {
    gained.set(target, (gained.get(target) ?? 0) + 1);
  }

  let value = 0;
  for (const [target, count] of gained) {
    const counted = Math.min(count, MARKS_TO_OPEN - me[target]);
    const need = opponents.reduce((sum, m) => sum + (MARKS_TO_OPEN - m[target]), 0);
    value += counted * (1 + OPPONENT_NEED_WEIGHT * need);
  }
  return value;
}

/** n 枚から k 枚を選ぶ組み合わせ（添字の並び。手札の並び順） */
function combinations(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  const result: number[][] = [];
  for (let first = 0; first <= n - k; first++) {
    for (const rest of combinations(n - first - 1, k - 1)) {
      result.push([first, ...rest.map((i) => i + first + 1)]);
    }
  }
  return result;
}

/** 候補から k 枚を無作為に抜く（足りなければ全部） */
function sample(pool: readonly Target[], k: number, rng: Rng): Target[] {
  const rest = [...pool];
  const picked: Target[] = [];
  while (picked.length < k && rest.length > 0) {
    picked.push(rest.splice(rng.nextInt(rest.length), 1)[0]!);
  }
  return picked;
}

/** 値打ちに応じた確率で1つ選ぶ（softmax）。温度 0 なら一番（同じなら先のもの） */
function pick(values: readonly number[], temperature: number, rng: Rng): number {
  const best = Math.max(...values);
  if (temperature === 0) {
    return values.indexOf(best);
  }
  const weights = values.map((v) => Math.exp((v - best) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = (rng.nextInt(1_000_000) / 1_000_000) * total;
  // 最後の1つは残りすべて（小数の誤差で r が残っても最後を選ぶ）
  for (let i = 0; i < weights.length - 1; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/**
 * CPU の狙いを選ぶ（docs/spec.md 9章のモデル、解釈メモ14）。返すのは手札のカードの id。
 * CPU 自身の手番に、その CPU 向けの viewFor を渡して呼ぶ（自分のマークは手番の人のものとして読む）。
 *
 * 見る情報は CPU 向けの GameView だけ（山札の中身や他人の手札は見ない）。
 * 手札から出せる組み合わせを全部試し、山札の候補（全41枚 − 自分の手札 − このラウンドに公開された札）から
 * めくりを24回試して値打ちを足し、値打ちに応じた確率で選ぶ（いつも最善だと人が勝てないため）。
 */
export function chooseAims(
  view: GameView,
  rng: Rng,
  { temperature = CPU_TEMPERATURE, samples = CPU_SAMPLES }: ChooseAimsOptions = {}
): number[] {
  const hand = view.myHand;
  if (hand === null) {
    throw new Error("手札が見えない（観戦者）ので狙いを選べない");
  }
  const me = view.players.find((p) => p.id === view.currentThrower)!.marks;
  const opponents = view.players.filter((p) => p.id !== view.currentThrower).map((p) => p.marks);
  const opened = openedTargets(me);
  const dead = deadTargets(view.players.map((p) => p.marks));

  // 見えていない札 = 全体 − 自分の手札 − このラウンドに公開された札
  const unseen = new Map<Target, number>(TARGETS.map((t) => [t, view.rules.deck[t]]));
  const seen = [...hand, ...view.throws.flatMap((t) => [...t.aims, ...t.flips])];
  for (const card of seen) unseen.set(card.target, Math.max(0, unseen.get(card.target)! - 1));
  const pool = TARGETS.flatMap((t) => Array<Target>(unseen.get(t)!).fill(t));

  // 組み合わせどうしを同じめくりで比べる
  const flipsList = Array.from({ length: samples }, () => sample(pool, view.rules.flipCount, rng));
  const combos = combinations(hand.length, view.rules.aimCount);
  const values = combos.map((combo) => {
    const aims = combo.map((i) => hand[i]!.target);
    return flipsList.reduce(
      (sum, flips) => sum + throwValue(resolveThrow({ aims, flips, opened, dead }), me, opponents),
      0
    );
  });

  // 値打ちは試した回数の合計なので、1回あたりに直して温度と比べる
  const average = values.map((v) => v / samples);
  return combos[pick(average, temperature, rng)]!.map((i) => hand[i]!.id);
}
