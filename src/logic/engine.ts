import { BRIGHTNESS_LIMIT } from "../data/seed";
import type { Cue, Fixture } from "../data/types";
import { covers, distance } from "./geometry";

/** 单个落点上某盏灯的贡献 */
export interface Contribution {
  fixtureId: string;
  fixtureName: string;
  brightness: number;
  distance: number;
}

/** 单个落点的校对结果 */
export interface PointResult {
  pointId: string;
  pointName: string;
  x: number;
  y: number;
  total: number;
  covered: boolean;
  contributions: Contribution[];
  over: boolean;
  /** 造成该落点超限的灯具（贡献者即超出的灯） */
  offenderIds: string[];
}

/** Cue 校对状态 */
export type CueStatus = "ok" | "warn" | "blocked";

export interface CueResult {
  cueId: string;
  status: CueStatus;
  /** 全 Cue 内所有落点的最大叠加亮度 */
  maxTotal: number;
  pointResults: PointResult[];
  /** 全 Cue 范围内造成任一落点超限的灯具 */
  offenderIds: string[];
}

/**
 * 单 Cue 校对（纯函数）：
 * 把覆盖每个落点的参与灯具亮度相加；任一落点超过 100% 即拦截。
 * 没有任何光斑覆盖的落点给出警告（暗点），但不拦截。
 */
export function evaluateCue(cue: Cue, fixtureById: Map<string, Fixture>): CueResult {
  const pointResults: PointResult[] = cue.points.map((point) => {
    const contributions: Contribution[] = [];
    for (const fixtureId of cue.fixtureIds) {
      const fixture = fixtureById.get(fixtureId);
      if (!fixture) continue;
      if (covers(fixture, point)) {
        contributions.push({
          fixtureId,
          fixtureName: fixture.name,
          brightness: fixture.brightness,
          distance: distance(fixture, point),
        });
      }
    }
    const total = round1(contributions.reduce((sum, c) => sum + c.brightness, 0));
    const over = total > BRIGHTNESS_LIMIT;
    return {
      pointId: point.id,
      pointName: point.name,
      x: point.x,
      y: point.y,
      total,
      covered: contributions.length > 0,
      contributions,
      over,
      offenderIds: over ? contributions.map((c) => c.fixtureId) : [],
    };
  });

  const offenderIds = Array.from(
    new Set(pointResults.flatMap((p) => p.offenderIds)),
  );
  const maxTotal = pointResults.reduce((m, p) => Math.max(m, p.total), 0);
  const hasOver = pointResults.some((p) => p.over);
  const hasDark = pointResults.some((p) => !p.covered);

  return {
    cueId: cue.id,
    status: hasOver ? "blocked" : hasDark ? "warn" : "ok",
    maxTotal,
    pointResults,
    offenderIds,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 建立 灯具 -> 引用它的 Cue 反向索引，供增量重算使用 */
export function buildReferenceIndex(cues: Cue[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const cue of cues) {
    for (const fixtureId of cue.fixtureIds) {
      let set = index.get(fixtureId);
      if (!set) {
        set = new Set();
        index.set(fixtureId, set);
      }
      set.add(cue.id);
    }
  }
  return index;
}

/** 查询引用某盏灯的全部 Cue id */
export function cuesReferencingFixture(
  index: Map<string, Set<string>>,
  fixtureId: string,
): string[] {
  return Array.from(index.get(fixtureId) ?? []);
}

/** 首次载入：全量校对所有 Cue（纯函数） */
export function evaluateAll(
  cues: Cue[],
  fixtureById: Map<string, Fixture>,
): Map<string, CueResult> {
  const results = new Map<string, CueResult>();
  for (const cue of cues) {
    results.set(cue.id, evaluateCue(cue, fixtureById));
  }
  return results;
}

/**
 * 增量重算（纯函数）：
 * 只重新校对 dirtyCueIds 里的 Cue，其余结果原样保留；
 * 新出现 / 被删除的 Cue 也由调用方放进 dirty 集合或从 Map 中剔除。
 */
export function reevaluate(
  cues: Cue[],
  fixtureById: Map<string, Fixture>,
  previous: Map<string, CueResult>,
  dirtyCueIds: Iterable<string>,
): Map<string, CueResult> {
  const dirty = new Set(dirtyCueIds);
  const next = new Map<string, CueResult>();
  for (const cue of cues) {
    if (dirty.has(cue.id)) {
      next.set(cue.id, evaluateCue(cue, fixtureById));
    } else {
      const cached = previous.get(cue.id);
      if (cached) next.set(cue.id, cached);
    }
  }
  return next;
}
