import { useRef } from "react";
import { STAGE_HEIGHT, STAGE_WIDTH } from "../data/seed";
import type { Cue, Fixture } from "../data/types";
import type { CueResult } from "../logic/engine";

interface StagePlanProps {
  fixtures: Fixture[];
  currentCue: Cue | null;
  previewCue: Cue | null;
  previewResult: CueResult | null;
  offenderFixtureIds: Set<string>;
  onMoveFixture: (id: string, x: number, y: number) => void;
  onMovePoint: (cueId: string, pointId: string, x: number, y: number) => void;
}

type Drag =
  | { kind: "fixture"; id: string }
  | { kind: "point"; cueId: string; pointId: string };

/** 追光灯具在舞台图上的配色（循环使用） */
export const FIXTURE_COLORS = ["#fbbf24", "#38bdf8", "#f472b6", "#a3e635", "#fb923c"];

export function fixtureColor(index: number): string {
  return FIXTURE_COLORS[index % FIXTURE_COLORS.length];
}

/** 舞台平面灯位图：光斑、灯具、Cue 落点叠加显示 */
export function StagePlan({
  fixtures,
  currentCue,
  previewCue,
  previewResult,
  offenderFixtureIds,
  onMoveFixture,
  onMovePoint,
}: StagePlanProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const activeFixtureIds = new Set(previewCue?.fixtureIds ?? []);
  const colorById = new Map(fixtures.map((f, i) => [f.id, fixtureColor(i)]));

  function toStageCoords(e: React.PointerEvent): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * STAGE_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * STAGE_HEIGHT;
    return {
      x: Math.round(Math.min(STAGE_WIDTH, Math.max(0, x))),
      y: Math.round(Math.min(STAGE_HEIGHT, Math.max(0, y))),
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = toStageCoords(e);
    if (drag.kind === "fixture") onMoveFixture(drag.id, x, y);
    else onMovePoint(drag.cueId, drag.pointId, x, y);
  }

  function endDrag() {
    dragRef.current = null;
  }

  // 预览 Cue 的参与灯具画光斑
  const beams = (previewCue?.fixtureIds ?? [])
    .map((id) => fixtures.find((f) => f.id === id))
    .filter((f): f is Fixture => Boolean(f));

  // 原场景（已触发的当前 Cue）落点；被拦截时用它说明“原场景不动”
  const currentPoints = currentCue?.points ?? [];

  return (
    <div className="stage-wrap">
      <div className="stage-caption">
        <span>舞台平面灯位图</span>
        <small>
          预览：{previewCue ? previewCue.name : "—"}
          {currentCue ? `　·　原场景：${currentCue.name}` : "　·　原场景：未起光"}
        </small>
      </div>
      <svg
        ref={svgRef}
        className="stage"
        viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e293b" strokeWidth="1" />
          </pattern>
          <marker id="audience" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#475569" />
          </marker>
        </defs>

        <rect x="0" y="0" width={STAGE_WIDTH} height={STAGE_HEIGHT} fill="url(#grid)" />
        <text x={STAGE_WIDTH / 2} y={STAGE_HEIGHT - 14} textAnchor="middle" className="svg-label">
          台口 · 观众席方向
        </text>

        {/* 预览 Cue 各参与灯具的光斑 */}
        {previewCue &&
          beams.map((f) => {
            const offending = offenderFixtureIds.has(f.id);
            const color = colorById.get(f.id) ?? "#fbbf24";
            return (
              <circle
                key={f.id}
                cx={f.x}
                cy={f.y}
                r={f.radius}
                className={offending ? "beam beam-offender" : "beam"}
                style={{ fill: color, stroke: color }}
              />
            );
          })}

        {/* 原场景落点（灰色，灰显表示未被改动） */}
        {currentPoints.map((p) => (
          <g key={`cur-${p.id}`} className="current-point">
            <rect x={p.x - 8} y={p.y - 8} width={16} height={16} rx={3} />
            <text x={p.x + 12} y={p.y + 5} className="svg-label svg-dim">
              {p.name}
            </text>
          </g>
        ))}

        {/* 预览 Cue 的落点：超限红色脉冲，正常琥珀色 */}
        {previewResult?.pointResults.map((pr) => (
          <g key={pr.pointId}>
            <circle
              cx={pr.x}
              cy={pr.y}
              r={pr.over ? 16 : 10}
              className={pr.over ? "point point-over" : "point"}
            />
            <line x1={pr.x - 20} y1={pr.y} x2={pr.x + 20} y2={pr.y} className="point-cross" />
            <line x1={pr.x} y1={pr.y - 20} x2={pr.x} y2={pr.y + 20} className="point-cross" />
            <text x={pr.x} y={pr.y - 22} textAnchor="middle" className="svg-label">
              {pr.pointName} · {pr.total}%
            </text>
          </g>
        ))}

        {/* 灯具位置（可拖拽） */}
        {fixtures.map((f, i) => {
          const active = activeFixtureIds.has(f.id);
          const offending = offenderFixtureIds.has(f.id);
          const color = colorById.get(f.id)!;
          return (
            <g
              key={f.id}
              className={`fixture ${active ? "fixture-active" : ""} ${
                offending ? "fixture-offender" : ""
              }`}
              style={{ ["--fx" as string]: color }}
              transform={`translate(${f.x} ${f.y})`}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                dragRef.current = { kind: "fixture", id: f.id };
              }}
            >
              <polygon points="0,-13 12,9 -12,9" className="fixture-body" />
              <text y={i % 2 === 0 ? -22 : 30} textAnchor="middle" className="svg-label">
                {f.name}
              </text>
            </g>
          );
        })}

        {/* 预览落点也可直接在舞台上拖动 */}
        {previewCue?.points.map((p) => (
          <circle
            key={`drag-${p.id}`}
            cx={p.x}
            cy={p.y}
            r={18}
            fill="transparent"
            className="point-hit"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              dragRef.current = { kind: "point", cueId: previewCue.id, pointId: p.id };
            }}
          />
        ))}
      </svg>
    </div>
  );
}
