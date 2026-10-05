import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export type DocumentClientOptions = {
  /** DynamoDB Local などへ繋ぐときだけ指定する */
  endpoint?: string;
};

/**
 * DynamoDB の DocumentClient を作る。
 *
 * Lambda の warm start で使い回せるよう、呼び出し側はモジュールスコープか
 * アプリの組み立て時に1度だけ作ること。
 */
export function createDocumentClient(options: DocumentClientOptions = {}): DynamoDBDocumentClient {
  const client = new DynamoDBClient(options.endpoint ? { endpoint: options.endpoint } : {});
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/**
 * 条件付き書き込み（楽観ロック・重複防止）の失敗かどうか。
 *
 * 呼び出し側はこれを ConflictError（409）などに読み替える。
 */
export function isConditionalCheckFailed(error: unknown): boolean {
  return error instanceof ConditionalCheckFailedException;
}
