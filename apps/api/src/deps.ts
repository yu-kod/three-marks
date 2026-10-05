/**
 * 本番の依存を環境変数から組み立てる。
 *
 * テーブル名があれば DynamoDB、無ければインメモリ。ローカル開発（npm run dev）は
 * 環境変数を置かないので、そのままインメモリで動く。
 */
import { createDynamoGuestStore, createInMemoryGuestStore, type GuestStore } from "@app/identity";
import { createDocumentClient } from "@app/server-core";

/** Terraform が Lambda へ渡す（infra/app.tf） */
export const TABLE_NAME_ENV = "APP_TABLE_NAME";

export type AppDeps = {
  guestStore: GuestStore;
};

export function createDepsFromEnv(env: Record<string, string | undefined> = process.env): AppDeps {
  const tableName = env[TABLE_NAME_ENV];
  if (!tableName) {
    return { guestStore: createInMemoryGuestStore() };
  }
  const client = createDocumentClient();
  return { guestStore: createDynamoGuestStore({ client, tableName }) };
}
