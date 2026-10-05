import type { MountGame } from "@/features/table/GameCanvas";

/** Phaser は大きいので、ゲーム画面を開いたときに初めて読み込む */
export const mountPhaser: MountGame = async (parent, options) => {
  const { mountGame } = await import("./game");
  // 読み込んでいる間に画面を離れていたら作らない
  if (options.signal.aborted) return () => {};
  return mountGame(parent, options);
};
