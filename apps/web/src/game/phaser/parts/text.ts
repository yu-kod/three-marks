import type * as Phaser from "phaser";
import type { Skin } from "@/game/skin/skin";
import { toCss } from "./color";

/** 画素密度。カメラをこの倍率で拡大して描くので、文字もこの解像度で作る（ぼやけないように） */
export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 3);

type TextOptions = {
  size: number;
  /** display: 数字や見出し / body: 日本語の文 */
  font?: "display" | "body";
  color?: keyof Omit<Skin["colors"], "players">;
  bold?: boolean;
  originX?: number;
  wrapWidth?: number;
};

/** 文字。フォントと色はスキンから取る */
export function addText(
  scene: Phaser.Scene,
  skin: Skin,
  x: number,
  y: number,
  text: string,
  { size, font = "body", color = "text", bold = false, originX = 0.5, wrapWidth }: TextOptions
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: skin.fonts[font],
      fontSize: `${size}px`,
      fontStyle: bold ? "bold" : "normal",
      color: toCss(skin.colors[color]),
      resolution: pixelRatio(),
      align: "center",
      wordWrap: wrapWidth ? { width: wrapWidth, useAdvancedWrap: true } : undefined,
    })
    .setOrigin(originX, 0.5);
}
