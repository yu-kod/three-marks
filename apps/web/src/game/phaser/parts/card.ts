import type * as Phaser from "phaser";
import type { Skin, SlotKey } from "@/game/skin/skin";
import { placeVisual } from "./visual";

/** カードの表に何を出すか。どのカードがどれになるかは描く側ではなく呼ぶ側が決める */
export type CardFace =
  { kind: "number"; value: 15 | 16 | 17 | 18 | 19 | 20 } | { kind: "bull" } | { kind: "back" };

/**
 * カード1枚。地の絵も数字・ブルの印もスキンの差し込み口から取る（パーツは置くだけ）。
 * x, y はカードの中心。
 */
export function drawCard(
  scene: Phaser.Scene,
  skin: Skin,
  { x, y, face }: { x: number; y: number; face: CardFace }
): Phaser.GameObjects.Container {
  const { width, height, radius } = skin.card;
  const place = (key: SlotKey, box: { width: number; height: number }, stretch = false) =>
    placeVisual(
      scene,
      key,
      skin.slots[key],
      { x: 0, y: 0, radius, ...box },
      {
        stretch,
        font: skin.fonts.display,
      }
    );

  const ground = face.kind === "back" ? "card.back" : "card.face";
  const parts = [place(ground, { width, height }, true)];
  if (face.kind === "number") {
    parts.push(place(`glyph.${face.value}`, { width: width * 0.86, height: height * 0.4 }));
  } else if (face.kind === "bull") {
    parts.push(place("glyph.bull", { width: width * 0.8, height: width * 0.8 }));
  }
  return scene.add.container(x, y, parts);
}
