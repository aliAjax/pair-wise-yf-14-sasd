// 数据层：灯具、落点、Cue 与整份校对台数据的结构定义

/** 灯具：位置（舞台坐标 0~1000 × 0~640）、光斑半径、亮度（0~100%） */
export interface Fixture {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  brightness: number;
}

/** Cue 落点：演员在舞台上的位置 */
export interface LandingPoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Cue：若干落点 + 参与本场的灯具 */
export interface Cue {
  id: string;
  name: string;
  note: string;
  fixtureIds: string[];
  points: LandingPoint[];
}

/** 校对台持久化数据（结果不持久化，载入时统一重算） */
export interface DeskData {
  version: 1;
  showName: string;
  fixtures: Fixture[];
  cues: Cue[];
  /** 当前场景：最后一次通过校对并成功触发的 Cue */
  currentCueId: string | null;
}
