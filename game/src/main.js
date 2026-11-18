// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there.
// Screens: title → play → game over (restart loops back to title).
//
// ?seed=N fixes the procedural city/pattern. ?shot=start|play|chase|end (with &seed=N) stages
// that screenshot scene instead of running the loop and sets window.__shotReady.
import { BEST_KEY, STEP, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER } from './config.js';
import { EVENT_HIT_BUILDING, EVENT_HIT_CAR, EVENT_HIT_PED, EVENT_HIT_COP, EVENT_CASH, EVENT_MISSION, EVENT_OVER } from './world.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage off: best lasts this visit only */ }
}

function state() { return world.state(); }

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(state(), scene.screen, readBest());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) { status.textContent = message; }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Neo-City Stories. Drive and survive.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    const s = state();
    if (s.player.score > best) { best = s.player.score; saveBest(best); }
    announce('Wasted. Final $' + s.player.cash + '. Best $' + best + '.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = 'paused';
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, input);
      return;
    }
    if (screen === 'paused') return;
    const events = world.step(STEP, input);
    const s = state();
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_CASH) announce('$' + s.player.cash);
    else if (events & EVENT_MISSION) announce(s.mission ? s.mission.text : '');
    else if (events & (EVENT_HIT_BUILDING | EVENT_HIT_CAR | EVENT_HIT_PED | EVENT_HIT_COP)) {
      announce('Crash! Health ' + (s.player.health | 0));
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state(), screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = 'paused'; announce('Paused.'); }
  });

  announce('Neo-City Stories. Press Space to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
