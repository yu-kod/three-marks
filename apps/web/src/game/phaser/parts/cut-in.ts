import type * as Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import type { Skin } from "@/game/skin/skin";
import type { CutIn } from "@/game/state/cut-in";
import { playSound } from "./sound";
import { addText } from "./text";
import { placeVisual } from "./visual";

const BANNER = { width: 360, height: 140 };

/**
 * アワードのカットイン。帯が横から飛び込んで弾み、格が高いほど暗く・揺れ・光り・紙吹雪が舞い、長く残る。
 * ほかの人の投げは小さく短く。絵は差し込み口 cutin.<アワード>、時間はスキンの cutInMs から。
 */
export function playCutIn(scene: Phaser.Scene, skin: Skin, cut: CutIn): Promise<void> {
  const big = cut.mine ? 1 : 0.78;
  const hold = skin.motion.cutInMs * (cut.mine ? 0.5 + cut.tier * 0.18 : 0.45);
  const cx = BASE_WIDTH / 2;
  const cy = BASE_HEIGHT / 2 - 60;

  const shade = scene.add
    .rectangle(
      0,
      0,
      BASE_WIDTH,
      BASE_HEIGHT,
      skin.colors.panel,
      Math.min(0.85, 0.35 + cut.tier * 0.08) * big
    )
    .setOrigin(0)
    .setDepth(60);
  const banner = placeVisual(scene, `cutin.${cut.kind}`, skin.slots[`cutin.${cut.kind}`], {
    x: -BANNER.width,
    y: cy,
    width: BANNER.width * big,
    height: BANNER.height * big,
  }) as Phaser.GameObjects.Image;
  banner.setDepth(62);
  const caption = [cut.who, cut.opened.length > 0 ? `${cut.opened.join("・")} OPEN` : ""]
    .filter(Boolean)
    .join("　");
  const label = addText(scene, skin, cx, cy + (BANNER.height / 2) * big + 26, caption, {
    size: Math.round(20 * big),
    font: "display",
    bold: true,
  })
    .setDepth(62)
    .setAlpha(0);
  const parts: Phaser.GameObjects.GameObject[] = [shade, banner, label];

  playSound(scene, cut.tier >= 3 ? "sfx.start" : "sfx.seat");
  const baseScale = banner.scale;
  scene.tweens.add({ targets: shade, alpha: { from: 0, to: shade.alpha }, duration: 120 });
  scene.tweens.chain({
    targets: banner,
    tweens: [
      { x: cx, duration: 180, ease: "Cubic.easeOut" },
      { scale: { from: baseScale * 1.25, to: baseScale }, duration: 220, ease: "Back.easeOut" },
    ],
  });
  scene.tweens.add({ targets: label, alpha: 1, y: "-=8", delay: 260, duration: 200 });

  if (cut.mine && cut.tier >= 2) {
    const flash = scene.add
      .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0xffffff, 0.55)
      .setOrigin(0)
      .setDepth(61);
    parts.push(flash);
    scene.tweens.add({ targets: flash, alpha: 0, delay: 170, duration: 260 });
  }
  if (cut.mine && cut.tier >= 3) {
    scene.time.delayedCall(180, () =>
      scene.cameras.main.shake(160 + cut.tier * 40, 0.003 * cut.tier)
    );
    // 紙吹雪（席の色）
    const count = 12 + cut.tier * 8;
    for (let i = 0; i < count; i++) {
      const color = skin.colors.players[i % skin.colors.players.length]!;
      const bit = scene.add.rectangle(cx, cy, 6, 12, color).setDepth(63);
      parts.push(bit);
      const angle = Math.random() * Math.PI * 2;
      const reach = 120 + Math.random() * 220;
      scene.tweens.add({
        targets: bit,
        x: cx + Math.cos(angle) * reach,
        y: cy + Math.sin(angle) * reach + 180,
        angle: Math.random() * 720 - 360,
        alpha: { from: 1, to: 0 },
        delay: 180,
        duration: 900 + Math.random() * 500,
        ease: "Cubic.easeOut",
      });
    }
  }

  return new Promise((resolve) => {
    scene.time.delayedCall(400 + hold, () => {
      scene.tweens.add({
        targets: banner,
        x: BASE_WIDTH + BANNER.width,
        duration: 200,
        ease: "Cubic.easeIn",
      });
      scene.tweens.add({
        targets: [shade, label],
        alpha: 0,
        duration: 220,
        onComplete: () => {
          parts.forEach((p) => p.destroy());
          resolve();
        },
      });
    });
  });
}
