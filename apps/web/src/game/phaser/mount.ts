import type { MountTable } from "@/features/table/TableCanvas";

/** Phaser は大きいので、ゲーム画面を開いたときに初めて読み込む */
export const mountPhaser: MountTable = async (parent, options) => {
  const { mountTableGame } = await import("./table-game");
  return mountTableGame(parent, options);
};
