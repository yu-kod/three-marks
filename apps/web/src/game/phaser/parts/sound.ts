import type * as Phaser from "phaser";
import type { SoundKey } from "@/game/skin/skin";

/** スキンの効果音を鳴らす。まだ鳴らせない（ブラウザが音を止めている）ときは鳴らさずに進む */
export function playSound(scene: Phaser.Scene, key: SoundKey) {
  if (scene.cache.audio.exists(key)) scene.sound.play(key);
}
