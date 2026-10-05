/**
 * 名前を入力しなかったゲストに付ける仮の名前（「ねむいペンギン」など）。
 *
 * 最初の画面で名前の入力を求めず、まず遊び始められるようにするためのもの。
 * 名前はあとでいつでも変えられる。
 */

export const ADJECTIVES = [
  "ねむい",
  "げんきな",
  "しずかな",
  "はやい",
  "のんびり",
  "まじめな",
  "ふしぎな",
  "かしこい",
  "ゆかいな",
  "やさしい",
  "きまぐれ",
  "おおきな",
  "ちいさな",
  "まるい",
  "ひかる",
  "あわてる",
] as const;

export const ANIMALS = [
  "ペンギン",
  "カワウソ",
  "パンダ",
  "フクロウ",
  "キツネ",
  "タヌキ",
  "ウサギ",
  "ラッコ",
  "ハリネズミ",
  "アザラシ",
  "コアラ",
  "カメ",
  "イルカ",
  "シマリス",
  "ヒツジ",
  "クジラ",
] as const;

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

/** random は 0 以上 1 未満を返す関数。テストでは固定値を渡す */
export function generateGuestName(random: () => number = Math.random): string {
  return `${pick(ADJECTIVES, random)}${pick(ANIMALS, random)}`;
}
