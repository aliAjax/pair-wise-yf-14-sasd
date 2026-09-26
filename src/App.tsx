import { useMemo } from "react";
import "./styles.css";
import { CueList } from "./components/CueList";
import { FixturePanel } from "./components/FixturePanel";
import { StagePlan } from "./components/StagePlan";
import { buildReferenceIndex } from "./logic/engine";
import { useDesk } from "./state/useDesk";

function App() {
  const { state, dispatch, previewCue, previewResult, currentCue, resetToSeed } = useDesk();
  const { data, results, blocked, lastRecompute } = state;

  // 灯具 -> 引用数量（数据/视图层派生，判定层不掺页面逻辑）
  const cueCountByFixture = useMemo(() => {
    const index = buildReferenceIndex(data.cues);
    return new Map(Array.from(index, ([id, set]) => [id, set.size]));
  }, [data.cues]);

  const blockedCount = useMemo(
    () => Array.from(results.values()).filter((r) => r.status === "blocked").length,
    [results],
  );
  const darkCount = useMemo(
    () => Array.from(results.values()).filter((r) => r.status === "warn").length,
    [results],
  );

  // 预览 Cue 上造成超限的灯具 → 舞台图与灯具面板同时标红
  const offenderIds = useMemo(
    () => new Set(previewResult?.offenderIds ?? []),
    [previewResult],
  );

  const blockedResult = blocked ? results.get(blocked.cueId) : null;
  const recomputeNames = lastRecompute
    ? data.cues
        .filter((c) => lastRecompute.cueIds.includes(c.id))
        .map((c) => c.name)
    : [];

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p>追光校对台 · 夜戏排练现场</p>
          <h1>
            <input
              className="show-name"
              value={data.showName}
              onChange={(e) => dispatch({ type: "setShowName", name: e.target.value })}
            />
          </h1>
        </div>
        <div className="topbar-right">
          <span className="current-scene">
            当前场景：<b>{currentCue ? currentCue.name : "未起光"}</b>
          </span>
          <button className="ghost-btn" onClick={resetToSeed}>
            恢复预置
          </button>
        </div>
      </header>

      <section className="metrics">
        <article>
          <small>灯具数量</small>
          <strong>{data.fixtures.length}</strong>
        </article>
        <article>
          <small>Cue 数量</small>
          <strong>{data.cues.length}</strong>
        </article>
        <article className={blockedCount ? "metric-bad" : ""}>
          <small>超限拦截</small>
          <strong>{blockedCount}</strong>
        </article>
        <article className={darkCount ? "metric-warn" : ""}>
          <small>有暗点 Cue</small>
          <strong>{darkCount}</strong>
        </article>
      </section>

      {/* 触发被拦截：停在当前 Cue，标出落点与超出的灯具 */}
      {blocked && blockedResult && (
        <section className="blocked-banner" role="alert">
          <div>
            <b>⛔ {blocked.cueName} 未触发：叠光超过 100%</b>
            <span>
              已停在当前场景（{currentCue ? currentCue.name : "未起光"}），原场景不动。
              超出落点：
              {blockedResult.pointResults
                .filter((p) => p.over)
                .map((p) => `${p.pointName} ${p.total}%`)
                .join("、")}
              ；超出灯具：
              {Array.from(new Set(blockedResult.pointResults.flatMap((p) => p.offenderIds)))
                .map(
                  (id) =>
                    data.fixtures.find((f) => f.id === id)?.name ?? id,
                )
                .join("、")}
              。请在右侧调小对应灯具的亮度或光斑半径。
            </span>
          </div>
          <button onClick={() => dispatch({ type: "dismissBlocked" })}>
            知道了
          </button>
        </section>
      )}

      <section className="layout">
        <div className="left-col">
          <StagePlan
            fixtures={data.fixtures}
            currentCue={currentCue}
            previewCue={previewCue}
            previewResult={previewResult}
            offenderFixtureIds={offenderIds}
            onMoveFixture={(id, x, y) => dispatch({ type: "updateFixture", id, patch: { x, y } })}
            onMovePoint={(cueId, pointId, x, y) =>
              dispatch({ type: "updatePoint", cueId, pointId, patch: { x, y } })
            }
          />
          <FixturePanel
            fixtures={data.fixtures}
            cueCountByFixture={cueCountByFixture}
            offenderIds={offenderIds}
            onChange={(id, patch) => dispatch({ type: "updateFixture", id, patch })}
            onDelete={(id) => dispatch({ type: "deleteFixture", id })}
            onAdd={() => dispatch({ type: "addFixture" })}
          />
        </div>

        <CueList
          cues={data.cues}
          fixtures={data.fixtures}
          results={results}
          currentCueId={data.currentCueId}
          previewCueId={state.previewCueId}
          blockedCueId={blocked?.cueId ?? null}
          onPreview={(id) => dispatch({ type: "setPreview", cueId: id })}
          onTrigger={(id) => dispatch({ type: "trigger", cueId: id })}
          onUpdate={(id, patch) => dispatch({ type: "updateCue", id, patch })}
          onDelete={(id) => dispatch({ type: "deleteCue", id })}
          onToggleFixture={(cueId, fixtureId) =>
            dispatch({ type: "toggleCueFixture", cueId, fixtureId })
          }
          onAddPoint={(cueId) => dispatch({ type: "addPoint", cueId })}
          onUpdatePoint={(cueId, pointId, patch) =>
            dispatch({ type: "updatePoint", cueId, pointId, patch })
          }
          onDeletePoint={(cueId, pointId) =>
            dispatch({ type: "deletePoint", cueId, pointId })
          }
          onAddCue={() => dispatch({ type: "addCue" })}
        />
      </section>

      <footer className="statusbar">
        {lastRecompute && (
          <span>
            {lastRecompute.full ? "全量校对" : "增量重算"}：{lastRecompute.reason}
            {recomputeNames.length > 0 && <>（{recomputeNames.join("、")}）</>}
          </span>
        )}
        <span>数据保存在本浏览器 localStorage，校对结果仅存内存，不上传任何服务器。</span>
      </footer>
    </main>
  );
}

export default App;
