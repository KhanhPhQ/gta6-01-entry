// Neo-City Stories — simulation.
// Procedural city grid, player/traffic/police cars, pedestrians, cash, missions,
// collisions, wanted level, score and money. Pure rules: no drawing, no browser.
import { FIELD, STEP, PALETTE, CAR, TRAFFIC, PEDESTRIAN, POLICE, WANTED, CITY, MONEY } from './config.js';
import { createRandom } from './random.js';

export const KIND_PLAYER = 0;
export const KIND_TRAFFIC = 1;
export const KIND_POLICE = 2;
export const KIND_PEDESTRIAN = 3;
export const KIND_CASH = 4;
export const KIND_MISSION = 5;

export const EVENT_NONE = 0;
export const EVENT_HIT_BUILDING = 1;
export const EVENT_HIT_CAR = 2;
export const EVENT_HIT_PED = 4;
export const EVENT_HIT_COP = 8;
export const EVENT_CASH = 16;
export const EVENT_MISSION = 32;
export const EVENT_OVER = 64;

const PI2 = Math.PI * 2;
function wrapAngle(a) { return ((a % PI2) + PI2) % PI2; }
function overlapsRect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function dist2(x1, y1, x2, y2) { const d = x2 - x1, e = y2 - y1; return d * d + e * e; }
function dist(x1, y1, x2, y2) { return Math.sqrt(dist2(x1, y1, x2, y2)); }
function pick(arr, random) { return arr[Math.floor(random() * arr.length)]; }

/* ---------------- city ---------------- */

function generateCity(random) {
  const grid = CITY.grid, rw = CITY.roadWidth, sw = CITY.sidewalkWidth;
  const roads = [];
  const sidewalks = [];
  const buildings = [];
  const nbx = Math.max(1, Math.floor((FIELD.width - rw) / (grid + rw)));
  const nby = Math.max(1, Math.floor((FIELD.height - rw) / (grid + rw)));
  for (let i = 0; i <= nbx; i += 1) {
    const x = rw / 2 + i * (grid + rw);
    roads.push({ x, y: 0, w: rw, h: FIELD.height, vertical: true });
  }
  for (let j = 0; j <= nby; j += 1) {
    const y = rw / 2 + j * (grid + rw);
    roads.push({ x: 0, y, w: FIELD.width, h: rw, vertical: false });
  }
  for (let i = 0; i < nbx; i += 1) {
    const bx = rw / 2 + i * (grid + rw) + rw;
    for (let j = 0; j < nby; j += 1) {
      const by = rw / 2 + j * (grid + rw) + rw;
      sidewalks.push({ x: bx, y: by, w: grid, h: sw });
      sidewalks.push({ x: bx, y: by + grid - sw, w: grid, h: sw });
      sidewalks.push({ x: bx, y: by, w: sw, h: grid });
      sidewalks.push({ x: bx + grid - sw, y: by, w: sw, h: grid });
      const nBuildings = 1 + (random() < 0.5 ? 1 : 0);
      for (let k = 0; k < nBuildings; k += 1) {
        const bw = CITY.buildingMin + random() * (CITY.buildingMax - CITY.buildingMin);
        const bh = CITY.buildingMin + random() * (CITY.buildingMax - CITY.buildingMin);
        const mx = bx + sw + random() * (grid - sw * 2 - bw);
        const my = by + sw + random() * (grid - sw * 2 - bh);
        const base = 220 + random() * 60;
        const light = 30 + random() * 14;
        const color = `hsl(${base},10%,${light}%)`;
        const roof = `hsl(${base - 12},8%,${Math.max(0, light - 9)}%)`;
        const b = { x: mx, y: my, w: bw, h: bh, color, roof, windows: [] };
        const wx = bw / 6, wy = bh / 6;
        for (let gx = 0; gx < 5; gx += 1) {
          for (let gy = 0; gy < 4; gy += 1) {
            b.windows.push({
              x: mx + bw * 0.2 + gx * wx,
              y: my + bh * 0.2 + gy * wy,
              w: wx * 0.55,
              h: wy * 0.55,
              lit: random() < 0.4,
            });
          }
        }
        buildings.push(b);
      }
    }
  }
  return { roads, sidewalks, buildings };
}

/* ---------------- entities ---------------- */

function newCar(kind, x, y, angle, speed, maxSpeed) {
  return { kind, x, y, w: CAR.width, h: CAR.height, angle, speed, maxSpeed, active: true, health: 100, targetX: x, targetY: y, bob: 0 };
}

function newPedestrian(x, y) {
  return { kind: KIND_PEDESTRIAN, x, y, w: 10, h: 16, angle: 0, speed: 0, active: true, targetX: x, targetY: y, wander: 0, bob: 0 };
}

function newCash(x, y) { return { kind: KIND_CASH, x, y, w: 10, h: 10, active: true, value: MONEY.cashValue, bob: Math.random() * 6.28 }; }
function newMissionMarker(x, y, text) { return { kind: KIND_MISSION, x, y, w: 14, h: 14, active: true, text, bob: Math.random() * 6.28 }; }

function pointOnRoad(random, roads) {
  // Find the road closest to center
  let bestRoad = null;
  let bestDist = Infinity;
  for (const r of roads) {
    let dist;
    if (r.vertical) {
      dist = Math.abs(r.x + r.w / 2 - FIELD.width / 2);
    } else {
      dist = Math.abs(r.y + r.h / 2 - FIELD.height / 2);
    }
    if (dist < bestDist) {
      bestDist = dist;
      bestRoad = r;
    }
  }
  if (!bestRoad) return { x: FIELD.width / 2, y: FIELD.height / 2 };
  if (bestRoad.vertical) {
    return { x: bestRoad.x + bestRoad.w / 2, y: FIELD.height / 2 };
  }
  return { x: FIELD.width / 2, y: bestRoad.y + bestRoad.h / 2 };
}

function pointOnRoadNetwork(random, roads) {
  const r = pick(roads, random);
  if (r.vertical) return { x: r.x + r.w / 2 + (random() - 0.5) * 30, y: random() * FIELD.height };
  return { x: random() * FIELD.width, y: r.y + r.h / 2 + (random() - 0.5) * 30 };
}

function pointOnSidewalk(random, sidewalks) {
  const s = pick(sidewalks, random);
  return { x: s.x + random() * s.w, y: s.y + random() * s.h };
}

/* shared car physics (arcade top-down) */
function updateCar(c, dt, steer, throttle, maxSpeed) {
  if (throttle > 0) c.speed = Math.min(c.speed + CAR.acceleration * dt, maxSpeed);
  else if (throttle < 0) c.speed = Math.max(c.speed - CAR.brake * dt, -CAR.reverseSpeed);
  else c.speed *= Math.pow(CAR.friction, dt * 60);
  const turnFactor = Math.min(1, Math.abs(c.speed) / 70);
  c.angle = wrapAngle(c.angle + steer * CAR.turnRate * turnFactor * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
}

function driveAI(c, dt, tx, ty, maxSpeed, player) {
  const dx = tx - c.x, dy = ty - c.y;
  const desired = Math.atan2(dy, dx);
  let diff = wrapAngle(desired - c.angle);
  const maxTurn = c.turnRate || CAR.turnRate;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, diff)) * dt;
  c.angle = wrapAngle(c.angle + turn);
  const aligned = Math.abs(diff) < 0.6;
  const close = dist2(c.x, c.y, tx, ty) < 70 * 70;
  if (aligned && !close) c.speed = Math.min(c.speed + CAR.acceleration * dt, maxSpeed);
  else c.speed = Math.max(c.speed - CAR.brake * dt, 0);
  // ease off if another car is right ahead
  if (player && dist2(c.x, c.y, player.x, player.y) < 80 * 80) c.speed *= 0.95;
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
}

function clampCar(c) {
  c.x = Math.min(FIELD.width - c.w / 2, Math.max(c.w / 2, c.x));
  c.y = Math.min(FIELD.height - c.h / 2, Math.max(c.h / 2, c.y));
}

export function createWorld(random) {
  const city = generateCity(random);
  const { roads, sidewalks, buildings } = city;
  const entities = [];

  const spawn = pointOnRoad(random, roads);
  const player = newCar(KIND_PLAYER, spawn.x, spawn.y, -Math.PI / 2, 0, CAR.maxSpeed);
  player.health = CAR.health;
  player.cash = 120;
  player.score = 120;
  player.wanted = 0;
  player.invulnerable = 2.0; // 2 seconds invulnerable on start
  player.wantedSight = 0;
  player.sidewalkTimer = 0;

  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const p = pointOnRoadNetwork(random, roads);
    entities.push(newCar(KIND_TRAFFIC, p.x, p.y, random() * PI2, TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin), TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin)));
  }
  for (let i = 0; i < PEDESTRIAN.count; i += 1) {
    const p = pointOnSidewalk(random, sidewalks);
    entities.push(newPedestrian(p.x, p.y));
  }
  for (let i = 0; i < 6; i += 1) {
    const p = pointOnSidewalk(random, sidewalks);
    entities.push(newCash(p.x, p.y));
  }

  function spawnPolice() {
    if (entities.filter(e => e.kind === KIND_POLICE).length >= POLICE.maxCops) return;
    const angle = player.angle + (random() - 0.5) * PI2;
    const d = 240 + random() * 180;
    const c = newCar(KIND_POLICE, player.x + Math.cos(angle) * d, player.y + Math.sin(angle) * d, angle, 0, POLICE.speed);
    c.health = 120;
    c.turnRate = POLICE.turnRate;
    entities.push(c);
  }

  function despawnPolice() {
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      const e = entities[i];
      if (e.kind === KIND_POLICE && player.wanted <= 0 && dist2(e.x, e.y, player.x, player.y) > 320 * 320) entities.splice(i, 1);
    }
  }

  let mission = null;
  let missionNext = 0;
  let missionTextTimer = 0;

  function setMission() {
    const types = ['cash', 'reach', 'evade'];
    const type = pick(types, random);
    let text = '', target = 0, x = player.x, y = player.y;
    if (type === 'cash') {
      target = player.cash + Math.floor(6 + random() * 6) * MONEY.cashValue;
      text = `Reach $${target}`;
      const sp = pointOnSidewalk(random, sidewalks); x = sp.x; y = sp.y;
    } else if (type === 'reach') {
      const rp = pointOnRoadNetwork(random, roads); x = rp.x; y = rp.y;
      text = 'Reach the marker';
      target = 1;
    } else {
      text = 'Lose the police';
      target = 4;
    }
    mission = { type, text, target, reward: MONEY.missionReward, progress: 0, done: false, awarded: false, x, y };
    missionNext = 0;
    // place/reset mission marker entity
    let marker = entities.find(e => e.kind === KIND_MISSION && e.active);
    if (!marker) { marker = newMissionMarker(x, y, text); entities.push(marker); }
    marker.x = x; marker.y = y; marker.text = text; marker.active = true;
    missionTextTimer = 3;
  }

  function awardMission() {
    if (!mission || mission.awarded) return;
    mission.awarded = true;
    player.cash += mission.reward;
    player.score += mission.reward;
    missionNext = 3;
  }

  setMission();

  function reset() {
    entities.length = 0;
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const p = pointOnRoadNetwork(random, roads);
      entities.push(newCar(KIND_TRAFFIC, p.x, p.y, random() * PI2, TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin), TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin)));
    }
    for (let i = 0; i < PEDESTRIAN.count; i += 1) {
      const p = pointOnSidewalk(random, sidewalks);
      entities.push(newPedestrian(p.x, p.y));
    }
    for (let i = 0; i < 6; i += 1) {
      const p = pointOnSidewalk(random, sidewalks);
      entities.push(newCash(p.x, p.y));
    }
    const spawn = pointOnRoad(random, roads);
        player.x = spawn.x; player.y = spawn.y; player.angle = -Math.PI / 2;
        player.speed = 0; player.health = CAR.health; player.cash = 120; player.score = 120;
        player.wanted = 0; player.invulnerable = 2.0; player.wantedSight = 0; player.sidewalkTimer = 0;
        player.active = true;
    mission = null; missionNext = 0; missionTextTimer = 0;
    setMission();
  }

  function step(dt, input) {
    let events = EVENT_NONE;
    const throttle = input.throttle();
    const steer = input.steer();
    input.takeActions();

    const prevX = player.x, prevY = player.y;
    updateCar(player, dt, steer, throttle, CAR.maxSpeed);
    clampCar(player);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    // building collision
    let hitBuilding = false;
    for (const b of buildings) { if (overlapsRect(player, b)) { hitBuilding = true; break; } }
    if (hitBuilding) {
      player.x = prevX; player.y = prevY; player.speed *= 0.25;
      player.health = Math.max(0, player.health - 8 * dt * 60);
      events |= EVENT_HIT_BUILDING;
      player.wanted = Math.min(5, player.wanted + WANTED.gainHitBuilding);
      if (player.health <= 0) events |= EVENT_OVER;
    }

    // sidewalk wanted
    let onSidewalk = false;
    for (const s of sidewalks) {
      if (player.x > s.x && player.x < s.x + s.w && player.y > s.y && player.y < s.y + s.h) { onSidewalk = true; break; }
    }
    if (onSidewalk) {
      player.sidewalkTimer += dt;
      player.wanted = Math.min(5, player.wanted + WANTED.gainSidewalkPerSecond);
    } else player.sidewalkTimer = 0;

    // entity interactions
    for (let i = 0; i < entities.length; i += 1) {
      const e = entities[i];
      if (!e.active) continue;
      if (overlapsRect(player, e)) {
        if (e.kind === KIND_TRAFFIC || e.kind === KIND_POLICE) {
          const dx = player.x - e.x, dy = player.y - e.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / len, ny = dy / len;
          const minDist = (player.w + e.w) / 2;
          if (len < minDist) {
            player.x = e.x + nx * minDist; player.y = e.y + ny * minDist;
            player.speed *= -0.5; e.speed *= 0.6;
            player.health = Math.max(0, player.health - 14 * dt * 60);
            events |= e.kind === KIND_POLICE ? EVENT_HIT_COP : EVENT_HIT_CAR;
            player.wanted = Math.min(5, player.wanted + (e.kind === KIND_POLICE ? WANTED.gainHitCop : WANTED.gainHitCar));
            if (player.health <= 0) events |= EVENT_OVER;
          }
        } else if (e.kind === KIND_PEDESTRIAN) {
          e.active = false;
          player.health = Math.max(0, player.health - 4 * dt * 60);
          events |= EVENT_HIT_PED;
          player.wanted = Math.min(5, player.wanted + WANTED.gainHitPed);
        } else if (e.kind === KIND_CASH) {
          e.active = false;
          player.cash += e.value; player.score += e.value;
          events |= EVENT_CASH;
          const p = pointOnSidewalk(random, sidewalks);
          e.x = p.x; e.y = p.y; e.active = true; e.bob = 0;
        } else if (e.kind === KIND_MISSION && mission && !mission.done && mission.type === 'reach') {
          mission.done = true; awardMission(); events |= EVENT_MISSION;
        }
      }
    }

    // wanted decay (always, when above zero)
    if (player.wanted > 0) player.wanted = Math.max(0, player.wanted - WANTED.decayPerSecond * dt);

    // police chase
    if (player.wanted > 0) {
      player.wantedSight += dt;
      if (player.wantedSight > POLICE.spawnDelay) { spawnPolice(); player.wantedSight = 0; }
    } else {
      despawnPolice();
    }

    // traffic AI
    for (const c of entities) {
      if (c.kind !== KIND_TRAFFIC || !c.active) continue;
      if (dist2(c.x, c.y, c.targetX, c.targetY) < 90 * 90) {
        const p = pointOnRoadNetwork(random, roads);
        c.targetX = p.x; c.targetY = p.y;
        c.maxSpeed = TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin);
      }
      driveAI(c, dt, c.targetX, c.targetY, c.maxSpeed, player);
      clampCar(c);
      for (const b of buildings) {
        if (overlapsRect(c, b)) {
          c.x -= Math.cos(c.angle) * c.speed * dt;
          c.y -= Math.sin(c.angle) * c.speed * dt;
          c.speed *= -0.5;
          c.angle += (random() - 0.5);
          break;
        }
      }
    }

    // pedestrians
    for (const p of entities) {
      if (p.kind !== KIND_PEDESTRIAN || !p.active) continue;
      p.wander -= dt;
      if (p.wander <= 0) {
        const sp = pointOnSidewalk(random, sidewalks);
        p.targetX = sp.x; p.targetY = sp.y; p.wander = 2 + random() * 3;
      }
      driveAI(p, dt, p.targetX, p.targetY, PEDESTRIAN.speed);
      // keep near sidewalk
      let onSw = false;
      for (const s of sidewalks) { if (p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h) { onSw = true; break; } }
      if (!onSw) { const sp = pointOnSidewalk(random, sidewalks); p.targetX = sp.x; p.targetY = sp.y; }
      clampCar(p);
    }

    // police AI
    for (const c of entities) {
      if (c.kind !== KIND_POLICE || !c.active) continue;
      driveAI(c, dt, player.x, player.y, c.maxSpeed, player);
      clampCar(c);
      if (dist2(c.x, c.y, player.x, player.y) < 30 * 30) {
        player.health = Math.max(0, player.health - POLICE.ramDamage * dt * 60);
        events |= EVENT_HIT_COP;
        if (player.health <= 0) events |= EVENT_OVER;
      }
    }

    // cash bob
    for (const c of entities) { if (c.kind === KIND_CASH && c.active) c.bob += dt; }

    // mission logic
    if (mission && !mission.done) {
      if (mission.type === 'cash' && player.cash >= mission.target) mission.done = true;
      else if (mission.type === 'evade') {
        if (player.wanted <= 0) { mission.progress += dt; if (mission.progress >= mission.target) mission.done = true; }
        else mission.progress = 0;
      }
    }
    if (mission && mission.done) awardMission();
    if (missionNext > 0) { missionNext -= dt; if (missionNext <= 0 && mission && mission.awarded) setMission(); }
    if (missionTextTimer > 0) { missionTextTimer -= dt; }

    return events;
  }

  return { state: () => ({ player, entities, buildings, roads, sidewalks, mission }), reset, step };
}
