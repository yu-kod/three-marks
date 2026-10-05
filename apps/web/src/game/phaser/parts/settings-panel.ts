import * as Phaser from "phaser";
import { createJsonStorage } from "@app/web-core";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import type { Skin } from "@/game/skin/skin";
import { saveEffectLevel, savedEffectLevel, type EffectLevel } from "@/game/state/effects";
import { cycleSetting, settingsRows, type Settings } from "@/game/state/settings";
import { drawButton } from "./button";
import { audioSettings, feedback, setAudioSettings } from "./sound";
import { addText } from "./text";
import { placeVisual } from "./visual";

const ROW_GAP = 64;

/**
 * 見出しの設定ボタン（歯車）。押すと設定の画面を重ねて開く。
 * 演出の強さを変えたら onEffects で知らせる（再生の速さなどにすぐ反映するため）
 */
export function drawSettingsButton(
  scene: Phaser.Scene,
  skin: Skin,
  { x, y, onEffects }: { x: number; y: number; onEffects?: (level: EffectLevel) => void }
) {
  const icon = placeVisual(scene, "icon.settings", skin.slots["icon.settings"], {
    x,
    y,
    width: 36,
    height: 36,
  }) as Phaser.GameObjects.Image;
  icon.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_UP, () => {
    feedback(scene, skin, "tap");
    openSettings(scene, skin, onEffects);
  });
  return icon;
}

function openSettings(scene: Phaser.Scene, skin: Skin, onEffects?: (level: EffectLevel) => void) {
  let settings: Settings = {
    effects: savedEffectLevel(createJsonStorage()),
    audio: audioSettings(),
  };
  const cx = BASE_WIDTH / 2;
  const top = 230;
  const shade = scene.add
    .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, skin.colors.background, 0.85)
    .setOrigin(0)
    .setInteractive();
  const panel = scene.add
    .rectangle(cx, top + 160, 340, 420, skin.colors.panel)
    .setStrokeStyle(2, skin.colors.muted);
  const title = addText(scene, skin, cx, top, "設定", { size: 22, bold: true });
  const layer = scene.add.container(0, 0, [shade, panel, title]).setDepth(80);
  const close = () => layer.destroy();
  shade.on(Phaser.Input.Events.POINTER_UP, close);

  settingsRows(settings).forEach((row, i) => {
    const y = top + 64 + i * ROW_GAP;
    const label = addText(scene, skin, cx - 140, y, row.label, { size: 17, originX: 0 });
    const chip = placeVisual(
      scene,
      "button.secondary",
      skin.slots["button.secondary"],
      { x: cx + 90, y, width: 120, height: 44 },
      { stretch: true }
    ) as Phaser.GameObjects.Image;
    const value = addText(scene, skin, cx + 90, y, row.value, { size: 17, bold: true });
    chip.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_UP, () => {
      settings = cycleSetting(settings, row.key);
      const next = settingsRows(settings)[i]!;
      value.setText(next.value);
      if (row.key === "effects") {
        saveEffectLevel(settings.effects, createJsonStorage());
        onEffects?.(settings.effects);
      } else {
        setAudioSettings(scene, settings.audio);
      }
      // 変えた音量・振動で鳴らしてみせる
      feedback(scene, skin, row.key === "vibrate" ? "hit" : "select");
    });
    layer.add([label, chip, value]);
  });

  layer.add(
    drawButton(scene, skin, {
      x: cx,
      y: top + 64 + 4 * ROW_GAP,
      label: "閉じる",
      primary: false,
      onPress: async () => close(),
    })
  );
}
