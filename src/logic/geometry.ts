import type { Fixture, LandingPoint } from "../data/types";

/** 灯具光斑是否覆盖落点：落点落在光斑圆内 */
export function covers(fixture: Fixture, point: LandingPoint): boolean {
  const dx = fixture.x - point.x;
  const dy = fixture.y - point.y;
  return dx * dx + dy * dy <= fixture.radius * fixture.radius;
}

export function distance(fixture: Fixture, point: LandingPoint): number {
  return Math.hypot(fixture.x - point.x, fixture.y - point.y);
}
