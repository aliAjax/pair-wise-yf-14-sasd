// 判定层：覆盖计算、超限判定、按引用关系的增量重算。纯函数，不碰页面与存储。

import type { Cue, Fixture } from "./data";

export const LIMIT = 100; // 落点叠加亮度上限（%）

export interface Contributor {
  fixtureId: string;
  name: string;
  brightness: number;
}

export interface CueEval {
  cueId: string;
  total: number; // 落点处覆盖灯具的亮度之和
  over: boolean; // total > LIMIT
  contributors: Contributor[]; // 实际覆盖落点的参与灯具
}

/** 灯具光斑是否覆盖某个落点 */
export function covers(f: Fixture, x: number, y: number): boolean {
  return Math.hypot(f.x - x, f.y - y) <= f.radius;
}

/** 触发前预检：把覆盖落点的参与灯具亮度相加 */
export function evaluateCue(cue: Cue, fixtures: Fixture[]): CueEval {
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  const contributors = cue.fixtureIds
    .map((id) => byId.get(id))
    .filter((f): f is Fixture => !!f && covers(f, cue.x, cue.y))
    .map((f) => ({ fixtureId: f.id, name: f.name, brightness: f.brightness }));
  const total = contributors.reduce((sum, c) => sum + c.brightness, 0);
  return { cueId: cue.id, total, over: total > LIMIT, contributors };
}

export function evaluateAll(cues: Cue[], fixtures: Fixture[]): Record<string, CueEval> {
  const out: Record<string, CueEval> = {};
  for (const cue of cues) out[cue.id] = evaluateCue(cue, fixtures);
  return out;
}

/** 只重算引用了某灯具的 Cue，其余结果原样保留 */
export function recomputeForFixture(
  fixtureId: string,
  cues: Cue[],
  fixtures: Fixture[],
  prev: Record<string, CueEval>
): { next: Record<string, CueEval>; touched: string[] } {
  const next = { ...prev };
  const touched: string[] = [];
  for (const cue of cues) {
    if (!cue.fixtureIds.includes(fixtureId)) continue;
    next[cue.id] = evaluateCue(cue, fixtures);
    touched.push(cue.id);
  }
  return { next, touched };
}
