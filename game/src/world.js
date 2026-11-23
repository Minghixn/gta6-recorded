// Port Meridian itself: the city grid, the player's body and car, and one
// fixed step of everything that moves. No drawing and no browser in here —
// the renderer reads the state this returns, and main.js feeds it input.
import {
  CAR_ACCEL, CAR_BRAKE, CAR_DRAG, CAR_MAX_SPEED, CAR_REVERSE_MAX, CAR_TURN,
  CAR_R, PALETTE, PISTOL_DAMAGE, PISTOL_MAG, PISTOL_RANGE, PLAYER_MAX_HEALTH,
  PLAYER_R, ROAD_GAP, ROAD_OFF, ROAD_W, SAVE_KEY, STEP, WALK_SPEED,
  WORLD_H, WORLD_W,
} from './config.js';
import { createRandom } from './random.js';
import {
  roadLines, makeCar, spawnParkedCar, spawnTrafficCar, spawnPedestrian,
  spawnPoliceCar, updateTrafficCar, updatePedestrian, updatePoliceCar,
  updateEnemy,
} from './entities.js';
import { updateMissions, missionStartPad, nextMissionDef, startMission, idleObjective } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_OVER = 16;

const BUILDING_COLORS = ['#7a6a58', '#6b7a8d', '#8d6b6b', '#5f7a5f', '#7d7a68', '#8a7a9e', '#9e8a6b', '#687a7a'];
const ROOF_COLORS = ['#4a4038', '#3d4a5a', '#5a3d3d', '#3d4a3d', '#4a4a3d'];

/** The city: roads on a grid, buildings filling the blocks, two green parks. */
export function buildCity(rng) {
  const lines = roadLines();
  const buildings = [];
  const parks = [];
  const parkBlocks = [[2, 5], [6, 2]];
  for (let bx = 0; bx < lines.length - 1; bx += 1) {
    for (let by = 0; by < lines.length - 1; by += 1) {
      const x0 = lines[bx] + ROAD_W / 2 + 8;
      const y0 = lines[by] + ROAD_W / 2 + 8;
      const x1 = lines[bx + 1] - ROAD_W / 2 - 8;
      const y1 = lines[by + 1] - ROAD_W / 2 - 8;
      if (parkBlocks.some(([px, py]) => px === bx && py === by)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: [] });
        const park = parks[parks.length - 1];
        for (let t = 0; t < 7; t += 1) {
          park.trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(8, 13) });
        }
        continue;
      }
      const split = rng.chance(0.5);
      const halves = split
        ? [{ x: x0, y: y0, w: (x1 - x0) / 2 - 6, h: y1 - y0 }, { x: x0 + (x1 - x0) / 2 + 6, y: y0, w: (x1 - x0) / 2 - 6, h: y1 - y0 }]
        : [{ x: x0, y: y0, w: x1 - x0, h: (y1 - y0) / 2 - 6 }, { x: x0, y: y0 + (y1 - y0) / 2 + 6, w: x1 - x0, h: (y1 - y0) / 2 - 6 }];
      for (const half of halves) {
        const inset = rng.range(6, 16);
        buildings.push({
          x: half.x + inset,
          y: half.y + inset,
          w: half.w - inset * 2,
          h: half.h - inset * 2,
          color: rng.pick(BUILDING_COLORS),
          roof: rng.pick(ROOF_COLORS),
          windows: rng.int(2, 5),
        });
      }
    }
  }
  return { lines, buildings, parks };
}

function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns the building hit, if any. */
export function resolveBuildingCollision(city, body, r) {
  const b = circleHitsBuilding(city, body.x, body.y, r);
  if (!b) return null;
  const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
  const dx = body.x - cx;
  const dy = body.y - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const push = r - dist + 0.5;
  if (dist < 0.01) {
    // Centre is inside the building: push out along the smallest side.
    const left = body.x - b.x;
    const right = b.x + b.w - body.x;
    const top = body.y - b.y;
    const bottom = b.y + b.h - body.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) body.x = b.x - r;
    else if (min === right) body.x = b.x + b.w + r;
    else if (min === top) body.y = b.y - r;
    else body.y = b.y + b.h + r;
  } else {
    body.x += (dx / dist) * push;
    body.y += (dy / dist) * push;
  }
  return b;
}

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    rng, city, seed,
    time: 0, cash: 200, health: PLAYER_MAX_HEALTH, ammo: PISTOL_MAG, reserveAmmo: 60,
    wanted: 0, lastCrimeT: -999, policeTimer: 0,
    player: {
      x: 750, y: 750, angle: -Math.PI / 2, speed: 0,
      inCar: null, shootCd: 0, meleeCd: 0, hurtCd: 0, invuln: 0,
    },
    cars: [], peds: [], enemies: [], bullets: [], particles: [], pickups: [],
    missionsDone: [false, false, false], mission: null, dialogue: null,
    objective: '', message: null, messageUntil: 0,
    stats: { kills: 0, carsStolen: 0, shotsFired: 0 },
    events: [], won: false, gameOver: false, justSaved: false,
  };

  function reset() {
    state.time = 0;
    state.cash = 200;
    state.health = PLAYER_MAX_HEALTH;
    state.ammo = PISTOL_MAG;
    state.reserveAmmo = 60;
    state.wanted = 0;
    state.lastCrimeT = -999;
    state.policeTimer = 0;
    state.player.x = 750;
    state.player.y = 750;
    state.player.angle = -Math.PI / 2;
    state.player.speed = 0;
    state.player.inCar = null;
    state.player.shootCd = 0;
    state.player.meleeCd = 0;
    state.player.hurtCd = 0;
    state.cars = [];
    state.peds = [];
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.missionsDone = [false, false, false];
    state.mission = null;
    state.dialogue = null;
    state.objective = idleObjective(state);
    state.message = null;
    state.won = false;
    state.gameOver = false;
    state.stats = { kills: 0, carsStolen: 0, shotsFired: 0 };
    for (let i = 0; i < 14; i += 1) spawnParkedCar(state, rng);
    for (let i = 0; i < 16; i += 1) spawnTrafficCar(state, rng);
    for (let i = 0; i < 26; i += 1) spawnPedestrian(state, rng);
    spawnPickup(state, 1050, 1350, 'health');
    spawnPickup(state, 1650, 750, 'ammo');
    spawnPickup(state, 450, 1650, 'cash');
  }

  function spawnPickup(stateRef, x, y, kind) {
    stateRef.pickups.push({ x, y, kind, bob: 0 });
  }

  function addCrime(level) {
    state.wanted = Math.min(5, state.wanted + level);
    state.lastCrimeT = state.time;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = state.rng.range(0, Math.PI * 2);
      const s = state.rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: state.rng.range(0.25, 0.6), maxLife: 0.6, color, size: state.rng.range(2, 5),
      });
    }
  }

  function playerCar() {
    if (state.player.inCar === null) return null;
    return state.cars.find((c) => c.id === state.player.inCar) || null;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of state.cars) {
      if (car.kind === 'police' || car.dead) continue;
      const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    state.player.inCar = car.id;
    car.kind = 'player';
    car.targetSpeed = 0;
    if (car.wasTraffic) addCrime(1);
    state.stats.carsStolen += 1;
    state.events.push({ type: 'toast', text: car.wasTraffic ? 'Car stolen! Wanted level up.' : 'You took the car.' });
  }

  function exitCar() {
    const car = playerCar();
    if (!car) return;
    const side = state.player.angle + Math.PI / 2;
    let x = car.x + Math.cos(side) * 34;
    let y = car.y + Math.sin(side) * 34;
    if (circleHitsBuilding(state.city, x, y, PLAYER_R)) {
      x = car.x - Math.cos(side) * 34;
      y = car.y - Math.sin(side) * 34;
    }
    state.player.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, x));
    state.player.y = Math.max(PLAYER_R, Math.min(WORLD_H - PLAYER_R, y));
    state.player.angle = car.angle;
    state.player.speed = 0;
    state.player.inCar = null;
    car.kind = 'parked';
    car.speed = 0;
  }

  function firePistol(aimX, aimY) {
    const p = state.player;
    if (p.shootCd > 0 || state.ammo <= 0) {
      if (state.ammo <= 0 && p.shootCd <= 0) state.events.push({ type: 'toast', text: 'Out of ammo — press R to reload' });
      return 0;
    }
    p.shootCd = 0.22;
    state.ammo -= 1;
    state.stats.shotsFired += 1;
    const car = playerCar();
    const ox = car ? car.x : p.x;
    const oy = car ? car.y : p.y;
    const angle = Math.atan2(aimY - oy, aimX - ox) + state.rng.range(-0.02, 0.02);
    state.bullets.push({
      x: ox + Math.cos(angle) * 20,
      y: oy + Math.sin(angle) * 20,
      vx: Math.cos(angle) * 780,
      vy: Math.sin(angle) * 780,
      from: 'player',
      life: PISTOL_RANGE / 780,
    });
    burst(ox + Math.cos(angle) * 24, oy + Math.sin(angle) * 24, '#ffd76a', 3, 90);
    return EVENT_SHOT;
  }

  function meleeSwing() {
    const p = state.player;
    if (p.meleeCd > 0) return;
    p.meleeCd = 0.45;
    const ox = p.x;
    const oy = p.y;
    let hitAny = false;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const d = Math.hypot(enemy.x - ox, enemy.y - oy);
      if (d < 52) {
        enemy.hp -= 2;
        enemy.x += ((enemy.x - ox) / (d || 1)) * 26;
        enemy.y += ((enemy.y - oy) / (d || 1)) * 26;
        burst(enemy.x, enemy.y, '#ff6b6b', 8, 160);
        hitAny = true;
        if (enemy.hp <= 0) killEnemy(enemy);
      }
    }
    if (!hitAny) burst(ox + Math.cos(p.angle) * 26, oy + Math.sin(p.angle) * 26, '#cccccc', 4, 120);
  }

  function killEnemy(enemy) {
    enemy.dead = true;
    state.stats.kills += 1;
    burst(enemy.x, enemy.y, '#d63031', 16, 220);
    state.pickups.push({ x: enemy.x, y: enemy.y, kind: 'cash', bob: 0 });
    state.events.push({ type: 'enemyKilled' });
  }

  function hurtPlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return;
    state.health -= amount;
    p.invuln = 0.5;
    p.hurtCd = 0.4;
    state.events.push({ type: 'hurt' });
    if (state.health <= 0) {
      state.health = 0;
      state.gameOver = true;
    }
  }

  function stepPlayerOnFoot(input, dt) {
    const p = state.player;
    const walk = input.walk();
    const len = Math.hypot(walk.x, walk.y) || 1;
    const nx = walk.x / len;
    const ny = walk.y / len;
    const moving = walk.x !== 0 || walk.y !== 0;
    if (moving) {
      p.angle = Math.atan2(ny, nx);
      p.x += nx * WALK_SPEED * dt;
      resolveBuildingCollision(state.city, p, PLAYER_R);
      p.y += ny * WALK_SPEED * dt;
      resolveBuildingCollision(state.city, p, PLAYER_R);
      p.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, p.x));
      p.y = Math.max(PLAYER_R, Math.min(WORLD_H - PLAYER_R, p.y));
    }
    p.speed = moving ? WALK_SPEED : 0;
    if (input.consume('KeyE')) {
      const pad = missionStartPad(state);
      if (!state.mission && pad && Math.hypot(p.x - pad.x, p.y - pad.y) < 70) {
        startMission(state, nextMissionDef(state));
        return 0;
      }
      const car = nearestCar(58);
      if (car) {
        car.wasTraffic = car.kind === 'traffic';
        enterCar(car);
      }
    }
    if (input.consume('KeyF')) meleeSwing();
    if (input.consume('KeyR')) reloadPistol();
    return 0;
  }

  function reloadPistol() {
    const need = PISTOL_MAG - state.ammo;
    if (need <= 0 || state.reserveAmmo <= 0) return;
    const take = Math.min(need, state.reserveAmmo);
    state.ammo += take;
    state.reserveAmmo -= take;
    state.events.push({ type: 'toast', text: 'Reloaded' });
  }

  function stepPlayerDriving(input, dt) {
    const p = state.player;
    const car = playerCar();
    if (!car) {
      p.inCar = null;
      return 0;
    }
    const drive = input.drive();
    const steer = input.steer();
    if (drive > 0) car.speed += CAR_ACCEL * dt;
    else if (drive < 0) {
      car.speed -= (car.speed > 10 ? CAR_BRAKE : CAR_ACCEL * 0.7) * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR_DRAG * 320 * dt);
    }
    car.speed = Math.max(-CAR_REVERSE_MAX, Math.min(CAR_MAX_SPEED, car.speed));
    const speedFactor = Math.min(1, Math.abs(car.speed) / 240);
    car.angle += steer * CAR_TURN * speedFactor * dt * Math.sign(car.speed || 1);
    const prevX = car.x;
    const prevY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hit = resolveBuildingCollision(state.city, car, CAR_R);
    if (hit) {
      const impact = Math.abs(car.speed);
      if (impact > 180) {
        car.hp -= Math.round(impact / 40);
        burst(car.x, car.y, '#ffcc66', 10, 200);
        state.events.push({ type: 'crash' });
        if (car.hp <= 0) explodeCar(car);
      }
      car.speed *= 0.4;
      // Slide along the wall instead of sticking to it.
      if (circleHitsBuilding(state.city, car.x, car.y, CAR_R)) {
        car.x = prevX;
        car.y = prevY;
        car.speed *= 0.5;
      }
    }
    car.x = Math.max(CAR_R, Math.min(WORLD_W - CAR_R, car.x));
    car.y = Math.max(CAR_R, Math.min(WORLD_H - CAR_R, car.y));
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    if (input.consume('KeyE')) exitCar();
    if (input.consume('KeyR')) reloadPistol();
    return 0;
  }

  function explodeCar(car) {
    car.dead = true;
    burst(car.x, car.y, '#ff9f43', 26, 320);
    burst(car.x, car.y, '#576574', 18, 180);
    state.events.push({ type: 'explosion' });
    if (state.player.inCar === car.id) {
      state.player.inCar = null;
      state.player.x = car.x + 40;
      state.player.y = car.y;
      hurtPlayer(25);
    }
  }

  function stepBullets(dt) {
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (circleHitsBuilding(state.city, b.x, b.y, 2)) {
        b.life = 0;
        burst(b.x, b.y, '#ffd76a', 4, 120);
        continue;
      }
      if (b.from === 'player') {
        for (const enemy of state.enemies) {
          if (enemy.dead) continue;
          if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < 17) {
            enemy.hp -= PISTOL_DAMAGE;
            b.life = 0;
            burst(b.x, b.y, '#ff6b6b', 6, 160);
            state.events.push({ type: 'hit' });
            if (enemy.hp <= 0) killEnemy(enemy);
            break;
          }
        }
      } else if (Math.hypot(state.player.x - b.x, state.player.y - b.y) < (state.player.inCar !== null ? CAR_R : PLAYER_R)) {
        b.life = 0;
        hurtPlayer(8);
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
  }

  function stepCollisions(dt) {
    const car = playerCar();
    // The player's car against traffic and parked cars.
    if (car) {
      for (const other of state.cars) {
        if (other === car || other.dead) continue;
        const dx = car.x - other.x;
        const dy = car.y - other.y;
        const d = Math.hypot(dx, dy);
        if (d < 34 && d > 0.01) {
          // A police ram never shoves the player's car off the road: the
          // police car bounces off instead, the player's car only slows.
          if (other.kind === 'police') {
            other.x -= (dx / d) * (34 - d);
            other.y -= (dy / d) * (34 - d);
          } else {
            const push = (34 - d) / 2;
            car.x += (dx / d) * push;
            car.y += (dy / d) * push;
            other.x -= (dx / d) * push;
            other.y -= (dy / d) * push;
          }
          const impact = Math.abs(car.speed);
          if (impact > 220) {
            car.hp -= 6;
            burst(car.x, car.y, '#ffcc66', 8, 180);
            state.events.push({ type: 'crash' });
            if (car.hp <= 0) explodeCar(car);
          }
          car.speed *= 0.86;
          if (other.kind === 'traffic') other.speed *= 0.7;
        }
      }
      // Running over pedestrians is a crime.
      for (const ped of state.peds) {
        if (Math.abs(car.speed) > 60 && Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
          ped.hit = true;
          burst(ped.x, ped.y, '#e74c3c', 10, 180);
          addCrime(1);
          state.events.push({ type: 'toast', text: 'Pedestrian hit! Wanted level up.' });
        }
      }
    }
    state.peds = state.peds.filter((ped) => !ped.hit);
    // Police ramming the player.
    for (const other of state.cars) {
      if (other.kind !== 'police' || other.dead) continue;
      const d = Math.hypot(other.x - state.player.x, other.y - state.player.y);
      if (d < 36 && other.ramCd <= 0) {
        other.ramCd = 0.9;
        if (car) {
          car.hp -= 4;
          car.speed *= 0.7;
          burst(other.x, other.y, '#74b9ff', 8, 160);
          if (car.hp <= 0) explodeCar(car);
        } else {
          hurtPlayer(10);
        }
        state.events.push({ type: 'crash' });
      }
    }
  }

  function stepPickups() {
    const p = state.player;
    for (const pickup of state.pickups) {
      pickup.bob += STEP;
      if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 30) {
        pickup.taken = true;
        if (pickup.kind === 'health') {
          state.health = Math.min(PLAYER_MAX_HEALTH, state.health + 30);
          state.events.push({ type: 'toast', text: '+30 health' });
        } else if (pickup.kind === 'ammo') {
          state.reserveAmmo += 24;
          state.events.push({ type: 'toast', text: '+24 ammo' });
        } else {
          const amount = 25 + state.rng.int(0, 75);
          state.cash += amount;
          state.events.push({ type: 'cash', text: `+$${amount}` });
        }
        state.events.push({ type: 'pickup' });
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
  }

  function stepWanted(dt) {
    // The heat cools off when the player stays clean and out of sight.
    if (state.wanted > 0 && state.time - state.lastCrimeT > 25) {
      let policeNear = false;
      for (const car of state.cars) {
        if (car.kind === 'police' && Math.hypot(car.x - state.player.x, car.y - state.player.y) < 600) {
          policeNear = true;
          break;
        }
      }
      if (!policeNear) {
        state.wanted -= 1;
        state.lastCrimeT = state.time;
        state.events.push({ type: 'toast', text: 'Wanted level dropped' });
      }
    }
    // Keep the right number of police cars on the streets.
    const want = state.wanted;
    const have = state.cars.filter((c) => c.kind === 'police' && !c.dead).length;
    state.policeTimer -= dt;
    if (want > 0 && have < want && state.policeTimer <= 0) {
      state.policeTimer = 1.5;
      spawnPoliceCar(state, rng);
    }
    state.cars = state.cars.filter((c) => {
      if (c.kind !== 'police' || c.dead) return !c.dead;
      return Math.hypot(c.x - state.player.x, c.y - state.player.y) < 1400;
    });
  }

  /** One fixed step of the whole city. Returns event flags for sound and screens. */
  function step(input, dt) {
    let events = 0;
    state.events.length = 0;
    if (state.dialogue || state.gameOver || state.won) return 0;
    state.time += dt;
    const p = state.player;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.meleeCd > 0) p.meleeCd -= dt;
    if (p.hurtCd > 0) p.hurtCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;

    if (p.inCar !== null) stepPlayerDriving(input, dt);
    else stepPlayerOnFoot(input, dt);

    // Shooting aims at the mouse, on foot or from the driver's seat.
    if (input.consumeClick()) {
      const aim = input.aimWorld();
      if (aim) events |= firePistol(aim.x, aim.y);
    }

    for (const car of state.cars) {
      if (car.kind === 'traffic') updateTrafficCar(state, car, dt, rng);
      else if (car.kind === 'police') updatePoliceCar(state, car, dt);
    }
    for (const ped of state.peds) updatePedestrian(state, ped, dt, rng);
    for (const enemy of state.enemies) {
      if (!enemy.dead) updateEnemy(state, enemy, dt, rng);
    }
    state.enemies = state.enemies.filter((e) => !e.dead || state.mission?.def.id === 2);
    stepBullets(dt);
    stepCollisions(dt);
    stepPickups();
    stepWanted(dt);
    updateMissions(state, dt, rng);

    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    // Keep the streets populated.
    if (state.cars.filter((c) => c.kind === 'traffic').length < 14) spawnTrafficCar(state, rng);
    if (state.peds.length < 22) spawnPedestrian(state, rng);

    for (const ev of state.events) {
      if (ev.type === 'hurt' || ev.type === 'crash') events |= EVENT_CRASH;
      else if (ev.type === 'pickup' || ev.type === 'cash') events |= EVENT_PICKUP;
      else if (ev.type === 'hit') events |= EVENT_HIT;
    }
    if (state.gameOver) events |= EVENT_OVER;
    return events;
  }

  function toast(text, seconds) {
    state.message = text;
    state.messageUntil = state.time + (seconds || 3);
  }

  /** Save the run to this browser: cash, health, ammo, missions, position. */
  function save() {
    try {
      const data = {
        cash: state.cash,
        health: state.health,
        ammo: state.ammo,
        reserveAmmo: state.reserveAmmo,
        missionsDone: state.missionsDone,
        x: state.player.x,
        y: state.player.y,
        wanted: 0,
        kills: state.stats.kills,
        carsStolen: state.stats.carsStolen,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      state.justSaved = true;
      return true;
    } catch {
      return false;
    }
  }

  /** Load a saved run back into a fresh city. Returns true when one existed. */
  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      reset();
      state.cash = data.cash ?? 200;
      state.health = data.health ?? PLAYER_MAX_HEALTH;
      state.ammo = data.ammo ?? PISTOL_MAG;
      state.reserveAmmo = data.reserveAmmo ?? 60;
      state.missionsDone = data.missionsDone ?? [false, false, false];
      state.player.x = data.x ?? 750;
      state.player.y = data.y ?? 750;
      state.stats.kills = data.kills ?? 0;
      state.stats.carsStolen = data.carsStolen ?? 0;
      state.objective = idleObjective(state);
      return true;
    } catch {
      return false;
    }
  }

  function hasSave() {
    try {
      return window.localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  reset();
  return { state, reset, step, save, load, hasSave, toast, buildCity };
}
