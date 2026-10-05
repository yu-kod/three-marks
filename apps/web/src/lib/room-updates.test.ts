import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeRoomUpdates } from "./room-updates";

/** テスト用の WebSocket。開く・届く・閉じるをテストから起こす */
class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  receive(data: unknown) {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }
  drop() {
    this.onclose?.();
  }
}

const latest = () => FakeSocket.instances.at(-1)!;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

/** url に null を渡すと、URL が無いとき（VITE_WS_URL 未設定）を再現する */
function subscribe(url: string | null = "wss://ws.example/ws") {
  const onChange = vi.fn();
  const unsubscribe = subscribeRoomUpdates({
    url: url ?? undefined,
    roomId: "room 1",
    onChange,
    pollIntervalMs: 5_000,
    createSocket: (u) => new FakeSocket(u),
  });
  return { onChange, unsubscribe };
}

describe("subscribeRoomUpdates", () => {
  it("ルームを指定して繋ぎ、そのルームの更新が届いたら知らせる", () => {
    const { onChange } = subscribe();
    latest().open();

    latest().receive({ type: "room-changed", roomId: "room 1" });

    expect(latest().url).toBe("wss://ws.example/ws?room=room%201");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("別のルームの更新や、読めないメッセージは無視する", () => {
    const { onChange } = subscribe();
    latest().open();

    latest().receive({ type: "room-changed", roomId: "other" });
    latest().receive("not json");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("繋がっている間はポーリングしない", () => {
    const { onChange } = subscribe();
    latest().open();

    vi.advanceTimersByTime(60_000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("繋がる前と切れている間はポーリングで追いつく", () => {
    const { onChange } = subscribe();

    vi.advanceTimersByTime(5_000);
    expect(onChange).toHaveBeenCalledTimes(1);

    latest().open();
    latest().drop();
    vi.advanceTimersByTime(5_000);
    expect(onChange).toHaveBeenCalledTimes(3); // 切れた直後に1回 + ポーリング1回
  });

  it("切れたら、待ち時間を倍にしながら（上限30秒）繋ぎ直す", () => {
    subscribe();
    latest().drop();

    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    latest().drop();
    vi.advanceTimersByTime(2_000);
    expect(FakeSocket.instances).toHaveLength(3);

    for (let i = 0; i < 10; i++) {
      latest().drop();
      vi.advanceTimersByTime(30_000);
    }
    expect(FakeSocket.instances).toHaveLength(13);
  });

  it("繋がったら待ち時間は最初に戻る", () => {
    subscribe();
    latest().drop();
    vi.advanceTimersByTime(1_000);
    latest().drop();
    vi.advanceTimersByTime(2_000);

    latest().open();
    latest().drop();
    vi.advanceTimersByTime(1_000);

    expect(FakeSocket.instances).toHaveLength(4);
  });

  it("URL が無ければ（ローカル開発など）ポーリングだけで動く", () => {
    const { onChange } = subscribe(null);

    vi.advanceTimersByTime(10_000);

    expect(FakeSocket.instances).toHaveLength(0);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("やめたら閉じて、もう知らせも繋ぎ直しもしない", () => {
    const { onChange, unsubscribe } = subscribe();
    const socket = latest();

    unsubscribe();
    socket.drop();
    vi.advanceTimersByTime(60_000);

    expect(socket.closed).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("繋ぎ直しを待っている間にやめたら、もう繋ぎ直さない", () => {
    const { unsubscribe } = subscribe();
    latest().drop();

    unsubscribe();
    vi.advanceTimersByTime(60_000);

    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("繋がっている間にやめても閉じるだけ", () => {
    const { onChange, unsubscribe } = subscribe();
    latest().open();

    unsubscribe();
    vi.advanceTimersByTime(60_000);

    expect(latest().closed).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("作り方を渡さなければブラウザの WebSocket を使う", () => {
    const Native = vi.fn(function (this: object, url: string) {
      Object.assign(this, { url, close: () => {} });
    });
    vi.stubGlobal("WebSocket", Native);

    const unsubscribe = subscribeRoomUpdates({
      url: "wss://ws.example/ws",
      roomId: "r",
      onChange: () => {},
    });

    expect(Native).toHaveBeenCalledWith("wss://ws.example/ws?room=r");
    unsubscribe();
  });
});
