import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConflictError, NotFoundError } from "@app/server-core";
import { describe, expect, it, vi } from "vitest";
import { createDynamoGuestStore } from "./dynamo-guest-store.js";
import type { GuestRecord } from "./guest-store.js";

const record: GuestRecord = {
  tokenHash: "hash-1",
  guestId: "g-1",
  name: "Alice",
  createdAt: 1_000,
  expiresAt: 2_000,
};

const item = {
  PK: "GUEST#hash-1",
  SK: "GUEST",
  guestId: "g-1",
  name: "Alice",
  createdAt: 1_000,
  expiresAt: 2_000,
};

function setup(send = vi.fn().mockResolvedValue({})) {
  const store = createDynamoGuestStore({ client: { send }, tableName: "app" });
  const sent = (i = 0) => send.mock.calls[i]![0] as PutCommand | GetCommand | UpdateCommand;
  return { store, send, sent };
}

const conditionFailed = () =>
  new ConditionalCheckFailedException({ message: "failed", $metadata: {} });

describe("createDynamoGuestStore", () => {
  it("create は上書きしない条件付きで Put する", async () => {
    const { store, sent } = setup();

    await store.create(record);

    expect(sent()).toBeInstanceOf(PutCommand);
    expect(sent().input).toEqual({
      TableName: "app",
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    });
  });

  it("create の条件に落ちたら ConflictError", async () => {
    const { store } = setup(vi.fn().mockRejectedValue(conditionFailed()));

    await expect(store.create(record)).rejects.toBeInstanceOf(ConflictError);
  });

  it("findByTokenHash はキーで Get して GuestRecord に戻す", async () => {
    const { store, sent } = setup(vi.fn().mockResolvedValue({ Item: item }));

    await expect(store.findByTokenHash("hash-1")).resolves.toEqual(record);
    expect(sent()).toBeInstanceOf(GetCommand);
    expect(sent().input).toEqual({ TableName: "app", Key: { PK: "GUEST#hash-1", SK: "GUEST" } });
  });

  it("findByTokenHash で項目が無ければ null", async () => {
    const { store } = setup(vi.fn().mockResolvedValue({}));

    await expect(store.findByTokenHash("nope")).resolves.toBeNull();
  });

  it("update は渡した属性だけを、存在する項目に対して SET する", async () => {
    const { store, sent } = setup();

    await store.update("hash-1", { name: "Bob", expiresAt: 3_000 });

    expect(sent()).toBeInstanceOf(UpdateCommand);
    expect(sent().input).toEqual({
      TableName: "app",
      Key: { PK: "GUEST#hash-1", SK: "GUEST" },
      UpdateExpression: "SET #name = :name, #expiresAt = :expiresAt",
      ExpressionAttributeNames: { "#name": "name", "#expiresAt": "expiresAt" },
      ExpressionAttributeValues: { ":name": "Bob", ":expiresAt": 3_000 },
      ConditionExpression: "attribute_exists(PK)",
    });
  });

  it("update の条件に落ちたら NotFoundError", async () => {
    const { store } = setup(vi.fn().mockRejectedValue(conditionFailed()));

    await expect(store.update("hash-1", { name: "Bob" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("条件以外の失敗はそのまま投げる", async () => {
    const throttled = new Error("throttled");
    const { store } = setup(vi.fn().mockRejectedValue(throttled));

    await expect(store.create(record)).rejects.toBe(throttled);
    await expect(store.update("hash-1", { name: "Bob" })).rejects.toBe(throttled);
  });
});
