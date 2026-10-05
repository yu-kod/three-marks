import { SLOT_KEYS, SOUND_KEYS, type SkinManifest } from "@/game/skin/skin";

type Overrides = Partial<Omit<SkinManifest, "colors" | "slots" | "sounds">> & {
  colors?: Partial<SkinManifest["colors"]>;
  slots?: Partial<SkinManifest["slots"]>;
  sounds?: Partial<SkinManifest["sounds"]>;
};

/** テスト用のスキンのマニフェスト。差し込み口は既定で文字を入れておき、指定したところだけ変える */
export function buildManifest(overrides: Overrides = {}): SkinManifest {
  const base: SkinManifest = {
    id: "standard",
    name: "スタンダード",
    colors: {
      background: "#23272f",
      panel: "#101218",
      text: "#f4f5f7",
      muted: "#a9afbd",
      accent: "#d93a3a",
      players: ["#d93a3a", "#2f6fd6", "#e0a100", "#2fa36b"],
    },
    fonts: { display: "'Barlow Semi Condensed', sans-serif", body: "'Noto Sans JP', sans-serif" },
    card: { width: 44, height: 112, radius: 4 },
    motion: { tapMs: 90, flipMs: 280, dealMs: 180, cutInMs: 1200 },
    slots: Object.fromEntries(
      SLOT_KEYS.map((key) => [key, { text: key, color: "#101218", size: 0.5 }])
    ) as SkinManifest["slots"],
    sounds: Object.fromEntries(
      SOUND_KEYS.map((key) => [key, `${key}.wav`])
    ) as SkinManifest["sounds"],
    vibrations: {},
  };
  return {
    ...base,
    ...overrides,
    colors: { ...base.colors, ...overrides.colors },
    slots: { ...base.slots, ...overrides.slots } as SkinManifest["slots"],
    sounds: { ...base.sounds, ...overrides.sounds } as SkinManifest["sounds"],
  };
}
