import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./token.js";

describe("generateToken", () => {
  it("URL に載せても壊れない 43 文字（32 バイト）の文字列を返す", () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("呼ぶたびに違う値を返す", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateToken));

    expect(tokens.size).toBe(100);
  });
});

describe("hashToken", () => {
  it("同じトークンからは同じハッシュを返す（保存したハッシュで照合できる）", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("SHA-256 を 16 進で返し、元のトークンを含まない", () => {
    // echo -n abc | sha256sum
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
