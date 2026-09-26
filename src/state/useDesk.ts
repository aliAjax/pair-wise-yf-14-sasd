import { useEffect, useMemo, useReducer } from "react";
import { createSeedData, STAGE_HEIGHT, STAGE_WIDTH } from "../data/seed";
import { clearStorage, loadData, saveData } from "../data/storage";
import type { Cue, DeskData, Fixture, LandingPoint } from "../data/types";
import { uid } from "../data/uid";
import {
  buildReferenceIndex,
  evaluateAll,
  reevaluate,
  type CueResult,
} from "../logic/engine";

/** 最近一次触发被拦截的信息（“停在当前 Cue”） */
export interface BlockedAttempt {
  cueId: string;
  cueName: string;
  at: number;
}

/** 最近一次（增量）重算的痕迹，用于在页面上证明“只重算引用它的 Cue” */
export interface RecomputeTrace {
  cueIds: string[];
  reason: string;
  full: boolean;
  at: number;
}

export interface DeskState {
  data: DeskData;
  results: Map<string, CueResult>;
  referenceIndex: Map<string, Set<string>>;
  previewCueId: string | null;
  blocked: BlockedAttempt | null;
  lastRecompute: RecomputeTrace | null;
}

type Action =
  | { type: "load"; data: DeskData }
  | { type: "reset" }
  | { type: "setShowName"; name: string }
  | { type: "addFixture" }
  | { type: "updateFixture"; id: string; patch: Partial<Omit<Fixture, "id">> }
  | { type: "deleteFixture"; id: string }
  | { type: "addCue" }
  | { type: "updateCue"; id: string; patch: Partial<Pick<Cue, "name" | "note">> }
  | { type: "deleteCue"; id: string }
  | { type: "toggleCueFixture"; cueId: string; fixtureId: string }
  | { type: "addPoint"; cueId: string }
  | {
      type: "updatePoint";
      cueId: string;
      pointId: string;
      patch: Partial<Omit<LandingPoint, "id">>;
    }
  | { type: "deletePoint"; cueId: string; pointId: string }
  | { type: "setPreview"; cueId: string | null }
  | { type: "dismissBlocked" }
  | { type: "trigger"; cueId: string };

function fixtureMap(fixtures: Fixture[]): Map<string, Fixture> {
  return new Map(fixtures.map((f) => [f.id, f]));
}

function buildState(data: DeskData): DeskState {
  const byId = fixtureMap(data.fixtures);
  const results = evaluateAll(data.cues, byId);
  const firstBlocked = data.cues.find((c) => results.get(c.id)?.status === "blocked");
  return {
    data,
    results,
    referenceIndex: buildReferenceIndex(data.cues),
    previewCueId: firstBlocked?.id ?? data.cues[0]?.id ?? null,
    blocked: null,
    lastRecompute: {
      cueIds: data.cues.map((c) => c.id),
      reason: "载入校对台，全量校对",
      full: true,
      at: Date.now(),
    },
  };
}

/**
 * 核心更新：修改数据 → 通过反向索引找出受影响的 Cue → 只重算这些 Cue。
 * 改 Cue 自身结构时只重算该 Cue；改灯具时只重算引用该灯具的 Cue。
 */
function commit(
  prev: DeskState,
  data: DeskData,
  dirtyCueIds: Set<string>,
  reason: string,
  full = false,
): DeskState {
  const results = reevaluate(
    data.cues,
    fixtureMap(data.fixtures),
    prev.results,
    dirtyCueIds,
  );
  // 被拦下的 Cue 经调节后已不超限：自动解除拦截提示
  const blocked =
    prev.blocked && results.get(prev.blocked.cueId)?.status === "blocked"
      ? prev.blocked
      : null;
  return {
    ...prev,
    data,
    results,
    blocked,
    referenceIndex: buildReferenceIndex(data.cues),
    lastRecompute: { cueIds: Array.from(dirtyCueIds), reason, full, at: Date.now() },
  };
}

function updateCueIn(data: DeskData, cueId: string, fn: (cue: Cue) => Cue): Cue[] {
  return data.cues.map((c) => (c.id === cueId ? fn(c) : c));
}

function reducer(state: DeskState, action: Action): DeskState {
  switch (action.type) {
    case "load":
      return buildState(action.data);

    case "reset":
      return buildState(createSeedData());

    case "setShowName": {
      const data = { ...state.data, showName: action.name };
      return { ...state, data };
    }

    case "addFixture": {
      const fixture: Fixture = {
        id: uid("f"),
        name: `追光-${state.data.fixtures.length + 1}`,
        x: Math.round(STAGE_WIDTH / 2),
        y: 60,
        radius: 200,
        brightness: 50,
      };
      return commit(
        state,
        { ...state.data, fixtures: [...state.data.fixtures, fixture] },
        new Set(),
        `新增灯具 ${fixture.name}（暂无 Cue 引用，无需重算）`,
      );
    }

    case "updateFixture": {
      const fixtures = state.data.fixtures.map((f) =>
        f.id === action.id ? { ...f, ...clampFixture(action.patch) } : f,
      );
      const affected = new Set(state.referenceIndex.get(action.id) ?? []);
      const name = state.data.fixtures.find((f) => f.id === action.id)?.name ?? action.id;
      return commit(
        state,
        { ...state.data, fixtures },
        affected,
        `调节灯具 ${name}，只重算引用它的 ${affected.size} 个 Cue`,
      );
    }

    case "deleteFixture": {
      const fixtures = state.data.fixtures.filter((f) => f.id !== action.id);
      const affected = new Set(state.referenceIndex.get(action.id) ?? []);
      const cues = state.data.cues.map((c) =>
        affected.has(c.id)
          ? { ...c, fixtureIds: c.fixtureIds.filter((id) => id !== action.id) }
          : c,
      );
      const data: DeskData = { ...state.data, fixtures, cues };
      const next = commit(state, data, affected, "删除灯具并重算引用它的 Cue");
      return {
        ...next,
        previewCueId:
          state.previewCueId === action.id ? next.data.cues[0]?.id ?? null : state.previewCueId,
      };
    }

    case "addCue": {
      const cue: Cue = {
        id: uid("c"),
        name: `Cue ${state.data.cues.length + 1}`,
        note: "",
        fixtureIds: [],
        points: [
          {
            id: uid("p"),
            name: "落点 1",
            x: Math.round(STAGE_WIDTH / 2),
            y: Math.round(STAGE_HEIGHT / 2),
          },
        ],
      };
      return commit(
        state,
        { ...state.data, cues: [...state.data.cues, cue] },
        new Set([cue.id]),
        `新增 ${cue.name}，校对这一个 Cue`,
      );
    }

    case "updateCue": {
      const cues = updateCueIn(state.data, action.id, (c) => ({ ...c, ...action.patch }));
      // 名称/备注不参与判定，无需重算
      return { ...state, data: { ...state.data, cues } };
    }

    case "deleteCue": {
      const cues = state.data.cues.filter((c) => c.id !== action.id);
      const results = new Map(state.results);
      results.delete(action.id);
      return {
        ...state,
        data: { ...state.data, cues },
        results,
        referenceIndex: buildReferenceIndex(cues),
        previewCueId:
          state.previewCueId === action.id ? cues[0]?.id ?? null : state.previewCueId,
        blocked: state.blocked?.cueId === action.id ? null : state.blocked,
      };
    }

    case "toggleCueFixture": {
      const cues = updateCueIn(state.data, action.cueId, (c) => {
        const has = c.fixtureIds.includes(action.fixtureId);
        return {
          ...c,
          fixtureIds: has
            ? c.fixtureIds.filter((id) => id !== action.fixtureId)
            : [...c.fixtureIds, action.fixtureId],
        };
      });
      return commit(
        state,
        { ...state.data, cues },
        new Set([action.cueId]),
        "Cue 参与灯具变化，只重算当前 Cue",
      );
    }

    case "addPoint": {
      const cues = updateCueIn(state.data, action.cueId, (c) => ({
        ...c,
        points: [
          ...c.points,
          {
            id: uid("p"),
            name: `落点 ${c.points.length + 1}`,
            x: Math.round(STAGE_WIDTH / 2),
            y: Math.round(STAGE_HEIGHT / 2),
          },
        ],
      }));
      return commit(
        state,
        { ...state.data, cues },
        new Set([action.cueId]),
        "Cue 新增落点，只重算当前 Cue",
      );
    }

    case "updatePoint": {
      const cues = updateCueIn(state.data, action.cueId, (c) => ({
        ...c,
        points: c.points.map((p) =>
          p.id === action.pointId ? { ...p, ...action.patch } : p,
        ),
      }));
      return commit(
        state,
        { ...state.data, cues },
        new Set([action.cueId]),
        "落点变化，只重算所在 Cue",
      );
    }

    case "deletePoint": {
      const cues = updateCueIn(state.data, action.cueId, (c) => ({
        ...c,
        points: c.points.filter((p) => p.id !== action.pointId),
      }));
      return commit(
        state,
        { ...state.data, cues },
        new Set([action.cueId]),
        "落点删除，只重算所在 Cue",
      );
    }

    case "setPreview":
      return { ...state, previewCueId: action.cueId };

    case "dismissBlocked":
      return { ...state, blocked: null };

    case "trigger": {
      const result = state.results.get(action.cueId);
      const cue = state.data.cues.find((c) => c.id === action.cueId);
      if (!cue || !result) return state;
      if (result.status === "blocked") {
        // 超过 100%：停在当前 Cue，原场景不动，只在页面标出落点与超限灯具
        return {
          ...state,
          previewCueId: action.cueId,
          blocked: { cueId: cue.id, cueName: cue.name, at: Date.now() },
        };
      }
      return {
        ...state,
        data: { ...state.data, currentCueId: cue.id },
        previewCueId: cue.id,
        blocked: null,
      };
    }

    default:
      return state;
  }
}

function clampFixture(patch: Partial<Omit<Fixture, "id">>): Partial<Fixture> {
  const out: Partial<Fixture> = { ...patch };
  if (typeof out.x === "number") out.x = Math.min(STAGE_WIDTH, Math.max(0, out.x));
  if (typeof out.y === "number") out.y = Math.min(STAGE_HEIGHT, Math.max(0, out.y));
  if (typeof out.radius === "number") out.radius = Math.min(400, Math.max(20, out.radius));
  if (typeof out.brightness === "number")
    out.brightness = Math.min(100, Math.max(0, out.brightness));
  return out;
}

export function useDesk() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    buildState(loadData() ?? createSeedData()),
  );

  // 数据持久化到浏览器；判定结果（results）不存，下次载入重新校对
  useEffect(() => {
    saveData(state.data);
  }, [state.data]);

  const previewCue = useMemo(
    () => state.data.cues.find((c) => c.id === state.previewCueId) ?? null,
    [state.data.cues, state.previewCueId],
  );
  const previewResult = state.previewCueId
    ? state.results.get(state.previewCueId) ?? null
    : null;
  const currentCue = useMemo(
    () => state.data.cues.find((c) => c.id === state.data.currentCueId) ?? null,
    [state.data.cues, state.data.currentCueId],
  );

  return {
    state,
    dispatch,
    previewCue,
    previewResult,
    currentCue,
    resetToSeed() {
      clearStorage();
      dispatch({ type: "reset" });
    },
  };
}
