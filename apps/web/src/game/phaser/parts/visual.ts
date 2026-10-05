import type * as Phaser from "phaser";
import type { SlotKey, Visual } from "@/game/skin/skin";
import { toCss } from "./color";

/** 差し込み口の絵は、差し込み口の名前をテクスチャの名前にして読み込む */
export function preloadSlots(scene: Phaser.Scene, slots: Record<SlotKey, Visual>) {
  for (const [key, visual] of Object.entries(slots)) {
    if ("image" in visual) scene.load.svg(key, visual.image);
  }
}

type Box = { x: number; y: number; width: number; height: number; radius?: number };

/**
 * 差し込み口の中身を、中心 (x, y)・幅 width・高さ height の枠に置く。
 * stretch なら枠いっぱいに広げ、そうでなければ縦横比を保って枠に収める。文字は font（スキンのフォント）で書く。
 */
export function placeVisual(
  scene: Phaser.Scene,
  key: SlotKey,
  visual: Visual,
  { x, y, width, height, radius = 0 }: Box,
  { stretch = false, font }: { stretch?: boolean; font?: string } = {}
): Phaser.GameObjects.GameObject {
  if ("image" in visual) {
    const image = scene.add.image(x, y, key);
    if (stretch) return image.setDisplaySize(width, height);
    return image.setScale(Math.min(width / image.width, height / image.height));
  }
  if ("text" in visual) {
    const text = scene.add
      .text(x, y, visual.text, {
        fontFamily: font,
        fontSize: `${Math.round(width * visual.size)}px`,
        fontStyle: "bold",
        color: toCss(visual.color),
      })
      .setOrigin(0.5);
    return text.setScale(Math.min(1, width / text.width, height / text.height));
  }
  const graphics = scene.add.graphics();
  if ("rect" in visual) {
    graphics
      .fillStyle(visual.rect, 1)
      .fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    return graphics;
  }
  const outer = Math.min(width, height) / 2;
  visual.rings.forEach((color, i) =>
    graphics.fillStyle(color, 1).fillCircle(x, y, outer * (1 - i / visual.rings.length))
  );
  return graphics;
}
