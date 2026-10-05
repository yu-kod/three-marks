import * as Phaser from "phaser";
import type { MountTable } from "@/features/table/TableCanvas";
import { BASE_HEIGHT, BASE_WIDTH } from "./layout";
import { toCss } from "./parts/color";
import { TableScene } from "./table-scene";

/** 入れ物の中に Phaser のゲームを作る。基準の大きさのまま、縦横比を保って画面に収める */
export const mountTableGame: MountTable = async (parent, { skin, store }) => {
  // 縦横比が合わない画面の余りも、スキンの背景色で埋める
  parent.style.backgroundColor = toCss(skin.colors.background);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: skin.colors.background,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
    },
    scene: new TableScene(skin, store),
  });
  return () => game.destroy(true);
};
