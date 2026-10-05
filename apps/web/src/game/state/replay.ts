import { addMarks, type GameView, type Marks, type ThrowRecord } from "@three-marks/engine";

/**
 * 再生する1コマ。flip: 1枚めくった / settle: 照合してマークが付いた / round: 次のラウンドへ。
 * 待つ時間はコマの種類ごとにスキンの動きの時間から決める（画面側）。
 */
export type ReplayFrame = {
  kind: "flip" | "settle" | "round";
  view: GameView;
  banner: string | null;
};

const gainedBy = (record: ThrowRecord) => [
  ...record.result.hits,
  ...record.result.wildHits.map((w) => w.aim),
];

/**
 * 前に描いた状態から今の状態までを、1枚ずつ再生するコマにする。
 *
 * サーバーは CPU の手番を一度に進めるので、何人分もの投げがまとめて届く。届いた投げを順に、
 * 1枚ずつめくって照合するコマに分け、ラウンドが変われば切り替わりを挟む。最後のコマは今の状態そのもの。
 * 前にもう見えていためくり札（人が1枚ずつめくっていた続き）は飛ばす。初めて見るときは再生しない。
 * 照合のコマでは誰の手番でもない（次の人の手番は最後のコマで決まる）。
 */
export function replayFrames(prev: GameView | null, next: GameView): ReplayFrame[] {
  if (prev === null) return [];
  const finishedNow = next.phase === "finished" && prev.phase !== "finished";
  const roundChanged = next.round > prev.round;
  // 前のラウンドの投げは、ラウンドが変わる（終わる）と lastRoundThrows に移る
  const oldRound = roundChanged || finishedNow ? next.lastRoundThrows : next.throws;
  const restOfOldRound = oldRound.slice(prev.throws.length);
  const newRound = roundChanged ? next.throws : [];
  if (restOfOldRound.length === 0 && newRound.length === 0 && !roundChanged) return [];

  const marks = new Map<string, Marks>(prev.players.map((p) => [p.id, p.marks]));
  const withMarks = (base: GameView) =>
    base.players.map((p) => ({ ...p, marks: marks.get(p.id)! }));
  const frames: ReplayFrame[] = [];

  function play(
    records: readonly ThrowRecord[],
    base: GameView,
    throwsBefore: readonly ThrowRecord[]
  ) {
    const thrown = [...throwsBefore];
    for (const record of records) {
      const seen =
        base === prev && prev.pending?.player === record.player ? prev.pending.flips.length : 0;
      for (let k = seen + 1; k <= record.flips.length; k++) {
        frames.push({
          kind: "flip",
          banner: null,
          view: {
            ...base,
            players: withMarks(base),
            throws: [...thrown],
            currentThrower: record.player,
            pending: { player: record.player, aims: record.aims, flips: record.flips.slice(0, k) },
          },
        });
      }
      marks.set(record.player, addMarks(marks.get(record.player)!, gainedBy(record)));
      thrown.push(record);
      frames.push({
        kind: "settle",
        banner: null,
        view: {
          ...base,
          players: withMarks(base),
          throws: [...thrown],
          currentThrower: null,
          pending: null,
        },
      });
    }
  }

  play(restOfOldRound, prev, prev.throws);
  if (roundChanged) {
    frames.push({
      kind: "round",
      banner: `ROUND ${next.round}`,
      view: {
        ...next,
        players: withMarks(next),
        throws: [],
        pending: null,
        currentThrower: next.startPlayer,
      },
    });
    play(newRound, next, []);
  }
  // 最後のコマは今の状態そのもの（手札・山札の枚数・次の手番まで合わせる）
  frames[frames.length - 1] = { ...frames.at(-1)!, view: next };
  return frames;
}
