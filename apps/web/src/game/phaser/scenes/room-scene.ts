import * as Phaser from "phaser";
import type { Screen } from "../../screens";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import { drawButton } from "../parts/button";
import { drawCard, type CardFace } from "../parts/card";
import { drawSeat, SEAT_SIZE } from "../parts/seat";
import { addText } from "../parts/text";
import { showToast } from "../parts/toast";
import { placeVisual } from "../parts/visual";
import { BaseScene } from "./base-scene";
import type { LobbyAction, LobbyButton, LobbyView } from "@/game/state/lobby";
import { roomModel } from "@/game/state/room-model";
import type { Skin } from "@/game/skin/skin";

type Room = Extract<Screen, { kind: "room" }>;

const HEADER = 64;
const SEATS_TOP = 170;
const SEAT_GAP = 12;

/** 招待 URL の画面。待合室（席と参加・退出・招待）。ゲーム中の中身は #39 で作る */
export class RoomScene extends BaseScene {
  private body!: Phaser.GameObjects.Container;
  private headline!: Phaser.GameObjects.Text;
  /** 前に描いた席。新しく座った席だけを弾ませる */
  private shownSeats: string[] = [];

  constructor(
    skin: Skin,
    private readonly screen: Room
  ) {
    super("room", skin);
  }

  protected build() {
    const { skin, screen } = this;
    this.add.rectangle(0, 0, BASE_WIDTH, HEADER, skin.colors.panel).setOrigin(0);
    placeVisual(this, "logo", skin.slots.logo, { x: 74, y: HEADER / 2, width: 120, height: 48 });
    this.headline = addText(this, skin, BASE_WIDTH - 16, HEADER / 2, "", {
      size: 14,
      color: "muted",
      originX: 1,
    });
    this.body = this.add.container(0, 0);

    const render = () => this.render();
    render();
    const offStore = screen.store.subscribe(render);
    const offGuest = screen.guest.subscribe(render);
    this.onShutdown(() => {
      offStore();
      offGuest();
    });
  }

  /** 前に描いた形。同じなら描き直さない */
  private drawn = "";

  private render() {
    const model = roomModel(
      this.screen.store.getState(),
      this.screen.guest.getState().guest?.id ?? null
    );
    const key = JSON.stringify(model);
    if (key === this.drawn) return;
    this.drawn = key;
    this.headline.setText(model.headline);
    this.body.removeAll(true);
    if (model.kind === "error") {
      this.body.add(
        addText(this, this.skin, BASE_WIDTH / 2, BASE_HEIGHT / 2, model.headline, { size: 18 })
      );
    } else if (model.kind === "playing") {
      this.renderPlayingPlaceholder();
    } else if (model.kind === "lobby") {
      this.renderLobby(model.view, model.buttons);
    }
  }

  private renderLobby(view: LobbyView, buttons: LobbyButton[]) {
    const { skin } = this;
    const cx = BASE_WIDTH / 2;
    this.body.add(
      addText(this, skin, cx, 112, view.hostName ? `${view.hostName} のルーム` : "ルーム", {
        size: 22,
        bold: true,
      })
    );
    const seatKeys = view.seats.map((s, i) => (s.kind === "cpu" ? `cpu-${i}` : `${s.name}-${i}`));
    view.seats.forEach((seat, index) => {
      const y = SEATS_TOP + index * (SEAT_SIZE.height + SEAT_GAP);
      const plate = drawSeat(this, skin, { x: cx, y, seat, index });
      this.body.add(plate);
      if (!this.shownSeats.includes(seatKeys[index]!)) {
        this.tweens.add({
          targets: plate,
          scale: { from: 0.85, to: 1 },
          alpha: { from: 0, to: 1 },
          duration: 260,
          delay: index * 40,
          ease: "Back.easeOut",
        });
      }
    });
    this.shownSeats = seatKeys;

    const actions: Record<LobbyAction, () => Promise<{ ok: boolean; message: string | null }>> = {
      join: async () => {
        const r = await this.screen.actions.join();
        return r.ok ? { ok: true, message: null } : r;
      },
      leave: async () => {
        const r = await this.screen.actions.leave();
        return r.ok ? { ok: true, message: null } : r;
      },
      share: () => this.screen.actions.share(),
    };
    buttons.forEach((button, i) => {
      const y = BASE_HEIGHT - 70 - (buttons.length - 1 - i) * 66;
      this.body.add(
        drawButton(this, skin, {
          x: cx,
          y,
          label: button.label,
          primary: button.primary,
          onPress: async () => {
            const { message } = await actions[button.action]();
            if (message) showToast(this, skin, message);
          },
        })
      );
    });
  }

  /** ゲーム中の画面は #39 で作る。いまは手札の見本だけ */
  private renderPlayingPlaceholder() {
    const { skin } = this;
    const hand: CardFace[] = [
      { kind: "number", value: 20 },
      { kind: "number", value: 18 },
      { kind: "number", value: 18 },
      { kind: "bull" },
      { kind: "number", value: 16 },
    ];
    const step = skin.card.width + 8;
    const left = BASE_WIDTH / 2 - (step * (hand.length - 1)) / 2;
    hand.forEach((face, i) =>
      this.body.add(
        drawCard(this, skin, {
          x: left + step * i,
          y: BASE_HEIGHT - 40 - skin.card.height / 2,
          face,
        })
      )
    );
    this.body.add(
      drawCard(this, skin, { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2, face: { kind: "back" } })
    );
  }
}
