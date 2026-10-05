/** スキンの色（数値）を Phaser の文字の色（CSS の #rrggbb）にする */
export const toCss = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
