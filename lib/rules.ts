export function approvalStatus(up: number, down: number, visibility: string) {
  if (visibility === "private") return "private";
  if (up > 0 && up > down) return "approved";
  if (down > 0 && down > up) return "declined";
  return "pending";
}
export const mealKinds = ["早餐", "午餐", "晚餐", "加餐", "饮品", "夜宵"];
export const foodEmojis = ["🍚", "🥗", "🍜", "🥪", "🥟", "🍔", "🍰", "🍎", "☕", "🧋", "🍲", "🍳"];
