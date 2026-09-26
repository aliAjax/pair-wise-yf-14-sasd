import { STORAGE_KEY } from "./seed";
import type { DeskData } from "./types";

/** 数据持久化：只保存数据本身，校对结果留在内存里由判定层重算 */
export function loadData(): DeskData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeskData>;
    if (
      parsed.version === 1 &&
      Array.isArray(parsed.fixtures) &&
      Array.isArray(parsed.cues) &&
      typeof parsed.showName === "string"
    ) {
      return parsed as DeskData;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveData(data: DeskData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存储空间不足或被禁用时静默放弃，校对台仍可在内存中工作
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
