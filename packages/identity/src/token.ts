import { createHash, randomBytes } from "node:crypto";

/** 推測できない資格情報を作る（32 バイトの乱数を base64url で） */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * 保存用のハッシュ。DB には平文のトークンを置かず、これだけを置く。
 *
 * トークン自体が十分な長さの乱数なので、パスワードのような遅いハッシュは要らない。
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
