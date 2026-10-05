import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { Post } from "./notifier.js";

/**
 * API Gateway WebSocket API の接続へ送る。
 *
 * client は `new ApiGatewayManagementApiClient({ endpoint })` で作る（endpoint は
 * https://<api-id>.execute-api.<region>.amazonaws.com/<stage>）。テストでは send だけを持つ偽物を渡す。
 */
export function createApiGatewayPost(client: Pick<ApiGatewayManagementApiClient, "send">): Post {
  const encoder = new TextEncoder();

  return async (connectionId, data) => {
    try {
      await client.send(
        new PostToConnectionCommand({ ConnectionId: connectionId, Data: encoder.encode(data) })
      );
      return "sent";
    } catch (error) {
      if (error instanceof GoneException) {
        return "gone";
      }
      throw error;
    }
  };
}
