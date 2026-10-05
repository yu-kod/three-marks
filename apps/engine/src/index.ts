export { TARGETS, strength, type Target } from "./targets.js";
export { resolveThrow, type ThrowInput, type ThrowResult } from "./throw.js";
export {
  addMarks,
  deadTargets,
  emptyMarks,
  hasOpenedAll,
  MARKS_TO_OPEN,
  openedTargets,
  type Marks,
} from "./marks.js";
export { deckSize, MAX_PLAYERS, MIN_PLAYERS, rulesFor, type Rules } from "./rules.js";
export { createRng, shuffle, type Rng } from "./rng.js";
export {
  createGame,
  currentThrower,
  GameRuleError,
  throwCards,
  type Card,
  type GameState,
  type PlayerId,
  type ThrowRecord,
} from "./game.js";
