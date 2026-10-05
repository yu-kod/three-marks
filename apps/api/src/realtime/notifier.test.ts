import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryConnectionStore } from "./connection-store.js";
import { createRoomNotifier, type Post } from "./notifier.js";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function setup(post: Post) {
  const connections = createInMemoryConnectionStore();
  await connections.add({ connectionId: "c1", roomId: "r1", expiresAt: 100 });
  await connections.add({ connectionId: "c2", roomId: "r1", expiresAt: 100 });
  await connections.add({ connectionId: "c3", roomId: "r2", expiresAt: 100 });
  return { connections, notifier: createRoomNotifier({ connections, post }) };
}

describe("createRoomNotifier", () => {
  it("ルームの接続すべてに、更新があったことだけを送る（中身は送らない）", async () => {
    const post = vi.fn<Post>().mockResolvedValue("sent");
    const { notifier } = await setup(post);

    await notifier.roomChanged("r1");

    const message = JSON.stringify({ type: "room-changed", roomId: "r1" });
    expect(post.mock.calls).toEqual([
      ["c1", message],
      ["c2", message],
    ]);
  });

  it("もう切れていた接続は忘れる", async () => {
    const post = vi.fn<Post>(async (id) => (id === "c1" ? "gone" : "sent"));
    const { notifier, connections } = await setup(post);

    await notifier.roomChanged("r1");

    await expect(connections.listByRoom("r1")).resolves.toEqual(["c2"]);
  });

  it("送れなくても投げない（ルームの操作は成功させ、クライアントはポーリングで追いつく）", async () => {
    const post = vi.fn<Post>(async (id) => {
      if (id === "c1") throw new Error("throttled");
      return "sent";
    });
    const { notifier } = await setup(post);

    await expect(notifier.roomChanged("r1")).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith("c2", expect.any(String));
    expect(console.error).toHaveBeenCalled();
  });

  it("接続の一覧が取れなくても投げない", async () => {
    const connections = createInMemoryConnectionStore();
    const notifier = createRoomNotifier({
      connections: { ...connections, listByRoom: () => Promise.reject(new Error("db")) },
      post: vi.fn<Post>(),
    });

    await expect(notifier.roomChanged("r1")).resolves.toBeUndefined();
  });
});
