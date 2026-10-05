import type { JsonStorage } from "@app/web-core";
import type { SoundKey } from "@/game/skin/skin";

/** 音や振動で知らせるできごと */
export const FEEDBACK_EVENTS = [
  "tap",
  "select",
  "throw",
  "flip",
  "hit",
  "miss",
  "open",
  "award",
  "turn",
  "start",
  "seat",
] as const;
export type FeedbackEvent = (typeof FEEDBACK_EVENTS)[number];

const SOUND_OF: Record<FeedbackEvent, SoundKey> = {
  tap: "sfx.tap",
  select: "sfx.select",
  throw: "sfx.throw",
  flip: "sfx.flip",
  hit: "sfx.hit",
  miss: "sfx.miss",
  open: "sfx.open",
  award: "sfx.award",
  turn: "sfx.turn",
  start: "sfx.start",
  seat: "sfx.seat",
};

/** 音量の段階（0 = なし） */
export type VolumeStep = 0 | 1 | 2 | 3;
export const VOLUME_LABELS = ["なし", "小", "中", "大"] as const;
const SFX_GAIN = [0, 0.35, 0.7, 1];
/** BGM は効果音の邪魔をしないよう控えめに */
const BGM_GAIN = [0, 0.15, 0.3, 0.5];

export type AudioSettings = { sfx: VolumeStep; bgm: VolumeStep; vibrate: boolean };
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { sfx: 2, bgm: 1, vibrate: true };

const STORAGE_KEY = "three-marks:audio";
const isStep = (v: unknown): v is VolumeStep => v === 0 || v === 1 || v === 2 || v === 3;

/** 端末に保存した音と振動の設定。無い・壊れた値なら既定 */
export function savedAudioSettings(storage: JsonStorage): AudioSettings {
  const saved = storage.get<Partial<Record<keyof AudioSettings, unknown>>>(STORAGE_KEY);
  if (
    saved === null ||
    !isStep(saved.sfx) ||
    !isStep(saved.bgm) ||
    typeof saved.vibrate !== "boolean"
  ) {
    return DEFAULT_AUDIO_SETTINGS;
  }
  return { sfx: saved.sfx, bgm: saved.bgm, vibrate: saved.vibrate };
}

export function saveAudioSettings(settings: AudioSettings, storage: JsonStorage): void {
  storage.set(STORAGE_KEY, settings);
}

/** 設定ボタンを押したときの次の音量（大の次はなし） */
export function nextVolume(step: VolumeStep): VolumeStep {
  return ((step + 1) % VOLUME_LABELS.length) as VolumeStep;
}

export function bgmVolume(settings: AudioSettings): number {
  return BGM_GAIN[settings.bgm]!;
}

/** スキンが決める、できごとごとの振動の形（Vibration API の pattern） */
export type VibrationPatterns = Partial<Record<FeedbackEvent, number[]>>;

/** できごとに鳴らす音・音量・振動。鳴らさない・振動しないなら null */
export function feedbackFor(
  event: FeedbackEvent,
  settings: AudioSettings,
  patterns: VibrationPatterns
): { sound: SoundKey | null; volume: number; vibrate: number[] | null } {
  const volume = SFX_GAIN[settings.sfx]!;
  return {
    sound: volume > 0 ? SOUND_OF[event] : null,
    volume,
    vibrate: settings.vibrate ? (patterns[event] ?? null) : null,
  };
}

/** ほかの人の投げを照合したときの音（当たりがあれば当たり） */
export function settleFeedback(hits: number): FeedbackEvent {
  return hits > 0 ? "hit" : "miss";
}
