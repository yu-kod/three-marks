import * as Phaser from "phaser";
import type { Skin } from "@/game/skin/skin";
import type { FeedbackEvent } from "@/game/state/feedback";
import { feedback } from "./sound";
import { addText } from "./text";
import { placeVisual } from "./visual";

type ButtonOptions = {
  x: number;
  y: number;
  label: string;
  primary: boolean;
  /** 押されたとき。終わるまでボタンは押せない（連打で二重に送らない） */
  onPress: () => Promise<unknown>;
  /** 押したときの音（既定はタップ） */
  sound?: FeedbackEvent;
};

const SIZE = { primary: { width: 320, height: 56 }, secondary: { width: 320, height: 48 } };

/** ボタン。地はスキンの差し込み口、押すと沈んで戻る */
export function drawButton(scene: Phaser.Scene, skin: Skin, options: ButtonOptions) {
  const { x, y, label, primary, onPress, sound = "tap" } = options;
  const size = primary ? SIZE.primary : SIZE.secondary;
  const key = primary ? "button.primary" : "button.secondary";
  const ground = placeVisual(
    scene,
    key,
    skin.slots[key],
    { x: 0, y: 0, ...size },
    { stretch: true }
  );
  const text = addText(scene, skin, 0, primary ? -2 : 0, label, {
    size: primary ? 20 : 16,
    bold: true,
  });
  const button = scene.add.container(x, y, [ground, text]).setSize(size.width, size.height);
  let busy = false;
  button.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_UP, async () => {
    if (busy) return;
    busy = true;
    button.setAlpha(0.6);
    feedback(scene, skin, sound);
    scene.tweens.add({ targets: button, scale: 0.96, duration: skin.motion.tapMs, yoyo: true });
    try {
      await onPress();
    } finally {
      busy = false;
      if (button.active) button.setAlpha(1);
    }
  });
  return button;
}
