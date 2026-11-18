// Neo-City Stories — constants, colours and the fixed playfield.
// Everything is procedural; no network, no external assets.

export const FIELD = { width: 1280, height: 720 };

export const STEP = 1 / 60;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

export const PALETTE = {
  backdrop: '#0b1d3a',
  sky: '#141a24',
  road: '#232830',
  roadLine: '#454f5e',
  sidewalk: '#3a3f48',
  building: '#444b56',
  buildingRoof: '#525a66',
  windowLit: '#f2d570',
  windowDark: '#262d38',
  player: '#e5534b',
  playerWanted: '#ffd166',
  cop: '#2e9bff',
  traffic: '#f2c94c',
  pedestrian: '#c9d1dc',
  cash: '#22c55e',
  mission: '#8b5cf6',
  panel: '#161d28',
  panelEdge: '#2a3548',
  text: '#eef1f5',
  muted: '#8b93a3',
  star: '#f59e0b',
  starEmpty: '#374151',
  health: '#ef4444',
};

export const CAR = {
  width: 44, height: 26,
  maxSpeed: 340,
  reverseSpeed: 110,
  acceleration: 900,
  brake: 1200,
  friction: 0.90,
  turnRate: 4.4,
  health: 100,
};

export const PLAYER = { cash: 120, score: 120 };

export const TRAFFIC = { count: 16, speedMin: 120, speedMax: 200 };

export const PEDESTRIAN = { count: 28, speed: 48 };

export const POLICE = { maxCops: 6, speed: 400, turnRate: 5.0, spawnDelay: 0.9, ramDamage: 22 };

export const WANTED = {
  maxStars: 5,
  decayPerSecond: 0.4,
  gainHitBuilding: 0.4,
  gainHitCar: 0.9,
  gainHitPed: 1.5,
  gainHitCop: 1.2,
  gainSidewalkPerSecond: 0.15,
};

export const CITY = {
  grid: 150, roadWidth: 48, sidewalkWidth: 14,
  buildingMin: 58, buildingMax: 128,
};

export const MONEY = { cashValue: 25, missionReward: 400 };

export const BEST_KEY = 'neo-city-stories.best';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
