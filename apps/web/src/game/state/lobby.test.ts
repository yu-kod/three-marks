import { describe, expect, it } from "vitest";
import { lobbyButtons, lobbyView, orderMovingUp } from "./lobby";
import { buildRoom } from "@/test-utils/table";

const member = (id: string, name = id) => ({ id, name, cpu: false });

describe("lobbyView", () => {
  it("席は4つ。座った人を席順に並べ、空いた席は CPU が入る席として見せる", () => {
    const room = buildRoom({
      hostId: "a",
      members: [member("a", "あなた"), member("b", "ペンギン")],
    });

    expect(lobbyView(room, "b").seats).toEqual([
      { kind: "player", id: "a", name: "あなた", host: true, me: false, canMoveUp: false },
      { kind: "player", id: "b", name: "ペンギン", host: false, me: true, canMoveUp: false },
      { kind: "cpu" },
      { kind: "cpu" },
    ]);
  });

  it("参加していない人は、空きがあれば参加できる。満員なら参加できない", () => {
    const open = buildRoom({ members: [member("a")] });
    const full = buildRoom({ members: ["a", "b", "c", "d"].map((id) => member(id)) });

    expect(lobbyView(open, "x")).toMatchObject({ joined: false, canJoin: true, host: false });
    expect(lobbyView(open, null)).toMatchObject({ joined: false, canJoin: true });
    expect(lobbyView(full, "x")).toMatchObject({ joined: false, canJoin: false });
  });

  it("参加した人は席を離れられる。ホストかどうかも分かる", () => {
    const room = buildRoom({ hostId: "a", members: [member("a"), member("b")] });

    expect(lobbyView(room, "a")).toMatchObject({ joined: true, canJoin: false, host: true });
    expect(lobbyView(room, "b")).toMatchObject({ joined: true, canJoin: false, host: false });
  });

  it("ホストの名前（誰のルームか）を見せる。ホストが席を離れていれば null", () => {
    const room = buildRoom({ hostId: "a", members: [member("a", "あなた")] });

    expect(lobbyView(room, null).hostName).toBe("あなた");
    expect(lobbyView(buildRoom({ hostId: "gone", members: [] }), null).hostName).toBeNull();
  });
});

describe("lobbyButtons", () => {
  const room = buildRoom({ hostId: "a", members: [member("a"), member("b")] });

  it("参加していなければ「参加する」が主役。招待はいつでも送れる", () => {
    expect(lobbyButtons(lobbyView(room, "x"))).toEqual([
      { action: "join", label: "参加する", primary: true },
      { action: "share", label: "招待 URL を送る", primary: false },
    ]);
  });

  it("参加していれば、招待が主役で、席を離れることもできる", () => {
    expect(lobbyButtons(lobbyView(room, "b"))).toEqual([
      { action: "share", label: "招待 URL を送る", primary: true },
      { action: "leave", label: "席を離れる", primary: false },
    ]);
  });

  it("満員で参加できなければ、招待だけ", () => {
    const full = buildRoom({ members: ["a", "b", "c", "d"].map((id) => member(id)) });

    expect(lobbyButtons(lobbyView(full, "x"))).toEqual([
      { action: "share", label: "招待 URL を送る", primary: true },
    ]);
  });
});

describe("ホストの操作", () => {
  const room = buildRoom({ hostId: "a", members: [member("a"), member("b"), member("c")] });

  it("ホストは、ゲームを始める（主役）・カードを引いて席順を決める・招待・席を離れるを選べる", () => {
    expect(lobbyButtons(lobbyView(room, "a"))).toEqual([
      { action: "start", label: "ゲームを始める", primary: true },
      { action: "draw", label: "カードを引いて席順を決める", primary: false },
      { action: "share", label: "招待 URL を送る", primary: false },
      { action: "leave", label: "席を離れる", primary: false },
    ]);
  });

  it("ホストには、2番目から後ろの人の席に「上へ」が出る。ほかの人には出ない", () => {
    const seats = (me: string) =>
      lobbyView(room, me).seats.map((s) => s.kind === "player" && s.canMoveUp);

    expect(seats("a")).toEqual([false, true, true, false]);
    expect(seats("b")).toEqual([false, false, false, false]);
  });

  it("上へ動かした並び（ひとつ前の人と入れ替える）", () => {
    expect(orderMovingUp(lobbyView(room, "a"), 2)).toEqual(["a", "c", "b"]);
    expect(orderMovingUp(lobbyView(room, "a"), 1)).toEqual(["b", "a", "c"]);
  });
});

describe("最後の1人だったホストが席を離れたあと", () => {
  it("ホストの操作は出さず、参加できる（次に参加した人がホストになる）", () => {
    const emptied = buildRoom({ hostId: "a", members: [] });

    expect(lobbyView(emptied, "a")).toMatchObject({ host: false, canJoin: true });
  });
});
