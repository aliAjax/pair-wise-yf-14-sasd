import type { DeskData } from "./types";

/** 舞台坐标系尺寸（与舞台平面 SVG 保持一致） */
export const STAGE_WIDTH = 1000;
export const STAGE_HEIGHT = 640;

/** 叠光上限：同一落点的覆盖亮度之和不得超过 100% */
export const BRIGHTNESS_LIMIT = 100;

export const STORAGE_KEY = "spotlight-desk:v1";

/**
 * 预置夜戏排练场景：
 * 追光入场时多束追光会叠在演员身上 ——
 * Cue「追光入场」在台口中心的落点由 FOH-01 / FOH-02 / 侧光-01 三束光叠加，
 * 亮度合计 60 + 55 + 45 = 160%，默认即被拦下，供现场校对调灯。
 */
export function createSeedData(): DeskData {
  return {
    version: 1,
    showName: "夜戏排练 · 追光校对",
    currentCueId: null,
    fixtures: [
      // 坐标经几何校验：门口(500,320) 同时落在 F1/F2/F3 三束光斑内
      { id: "f1", name: "FOH-01 面光追光", x: 300, y: 180, radius: 260, brightness: 60 },
      { id: "f2", name: "FOH-02 面光追光", x: 650, y: 180, radius: 280, brightness: 55 },
      { id: "f3", name: "侧光-01", x: 120, y: 260, radius: 400, brightness: 45 },
      { id: "f4", name: "逆光-01", x: 620, y: 560, radius: 250, brightness: 35 },
    ],
    cues: [
      {
        id: "c1",
        name: "1. 开场",
        note: "面光单束入场",
        fixtureIds: ["f1"],
        points: [{ id: "p1", name: "台口中心", x: 300, y: 300 }],
      },
      {
        id: "c2",
        name: "2. 追光入场",
        note: "三束追光叠在门口落点，预计超限",
        fixtureIds: ["f1", "f2", "f3"],
        points: [
          { id: "p2", name: "门口", x: 500, y: 320 },
          { id: "p3", name: "窗边", x: 800, y: 400 },
        ],
      },
      {
        id: "c3",
        name: "3. 双人对手戏",
        note: "左右分区布光",
        fixtureIds: ["f3", "f4"],
        points: [
          { id: "p4", name: "左表演区", x: 280, y: 380 },
          { id: "p5", name: "右表演区", x: 680, y: 380 },
        ],
      },
      {
        id: "c4",
        name: "4. 暗转收尾",
        note: "只留逆光轮廓",
        fixtureIds: ["f4"],
        points: [{ id: "p6", name: "台中", x: 500, y: 360 }],
      },
    ],
  };
}
