// 页面层：舞台灯位图、Cue 列表、灯具调节与拦截提示。数据见 data.ts，判定见 logic.ts。

import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  BlockInfo,
  Cue,
  Fixture,
  PRESET_CUES,
  PRESET_FIXTURES,
  STAGE,
  clearState,
  loadState,
  saveState,
} from "./data";
import { CueEval, LIMIT, evaluateAll, evaluateCue, recomputeForFixture } from "./logic";

function timeStamp() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function App() {
  const initial = useMemo(loadState, []);
  const [fixtures, setFixtures] = useState<Fixture[]>(initial.fixtures);
  const [cues] = useState<Cue[]>(initial.cues);
  const [results, setResults] = useState<Record<string, CueEval>>(
    () => ({ ...evaluateAll(initial.cues, initial.fixtures), ...(initial.results as Record<string, CueEval>) })
  );
  const [currentCueId, setCurrentCueId] = useState<string | null>(initial.currentCueId);
  const [block, setBlock] = useState<BlockInfo | null>(initial.block);
  const [log, setLog] = useState<string[]>([]);

  // 结果留在浏览器：任何状态变化都写回 localStorage
  useEffect(() => {
    saveState({ fixtures, cues, results, currentCueId, block });
  }, [fixtures, cues, results, currentCueId, block]);

  const pushLog = (msg: string) =>
    setLog((prev) => [`${timeStamp()}  ${msg}`, ...prev].slice(0, 8));

  const currentCue = cues.find((c) => c.id === currentCueId) ?? null;
  const blockedCue = block ? cues.find((c) => c.id === block.cueId) ?? null : null;
  const overCount = Object.values(results).filter((r) => r.over).length;

  function tryCue(cue: Cue) {
    const ev = evaluateCue(cue, fixtures);
    setResults((prev) => ({ ...prev, [cue.id]: ev }));
    if (ev.over) {
      // 超过 100%：停在当前 Cue，标出落点与超限灯具，原场景不动
      setBlock({ cueId: cue.id, total: ev.total, fixtureIds: ev.contributors.map((c) => c.fixtureId) });
      pushLog(
        `触发 ${cue.id} 被拦截：落点叠加 ${ev.total}%（>${LIMIT}%），现场停在 ${currentCueId ?? "黑场"}`
      );
    } else {
      setCurrentCueId(cue.id);
      setBlock(null);
      pushLog(`已切到 ${cue.id}，落点叠加 ${ev.total}%`);
    }
  }

  function updateFixture(id: string, patch: Partial<Fixture>) {
    const nextFixtures = fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f));
    setFixtures(nextFixtures);
    // 只重算引用该灯具的 Cue
    const { next, touched } = recomputeForFixture(id, cues, nextFixtures, results);
    setResults(next);
    if (touched.length > 0) pushLog(`调整 ${id}：仅重算引用它的 Cue（${touched.join("、")}）`);
    if (block && touched.includes(block.cueId)) {
      const ev = next[block.cueId];
      setBlock({ ...block, total: ev.total, fixtureIds: ev.contributors.map((c) => c.fixtureId) });
    }
  }

  function resetAll() {
    clearState();
    setFixtures(PRESET_FIXTURES);
    setResults(evaluateAll(PRESET_CUES, PRESET_FIXTURES));
    setCurrentCueId(null);
    setBlock(null);
    pushLog("已恢复预置灯具与 Cue");
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">夜戏排练 · 追光校对台</p>
          <h1>追光落点叠加预检</h1>
        </div>
        <div className="metrics">
          <article><small>灯具数量</small><strong>{fixtures.length}</strong></article>
          <article><small>Cue 数量</small><strong>{cues.length}</strong></article>
          <article><small>当前场景</small><strong>{currentCueId ?? "黑场"}</strong></article>
          <article className={overCount > 0 ? "danger" : ""}><small>超限 Cue</small><strong>{overCount}</strong></article>
        </div>
        <button className="ghost" onClick={resetAll}>恢复预置</button>
      </header>

      {block && blockedCue && (
        <section className="banner">
          <strong>已停在 {currentCueId ?? "黑场"}，{block.cueId} 未触发。</strong>
          <span>
            落点 ({blockedCue.x}, {blockedCue.y}) 叠加亮度 {block.total}%（上限 {LIMIT}%），
            超限灯具：{block.fixtureIds.join("、")}。调小亮度或半径后重新触发。
          </span>
        </section>
      )}

      <div className="layout">
        <section className="panel stage-panel">
          <div className="panel-head">
            <h2>舞台平面 · 光斑覆盖</h2>
            <span className="hint">{STAGE.w}m × {STAGE.h}m</span>
          </div>
          <StageView
            fixtures={fixtures}
            cues={cues}
            results={results}
            currentCueId={currentCueId}
            block={block}
          />
        </section>

        <aside className="side">
          <section className="panel">
            <div className="panel-head"><h2>Cue 列表</h2><span className="hint">触发前自动预检</span></div>
            <ul className="cue-list">
              {cues.map((cue) => {
                const ev = results[cue.id];
                const total = ev?.total ?? 0;
                const isCurrent = cue.id === currentCueId;
                const isBlocked = cue.id === block?.cueId;
                return (
                  <li key={cue.id} className={`cue-row ${isCurrent ? "current" : ""} ${isBlocked ? "blocked" : ""}`}>
                    <div className="cue-main">
                      <div className="cue-title">
                        <b>{cue.name}</b>
                        <span className="cue-pos">落点 ({cue.x}, {cue.y})</span>
                      </div>
                      <div className="cue-sub">
                        {cue.fixtureIds.map((id) => <span key={id} className="chip">{id}</span>)}
                        <span className={`total ${total > LIMIT ? "over" : total >= 85 ? "warn" : ""}`}>
                          叠加 {total}%
                        </span>
                        {isCurrent && <span className="tag ok">当前</span>}
                        {isBlocked && <span className="tag bad">超限未触发</span>}
                      </div>
                    </div>
                    <button className="primary" onClick={() => tryCue(cue)}>触发</button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>灯具调节</h2><span className="hint">改动只重算引用它的 Cue</span></div>
            <ul className="fixture-list">
              {fixtures.map((f) => (
                <li key={f.id} className={`fixture-row ${block?.fixtureIds.includes(f.id) ? "hot" : ""}`}>
                  <div className="fixture-title">
                    <b>{f.id}</b><span>{f.name}</span>
                    <span className="cue-pos">位 ({f.x}, {f.y})</span>
                  </div>
                  <label>
                    <span>亮度 {f.brightness}%</span>
                    <input
                      type="range" min={0} max={100} value={f.brightness}
                      onChange={(e) => updateFixture(f.id, { brightness: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    <span>半径 {f.radius}m</span>
                    <input
                      type="range" min={5} max={40} value={f.radius}
                      onChange={(e) => updateFixture(f.id, { radius: Number(e.target.value) })}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>操作记录</h2></div>
            <ul className="log">
              {log.length === 0 && <li className="hint">暂无操作</li>}
              {log.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

interface StageViewProps {
  fixtures: Fixture[];
  cues: Cue[];
  results: Record<string, CueEval>;
  currentCueId: string | null;
  block: BlockInfo | null;
}

function StageView({ fixtures, cues, results, currentCueId, block }: StageViewProps) {
  const gridX = Array.from({ length: STAGE.w / 10 - 1 }, (_, i) => (i + 1) * 10);
  const gridY = Array.from({ length: STAGE.h / 10 - 1 }, (_, i) => (i + 1) * 10);
  const blockedCue = block ? cues.find((c) => c.id === block.cueId) : undefined;

  return (
    <svg className="stage" viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} role="img" aria-label="舞台灯位图">
      <rect x={0} y={0} width={STAGE.w} height={STAGE.h} className="stage-bg" />
      {gridX.map((x) => <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={STAGE.h} className="grid" />)}
      {gridY.map((y) => <line key={`gy${y}`} x1={0} y1={y} x2={STAGE.w} y2={y} className="grid" />)}

      {fixtures.map((f) => {
        const hot = block?.fixtureIds.includes(f.id);
        return (
          <g key={f.id}>
            <circle cx={f.x} cy={f.y} r={f.radius} className={`beam ${hot ? "hot" : ""}`} />
            <rect x={f.x - 1.2} y={f.y - 1.2} width={2.4} height={2.4} className={`fixture-dot ${hot ? "hot" : ""}`} />
            <text x={f.x + 2} y={f.y - 2} className="fixture-label">{f.id} {f.brightness}%</text>
          </g>
        );
      })}

      {cues.map((cue) => {
        const isCurrent = cue.id === currentCueId;
        const isBlocked = cue.id === block?.cueId;
        const over = results[cue.id]?.over;
        return (
          <g key={cue.id} className="cue-marker">
            <circle cx={cue.x} cy={cue.y} r={2.6}
              className={`cue-ring ${isCurrent ? "current" : ""} ${isBlocked ? "blocked" : ""} ${over ? "over" : ""}`} />
            <line x1={cue.x - 4} y1={cue.y} x2={cue.x + 4} y2={cue.y} className="cue-cross" />
            <line x1={cue.x} y1={cue.y - 4} x2={cue.x} y2={cue.y + 4} className="cue-cross" />
            <text x={cue.x + 3.4} y={cue.y + 4.6} className="cue-label">{cue.id}</text>
          </g>
        );
      })}

      {blockedCue && block && (
        <g className="block-marker">
          <circle cx={blockedCue.x} cy={blockedCue.y} r={5} className="pulse" />
          <text x={blockedCue.x + 4} y={blockedCue.y - 4} className="block-label">
            落点叠加 {block.total}%
          </text>
        </g>
      )}
    </svg>
  );
}

export default App;
