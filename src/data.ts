// 数据层：灯具 / Cue 的预置数据与浏览器持久化，不含任何判定逻辑。

export interface Fixture {
  id: string;
  name: string;
  x: number; // 舞台平面坐标（米），0..STAGE.w
  y: number; // 0..STAGE.h
  radius: number; // 光斑半径（米）
  brightness: number; // 亮度 0..100 (%)
}

export interface Cue {
  id: string;
  name: string;
  x: number; // 落点
  y: number;
  fixtureIds: string[]; // 参与灯具
}

export interface BlockInfo {
  cueId: string;
  total: number;
  fixtureIds: string[]; // 落点处参与叠加的灯具
}

export const STAGE = { w: 100, h: 60 };

export const PRESET_FIXTURES: Fixture[] = [
  { id: "SP-1", name: "追光·左台口", x: 18, y: 10, radius: 32, brightness: 55 },
  { id: "SP-2", name: "追光·中央楼座", x: 50, y: 4, radius: 32, brightness: 50 },
  { id: "SP-3", name: "追光·右台口", x: 82, y: 10, radius: 30, brightness: 45 },
  { id: "SP-4", name: "追光·侧幕", x: 8, y: 38, radius: 26, brightness: 40 },
];

export const PRESET_CUES: Cue[] = [
  { id: "Q1", name: "Cue 1 · 开场独白", x: 30, y: 26, fixtureIds: ["SP-1", "SP-4"] },
  { id: "Q2", name: "Cue 2 · 双人对手", x: 46, y: 22, fixtureIds: ["SP-1", "SP-2", "SP-3"] },
  { id: "Q3", name: "Cue 3 · 暗转退场", x: 78, y: 30, fixtureIds: ["SP-3"] },
  { id: "Q4", name: "Cue 4 · 谢幕聚光", x: 24, y: 40, fixtureIds: ["SP-1", "SP-4"] },
];

export interface PersistedState {
  fixtures: Fixture[];
  cues: Cue[];
  results: Record<string, unknown>;
  currentCueId: string | null;
  block: BlockInfo | null;
}

const STORAGE_KEY = "followspot-calibrator:v1";

export function loadState(): PersistedState {
  const fallback: PersistedState = {
    fixtures: PRESET_FIXTURES,
    cues: PRESET_CUES,
    results: {},
    currentCueId: null,
    block: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      fixtures: parsed.fixtures ?? fallback.fixtures,
      cues: parsed.cues ?? fallback.cues,
      results: parsed.results ?? {},
      currentCueId: parsed.currentCueId ?? null,
      block: parsed.block ?? null,
    };
  } catch {
    return fallback;
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级，页面功能不受影响
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
