/** カードの寸法と、数字・ブルの絵を置く枠（カードに対する割合。y は真ん中からのずれ） */
export type CardLayout = {
  width: number;
  height: number;
  glyph?: { width: number; height: number; y: number };
};

/**
 * 数字・ブルの絵を置く枠（px。y はカードの真ん中からのずれ）。
 * スキンが決めていなければ、数字は真ん中に横長、ブルは真ん中に正方形。
 * スキンが決めたら（たとえばカード全体に1本のダーツを描く絵）、どちらもその枠に置く
 */
export function glyphBox(card: CardLayout, kind: "number" | "bull") {
  const { width, height, glyph } = card;
  if (glyph)
    return { y: height * glyph.y, width: width * glyph.width, height: height * glyph.height };
  if (kind === "bull") return { y: 0, width: width * 0.8, height: width * 0.8 };
  return { y: 0, width: width * 0.86, height: height * 0.4 };
}
