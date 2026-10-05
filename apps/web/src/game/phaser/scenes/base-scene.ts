import * as Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import { preloadSlots } from "../parts/visual";
import { pixelRatio } from "../parts/text";
import type { Skin } from "@/game/skin/skin";

/** どの画面にも共通：スキンの読み込みと、基準座標（390×844）で描けるようにするカメラ */
export abstract class BaseScene extends Phaser.Scene {
  constructor(
    key: string,
    protected readonly skin: Skin
  ) {
    super(key);
  }

  preload() {
    preloadSlots(this, this.skin.slots);
    for (const [key, url] of Object.entries(this.skin.assets.sounds)) {
      this.load.audio(key, url);
    }
  }

  create() {
    // 実際のキャンバスは画素密度の倍の大きさ。カメラで拡大して、座標は基準の大きさのまま描く
    this.cameras.main.setZoom(pixelRatio()).centerOn(BASE_WIDTH / 2, BASE_HEIGHT / 2);
    this.build();
  }

  /** 画面を組み立てる */
  protected abstract build(): void;

  /** 片付けるとき（画面を離れるとき）に呼ぶ */
  protected onShutdown(cleanup: () => void) {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }
}
