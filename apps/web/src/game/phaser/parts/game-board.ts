import type * as Phaser from "phaser";
import { BASE_WIDTH } from "../layout";
import type { Skin, SlotKey } from "@/game/skin/skin";
import type { CardFace } from "@/game/state/card-face";
import { BOARD_ORDER, type FlipOutcome, type GameModel } from "@/game/state/game-model";
import type { Target } from "@three-marks/engine";
import { drawCard } from "./card";
import { addText } from "./text";
import { placeVisual } from "./visual";

/** 得点表の列。左に2人、真ん中に数字、右に2人（席順） */
const COLUMNS = [42, 118, BASE_WIDTH / 2, 272, 348];
const PLAYER_COLUMNS = [COLUMNS[0]!, COLUMNS[1]!, COLUMNS[3]!, COLUMNS[4]!];
const ROW_HEIGHT = 36;
/** 得点表の上端（基準座標） */
export const BOARD_TOP = 136;

/** 得点表で、ある人（席順）のある数字のマークが入る場所 */
export function boardCell(target: Target, seat: number): { x: number; y: number } {
  return {
    x: PLAYER_COLUMNS[seat]!,
    y: BOARD_TOP + BOARD_ORDER.indexOf(target) * ROW_HEIGHT + ROW_HEIGHT / 2,
  };
}

const glyphOf = (target: GameModel["rows"][number]["target"]): SlotKey =>
  target === "bull" ? "board.bull" : `board.${target}`;

/** 上のプレイヤーの札。手番の人には印、自分は縁取り。オープンした数 / 7 */
export function drawPlayerPanels(
  scene: Phaser.Scene,
  skin: Skin,
  players: GameModel["players"],
  y: number
): Phaser.GameObjects.Container {
  const width = 88;
  const gap = 6;
  const left = BASE_WIDTH / 2 - ((width + gap) * players.length - gap) / 2 + width / 2;
  const panels = players.map((p, i) => {
    const x = left + i * (width + gap);
    const color = skin.colors.players[i % skin.colors.players.length]!;
    const parts: Phaser.GameObjects.GameObject[] = [
      scene.add.rectangle(0, 0, width, 52, p.turn ? color : skin.colors.panel, p.turn ? 1 : 0.9),
      scene.add.rectangle(0, -24, width, 4, color),
    ];
    if (p.me) parts.push(scene.add.rectangle(0, 0, width, 52).setStrokeStyle(2, skin.colors.text));
    const name = addText(scene, skin, -width / 2 + 6, -11, p.name, {
      size: 11,
      bold: true,
      originX: 0,
    });
    name.setScale(Math.min(1, (width - (p.turn ? 30 : 12)) / name.width));
    parts.push(name);
    parts.push(
      addText(scene, skin, -width / 2 + 6, 11, `${p.open}`, {
        size: 22,
        font: "display",
        bold: true,
        originX: 0,
      }),
      addText(scene, skin, -width / 2 + 24, 14, "/7", { size: 11, color: "muted", originX: 0 })
    );
    if (p.turn) {
      parts.push(
        placeVisual(scene, "icon.turn", skin.slots["icon.turn"], {
          x: width / 2 - 13,
          y: -11,
          width: 18,
          height: 18,
        })
      );
    }
    if (p.winner) {
      parts.push(
        addText(scene, skin, width / 2 - 6, 12, "WIN", {
          size: 12,
          font: "display",
          bold: true,
          originX: 1,
        })
      );
    }
    return scene.add.container(x, 0, parts);
  });
  return scene.add.container(0, y, panels);
}

/** 得点表。数字の列が真ん中、4人のマーク。全員がオープンした数字（死に番）は暗くする */
export function drawScoreboard(
  scene: Phaser.Scene,
  skin: Skin,
  rows: GameModel["rows"],
  y: number
): Phaser.GameObjects.Container {
  const height = rows.length * ROW_HEIGHT + 8;
  const parts: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(
      BASE_WIDTH / 2,
      height / 2 - 4,
      BASE_WIDTH - 20,
      height,
      skin.colors.panel,
      0.85
    ),
  ];
  rows.forEach((row, r) => {
    const rowY = r * ROW_HEIGHT + ROW_HEIGHT / 2;
    const items: Phaser.GameObjects.GameObject[] = [
      placeVisual(scene, glyphOf(row.target), skin.slots[glyphOf(row.target)], {
        x: COLUMNS[2]!,
        y: rowY,
        width: 46,
        height: 28,
      }),
    ];
    row.marks.forEach((mark, p) => {
      if (mark === 0) return;
      const key = `mark.${Math.min(mark, 3)}` as SlotKey;
      items.push(
        placeVisual(scene, key, skin.slots[key], {
          x: PLAYER_COLUMNS[p]!,
          y: rowY,
          width: 28,
          height: 28,
        })
      );
    });
    if (r < rows.length - 1) {
      items.push(
        scene.add.rectangle(
          BASE_WIDTH / 2,
          rowY + ROW_HEIGHT / 2,
          BASE_WIDTH - 36,
          1,
          skin.colors.text,
          0.08
        )
      );
    }
    const line = scene.add.container(0, 0, items).setAlpha(row.dead ? 0.25 : 1);
    parts.push(line);
  });
  return scene.add.container(0, y, parts);
}

const SMALL = 0.5;

/** 小さなカードを並べる（狙い → めくり） */
export function drawThrowStrip(
  scene: Phaser.Scene,
  skin: Skin,
  {
    title,
    aims,
    flips,
    flipsLeft = 0,
  }: {
    title: string;
    aims: CardFace[];
    flips: { face: CardFace; outcome: FlipOutcome | null }[];
    flipsLeft?: number;
  },
  y: number
): Phaser.GameObjects.Container {
  const w = skin.card.width * SMALL;
  const step = w + 4;
  const parts: Phaser.GameObjects.GameObject[] = [
    addText(scene, skin, 16, -46, title, { size: 12, color: "muted", originX: 0 }),
  ];
  let x = 16 + w / 2;
  for (const face of aims) {
    parts.push(drawCard(scene, skin, { x, y: 0, face }).setScale(SMALL));
    x += step;
  }
  parts.push(addText(scene, skin, x + 2, 0, "→", { size: 16, color: "muted" }));
  x += 18;
  for (const { face, outcome } of flips) {
    const card = drawCard(scene, skin, { x, y: 0, face }).setScale(SMALL);
    if (outcome === "miss") card.setAlpha(0.35);
    parts.push(card);
    if (outcome === "wild") {
      parts.push(
        addText(scene, skin, x, 36, "WILD", {
          size: 9,
          font: "display",
          bold: true,
          color: "accent",
        })
      );
    }
    x += step;
  }
  for (let i = 0; i < flipsLeft; i++) {
    parts.push(
      drawCard(scene, skin, { x, y: 0, face: { kind: "back" } })
        .setScale(SMALL)
        .setAlpha(0.5)
    );
    x += step;
  }
  return scene.add.container(0, y, parts);
}
