import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { TABLE_NAME_ENV } from "./deps.js";

const send = vi.hoisted(() => vi.fn());
vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>()),
  DynamoDBDocumentClient: { from: () => ({ send }) },
}));

function registerGuest() {
  return createApp().request("/api/guests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alice" }),
  });
}

describe("環境変数からの依存の組み立て", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    send.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("テーブル名があればゲストを DynamoDB に保存する", async () => {
    vi.stubEnv(TABLE_NAME_ENV, "three-marks-app");
    send.mockResolvedValue({});

    const res = await registerGuest();

    expect(res.status).toBe(201);
    const command = send.mock.calls[0]![0] as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input.TableName).toBe("three-marks-app");
  });

  it("テーブル名が無ければインメモリで動き、DynamoDB には触れない", async () => {
    vi.stubEnv(TABLE_NAME_ENV, "");

    const res = await registerGuest();

    expect(res.status).toBe(201);
    expect(send).not.toHaveBeenCalled();
  });
});
