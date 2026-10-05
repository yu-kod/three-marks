import * as Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import type { ActionResult } from "@/features/table/room-actions";
import type { Skin } from "@/game/skin/skin";
import { drawButton } from "./button";
import { toCss } from "./color";
import { playSound } from "./sound";
import { addText } from "./text";
import { showToast } from "./toast";

/** 今の名前。押すと名前を変える入力が開く */
export function drawNameChip(
  scene: Phaser.Scene,
  skin: Skin,
  {
    x,
    y,
    name,
    onRename,
  }: {
    x: number;
    y: number;
    name: string | null;
    onRename: (name: string) => Promise<ActionResult>;
  }
) {
  const label = addText(scene, skin, x, y, name ? `${name} として遊びます ✎` : "名前を決める ✎", {
    size: 15,
    color: "muted",
  });
  label.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_UP, () => {
    playSound(scene, "sfx.tap");
    openNameEditor(scene, skin, name ?? "", onRename);
  });
  return label;
}

/** 名前を入れる。決めたら閉じ、変えられなければ理由を出して開いたままにする */
export function openNameEditor(
  scene: Phaser.Scene,
  skin: Skin,
  current: string,
  onRename: (name: string) => Promise<ActionResult>
) {
  const shade = scene.add
    .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, skin.colors.panel, 0.9)
    .setOrigin(0)
    .setDepth(60)
    .setInteractive();
  const title = addText(scene, skin, BASE_WIDTH / 2, 300, "名前", {
    size: 20,
    bold: true,
  }).setDepth(61);
  // 入力欄は HTML の input をキャンバスの上に重ねる。位置は基準座標からキャンバスの実際の位置へ写す
  const bounds = scene.game.canvas.getBoundingClientRect();
  const scale = bounds.width / BASE_WIDTH;
  const field = document.createElement("input");
  Object.assign(field.style, {
    position: "fixed",
    left: `${bounds.left + (BASE_WIDTH / 2) * scale}px`,
    top: `${bounds.top + 360 * scale}px`,
    width: `${300 * scale}px`,
    height: `${48 * scale}px`,
    transform: "translate(-50%, -50%)",
    // 16px 未満だと iOS が入力のときに拡大する
    fontSize: `${Math.max(16, 18 * scale)}px`,
    padding: "0 12px",
    borderRadius: "8px",
    border: `2px solid ${toCss(skin.colors.accent)}`,
    background: toCss(skin.colors.background),
    color: toCss(skin.colors.text),
    fontFamily: skin.fonts.body,
    boxSizing: "border-box",
    zIndex: "10",
  });
  field.value = current;
  field.maxLength = 40;
  field.setAttribute("aria-label", "名前");
  document.body.append(field);
  field.focus();

  const parts: Phaser.GameObjects.GameObject[] = [shade, title];
  const close = (): void => {
    field.remove();
    parts.forEach((o) => o.destroy());
  };
  // 画面を離れたら入力欄も片付ける
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => field.remove());
  scene.events.once(Phaser.Scenes.Events.DESTROY, () => field.remove());
  const submit = async () => {
    const result = await onRename(field.value);
    if (result.ok) close();
    else showToast(scene, skin, result.message);
  };
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void submit();
    if (event.key === "Escape") close();
  });
  const ok: Phaser.GameObjects.Container = drawButton(scene, skin, {
    x: BASE_WIDTH / 2,
    y: 440,
    label: "決める",
    primary: true,
    onPress: submit,
  }).setDepth(61);
  const cancel: Phaser.GameObjects.Container = drawButton(scene, skin, {
    x: BASE_WIDTH / 2,
    y: 506,
    label: "やめる",
    primary: false,
    onPress: async () => close(),
  }).setDepth(61);
  parts.push(ok, cancel);
}
