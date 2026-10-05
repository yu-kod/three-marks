import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { createDynamoConnectionStore } from "./dynamo-connection-store.js";

function setup(send = vi.fn().mockResolvedValue({})) {
  const store = createDynamoConnectionStore({ client: { send }, tableName: "app" });
  const sent = (i = 0) => send.mock.calls[i]![0];
  return { store, send, sent };
}

describe("createDynamoConnectionStore", () => {
  it("add はルームから引く項目と、接続から引く項目を一緒に書く", async () => {
    const { store, sent } = setup();

    await store.add({ connectionId: "c1", roomId: "r1", expiresAt: 100 });

    expect(sent()).toBeInstanceOf(TransactWriteCommand);
    expect(sent().input).toEqual({
      TransactItems: [
        { Put: { TableName: "app", Item: { PK: "ROOM#r1", SK: "CONN#c1", expiresAt: 100 } } },
        {
          Put: {
            TableName: "app",
            Item: { PK: "CONN#c1", SK: "CONN", roomId: "r1", expiresAt: 100 },
          },
        },
      ],
    });
  });

  it("listByRoom はルームの接続をまとめて引く", async () => {
    const { store, sent } = setup(
      vi.fn().mockResolvedValue({ Items: [{ SK: "CONN#c1" }, { SK: "CONN#c2" }] })
    );

    await expect(store.listByRoom("r1")).resolves.toEqual(["c1", "c2"]);
    expect(sent()).toBeInstanceOf(QueryCommand);
    expect(sent().input).toEqual({
      TableName: "app",
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": "ROOM#r1", ":prefix": "CONN#" },
    });
  });

  it("listByRoom で項目が無ければ空", async () => {
    const { store } = setup(vi.fn().mockResolvedValue({}));

    await expect(store.listByRoom("r1")).resolves.toEqual([]);
  });

  it("remove は接続からルームを引いて、両方の項目を消す", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Item: { PK: "CONN#c1", SK: "CONN", roomId: "r1" } })
      .mockResolvedValueOnce({});
    const { store, sent } = setup(send);

    await store.remove("c1");

    expect(sent(0)).toBeInstanceOf(GetCommand);
    expect(sent(0).input).toEqual({ TableName: "app", Key: { PK: "CONN#c1", SK: "CONN" } });
    expect(sent(1).input).toEqual({
      TransactItems: [
        { Delete: { TableName: "app", Key: { PK: "ROOM#r1", SK: "CONN#c1" } } },
        { Delete: { TableName: "app", Key: { PK: "CONN#c1", SK: "CONN" } } },
      ],
    });
  });

  it("remove で知らない接続なら何も消さない", async () => {
    const { store, send } = setup(vi.fn().mockResolvedValue({}));

    await store.remove("c1");

    expect(send).toHaveBeenCalledTimes(1);
  });
});
