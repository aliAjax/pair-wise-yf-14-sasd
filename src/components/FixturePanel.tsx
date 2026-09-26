import type { Fixture } from "../data/types";
import { fixtureColor } from "./StagePlan";

interface FixturePanelProps {
  fixtures: Fixture[];
  cueCountByFixture: Map<string, number>;
  offenderIds: Set<string>;
  onChange: (id: string, patch: Partial<Omit<Fixture, "id">>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

/** 灯具调节台：位置 / 光斑半径 / 亮度；超限灯具红框提示 */
export function FixturePanel({
  fixtures,
  cueCountByFixture,
  offenderIds,
  onChange,
  onDelete,
  onAdd,
}: FixturePanelProps) {
  return (
    <section className="panel fixtures-panel">
      <div className="heading">
        <div>
          <p>灯具</p>
          <h2>灯位与光斑</h2>
        </div>
        <button className="primary" onClick={onAdd}>
          ＋ 新增灯具
        </button>
      </div>

      <div className="fixture-list">
        {fixtures.map((f, i) => {
          const offending = offenderIds.has(f.id);
          return (
            <article
              key={f.id}
              className={`fixture-card ${offending ? "fixture-card-offender" : ""}`}
              style={{ ["--fx" as string]: fixtureColor(i) }}
            >
              <header>
                <span className="fixture-dot" />
                <input
                  className="fixture-name"
                  value={f.name}
                  onChange={(e) => onChange(f.id, { name: e.target.value })}
                />
                <em>{cueCountByFixture.get(f.id) ?? 0} 个 Cue 引用</em>
                <button
                  className="icon-btn"
                  title="删除灯具"
                  onClick={() => onDelete(f.id)}
                >
                  ✕
                </button>
              </header>

              {offending && (
                <p className="offender-tag">该灯造成预览 Cue 叠光超限</p>
              )}

              <div className="fixture-grid">
                <label>
                  <span>
                    X 位置 <b>{f.x}</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    value={f.x}
                    onChange={(e) => onChange(f.id, { x: Number(e.target.value) })}
                  />
                </label>
                <label>
                  <span>
                    Y 位置 <b>{f.y}</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={640}
                    value={f.y}
                    onChange={(e) => onChange(f.id, { y: Number(e.target.value) })}
                  />
                </label>
                <label>
                  <span>
                    光斑半径 <b>{f.radius}</b>
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={400}
                    value={f.radius}
                    onChange={(e) => onChange(f.id, { radius: Number(e.target.value) })}
                  />
                </label>
                <label>
                  <span>
                    亮度 <b className={offending ? "num-bad" : ""}>{f.brightness}%</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={f.brightness}
                    onChange={(e) => onChange(f.id, { brightness: Number(e.target.value) })}
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
