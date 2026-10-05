import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { ConflictError, isConditionalCheckFailed, NotFoundError } from "@app/server-core";
import type { GuestChanges, GuestRecord, GuestStore } from "./guest-store.js";

export type DynamoGuestStoreOptions = {
  /** `createDocumentClient()` で作ったもの。テストでは send だけを持つ偽物を渡す */
  client: Pick<DynamoDBDocumentClient, "send">;
  tableName: string;
};

/**
 * ゲストを単一テーブル（infra/modules/app-table）へ保存する。
 *
 *   | 項目     | PK                  | SK    | 属性                                  |
 *   |----------|---------------------|-------|---------------------------------------|
 *   | ゲスト   | GUEST#<tokenHash>   | GUEST | guestId, name, createdAt, expiresAt   |
 *
 * expiresAt はテーブルの TTL 属性なので、期限を過ぎた項目は DynamoDB が消す。
 */
export function createDynamoGuestStore({ client, tableName }: DynamoGuestStoreOptions): GuestStore {
  const key = (tokenHash: string) => ({ PK: `GUEST#${tokenHash}`, SK: "GUEST" });

  const toItem = ({ tokenHash, ...rest }: GuestRecord) => ({ ...key(tokenHash), ...rest });

  /** 条件付き書き込みの失敗だけをアプリのエラーに読み替える */
  async function write(run: () => Promise<unknown>, onConditionFailed: () => Error) {
    try {
      await run();
    } catch (error) {
      throw isConditionalCheckFailed(error) ? onConditionFailed() : error;
    }
  }

  function updateCommand(tokenHash: string, changes: GuestChanges) {
    const fields = Object.keys(changes);
    return new UpdateCommand({
      TableName: tableName,
      Key: key(tokenHash),
      UpdateExpression: `SET ${fields.map((f) => `#${f} = :${f}`).join(", ")}`,
      ExpressionAttributeNames: Object.fromEntries(fields.map((f) => [`#${f}`, f])),
      ExpressionAttributeValues: Object.fromEntries(
        Object.entries(changes).map(([f, v]) => [`:${f}`, v])
      ),
      ConditionExpression: "attribute_exists(PK)",
    });
  }

  return {
    create: (record) =>
      write(
        () =>
          client.send(
            new PutCommand({
              TableName: tableName,
              Item: toItem(record),
              ConditionExpression: "attribute_not_exists(PK)",
            })
          ),
        () => new ConflictError("同じトークンのゲストが既にいる")
      ),

    async findByTokenHash(tokenHash) {
      const { Item } = await client.send(
        new GetCommand({ TableName: tableName, Key: key(tokenHash) })
      );
      if (!Item) {
        return null;
      }
      return {
        tokenHash,
        guestId: Item.guestId,
        name: Item.name,
        createdAt: Item.createdAt,
        expiresAt: Item.expiresAt,
      };
    },

    update: (tokenHash, changes) =>
      write(
        () => client.send(updateCommand(tokenHash, changes)),
        () => new NotFoundError("ゲストが見つからない")
      ),
  };
}
