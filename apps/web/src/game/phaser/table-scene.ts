import * as Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "./layout";
import type { Skin } from "@/game/skin/skin";
import { tableHeadline } from "@/game/state/headline";
import type { TableStore } from "@/game/state/table-store";
import { drawCard, type CardFace } from "./parts/card";
import { toCss } from "./parts/color";
import { preloadSlots } from "./parts/visual";

/**
 * テーブル（ゲーム画面）。ストアの状態を描くだけで、ルールの判定はしない。
 * 待合室・ゲーム中の中身は #38・#39 で作る。いまは土台として見出しと手札の見本を描く。
 */
export class TableScene extends Phaser.Scene {
  private headline!: Phaser.GameObjects.Text;

  constructor(
    private readonly skin: Skin,
    private readonly store: TableStore
  ) {
    super("table");
  }

  preload() {
    preloadSlots(this, this.skin.slots);
    for (const [key, url] of Object.entries(this.skin.assets.sounds)) {
      this.load.audio(key, url);
    }
  }

  create() {
    const { skin } = this;
    this.add.rectangle(0, 0, BASE_WIDTH, 56, skin.colors.panel).setOrigin(0);
    this.add
      .text(14, 28, "THREE MARKS", {
        fontFamily: skin.fonts.display,
        fontSize: "22px",
        fontStyle: "bold",
        color: toCss(skin.colors.text),
      })
      .setOrigin(0, 0.5);
    this.headline = this.add
      .text(BASE_WIDTH - 14, 28, "", {
        fontFamily: skin.fonts.body,
        fontSize: "15px",
        color: toCss(skin.colors.muted),
      })
      .setOrigin(1, 0.5);

    // 手札の見本（スキンを差し替えるとここの見た目が変わることを確かめるため）
    const hand: CardFace[] = [
      { kind: "number", value: 20 },
      { kind: "number", value: 18 },
      { kind: "number", value: 18 },
      { kind: "bull" },
      { kind: "number", value: 16 },
    ];
    const gap = 8;
    const step = skin.card.width + gap;
    const left = BASE_WIDTH / 2 - (step * (hand.length - 1)) / 2;
    hand.forEach((face, i) =>
      drawCard(this, skin, { x: left + step * i, y: BASE_HEIGHT - 40 - skin.card.height / 2, face })
    );
    drawCard(this, skin, { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2, face: { kind: "back" } });

    const render = () => this.headline.setText(tableHeadline(this.store.getState()));
    render();
    const unsubscribe = this.store.subscribe(render);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }
}
