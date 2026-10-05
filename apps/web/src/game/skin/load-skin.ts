import type { JsonStorage } from "@app/web-core";
import { parseSkin, type Skin } from "./skin";

/** public/skins/ にあるスキン。ここに無い id は保存されていても読まない */
export const SKIN_IDS = ["standard", "night"] as const;
export type SkinId = (typeof SKIN_IDS)[number];
export const DEFAULT_SKIN_ID: SkinId = "standard";

const isSkinId = (id: unknown): id is SkinId => SKIN_IDS.includes(id as SkinId);

/**
 * 選んだスキンは端末に保存する。見た目はその人の好みなので、URL には出さない
 * （招待 URL を送ったときに相手へ渡らないように）。
 */
const STORAGE_KEY = "three-marks:skin";

/** 端末に保存したスキン。無い・知らないものなら標準 */
export function savedSkinId(storage: JsonStorage): SkinId {
  const id = storage.get<unknown>(STORAGE_KEY);
  return isSkinId(id) ? id : DEFAULT_SKIN_ID;
}

export function saveSkinId(id: SkinId, storage: JsonStorage): void {
  storage.set(STORAGE_KEY, id);
}

export type LoadSkinOptions = {
  /** アプリの配信元（location.origin） */
  origin: string;
  /** テストで差し替える */
  fetch?: (url: string) => Promise<Response>;
};

/** スキンのマニフェストを読み込む */
export async function loadSkin(
  id: SkinId,
  { origin, fetch: fetchFn = fetch }: LoadSkinOptions
): Promise<Skin> {
  const url = `${origin}/skins/${id}/manifest.json`;
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`スキン ${id} を読み込めない（HTTP ${res.status}）`);
  }
  return parseSkin(await res.json(), url);
}
