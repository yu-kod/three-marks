import { EFFECT_LABELS, nextEffectLevel, type EffectLevel } from "./effects";
import { nextVolume, VOLUME_LABELS, type AudioSettings } from "./feedback";

/** 設定の画面で変えられるもの（どれも端末に保存する） */
export type Settings = { effects: EffectLevel; audio: AudioSettings };
export type SettingKey = "effects" | "sfx" | "bgm" | "vibrate";

/** 設定の画面の行。押すと次の値へ切り替わる */
export function settingsRows({ effects, audio }: Settings) {
  return [
    { key: "effects", label: "演出", value: EFFECT_LABELS[effects] },
    { key: "sfx", label: "効果音", value: VOLUME_LABELS[audio.sfx] },
    { key: "bgm", label: "BGM", value: VOLUME_LABELS[audio.bgm] },
    { key: "vibrate", label: "振動", value: audio.vibrate ? "あり" : "なし" },
  ] satisfies { key: SettingKey; label: string; value: string }[];
}

export function cycleSetting(settings: Settings, key: SettingKey): Settings {
  const { effects, audio } = settings;
  if (key === "effects") return { ...settings, effects: nextEffectLevel(effects) };
  if (key === "vibrate") return { ...settings, audio: { ...audio, vibrate: !audio.vibrate } };
  return { ...settings, audio: { ...audio, [key]: nextVolume(audio[key]) } };
}
