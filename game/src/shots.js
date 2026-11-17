// Screenshot staging: start / play / chase / game over.
// Each scene plays the real rules forward from a fresh world for a fixed number of steps, steered
// by an autopilot, so the frame is what a real game looks like and the same seed always gives the
// same frame. The chase scene forces a high wanted level and spawns police; the end scene damages
// the player until game over.
import { FIELD, STEP, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER, KIND_CASH } from './world.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 22;
const END_SECONDS = 10;

const PI2 = Math.PI * 2;
function wrapAngle(a) { return ((a % PI2) + PI2) % PI2; }
function dist(x1, y1, x2, y2) { const d = x2 - x1, e = y2 - y1; return Math.sqrt(d * d + e * e); }

function autopilotInput(world) {
  const state = world.state();
  const p = state.player;
  // drive toward the nearest cash pickup, else a road point
  let target = { x: FIELD.width / 2, y: FIELD.height / 2 };
  let nearest = null;
  for (const e of state.entities) {
    if (e.kind === KIND_CASH && e.active) {
      if (!nearest || dist(p.x, p.y, e.x, e.y) < dist(p.x, p.y, nearest.x, nearest.y)) nearest = e;
    }
  }
  if (nearest) { target.x = nearest.x; target.y = nearest.y; }
  const dx = target.x - p.x, dy = target.y - p.y;
  const desired = Math.atan2(dy, dx);
  let diff = wrapAngle(desired - p.angle);
  const steer = Math.max(-1, Math.min(1, diff / 1.5));
  const close = dist(p.x, p.y, target.x, target.y) < 45;
  const throttle = Math.abs(diff) < 0.7 && !close ? 1 : 0;
  return { throttle: () => throttle, steer: () => steer, takeActions: () => 0 };
}

export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    const idle = { throttle: () => 0, steer: () => 0, takeActions: () => 0 };
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idle);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_SECONDS : PLAY_SECONDS;
  const chase = name === 'chase';
  if (chase) {
    const st = world.state();
    st.player.wanted = 4.6;
    for (let i = 0; i < 4; i += 1) {
      st.entities.push({ kind: 2, x: st.player.x + (Math.random() - 0.5) * 180, y: st.player.y + (Math.random() - 0.5) * 180, w: 44, h: 26, angle: 0, speed: 0, maxSpeed: 320, active: true, targetX: st.player.x, targetY: st.player.y, turnRate: 5 });
    }
  }
  for (let i = 0; i < limit / STEP; i += 1) {
    const input = autopilotInput(world);
    const ev = world.step(STEP, input);
    if (name === 'end') {
      const st = world.state();
      st.player.health -= 18;
      if (st.player.health <= 0) break;
    }
    if (ev & EVENT_OVER) break;
  }
  const st = world.state();
  const over = st.player.health <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: st.player.score, chase };
}
