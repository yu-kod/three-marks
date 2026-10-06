import type * as Phaser from "phaser";
import type { Skin, SlotKey } from "@/game/skin/skin";
import type { CardFace } from "@/game/state/card-face";
import { glyphBox } from "@/game/skin/card-layout";
import { placeVisual } from "./visual";

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
  const place = (
    key: SlotKey,
    box: { width: number; height: number; y?: number },
    stretch = false
  ) =>
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
    parts.push(place(`glyph.${face.value}`, glyphBox(skin.card, "number")));
  } else if (face.kind === "bull") {
    parts.push(place("glyph.bull", glyphBox(skin.card, "bull")));
  }
  return scene.add.container(x, y, parts);
}
