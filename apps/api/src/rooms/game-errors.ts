import { UnprocessableError } from "@app/server-core";
import { GameRuleError } from "@three-marks/engine";

/**
 * エンジンを呼び、ルール上できない操作（GameRuleError）を 422 にする。
 *
 * エンジンは I/O を知らないので HTTP のエラーを投げない。読み替えはここに集める。
 * それ以外の例外はエンジンの不具合なので、そのまま投げて 500 にする。
 */
export function withGameRules<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof GameRuleError) {
      throw new UnprocessableError(error.message, "GAME_RULE");
    }
    throw error;
  }
}
