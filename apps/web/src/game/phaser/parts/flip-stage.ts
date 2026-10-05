import * as Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import type { ActionResult } from "@/features/table/room-actions";
import type { Skin } from "@/game/skin/skin";
import type { CardFace } from "@/game/state/card-face";
import {
  classifyGesture,
  peelProgress,
  REVEAL_AT,
  slotFaces,
  type Point,
  type Slot,
} from "@/game/state/squeeze";
import { drawCard } from "./card";
import { playSound } from "./sound";
import { addText } from "./text";
import { showToast } from "./toast";
import { placeVisual } from "./visual";

/** 中身が届くまでに持ち上がる分 */
const PEEK = 0.15;

type SlotView = {
  slot: Slot;
  back: Phaser.GameObjects.Image;
  face: Phaser.GameObjects.Container | null;
  /** 0（伏せたまま）〜 1（表） */
  progress: number;
  revealed: boolean;
  /** めくりきる操作をしたが、中身がまだ届いていない（届いたらめくる） */
  waiting: boolean;
};

/**
 * 自分の投げの「めくりの舞台」。画面いっぱいに狙いと山札を出し、山札から配った札を指でめくる。
 * - 札に触れた時点で 1枚めくる（中身をサーバーから受け取る）。指の動きに合わせて下から絞る
 * - 札の列を横に払うと、残りを一気にめくる
 * 操作の読み替え（どの札か・どれだけ・一気にか）は squeeze.ts。ここは描くだけ。
 */
export class FlipStage {
  private readonly layer: Phaser.GameObjects.Container;
  private readonly slots: SlotView[] = [];
  private readonly deck: Phaser.GameObjects.Container;
  private deckCount: number;
  private readonly deckLabel: Phaser.GameObjects.Text;
  /** 指が触れた置き場所の順（めくれた札はこの順に入る） */
  private readonly touched: number[] = [];
  private faces: (CardFace | null)[] = [];
  private points: Point[] = [];
  private active: number | null = null;
  private allRequested = false;
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly skin: Skin,
    private readonly opts: {
      aims: CardFace[];
      count: number;
      deckCount: number;
      flip: (count: number | "all") => Promise<ActionResult>;
    }
  ) {
    const { width, height } = skin.card;
    const shade = scene.add
      .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, skin.colors.background, 0.97)
      .setOrigin(0)
      .setInteractive();
    this.layer = scene.add.container(0, 0, [shade]).setDepth(30);

    this.layer.add(addText(scene, skin, BASE_WIDTH / 2, 92, "狙い", { size: 13, color: "muted" }));
    opts.aims.forEach((face, i) => {
      const x = BASE_WIDTH / 2 + (i - (opts.aims.length - 1) / 2) * (width + 12);
      this.layer.add(drawCard(scene, skin, { x, y: 180, face }));
    });

    // 山札の束。配るたびに薄くなる
    this.deckCount = opts.deckCount;
    this.deck = scene.add.container(56, 340);
    for (let i = 3; i >= 0; i--) {
      this.deck.add(drawCard(scene, skin, { x: i * 1.5, y: -i * 1.5, face: { kind: "back" } }));
    }
    this.deckLabel = addText(scene, skin, 56, 410, "", { size: 12, color: "muted" });
    this.layer.add([this.deck, this.deckLabel]);
    this.updateDeckLabel();

    this.layer.add(
      addText(scene, skin, BASE_WIDTH / 2 + 30, 340, "札を指でめくる\n横に払うと一気に", {
        size: 13,
        color: "muted",
      })
    );

    // めくる場所。5枚なら1列、それより多ければ2列
    const perRow = opts.count > 5 ? Math.ceil(opts.count / 2) : opts.count;
    const scale = Math.min(1.45, (BASE_WIDTH - 24) / perRow / (width + 10));
    const w = width * scale;
    const h = height * scale;
    const rows = Math.ceil(opts.count / perRow);
    for (let i = 0; i < opts.count; i++) {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, opts.count - row * perRow);
      const x = BASE_WIDTH / 2 + ((i % perRow) - (inRow - 1) / 2) * (w + 10);
      const y = 600 + (row - (rows - 1) / 2) * (h + 14);
      const back = placeVisual(
        scene,
        "card.back",
        skin.slots["card.back"],
        { x, y, width: w, height: h },
        {
          stretch: true,
        }
      ) as Phaser.GameObjects.Image;
      this.layer.add(back);
      this.slots.push({
        slot: { x, y, width: w, height: h },
        back,
        face: null,
        progress: 0,
        revealed: false,
        waiting: false,
      });
      // 山札から1枚ずつ配る
      back
        .setPosition(56, 340)
        .setScale(back.scaleX * 0.7, back.scaleY * 0.7)
        .setAlpha(0);
      scene.tweens.add({
        targets: back,
        x,
        y,
        scaleX: back.scaleX / 0.7,
        scaleY: back.scaleY / 0.7,
        alpha: 1,
        angle: { from: -12, to: 0 },
        delay: i * skin.motion.dealMs,
        duration: skin.motion.dealMs * 1.6,
        ease: "Cubic.easeOut",
        onStart: () => {
          playSound(scene, "sfx.tap");
          this.deckCount -= 1;
          this.updateDeckLabel();
        },
      });
    }

    shade.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.down(p));
    shade.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.move(p));
    shade.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.up(p));
  }

  private updateDeckLabel() {
    this.deckLabel.setText(`山札 ${Math.max(0, this.deckCount)}`);
    this.deck.setScale(1, Math.max(0.4, Math.min(1, this.deckCount / 20)));
  }

  private pointOf(p: Phaser.Input.Pointer): Point {
    return { x: p.worldX, y: p.worldY, t: p.event.timeStamp };
  }

  private down(p: Phaser.Input.Pointer) {
    this.points = [this.pointOf(p)];
    const gesture = classifyGesture(
      this.points,
      this.slots.map((s) => s.slot)
    );
    if (gesture?.kind !== "tap" && gesture?.kind !== "peel") return;
    const view = this.slots[gesture.slot]!;
    if (view.revealed) return;
    this.active = gesture.slot;
    if (!this.touched.includes(gesture.slot) && !this.allRequested) {
      // 触れた時点でめくる（中身を受け取る）。戻せない
      this.touched.push(gesture.slot);
      void this.opts.flip(1).then((r) => {
        if (!r.ok) showToast(this.scene, this.skin, r.message);
      });
    }
  }

  private move(p: Phaser.Input.Pointer) {
    if (!p.isDown) return;
    // 札の外から始まった横の払いも読めるよう、指の跡はいつも残す
    this.points.push(this.pointOf(p));
    if (this.active === null) return;
    const view = this.slots[this.active]!;
    const progress = peelProgress(this.points[0]!, this.points.at(-1)!, view.slot.height);
    this.setProgress(this.active, this.faces[this.active] ? progress : Math.min(progress, PEEK));
  }

  private up(p: Phaser.Input.Pointer) {
    this.points.push(this.pointOf(p));
    const gesture = classifyGesture(
      this.points,
      this.slots.map((s) => s.slot)
    );
    const slot = this.active;
    this.active = null;
    if (gesture?.kind === "sweep") {
      this.flipAll();
      return;
    }
    if (slot === null) return;
    const view = this.slots[slot]!;
    if (gesture?.kind === "tap" || view.progress >= REVEAL_AT) this.reveal(slot);
    else this.animateProgress(slot, 0.06, 160);
  }

  /** 残りを一気にめくる */
  private flipAll() {
    if (!this.allRequested && this.slots.some((s) => !s.revealed)) {
      this.allRequested = true;
      void this.opts.flip("all").then((r) => {
        if (!r.ok) showToast(this.scene, this.skin, r.message);
      });
    }
    this.slots.forEach((s, i) => {
      if (!s.revealed) this.scene.time.delayedCall(i * 90, () => this.reveal(i));
    });
  }

  /** めくりきる。中身が届いていなければ、届いたときにめくる（update） */
  private reveal(slot: number) {
    const view = this.slots[slot]!;
    if (view.revealed) return;
    if (!this.faces[slot]) {
      this.animateProgress(slot, PEEK, 120);
      view.waiting = true;
      return;
    }
    view.revealed = true;
    this.animateProgress(slot, 1, this.skin.motion.flipMs, () => {
      playSound(this.scene, "sfx.flip");
      this.scene.tweens.add({
        targets: view.face,
        scale: { from: view.face!.scale * 1.12, to: view.face!.scale },
        duration: 160,
      });
    });
  }

  private animateProgress(slot: number, to: number, duration: number, onComplete?: () => void) {
    const view = this.slots[slot]!;
    const state = { p: view.progress };
    this.scene.tweens.add({
      targets: state,
      p: to,
      duration,
      ease: "Cubic.easeOut",
      onUpdate: () => this.setProgress(slot, state.p),
      onComplete,
    });
  }

  /** 伏せた札を下から絞る（裏の絵を上から切り取って、下の表を見せる） */
  private setProgress(slot: number, progress: number) {
    const view = this.slots[slot]!;
    view.progress = progress;
    const frame = view.back.frame;
    const keep = frame.realHeight * (1 - progress);
    view.back.setCrop(0, 0, frame.realWidth, keep);
  }

  /** 届いた中身を置き場所に入れる。触れずにめくれた札（一気に・ほかの画面）はそのままめくる */
  update(flips: CardFace[]) {
    if (this.closed) return;
    const faces = slotFaces(this.slots.length, flips, this.touched);
    faces.forEach((face, i) => {
      const view = this.slots[i]!;
      if (!face || this.faces[i]) return;
      const card = drawCard(this.scene, this.skin, { x: view.slot.x, y: view.slot.y, face });
      card.setScale(view.slot.width / this.skin.card.width);
      view.face = card;
      // 表は裏の下に置く
      this.layer.addAt(card, this.layer.getIndex(view.back));
      const wasTouched = this.touched.includes(i);
      this.faces[i] = face;
      if (!wasTouched || this.allRequested || view.waiting) {
        this.reveal(i);
      }
    });
    this.faces = faces;
  }

  /** 全部めくれたら、少し見せてから閉じる */
  async finish(flips: CardFace[]) {
    this.update(flips);
    this.slots.forEach((_, i) => this.reveal(i));
    await new Promise<void>((r) => this.scene.time.delayedCall(this.skin.motion.cutInMs, r));
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.scene.tweens.add({
      targets: this.layer,
      alpha: 0,
      duration: 200,
      onComplete: () => this.layer.destroy(),
    });
  }

  get isOpen() {
    return !this.closed;
  }
}
