import type { Screen } from "../../screens";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import { drawButton } from "../parts/button";
import { drawNameChip } from "../parts/name-editor";
import { drawSettingsButton } from "../parts/settings-panel";
import { startBgm } from "../parts/sound";
import { addText } from "../parts/text";
import { showToast } from "../parts/toast";
import { placeVisual } from "../parts/visual";
import { BaseScene } from "./base-scene";
import type { Skin } from "@/game/skin/skin";

type Entrance = Extract<Screen, { kind: "entrance" }>;

/** 入口。ロゴと「ルームを作る」 */
export class EntranceScene extends BaseScene {
  constructor(
    skin: Skin,
    private readonly screen: Entrance
  ) {
    super("entrance", skin);
  }

  protected build() {
    const { skin, screen } = this;
    drawSettingsButton(this, skin, { x: BASE_WIDTH - 30, y: 32 });
    startBgm(this);
    const logo = placeVisual(this, "logo", skin.slots.logo, {
      x: BASE_WIDTH / 2,
      y: 260,
      width: 320,
      height: 130,
    }) as Phaser.GameObjects.Image;
    this.tweens.add({
      targets: logo,
      y: { from: 230, to: 260 },
      alpha: { from: 0, to: 1 },
      duration: 600,
      ease: "Back.easeOut",
    });

    addText(this, skin, BASE_WIDTH / 2, 360, "ダーツのクリケットを、カードで", {
      size: 15,
      color: "muted",
    });

    let chip: Phaser.GameObjects.Text | null = null;
    const showName = () => {
      chip?.destroy();
      chip = drawNameChip(this, skin, {
        x: BASE_WIDTH / 2,
        y: BASE_HEIGHT - 200,
        name: screen.guest.getState().guest?.name ?? null,
        onRename: screen.rename,
      });
    };
    showName();
    this.onShutdown(screen.guest.subscribe(showName));

    drawButton(this, skin, {
      x: BASE_WIDTH / 2,
      y: BASE_HEIGHT - 140,
      label: "ルームを作る",
      primary: true,
      onPress: async () => {
        const result = await screen.createRoom();
        if (!result.ok) showToast(this, skin, result.message);
      },
    });
  }
}
