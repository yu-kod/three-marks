/**
 * 本番の依存を環境変数から組み立てる。
 *
 * テーブル名があれば DynamoDB、無ければインメモリ。ローカル開発（npm run dev）は
 * 環境変数を置かないので、そのままインメモリで動く。
 */
import { createDynamoGuestStore, createInMemoryGuestStore, type GuestStore } from "@app/identity";
import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import { createDocumentClient } from "@app/server-core";
import { createApiGatewayPost } from "./realtime/api-gateway-post.js";
import {
  createInMemoryConnectionStore,
  type ConnectionStore,
} from "./realtime/connection-store.js";
import { createDynamoConnectionStore } from "./realtime/dynamo-connection-store.js";
import { createRoomNotifier, silentNotifier, type RoomNotifier } from "./realtime/notifier.js";
import { createDynamoRoomStore } from "./rooms/dynamo-room-store.js";
import { createInMemoryRoomStore, type RoomStore } from "./rooms/room-store.js";

/** Terraform が Lambda へ渡す（infra/app.tf） */
export const TABLE_NAME_ENV = "APP_TABLE_NAME";

/**
 * WebSocket API の管理用エンドポイント（https://<api-id>.execute-api.<region>.amazonaws.com/<stage>）。
 * Terraform が Lambda へ渡す。無ければ通知しない（クライアントはポーリングで追いつく）
 */
export const WS_ENDPOINT_ENV = "WS_MANAGEMENT_ENDPOINT";

export type AppDeps = {
  guestStore: GuestStore;
  roomStore: RoomStore;
  connectionStore: ConnectionStore;
  notifier: RoomNotifier;
};

export function createDepsFromEnv(env: Record<string, string | undefined> = process.env): AppDeps {
  const tableName = env[TABLE_NAME_ENV];
  if (!tableName) {
    return {
      guestStore: createInMemoryGuestStore(),
      roomStore: createInMemoryRoomStore(),
      connectionStore: createInMemoryConnectionStore(),
      notifier: silentNotifier,
    };
  }
  const client = createDocumentClient();
  const connectionStore = createDynamoConnectionStore({ client, tableName });
  const endpoint = env[WS_ENDPOINT_ENV];
  return {
    guestStore: createDynamoGuestStore({ client, tableName }),
    roomStore: createDynamoRoomStore({ client, tableName }),
    connectionStore,
    notifier: endpoint
      ? createRoomNotifier({
          connections: connectionStore,
          post: createApiGatewayPost(new ApiGatewayManagementApiClient({ endpoint })),
        })
      : silentNotifier,
  };
}
