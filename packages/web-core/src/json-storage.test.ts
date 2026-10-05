import { beforeEach, describe, expect, it } from "vitest";
import { createJsonStorage } from "./json-storage.js";

const throwingStorage = (): Storage => {
  throw new DOMException("blocked", "SecurityError");
};

describe("createJsonStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("書いた値を JSON として読み戻す", () => {
    const storage = createJsonStorage();

    storage.set("app:session", { id: "g1", token: "t" });

    expect(storage.get("app:session")).toEqual({ id: "g1", token: "t" });
  });

  it("無いキーは null を返す", () => {
    expect(createJsonStorage().get("missing")).toBeNull();
  });

  it("JSON として壊れた値は null として扱う", () => {
    localStorage.setItem("broken", "{not json");

    expect(createJsonStorage().get("broken")).toBeNull();
  });

  it("消したキーは null になる", () => {
    const storage = createJsonStorage();
    storage.set("k", 1);

    storage.remove("k");

    expect(storage.get("k")).toBeNull();
  });

  it("ストレージが使えない環境（プライベートモード等）でも例外を投げない", () => {
    const storage = createJsonStorage(throwingStorage);

    expect(() => storage.set("k", 1)).not.toThrow();
    expect(storage.get("k")).toBeNull();
    expect(() => storage.remove("k")).not.toThrow();
  });
});
