// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred. Flat rectangles, rotated cars, canvas text. Everything
// procedural; no external assets.
import { FIELD, FONT, PALETTE, CAR, WANTED } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

const PANEL = { width: 560, top: 120, line: 32, bottom: 60 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const cashLabel = cachedLabel('$');
  const scoreLabel = cachedLabel('Score ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline = 'top') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function drawRoad(road) {
    context.fillStyle = PALETTE.road;
    context.fillRect(road.x, road.y, road.w, road.h);
    context.strokeStyle = PALETTE.roadLine;
    context.lineWidth = 3;
    context.beginPath();
    if (road.vertical) {
      for (let y = 0; y < FIELD.height; y += 44) { context.moveTo(road.x + road.w / 2, y); context.lineTo(road.x + road.w / 2, y + 22); }
    } else {
      for (let x = 0; x < FIELD.width; x += 44) { context.moveTo(x, road.y + road.h / 2); context.lineTo(x + 22, road.y + road.h / 2); }
    }
    context.stroke();
  }

  function drawBuilding(b) {
    context.fillStyle = b.roof;
    context.fillRect(b.x - 5, b.y - 5, b.w + 10, b.h > b.w ? b.h : b.w);
    context.fillStyle = b.color;
    context.fillRect(b.x, b.y, b.w, b.h);
    for (const w of b.windows) {
      context.fillStyle = w.lit ? PALETTE.windowLit : PALETTE.windowDark;
      context.fillRect(w.x, w.y, w.w, w.h);
    }
  }

  function drawCar(c, color) {
    context.save();
    context.translate(c.x, c.y);
    context.rotate(c.angle);
    context.fillStyle = color;
    context.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    context.fillStyle = '#ffffff';
    context.fillRect(-c.w / 2 + 5, -c.h / 2 + 4, c.w / 3, c.h - 8);
    context.restore();
  }

  function drawPedestrian(p) {
    context.fillStyle = PALETTE.pedestrian;
    context.beginPath();
    context.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
    context.fill();
  }

  function drawCash(c) {
    const r = 5 + Math.sin(c.bob * 3) * 2;
    context.fillStyle = PALETTE.cash;
    context.beginPath();
    context.moveTo(c.x, c.y - r);
    context.lineTo(c.x + r * 0.58, c.y + r * 0.35);
    context.lineTo(c.x - r * 0.35, c.y + r * 0.8);
    context.lineTo(c.x + r * 0.35, c.y + r * 0.8);
    context.lineTo(c.x - r * 0.58, c.y + r * 0.35);
    context.closePath();
    context.fill();
  }

  function drawMission(m) {
    context.fillStyle = PALETTE.mission;
    context.beginPath();
    const t = m.bob || 0;
    for (let i = 0; i < 4; i += 1) {
      const a = t + i * Math.PI / 2;
      context.lineTo(m.x + Math.cos(a) * 9, m.y + Math.sin(a) * 9);
    }
    context.closePath();
    context.fill();
    context.strokeStyle = '#ffffff';
    context.stroke();
  }

  function drawStar(cx, cy, r, filled) {
    context.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      context.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      const a2 = -Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / 5);
      context.lineTo(cx + Math.cos(a2) * r * 0.42, cy + Math.sin(a2) * r * 0.42);
    }
    context.closePath();
    context.fillStyle = filled ? PALETTE.star : PALETTE.starEmpty;
    context.fill();
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 1;
    context.stroke();
  }

  function drawHud(state, best) {
    text(cashLabel(state.player.cash), 20, 16, 30, PALETTE.text, 'left');
    text(scoreLabel(state.player.score), FIELD.width / 2, 16, 30, PALETTE.muted, 'center');
    // health bar
    const hx = FIELD.width - 220, hy = 18, hw = 200, hh = 14;
    context.fillStyle = '#111';
    context.fillRect(hx - 2, hy - 2, hw + 4, hh + 4);
    context.fillStyle = PALETTE.health;
    context.fillRect(hx, hy, Math.max(0, hw * (state.player.health / CAR.health)), hh);
    context.strokeStyle = PALETTE.text;
    context.strokeRect(hx, hy, hw, hh);
    text(Math.max(0, state.player.health | 0) + ' HP', hx, hy + hh + 6, 14, PALETTE.muted, 'left');
    // wanted stars
    text('Wanted', 20, 60, 18, PALETTE.muted, 'left');
    const full = Math.floor(state.player.wanted);
    const frac = state.player.wanted - full;
    for (let i = 0; i < WANTED.maxStars; i += 1) {
      const filled = i < full || (i === full && frac > 0.35);
      drawStar(20 + 70 + i * 24, 78, 9, filled);
    }
    // mission
    if (state.mission && !state.mission.done) {
      text(state.mission.text, 20, FIELD.height - 42, 20, PALETTE.mission, 'left');
      if (state.mission.type === 'reach') text('marker', state.mission.x, state.mission.y - 22, 14, PALETTE.mission, 'center');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 80, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 21, PALETTE.muted, 'center');
    text(prompt, FIELD.width / 2, y + height - 44, 22, PALETTE.cash, 'center');
  }

  const TITLE_LINES = ['Steal, drive, evade.', 'WASD / Arrows to drive • Space to start'];
  const OVER_LINES = ['Wasted', ''];

  resize();
  window.addEventListener('resize', resize);
  return {
    resize,
    /** Paint one frame. `best` is the all-time best score shown on the title screen. */
    draw(state, screen, best) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = PALETTE.backdrop;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.fillStyle = PALETTE.sky;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      for (const r of state.roads) drawRoad(r);
      for (const s of state.sidewalks) { context.fillStyle = PALETTE.sidewalk; context.fillRect(s.x, s.y, s.w, s.h); }
      for (const b of state.buildings) drawBuilding(b);
      for (const e of state.entities) {
        if (!e.active) continue;
        if (e.kind === 0) continue; // player drawn last
        if (e.kind === 1) drawCar(e, PALETTE.traffic);
        else if (e.kind === 2) drawCar(e, PALETTE.cop);
        else if (e.kind === 3) drawPedestrian(e);
        else if (e.kind === 4) drawCash(e);
        else if (e.kind === 5) drawMission(e);
      }
      const p = state.player;
            if (p.active && p.health > 0) {
              const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
              if (!blink) drawCar(p, p.wanted >= 2 ? PALETTE.playerWanted : PALETTE.player);
            }
            // Only draw HUD during actual gameplay (play or paused)
            if (screen === SCREEN_PLAY || screen === 'paused') {
              drawHud(state, best);
            }
            if (screen === SCREEN_TITLE) {
        drawPanel('Neo-City Stories', [...TITLE_LINES, '', 'Best $' + (best || 0)], 'Press Space to start');
      } else if (screen === 'paused') {
        drawPanel('Paused', ['The city waits for you.'], 'Press P to resume');
      } else if (screen === SCREEN_OVER) {
        OVER_LINES[1] = 'Final $' + p.cash + '  •  Score ' + p.score;
        drawPanel('Game over', OVER_LINES, 'Press Space to restart');
      }
    },
  };
}
