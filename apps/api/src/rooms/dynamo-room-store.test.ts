import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ConflictError } from "@app/server-core";
import { describe, expect, it, vi } from "vitest";
import { createDynamoRoomStore } from "./dynamo-room-store.js";
import type { RoomRecord } from "./room-store.js";

const room: RoomRecord = {
  roomId: "room-1",
  hostId: "g-1",
  members: [{ guestId: "g-1", name: "Alice", joinedAt: 1_000 }],
  createdAt: 1_000,
  expiresAt: 2_000,
  seatDraw: null,
  version: 1,
};

const item = {
  PK: "ROOM#room-1",
  SK: "ROOM",
  hostId: "g-1",
  members: [{ guestId: "g-1", name: "Alice", joinedAt: 1_000 }],
  createdAt: 1_000,
  expiresAt: 2_000,
  seatDraw: null,
  version: 1,
};

function setup(send = vi.fn().mockResolvedValue({})) {
  const store = createDynamoRoomStore({ client: { send }, tableName: "app" });
  const sent = (i = 0) => send.mock.calls[i]![0] as PutCommand | GetCommand;
  return { store, sent };
}

const conditionFailed = () =>
  new ConditionalCheckFailedException({ message: "failed", $metadata: {} });

describe("createDynamoRoomStore", () => {
  it("create は上書きしない条件付きで Put する", async () => {
    const { store, sent } = setup();

    await store.create(room);

    expect(sent()).toBeInstanceOf(PutCommand);
    expect(sent().input).toEqual({
      TableName: "app",
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    });
  });

  it("create の条件に落ちたら ConflictError", async () => {
    const { store } = setup(vi.fn().mockRejectedValue(conditionFailed()));

    await expect(store.create(room)).rejects.toBeInstanceOf(ConflictError);
  });

  it("find はキーで Get して RoomRecord に戻す", async () => {
    const { store, sent } = setup(vi.fn().mockResolvedValue({ Item: item }));

    await expect(store.find("room-1")).resolves.toEqual(room);
    expect(sent()).toBeInstanceOf(GetCommand);
    expect(sent().input).toEqual({ TableName: "app", Key: { PK: "ROOM#room-1", SK: "ROOM" } });
  });

  it("find で項目が無ければ null", async () => {
    const { store } = setup(vi.fn().mockResolvedValue({}));

    await expect(store.find("room-1")).resolves.toBeNull();
  });

  it("save は読んだときの版を条件に、版を1つ進めて Put する", async () => {
    const { store, sent } = setup();

    await store.save(room);

    expect(sent().input).toEqual({
      TableName: "app",
      Item: { ...item, version: 2 },
      ConditionExpression: "version = :expected",
      ExpressionAttributeValues: { ":expected": 1 },
    });
  });

  it("save の条件に落ちたら ConflictError", async () => {
    const { store } = setup(vi.fn().mockRejectedValue(conditionFailed()));

    await expect(store.save(room)).rejects.toBeInstanceOf(ConflictError);
  });

  it("条件以外の失敗はそのまま投げる", async () => {
    const error = new Error("network");
    const { store } = setup(vi.fn().mockRejectedValue(error));

    await expect(store.save(room)).rejects.toBe(error);
  });
});
