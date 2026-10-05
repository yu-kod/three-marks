import { GoneException, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { describe, expect, it, vi } from "vitest";
import { createApiGatewayPost } from "./api-gateway-post.js";

describe("createApiGatewayPost", () => {
  it("接続 ID へデータを送る", async () => {
    const send = vi.fn().mockResolvedValue({});
    const post = createApiGatewayPost({ send });

    await expect(post("c1", "hello")).resolves.toBe("sent");

    const command = send.mock.calls[0]![0] as PostToConnectionCommand;
    expect(command).toBeInstanceOf(PostToConnectionCommand);
    expect(command.input.ConnectionId).toBe("c1");
    expect(new TextDecoder().decode(command.input.Data as Uint8Array)).toBe("hello");
  });

  it("もう切れた接続（410 Gone）なら gone", async () => {
    const send = vi.fn().mockRejectedValue(new GoneException({ message: "gone", $metadata: {} }));

    await expect(createApiGatewayPost({ send })("c1", "x")).resolves.toBe("gone");
  });

  it("それ以外の失敗はそのまま投げる", async () => {
    const error = new Error("throttled");
    const send = vi.fn().mockRejectedValue(error);

    await expect(createApiGatewayPost({ send })("c1", "x")).rejects.toBe(error);
  });
});
