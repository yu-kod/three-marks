import { z } from "zod";

const color = z.string().regex(/^#[0-9a-f]{6}$/i, "色は #rrggbb で書く");

/**
 * 画面に出るものごとの差し込み口。パーツは名前で取り出して置くだけで、自分で絵を描かない。
 * 新しいパーツを作るときは、ここに差し込み口を足し、すべての同梱スキンに中身を入れる。
 */
export const SLOT_KEYS = [
  "card.face",
  "card.back",
  "glyph.15",
  "glyph.16",
  "glyph.17",
  "glyph.18",
  "glyph.19",
  "glyph.20",
  "glyph.bull",
] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

/**
 * 差し込み口の中身。基本はデザインした絵（image）を入れる。
 * 文字（text）や単純な図形（rect: 塗りつぶし / rings: 外から順の同心円）も入れられる。
 */
const visualSchema = z.union([
  z.object({ image: z.string().min(1) }).strict(),
  z
    .object({
      text: z.string().min(1),
      color,
      /** 差し込む枠の幅に対する文字の大きさ */
      size: z.number().positive(),
    })
    .strict(),
  z.object({ rect: color }).strict(),
  z.object({ rings: z.array(color).min(1) }).strict(),
]);

const slotsSchema = z.object(
  Object.fromEntries(SLOT_KEYS.map((key) => [key, visualSchema])) as Record<
    SlotKey,
    typeof visualSchema
  >
);

/**
 * スキンのマニフェスト（public/skins/<id>/manifest.json）。
 * 見た目に関わるもの（差し込み口の中身・色・寸法・動きの時間・音）はすべてここに書き、パーツのコードには埋め込まない。
 */
const manifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 差し込み口の外で使う色（背景・文字・席の色など） */
  colors: z.object({
    background: color,
    panel: color,
    text: color,
    muted: color,
    accent: color,
    /** 席ごとの色。席の順に使う */
    players: z.array(color).min(1),
  }),
  /** CSS の font-family。display は数字や見出し、body は日本語の文 */
  fonts: z.object({ display: z.string().min(1), body: z.string().min(1) }),
  /** カード1枚の寸法（基準画面 390×844 での px） */
  card: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    radius: z.number().nonnegative(),
  }),
  /** 動きの時間（ミリ秒） */
  motion: z.object({
    flipMs: z.number().nonnegative(),
    dealMs: z.number().nonnegative(),
    cutInMs: z.number().nonnegative(),
  }),
  slots: slotsSchema,
  /** 音の名前 → マニフェストから見た相対パス */
  sounds: z.record(z.string(), z.string()),
});

export type SkinManifest = z.infer<typeof manifestSchema>;

/** パーツが受け取る差し込み口の中身。色は Phaser が使う数値、絵は読み込める URL */
export type Visual =
  | { image: string }
  | { text: string; color: number; size: number }
  | { rect: number }
  | { rings: number[] };

type Colors = SkinManifest["colors"];

/** パーツが受け取るスキン */
export type Skin = Omit<SkinManifest, "colors" | "slots" | "sounds"> & {
  colors: { [K in keyof Colors]: Colors[K] extends string ? number : number[] };
  slots: Record<SlotKey, Visual>;
  assets: { sounds: Record<string, string> };
};

type ManifestVisual = z.infer<typeof visualSchema>;

const toNumber = (hex: string) => Number.parseInt(hex.slice(1), 16);

function toVisual(visual: ManifestVisual, base: string): Visual {
  if ("image" in visual) return { image: new URL(visual.image, base).href };
  if ("text" in visual) return { ...visual, color: toNumber(visual.color) };
  if ("rect" in visual) return { rect: toNumber(visual.rect) };
  return { rings: visual.rings.map(toNumber) };
}

/** マニフェストを確かめてスキンにする。絵や音のパスは manifestUrl から解決する */
export function parseSkin(manifest: unknown, manifestUrl: string): Skin {
  const result = manifestSchema.safeParse(manifest);
  if (!result.success) {
    throw new Error(`スキンのマニフェストが正しくない: ${z.prettifyError(result.error)}`);
  }
  const { colors, slots, sounds, ...rest } = result.data;
  const { players, ...single } = colors;
  return {
    ...rest,
    colors: {
      ...(Object.fromEntries(
        Object.entries(single).map(([key, hex]) => [key, toNumber(hex)])
      ) as Omit<Skin["colors"], "players">),
      players: players.map(toNumber),
    },
    slots: Object.fromEntries(
      SLOT_KEYS.map((key) => [key, toVisual(slots[key], manifestUrl)])
    ) as Skin["slots"],
    assets: {
      sounds: Object.fromEntries(
        Object.entries(sounds).map(([key, path]) => [key, new URL(path, manifestUrl).href])
      ),
    },
  };
}
