import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { ConnectionStore } from "./connection-store.js";

export type DynamoConnectionStoreOptions = {
  /** `createDocumentClient()` で作ったもの。テストでは send だけを持つ偽物を渡す */
  client: Pick<DynamoDBDocumentClient, "send">;
  tableName: string;
};

/**
 * WebSocket の接続を単一テーブル（infra/modules/app-table）へ保存する。
 *
 *   | 項目               | PK            | SK          | 属性                |
 *   |--------------------|---------------|-------------|---------------------|
 *   | ルームの接続       | ROOM#<roomId> | CONN#<id>   | expiresAt           |
 *   | 接続からルームを引く | CONN#<id>    | CONN        | roomId, expiresAt   |
 *
 * 送るときはルームから、切断のときは接続から引くので、同じ接続を2つの向きで持つ。
 * 2つは一緒に書いて一緒に消す。消し損ねても expiresAt（TTL）で消える。
 */
export function createDynamoConnectionStore({
  client,
  tableName,
}: DynamoConnectionStoreOptions): ConnectionStore {
  const roomKey = (roomId: string, connectionId: string) => ({
    PK: `ROOM#${roomId}`,
    SK: `CONN#${connectionId}`,
  });
  const connectionKey = (connectionId: string) => ({ PK: `CONN#${connectionId}`, SK: "CONN" });

  return {
    async add({ connectionId, roomId, expiresAt }) {
      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: { TableName: tableName, Item: { ...roomKey(roomId, connectionId), expiresAt } },
            },
            {
              Put: {
                TableName: tableName,
                Item: { ...connectionKey(connectionId), roomId, expiresAt },
              },
            },
          ],
        })
      );
    },

    async remove(connectionId) {
      const { Item } = await client.send(
        new GetCommand({ TableName: tableName, Key: connectionKey(connectionId) })
      );
      if (!Item) {
        return;
      }
      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Delete: { TableName: tableName, Key: roomKey(Item.roomId, connectionId) } },
            { Delete: { TableName: tableName, Key: connectionKey(connectionId) } },
          ],
        })
      );
    },

    async listByRoom(roomId) {
      // 1ルームの接続は数本なので、1回の Query（最大 1MB）で足りる
      const { Items = [] } = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: { ":pk": `ROOM#${roomId}`, ":prefix": "CONN#" },
        })
      );
      return Items.map((item) => (item.SK as string).slice("CONN#".length));
    },
  };
}
