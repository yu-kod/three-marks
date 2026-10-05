import type * as Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import type { Skin } from "@/game/skin/skin";
import { addText } from "./text";
import { placeVisual } from "./visual";

const SHOW_MS = 2600;

/** 画面の下から一言を出して、しばらくしたら消す */
export function showToast(scene: Phaser.Scene, skin: Skin, message: string) {
  const ground = placeVisual(
    scene,
    "toast",
    skin.slots.toast,
    { x: 0, y: 0, width: 340, height: 52 },
    { stretch: true }
  );
  const text = addText(scene, skin, 0, 0, message, { size: 14, wrapWidth: 310 });
  const toast = scene.add.container(BASE_WIDTH / 2, BASE_HEIGHT + 40, [ground, text]).setDepth(100);
  scene.tweens.chain({
    targets: toast,
    tweens: [
      { y: BASE_HEIGHT - 70, duration: 220, ease: "Back.easeOut" },
      { alpha: 0, delay: SHOW_MS, duration: 300 },
    ],
    onComplete: () => toast.destroy(),
  });
}
