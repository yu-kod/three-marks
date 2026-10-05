import { createGuestSession } from "@app/identity-client";
import { createApiClient, createJsonStorage } from "@app/web-core";
import { vi } from "vitest";
import type { Screen } from "@/game/screens";
import { createTableStore } from "@/game/state/table-store";

/** テスト用のゲストのセッション（通信しない） */
export const idleGuest = () =>
  createGuestSession({
    api: createApiClient({ fetch: vi.fn().mockRejectedValue(new TypeError("offline")) }),
    storage: createJsonStorage(),
  });

export const entranceScreen = (): Screen => ({
  kind: "entrance",
  guest: idleGuest(),
  createRoom: vi.fn(async () => ({ ok: true as const })),
  rename: vi.fn(async () => ({ ok: true as const })),
});

export const roomScreen = (): Screen => ({
  kind: "room",
  guest: idleGuest(),
  store: createTableStore({
    roomId: "r1",
    api: { getRoom: vi.fn(), getGame: vi.fn() },
    subscribe: () => () => {},
  }),
  rename: vi.fn(async () => ({ ok: true as const })),
  home: vi.fn(),
  actions: {
    join: vi.fn(async () => ({ ok: true as const })),
    leave: vi.fn(async () => ({ ok: true as const })),
    share: vi.fn(async () => ({ ok: true, message: null })),
    start: vi.fn(async () => ({ ok: true as const })),
    drawSeats: vi.fn(async () => ({ ok: true as const })),
    arrange: vi.fn(async () => ({ ok: true as const })),
    declare: vi.fn(async () => ({ ok: true as const })),
    flip: vi.fn(async () => ({ ok: true as const })),
  },
});
