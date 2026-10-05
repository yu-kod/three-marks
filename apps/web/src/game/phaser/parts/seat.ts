import type * as Phaser from "phaser";
import type { Seat } from "@/game/state/lobby";
import type { Skin } from "@/game/skin/skin";
import { playSound } from "./sound";
import { addText } from "./text";
import { placeVisual } from "./visual";

export const SEAT_SIZE = { width: 340, height: 60 };

/** 待合室の席の札。index は席の順（席の色に使う） */
export function drawSeat(
  scene: Phaser.Scene,
  skin: Skin,
  {
    x,
    y,
    seat,
    index,
    onMoveUp,
  }: { x: number; y: number; seat: Seat; index: number; onMoveUp?: () => void }
): Phaser.GameObjects.Container {
  const key = seat.kind === "cpu" ? "seat.cpu" : seat.me ? "seat.me" : "seat.player";
  const box = { x: 0, y: 0, ...SEAT_SIZE };
  const parts: Phaser.GameObjects.GameObject[] = [
    placeVisual(scene, key, skin.slots[key], box, { stretch: true }),
  ];
  const left = -SEAT_SIZE.width / 2;
  parts.push(
    addText(scene, skin, left + 26, 0, String(index + 1), {
      size: 22,
      font: "display",
      bold: true,
      color: "muted",
    })
  );
  if (seat.kind === "cpu") {
    parts.push(
      addText(scene, skin, left + 52, 0, "CPU が入ります", { size: 16, color: "muted", originX: 0 })
    );
  } else {
    const color = skin.colors.players[index % skin.colors.players.length]!;
    parts.push(scene.add.rectangle(left + 44, 0, 6, 30, color));
    const name = addText(
      scene,
      skin,
      left + 58,
      0,
      seat.me ? `${seat.name}（あなた）` : seat.name,
      {
        size: 17,
        bold: true,
        originX: 0,
      }
    );
    // 長い名前はホストの印に重ならないよう縮める
    const room = SEAT_SIZE.width - 58 - (seat.host ? 96 : 20) - (onMoveUp ? 44 : 0);
    parts.push(name.setScale(Math.min(1, room / name.width)));
    if (seat.host) {
      parts.push(
        placeVisual(scene, "badge.host", skin.slots["badge.host"], {
          x: SEAT_SIZE.width / 2 - (onMoveUp ? 88 : 44),
          y: 0,
          width: 56,
          height: 22,
        })
      );
    }
  }
  if (onMoveUp) {
    const up = placeVisual(scene, "icon.up", skin.slots["icon.up"], {
      x: SEAT_SIZE.width / 2 - 28,
      y: 0,
      width: 36,
      height: 36,
    }) as Phaser.GameObjects.Image;
    up.setInteractive({ useHandCursor: true }).on("pointerup", () => {
      playSound(scene, "sfx.tap");
      onMoveUp();
    });
    parts.push(up);
  }
  return scene.add.container(x, y, parts);
}
