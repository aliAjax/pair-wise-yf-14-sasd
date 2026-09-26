import type { Cue, Fixture } from "../data/types";
import type { CueResult } from "../logic/engine";
import { fixtureColor } from "./StagePlan";

interface CueListProps {
  cues: Cue[];
  fixtures: Fixture[];
  results: Map<string, CueResult>;
  currentCueId: string | null;
  previewCueId: string | null;
  blockedCueId: string | null;
  onPreview: (id: string) => void;
  onTrigger: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Cue, "name" | "note">>) => void;
  onDelete: (id: string) => void;
  onToggleFixture: (cueId: string, fixtureId: string) => void;
  onAddPoint: (cueId: string) => void;
  onUpdatePoint: (
    cueId: string,
    pointId: string,
    patch: { name?: string; x?: number; y?: number },
  ) => void;
  onDeletePoint: (cueId: string, pointId: string) => void;
  onAddCue: () => void;
}

const STATUS_LABEL: Record<CueResult["status"], string> = {
  ok: "通过",
  warn: "有暗点",
  blocked: "超限拦截",
};

export function CueList(props: CueListProps) {
  const {
    cues,
    fixtures,
    results,
    currentCueId,
    previewCueId,
    blockedCueId,
  } = props;
  const colorById = new Map(fixtures.map((f, i) => [f.id, fixtureColor(i)]));

  return (
    <section className="panel cue-panel">
      <div className="heading">
        <div>
          <p>Cue 序列</p>
          <h2>校对与触发</h2>
        </div>
        <button className="primary" onClick={props.onAddCue}>
          ＋ 新增 Cue
        </button>
      </div>

      <ol className="cue-list">
        {cues.map((cue, index) => {
          const result = results.get(cue.id);
          const status = result?.status ?? "ok";
          const isCurrent = cue.id === currentCueId;
          const isPreview = cue.id === previewCueId;
          const isBlocked = cue.id === blockedCueId;
          return (
            <li
              key={`${cue.id}-${isBlocked ? blockedCueId : "clear"}`}
              className={[
                "cue-card",
                `cue-${status}`,
                isPreview ? "cue-preview" : "",
                isCurrent ? "cue-current" : "",
                isBlocked ? "cue-blocked-flash" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => props.onPreview(cue.id)}
            >
              <header className="cue-head">
                <span className="cue-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="cue-titles">
                  <input
                    className="cue-name"
                    value={cue.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => props.onUpdate(cue.id, { name: e.target.value })}
                  />
                  <input
                    className="cue-note"
                    placeholder="备注（如：版本B、需走位确认）"
                    value={cue.note}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => props.onUpdate(cue.id, { note: e.target.value })}
                  />
                </div>
                <span className={`status-pill status-${status}`}>
                  {STATUS_LABEL[status]}
                  {result && status !== "ok" ? ` · 峰值 ${result.maxTotal}%` : ""}
                </span>
              </header>

              {isPreview && result && (
                <div className="cue-detail" onClick={(e) => e.stopPropagation()}>
                  <div className="points-block">
                    <div className="block-title">
                      落点与覆盖亮度（{cue.points.length}）
                      <button
                        className="mini-btn"
                        onClick={() => props.onAddPoint(cue.id)}
                      >
                        ＋落点
                      </button>
                    </div>
                    {result.pointResults.map((pr, pi) => (
                      <div
                        key={pr.pointId}
                        className={`point-row ${pr.over ? "point-row-over" : ""} ${
                          !pr.covered ? "point-row-dark" : ""
                        }`}
                      >
                        <input
                          className="point-name"
                          value={pr.pointName}
                          onChange={(e) =>
                            props.onUpdatePoint(cue.id, pr.pointId, { name: e.target.value })
                          }
                        />
                        <span className="point-coords">
                          x
                          <input
                            type="number"
                            value={cue.points[pi].x}
                            onChange={(e) =>
                              props.onUpdatePoint(cue.id, pr.pointId, {
                                x: Number(e.target.value),
                              })
                            }
                          />
                          y
                          <input
                            type="number"
                            value={cue.points[pi].y}
                            onChange={(e) =>
                              props.onUpdatePoint(cue.id, pr.pointId, {
                                y: Number(e.target.value),
                              })
                            }
                          />
                        </span>
                        <span className="point-total">
                          合计 <b>{pr.total}%</b>
                        </span>
                        <button
                          className="icon-btn"
                          title="删除落点"
                          onClick={() => props.onDeletePoint(cue.id, pr.pointId)}
                        >
                          ✕
                        </button>
                        <ul className="contrib-list">
                          {pr.contributions.length === 0 && (
                            <li className="contrib-empty">无任何光斑覆盖（暗点）</li>
                          )}
                          {pr.contributions.map((c) => (
                            <li
                              key={c.fixtureId}
                              className={pr.over ? "contrib-over" : ""}
                              style={{ ["--fx" as string]: colorById.get(c.fixtureId) }}
                            >
                              <span className="fixture-dot" />
                              {c.fixtureName}
                              <b>{c.brightness}%</b>
                            </li>
                          ))}
                          {pr.over && (
                            <li className="contrib-alert">
                              超过 100%：{pr.contributions.map((c) => c.fixtureName).join("、")}
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="fixtures-block">
                    <div className="block-title">参与灯具（{cue.fixtureIds.length}）</div>
                    <div className="fixture-chips">
                      {fixtures.map((f) => {
                        const on = cue.fixtureIds.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            className={[
                              "fixture-chip",
                              on ? "chip-on" : "chip-off",
                              result.offenderIds.includes(f.id) ? "chip-offender" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{ ["--fx" as string]: colorById.get(f.id) }}
                            onClick={() => props.onToggleFixture(cue.id, f.id)}
                          >
                            <span className="fixture-dot" />
                            {f.name}
                            <small>{f.brightness}%</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="cue-actions">
                    <button
                      className="primary trigger-btn"
                      disabled={status === "blocked"}
                      onClick={() => props.onTrigger(cue.id)}
                    >
                      ▶ 校对通过并触发
                    </button>
                    <button onClick={() => props.onTrigger(cue.id)}>
                      试触发（超限即停）
                    </button>
                    <button className="danger-btn" onClick={() => props.onDelete(cue.id)}>
                      删除 Cue
                    </button>
                    {isCurrent && <span className="current-tag">当前场景</span>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
