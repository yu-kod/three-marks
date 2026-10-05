import { GetCommand, PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ConflictError, isConditionalCheckFailed } from "@app/server-core";
import type { RoomRecord, RoomStore } from "./room-store.js";

export type DynamoRoomStoreOptions = {
  /** `createDocumentClient()` で作ったもの。テストでは send だけを持つ偽物を渡す */
  client: Pick<DynamoDBDocumentClient, "send">;
  tableName: string;
};

/**
 * ルームを単一テーブル（infra/modules/app-table）へ保存する。
 *
 *   | 項目     | PK            | SK   | 属性                                               |
 *   |----------|---------------|------|----------------------------------------------------|
 *   | ルーム   | ROOM#<roomId> | ROOM | hostId, members, seatDraw, game, createdAt, expiresAt, version |
 *
 * 参加者とゲームの状態は項目の中に持つ（最大4人・41枚なので項目のサイズ上限 400KB に届かない）。
 * 書き込みは版（version）を条件にした丸ごとの Put で、同時の参加が互いを消さないようにする。
 * expiresAt はテーブルの TTL 属性なので、期限を過ぎた項目は DynamoDB が消す。
 */
export function createDynamoRoomStore({ client, tableName }: DynamoRoomStoreOptions): RoomStore {
  const key = (roomId: string) => ({ PK: `ROOM#${roomId}`, SK: "ROOM" });

  const toItem = ({ roomId, ...rest }: RoomRecord) => ({ ...key(roomId), ...rest });

  /** 条件付き書き込みの失敗だけを ConflictError に読み替える */
  async function put(input: ConstructorParameters<typeof PutCommand>[0], message: string) {
    try {
      await client.send(new PutCommand(input));
    } catch (error) {
      throw isConditionalCheckFailed(error) ? new ConflictError(message) : error;
    }
  }

  return {
    create: (room) =>
      put(
        {
          TableName: tableName,
          Item: toItem(room),
          ConditionExpression: "attribute_not_exists(PK)",
        },
        "同じ ID のルームが既にある"
      ),

    async find(roomId) {
      const { Item } = await client.send(
        new GetCommand({ TableName: tableName, Key: key(roomId) })
      );
      if (!Item) {
        return null;
      }
      return {
        roomId,
        hostId: Item.hostId,
        members: Item.members,
        createdAt: Item.createdAt,
        expiresAt: Item.expiresAt,
        seatDraw: Item.seatDraw,
        game: Item.game,
        version: Item.version,
      };
    },

    save: (room) =>
      put(
        {
          TableName: tableName,
          Item: toItem({ ...room, version: room.version + 1 }),
          // 項目が無いときも version が無いので条件に落ちる（消えたルームを復活させない）
          ConditionExpression: "version = :expected",
          ExpressionAttributeValues: { ":expected": room.version },
        },
        "ルームが他の操作で更新された"
      ),
  };
}
