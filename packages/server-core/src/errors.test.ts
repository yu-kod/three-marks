import { describe, expect, it } from "vitest";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
  messageOf,
} from "./errors.js";

describe("AppError のサブクラス", () => {
  it.each([
    [new ValidationError("name は必須"), 400, "VALIDATION_ERROR", "name は必須"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED", "認証が必要"],
    [new ForbiddenError(), 403, "FORBIDDEN", "この操作は許可されていない"],
    [new NotFoundError(), 404, "NOT_FOUND", "見つからない"],
    [new ConflictError(), 409, "CONFLICT", "他の更新と競合した"],
    [new UnprocessableError("手番ではない"), 422, "UNPROCESSABLE", "手番ではない"],
  ])("%o はステータス %i・コード %s を持つ", (error, statusCode, code, message) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode, code, message });
  });

  it("既定のメッセージは差し替えられる", () => {
    expect(new NotFoundError("ルームが見つからない").message).toBe("ルームが見つからない");
  });

  it("コードを指定して独自のエラーを作れる", () => {
    const error = new ConflictError("ルームコードが重複した", "ROOM_CODE_TAKEN");

    expect(error).toMatchObject({ statusCode: 409, code: "ROOM_CODE_TAKEN" });
  });
});

describe("messageOf", () => {
  it("Error ならメッセージを返す", () => {
    expect(messageOf(new Error("壊れた"))).toBe("壊れた");
  });

  it("Error でない値が投げられても文字列にする", () => {
    expect(messageOf("文字列")).toBe("文字列");
  });
});
