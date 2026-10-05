import * as Phaser from "phaser";
import type { MountGame } from "@/features/table/GameCanvas";
import { BASE_HEIGHT, BASE_WIDTH } from "./layout";
import { toCss } from "./parts/color";
import { pixelRatio } from "./parts/text";
import { EntranceScene } from "./scenes/entrance-scene";
import { RoomScene } from "./scenes/room-scene";

/**
 * 入れ物の中に Phaser のゲームを作る。基準の大きさ（390×844）を縦横比を保って画面に収める。
 * キャンバスは画素密度の倍で作り、ぼやけないようにする（各シーンのカメラで拡大）。
 */
export const mountGame: MountGame = async (parent, { skin, screen }) => {
  // 縦横比が合わない画面の余りも、スキンの背景色で埋める
  parent.style.backgroundColor = toCss(skin.colors.background);
  const ratio = pixelRatio();
  const scene =
    screen.kind === "entrance" ? new EntranceScene(skin, screen) : new RoomScene(skin, screen);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: skin.colors.background,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: BASE_WIDTH * ratio,
      height: BASE_HEIGHT * ratio,
    },
    scene,
  });
  return () => game.destroy(true);
};
