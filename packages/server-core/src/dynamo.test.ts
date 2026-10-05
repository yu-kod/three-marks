import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { describe, expect, it } from "vitest";
import { createDocumentClient, isConditionalCheckFailed } from "./dynamo.js";

describe("createDocumentClient", () => {
  it("undefined の属性を落として書き込む設定で作る", () => {
    const client = createDocumentClient();

    expect(client.config.translateConfig?.marshallOptions?.removeUndefinedValues).toBe(true);
  });

  it("エンドポイントを渡すとそこへ繋ぐ（DynamoDB Local 用）", async () => {
    const client = createDocumentClient({ endpoint: "http://localhost:8000" });

    const endpoint = await client.config.endpoint?.();
    expect(endpoint?.hostname).toBe("localhost");
    expect(endpoint?.port).toBe(8000);
  });
});

describe("isConditionalCheckFailed", () => {
  it("条件付き書き込みの失敗を見分ける", () => {
    const error = new ConditionalCheckFailedException({ message: "failed", $metadata: {} });

    expect(isConditionalCheckFailed(error)).toBe(true);
  });

  it("それ以外のエラーは区別する", () => {
    expect(isConditionalCheckFailed(new Error("throttled"))).toBe(false);
  });
});
