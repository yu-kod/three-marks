import type * as Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import type { Skin } from "@/game/skin/skin";
import { cardFaceOf } from "@/game/state/card-face";
import type { SeatDrawRound } from "@/game/state/seat-draw";
import { drawCard } from "./card";
import { feedback } from "./sound";
import { addText } from "./text";

/** めくって見せるときは、手札より大きく出す */
const CARD_SCALE = 1.35;

const wait = (scene: Phaser.Scene, ms: number) =>
  new Promise<void>((resolve) => scene.time.delayedCall(ms, resolve));

/** カードを横に半回転して表に返す */
function flip(
  scene: Phaser.Scene,
  skin: Skin,
  back: Phaser.GameObjects.Container,
  front: Phaser.GameObjects.Container
) {
  const half = skin.motion.flipMs / 2;
  front.setScale(0, CARD_SCALE);
  return new Promise<void>((resolve) =>
    scene.tweens.chain({
      tweens: [
        { targets: back, scaleX: 0, duration: half, ease: "Sine.easeIn" },
        { targets: front, scaleX: CARD_SCALE, duration: half, ease: "Back.easeOut" },
      ],
      onComplete: () => resolve(),
    })
  );
}

/**
 * カードを引いて席順を決めた結果を、1人ずつめくって見せる（解釈メモ12）。
 * 引き直しがあれば、回ごとに並べ直して続ける。終わったら閉じる。
 */
export async function playSeatDrawReveal(scene: Phaser.Scene, skin: Skin, rounds: SeatDrawRound[]) {
  const shade = scene.add
    .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, skin.colors.panel, 0.92)
    .setOrigin(0)
    .setDepth(50)
    .setInteractive(); // 下の画面を押せないようにする
  const layer = scene.add.container(0, 0).setDepth(51);
  scene.tweens.add({ targets: [shade, layer], alpha: { from: 0, to: 1 }, duration: 200 });

  for (const round of rounds) {
    layer.removeAll(true);
    layer.add(
      addText(scene, skin, BASE_WIDTH / 2, 250, `席順を決める：${round.label}`, {
        size: 20,
        bold: true,
      })
    );
    const step = Math.min(84, (BASE_WIDTH - 40) / round.draws.length);
    const left = BASE_WIDTH / 2 - (step * (round.draws.length - 1)) / 2;
    const cards = round.draws.map((draw, i) => {
      const x = left + step * i;
      const back = drawCard(scene, skin, { x, y: 400, face: { kind: "back" } }).setScale(
        CARD_SCALE
      );
      const front = drawCard(scene, skin, { x, y: 400, face: cardFaceOf(draw.target) }).setScale(
        CARD_SCALE
      );
      const name = addText(scene, skin, x, 500, draw.name, { size: 13 });
      name.setScale(Math.min(1, (step - 6) / name.width));
      layer.add([back, front, name]);
      return { back, front };
    });
    cards.forEach(({ front }) => front.setScale(0, CARD_SCALE));
    await wait(scene, 500);
    for (const { back, front } of cards) {
      feedback(scene, skin, "flip");
      await flip(scene, skin, back, front);
      scene.tweens.add({ targets: front, y: 392, duration: 120, yoyo: true });
      await wait(scene, 380);
    }
    await wait(scene, 900);
  }
  feedback(scene, skin, "seat");
  await new Promise<void>((resolve) =>
    scene.tweens.add({
      targets: [shade, layer],
      alpha: 0,
      duration: 250,
      onComplete: () => resolve(),
    })
  );
  shade.destroy();
  layer.destroy(true);
}
