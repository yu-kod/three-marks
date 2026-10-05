import * as Phaser from "phaser";
import { createJsonStorage } from "@app/web-core";
import type { Skin } from "@/game/skin/skin";
import {
  bgmVolume,
  feedbackFor,
  saveAudioSettings,
  savedAudioSettings,
  type AudioSettings,
  type FeedbackEvent,
} from "@/game/state/feedback";

/** 音と振動の設定。最初に使うときに端末から読む */
let settings: AudioSettings | null = null;

export function audioSettings(): AudioSettings {
  return (settings ??= savedAudioSettings(createJsonStorage()));
}

/** 設定を変えて端末に保存し、流れている BGM の音量にもすぐ反映する */
export function setAudioSettings(scene: Phaser.Scene, next: AudioSettings) {
  settings = next;
  saveAudioSettings(next, createJsonStorage());
  startBgm(scene);
}

/**
 * できごとを音と振動で知らせる。音はスキンの効果音、振動はスキンの決めた形（対応端末のみ）。
 * まだ鳴らせない（ブラウザが音を止めている）ときは鳴らさずに進む
 */
export function feedback(scene: Phaser.Scene, skin: Skin, event: FeedbackEvent) {
  const { sound, volume, vibrate } = feedbackFor(event, audioSettings(), skin.vibrations);
  if (sound && scene.cache.audio.exists(sound)) scene.sound.play(sound, { volume });
  if (vibrate && "vibrate" in navigator) navigator.vibrate(vibrate);
}

const BGM = "bgm.main";
type VolumeSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

/**
 * BGM を流す（画面をまたいで1つだけ）。ブラウザは最初の操作まで音を止めているので、
 * 止まっていれば音が出せるようになってから流す。音量が「なし」なら止める
 */
export function startBgm(scene: Phaser.Scene) {
  const play = () => {
    const volume = bgmVolume(audioSettings());
    let bgm = scene.sound.get(BGM) as VolumeSound | null;
    if (!bgm) {
      if (volume === 0 || !scene.cache.audio.exists(BGM)) return;
      bgm = scene.sound.add(BGM, { loop: true }) as VolumeSound;
    }
    bgm.setVolume(volume);
    if (volume === 0) {
      if (bgm.isPlaying) bgm.pause();
    } else if (bgm.isPaused) {
      bgm.resume();
    } else if (!bgm.isPlaying) {
      bgm.play();
    }
  };
  if (scene.sound.locked) scene.sound.once(Phaser.Sound.Events.UNLOCKED, play);
  else play();
}
