import * as Phaser from "phaser";
import type { Screen } from "../../screens";
import { BASE_HEIGHT, BASE_WIDTH } from "../layout";
import { drawButton } from "../parts/button";
import { drawCard } from "../parts/card";
import { FlipStage } from "../parts/flip-stage";
import {
  BOARD_TOP,
  boardCell,
  drawPlayerPanels,
  drawScoreboard,
  drawThrowStrip,
} from "../parts/game-board";
import { drawNameChip } from "../parts/name-editor";
import { playSeatDrawReveal } from "../parts/seat-draw-reveal";
import { playSound } from "../parts/sound";
import { toggleAim, type GameModel } from "@/game/state/game-model";
import { drawSeat, SEAT_SIZE } from "../parts/seat";
import { addText } from "../parts/text";
import { showToast } from "../parts/toast";
import { placeVisual } from "../parts/visual";
import { BaseScene } from "./base-scene";
import type { ActionResult } from "@/features/table/room-actions";
import {
  orderMovingUp,
  type LobbyAction,
  type LobbyButton,
  type LobbyView,
} from "@/game/state/lobby";
import { shouldPlayReveal, type SeatDrawRound } from "@/game/state/seat-draw";
import { replayFrames, type ReplayFrame } from "@/game/state/replay";
import { roomModel } from "@/game/state/room-model";
import { latestThrowOf } from "@/game/state/squeeze";
import type { TableState } from "@/game/state/table-store";
import type { GameView } from "@three-marks/engine";
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

  /** 前に届いたゲームの状態。ここからの差分を1枚ずつ再生する */
  private lastGame: GameView | null = null;
  private queue: ReplayFrame[] = [];
  private playing = false;

  private render() {
    const state = this.screen.store.getState();
    if (state.status === "ready" && state.game !== null) {
      const frames = replayFrames(this.lastGame, state.game);
      this.lastGame = state.game;
      if (frames.length > 0) {
        // 自分の投げは、めくりの舞台でもう見せている（1枚ずつの再生は飛ばす）
        const me = this.me();
        this.queue.push(
          ...frames.filter(
            (f) => !(this.stage && f.kind === "flip" && f.view.pending?.player === me)
          )
        );
        void this.playQueue();
        return;
      }
    }
    // 再生している間は、再生が終わってから今の状態を描く
    if (!this.playing) this.draw(state);
  }

  /** 届いた投げを1枚ずつ再生する。コマごとに待つ時間はスキンの動きの時間から */
  private async playQueue() {
    if (this.playing) return;
    this.playing = true;
    // めくりの舞台が開いていれば、最後の札まで見せて閉じてから、ほかの人の投げを再生する
    if (this.stage) {
      const game = (this.screen.store.getState() as Extract<TableState, { status: "ready" }>).game!;
      const me = this.me()!;
      const seat = game.players.findIndex((p) => p.id === me);
      await this.stage.finish(latestThrowOf(game, me), (target) => boardCell(target, seat));
      this.stage = null;
    }
    const { motion } = this.skin;
    const hold: Record<ReplayFrame["kind"], number> = {
      flip: motion.flipMs * 1.2,
      settle: motion.dealMs * 4,
      round: motion.cutInMs,
    };
    while (this.queue.length > 0) {
      const frame = this.queue.shift()!;
      const state = this.screen.store.getState() as Extract<TableState, { status: "ready" }>;
      this.draw({ ...state, game: frame.view });
      if (frame.kind === "settle") playSound(this, "sfx.seat");
      if (frame.banner) this.showBanner(frame.banner);
      await new Promise<void>((resolve) => this.time.delayedCall(hold[frame.kind], resolve));
    }
    this.playing = false;
    this.draw(this.screen.store.getState());
  }

  /** ラウンドの切り替わりなどを、画面の真ん中に大きく出す */
  private showBanner(text: string) {
    const { skin } = this;
    const band = this.add.rectangle(0, 0, BASE_WIDTH, 96, skin.colors.panel, 0.94);
    const edge = this.add.rectangle(0, 46, BASE_WIDTH, 3, skin.colors.accent);
    const label = addText(this, skin, 0, 0, text, { size: 48, font: "display", bold: true });
    const banner = this.add
      .container(BASE_WIDTH / 2, BASE_HEIGHT / 2 - 40, [band, edge, label])
      .setDepth(40);
    playSound(this, "sfx.start");
    this.tweens.chain({
      targets: banner,
      tweens: [
        {
          scaleY: { from: 0, to: 1 },
          alpha: { from: 0, to: 1 },
          duration: 220,
          ease: "Back.easeOut",
        },
        { alpha: 0, delay: skin.motion.cutInMs - 520, duration: 300 },
      ],
      onComplete: () => banner.destroy(),
    });
  }

  /** 前に描いた形。同じなら描き直さない */
  private drawn = "";

  private draw(state: TableState) {
    const model = roomModel(state, this.screen.guest.getState().guest?.id ?? null);
    const key = JSON.stringify({ model, selected: this.selected });
    if (key === this.drawn) return;
    this.drawn = key;
    this.headline.setText(model.headline);
    this.body.removeAll(true);
    if (model.kind === "error") {
      this.body.add(
        addText(this, this.skin, BASE_WIDTH / 2, BASE_HEIGHT / 2, model.headline, { size: 18 })
      );
    } else if (model.kind === "game") {
      this.renderGame(model.game);
    } else if (model.kind === "lobby") {
      this.renderLobby(model.view, model.buttons);
      this.revealSeatDraw(model.seatDraw);
    }
  }

  /** 前に描いたときの席順の引き（JSON）。まだ描いていなければ undefined */
  private lastSeatDraw: string | undefined;

  /** 新しくカードを引いて席順を決めたら、誰が何を引いたかを1枚ずつめくって見せる */
  private revealSeatDraw(rounds: SeatDrawRound[] | null) {
    const key = JSON.stringify(rounds);
    const play = shouldPlayReveal(this.lastSeatDraw, key);
    this.lastSeatDraw = key;
    if (play) void playSeatDrawReveal(this, this.skin, rounds!);
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
    const seatKeys = view.seats.map((s, i) => (s.kind === "cpu" ? `cpu-${i}` : `${s.id}-${i}`));
    const firstDraw = this.shownSeats.length === 0;
    const moveUp = (index: number) => async () => {
      const result = await this.screen.actions.arrange(orderMovingUp(view, index));
      if (!result.ok) showToast(this, skin, result.message);
    };
    view.seats.forEach((seat, index) => {
      const y = SEATS_TOP + index * (SEAT_SIZE.height + SEAT_GAP);
      const canMove = seat.kind === "player" && seat.canMoveUp;
      const plate = drawSeat(this, skin, {
        x: cx,
        y,
        seat,
        index,
        onMoveUp: canMove ? () => void moveUp(index)() : undefined,
      });
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
        if (!firstDraw && seat.kind === "player") playSound(this, "sfx.seat");
      }
    });
    this.shownSeats = seatKeys;

    const me = this.screen.guest.getState().guest;
    this.body.add(
      drawNameChip(this, skin, {
        x: cx,
        y: SEATS_TOP + view.seats.length * (SEAT_SIZE.height + SEAT_GAP) + 10,
        name: me?.name ?? null,
        onRename: this.screen.rename,
      })
    );

    const { actions } = this.screen;
    const quiet = (run: () => Promise<ActionResult>, onDone?: () => void) => async () => {
      const result = await run();
      if (!result.ok) return { message: result.message };
      onDone?.();
      return { message: null };
    };
    const handlers: Record<LobbyAction, () => Promise<{ message: string | null }>> = {
      join: quiet(actions.join),
      leave: quiet(actions.leave),
      start: quiet(actions.start, () => playSound(this, "sfx.start")),
      draw: quiet(actions.drawSeats),
      share: () => actions.share(),
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
            const { message } = await handlers[button.action]();
            if (message) showToast(this, skin, message);
          },
        })
      );
    });
  }

  /** 自分の投げのめくりの舞台（めくっている間だけ） */
  private stage: FlipStage | null = null;

  private me() {
    return this.screen.guest.getState().guest?.id ?? null;
  }

  /** 狙いに選んでいる手札（自分の手番で選んでいる間だけ） */
  private selected: number[] = [];
  /** 前に描いた、めくっている途中の札の枚数。新しくめくれた札だけをめくる動きで出す */
  private shownFlips = 0;

  private renderGame(game: GameModel) {
    const { skin, screen } = this;
    if (game.myTurn !== "select") this.selected = [];
    this.body.add(drawPlayerPanels(this, skin, game.players, 98));
    this.body.add(drawScoreboard(this, skin, game.rows, BOARD_TOP));

    // めくっている途中ならその投げ、そうでなければ直前の投げ
    if (game.current) {
      const fresh = game.current.flips.length - this.shownFlips;
      const strip = drawThrowStrip(
        this,
        skin,
        {
          title: `${game.current.name} がめくっています`,
          aims: game.current.aims,
          flips: game.current.flips.map((face) => ({ face, outcome: null })),
          flipsLeft: game.current.flipsLeft,
        },
        470
      );
      this.body.add(strip);
      if (fresh > 0) {
        playSound(this, "sfx.flip");
        // 新しくめくれた札（狙いの後ろ、矢印の後ろの、めくった札の末尾）を弾ませる
        const cards = strip.list.filter((o) => o instanceof Phaser.GameObjects.Container);
        const flipped = cards.slice(
          game.current.aims.length,
          game.current.aims.length + game.current.flips.length
        );
        flipped.slice(-fresh).forEach((card, i) =>
          this.tweens.add({
            targets: card,
            scaleX: { from: 0, to: (card as Phaser.GameObjects.Container).scaleX },
            duration: skin.motion.flipMs,
            delay: i * skin.motion.flipMs,
            ease: "Back.easeOut",
          })
        );
      }
      this.shownFlips = game.current.flips.length;
    } else {
      this.shownFlips = 0;
      if (game.lastThrow) {
        this.body.add(
          drawThrowStrip(
            this,
            skin,
            { title: `${game.lastThrow.name} の投げ`, ...game.lastThrow },
            470
          )
        );
      }
    }

    // 山札と手札
    this.body.add(drawCard(this, skin, { x: 30, y: 610, face: { kind: "back" } }).setScale(0.5));
    this.body.add(
      addText(this, skin, 30, 652, `山札 ${game.deckCount}`, { size: 11, color: "muted" })
    );
    if (game.hand) this.renderHand(game);

    if (game.result) {
      this.renderResult(game.result);
      return;
    }
    if (game.myTurn === "select") {
      const ready = this.selected.length === game.aimCount;
      this.body.add(
        addText(
          this,
          skin,
          BASE_WIDTH - 16,
          540,
          `狙い ${this.selected.length} / ${game.aimCount}`,
          {
            size: 13,
            color: ready ? "text" : "muted",
            originX: 1,
          }
        )
      );
      const throwButton = drawButton(this, skin, {
        x: BASE_WIDTH / 2,
        y: 760,
        label: "投げる",
        primary: true,
        onPress: async () => {
          if (this.selected.length !== game.aimCount) {
            showToast(this, skin, `狙いを${game.aimCount}枚選んでください`);
            return;
          }
          const result = await screen.actions.declare(this.selected);
          if (!result.ok) showToast(this, skin, result.message);
        },
      });
      this.body.add(throwButton.setAlpha(ready ? 1 : 0.5));
    } else if (game.myTurn === "flip") {
      // 自分の投げは、画面いっぱいのめくりの舞台でめくる
      const current = game.current!;
      this.stage ??= new FlipStage(this, skin, {
        aims: current.aims,
        count: current.flips.length + current.flipsLeft,
        deckCount: game.deckCount,
        flip: (count) => screen.actions.flip(count),
      });
      this.stage.update(current.flips);
    } else {
      const turn = game.players.find((p) => p.turn);
      this.body.add(
        addText(this, skin, BASE_WIDTH / 2, 770, turn ? `${turn.name} の番です` : "", {
          size: 15,
          color: "muted",
        })
      );
    }
  }

  /** 手札。自分の手番なら押して狙いを選ぶ（選んだ札は持ち上がる） */
  private renderHand(game: GameModel) {
    const { skin } = this;
    const hand = game.hand!;
    const step = skin.card.width + 8;
    const left = BASE_WIDTH / 2 + 20 - (step * (hand.length - 1)) / 2;
    hand.forEach((card, i) => {
      const picked = this.selected.includes(card.id);
      const view = drawCard(this, skin, {
        x: left + step * i,
        y: picked ? 596 : 610,
        face: card.face,
      });
      if (game.myTurn === "select") {
        view.setSize(skin.card.width, skin.card.height).setInteractive({ useHandCursor: true });
        view.on("pointerup", () => {
          playSound(this, "sfx.tap");
          this.selected = toggleAim(this.selected, card.id, game.aimCount);
          this.draw(this.screen.store.getState());
        });
      }
      this.body.add(view);
    });
  }

  /** 終わったときの結果 */
  private renderResult(result: NonNullable<GameModel["result"]>) {
    const { skin } = this;
    const shade = this.add
      .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, skin.colors.panel, 0.88)
      .setOrigin(0)
      .setInteractive();
    const title = addText(this, skin, BASE_WIDTH / 2, 300, result.iWon ? "YOU WIN!" : "GAME OVER", {
      size: 40,
      font: "display",
      bold: true,
    });
    const names = addText(this, skin, BASE_WIDTH / 2, 360, `勝者：${result.winners.join("・")}`, {
      size: 18,
    });
    const home = drawButton(this, skin, {
      x: BASE_WIDTH / 2,
      y: 760,
      label: "入口へ戻る",
      primary: true,
      onPress: async () => this.screen.home(),
    });
    this.body.add([shade, title, names, home]);
    this.tweens.add({
      targets: title,
      scale: { from: 0.4, to: 1 },
      duration: 500,
      ease: "Back.easeOut",
    });
    playSound(this, "sfx.start");
  }
}
