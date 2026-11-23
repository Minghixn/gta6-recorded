// The city's moving population: traffic cars that keep to the roads,
// pedestrians on the sidewalks, police cars that hunt the player, and the
// rival gang members a turf war throws at you. Nothing here draws anything;
// it only moves bodies and reports what happened.
import {
  CAR_COLORS, PED_COLORS, ROAD_GAP, ROAD_OFF, ROAD_W, WORLD_W, WORLD_H,
} from './config.js';

export function roadLines() {
  const lines = [];
  for (let x = ROAD_OFF; x <= WORLD_W - ROAD_OFF; x += ROAD_GAP) lines.push(x);
  return lines;
}

function nearestRoadLine(value) {
  const lines = roadLines();
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

function onRoad(value, line) {
  return Math.abs(value - line) < 14;
}

let carId = 0;

export function makeCar(x, y, angle, kind, color, speed) {
  carId += 1;
  return {
    id: carId, kind, x, y, angle, speed: speed || 0,
    color: color || '#888888', hp: 100, axis: 'x', dir: 1,
    road: nearestRoadLine(y), targetSpeed: 0, ramCd: 0, dead: false,
  };
}

/** A parked car sits half on the kerb beside a road, engine off. */
export function spawnParkedCar(state, rng) {
  const lines = roadLines();
  const vertical = rng.chance(0.5);
  const line = rng.pick(lines);
  const along = rng.range(ROAD_OFF + 120, WORLD_W - ROAD_OFF - 120);
  const side = rng.chance(0.5) ? 1 : -1;
  const off = ROAD_W / 2 - 14;
  const x = vertical ? line + side * off : along;
  const y = vertical ? along : line + side * off;
  const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
  const car = makeCar(x, y, angle, 'parked', rng.pick(CAR_COLORS), 0);
  state.cars.push(car);
  return car;
}

/** A traffic car drives along one road, in one lane, at a cruise speed. */
export function spawnTrafficCar(state, rng) {
  const lines = roadLines();
  const vertical = rng.chance(0.5);
  const line = rng.pick(lines);
  const along = rng.range(ROAD_OFF, WORLD_W - ROAD_OFF);
  const dir = rng.chance(0.5) ? 1 : -1;
  const lane = 20;
  const x = vertical ? line + (dir > 0 ? lane : -lane) : along;
  const y = vertical ? along : line + (dir > 0 ? lane : -lane);
  const car = makeCar(x, y, vertical ? dir * Math.PI / 2 : (dir > 0 ? 0 : Math.PI), 'traffic', rng.pick(CAR_COLORS), rng.range(140, 210));
  car.axis = vertical ? 'y' : 'x';
  car.dir = dir;
  car.road = line;
  car.targetSpeed = car.speed;
  state.cars.push(car);
  return car;
}

/** A pedestrian strolls a sidewalk beside a road. */
export function spawnPedestrian(state, rng) {
  const lines = roadLines();
  const vertical = rng.chance(0.5);
  const line = rng.pick(lines);
  const along = rng.range(ROAD_OFF, WORLD_W - ROAD_OFF);
  const side = rng.chance(0.5) ? 1 : -1;
  const off = ROAD_W / 2 + 12;
  state.peds.push({
    x: vertical ? line + side * off : along,
    y: vertical ? along : line + side * off,
    axis: vertical ? 'y' : 'x',
    dir: rng.chance(0.5) ? 1 : -1,
    speed: rng.range(28, 55),
    color: rng.pick(PED_COLORS),
    angle: 0,
  });
}

function carAhead(state, car) {
  let closest = Infinity;
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    if (car.axis === 'x') {
      if (Math.abs(other.y - car.y) > 26) continue;
      const gap = (other.x - car.x) * car.dir;
      if (gap > 0 && gap < closest) closest = gap;
    } else {
      if (Math.abs(other.x - car.x) > 26) continue;
      const gap = (other.y - car.y) * car.dir;
      if (gap > 0 && gap < closest) closest = gap;
    }
  }
  return closest;
}

/** One traffic car follows its road, slowing for the car in front and turning at junctions. */
export function updateTrafficCar(state, car, dt, rng) {
  if (car.kind !== 'traffic') return;
  const ahead = carAhead(state, car);
  const want = ahead < 78 ? 0 : car.targetSpeed;
  car.speed += Math.max(-260 * dt, Math.min(140 * dt, want - car.speed));
  if (car.speed < 1) car.speed = 0;
  const step = car.speed * car.dir * dt;
  if (car.axis === 'x') car.x += step;
  else car.y += step;
  const pos = car.axis === 'x' ? car.x : car.y;
  // At a junction, sometimes turn onto the crossing road.
  for (const line of roadLines()) {
    if (!onRoad(pos, line)) continue;
    if (pos < ROAD_OFF || pos > WORLD_W - ROAD_OFF) break;
    if (rng.chance(0.35)) {
      const turnVertical = car.axis === 'x';
      const newDir = rng.chance(0.5) ? 1 : -1;
      car.axis = turnVertical ? 'y' : 'x';
      car.dir = newDir;
      car.road = line;
      if (turnVertical) {
        car.x = line;
        car.y += newDir * 20 - (car.y - nearestRoadLine(car.y)) * 0;
        car.y = nearestRoadLine(car.y) + newDir * 20;
        car.angle = newDir * Math.PI / 2;
      } else {
        car.y = line;
        car.x = nearestRoadLine(car.x) + newDir * 20;
        car.angle = newDir > 0 ? 0 : Math.PI;
      }
    }
    break;
  }
  // Wrap around the city edge instead of driving off the map.
  if (car.x < 60) { car.x = WORLD_W - 70; }
  if (car.x > WORLD_W - 60) { car.x = 70; }
  if (car.y < 60) { car.y = WORLD_H - 70; }
  if (car.y > WORLD_H - 60) { car.y = 70; }
}

export function updatePedestrian(state, ped, dt, rng) {
  const step = ped.speed * ped.dir * dt;
  if (ped.axis === 'x') ped.x += step;
  else ped.y += step;
  ped.angle = ped.axis === 'x' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const pos = ped.axis === 'x' ? ped.x : ped.y;
  for (const line of roadLines()) {
    if (!onRoad(pos, line)) continue;
    if (rng.chance(0.3)) {
      ped.axis = ped.axis === 'x' ? 'y' : 'x';
      ped.dir = rng.chance(0.5) ? 1 : -1;
    }
    break;
  }
  if (ped.x < 80) { ped.x = 80; ped.dir = 1; }
  if (ped.x > WORLD_W - 80) { ped.x = WORLD_W - 80; ped.dir = -1; }
  if (ped.y < 80) { ped.y = 80; ped.dir = 1; }
  if (ped.y > WORLD_H - 80) { ped.y = WORLD_H - 80; ped.dir = -1; }
}

/** Drop a police car on a road some distance from the player. */
export function spawnPoliceCar(state, rng) {
  const lines = roadLines();
  const p = state.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const vertical = rng.chance(0.5);
    const line = rng.pick(lines);
    const along = rng.range(ROAD_OFF, WORLD_W - ROAD_OFF);
    const x = vertical ? line : along;
    const y = vertical ? along : line;
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist < 520 || dist > 900) continue;
    const car = makeCar(x, y, 0, 'police', '#e8e8e8', 0);
    car.targetSpeed = 560;
    state.cars.push(car);
    return car;
  }
  return null;
}

/** A police car steers straight at the player and rams on contact. */
export function updatePoliceCar(state, car, dt) {
  const p = state.player;
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  car.speed = Math.min(car.targetSpeed, car.speed + 520 * dt);
  if (dist < 130) car.speed = Math.min(car.speed, 300);
  car.angle += steer * 3.1 * dt * Math.min(1, car.speed / 220);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (car.ramCd > 0) car.ramCd -= dt;
  return dist;
}

/** Rival gang members for the turf war: they close in and shoot. */
export function spawnGang(state, rng, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const dist = rng.range(120, 220);
    state.enemies.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      hp: 3,
      angle,
      speed: rng.range(70, 95),
      shootCd: rng.range(0.5, 1.6),
      color: '#d63031',
      dead: false,
    });
  }
}

export function updateEnemy(state, enemy, dt, rng) {
  const p = state.player;
  const dx = p.x - enemy.x;
  const dy = p.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.angle = Math.atan2(dy, dx);
  if (dist > 260) {
    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;
  } else if (dist < 120) {
    enemy.x -= (dx / dist) * enemy.speed * 0.5 * dt;
    enemy.y -= (dy / dist) * enemy.speed * 0.5 * dt;
  }
  enemy.shootCd -= dt;
  if (enemy.shootCd <= 0 && dist < 330) {
    enemy.shootCd = rng.range(1.1, 1.9);
    const spread = rng.range(-0.09, 0.09);
    state.bullets.push({
      x: enemy.x + Math.cos(enemy.angle) * 18,
      y: enemy.y + Math.sin(enemy.angle) * 18,
      vx: Math.cos(enemy.angle + spread) * 560,
      vy: Math.sin(enemy.angle + spread) * 560,
      from: 'enemy',
      life: 1.1,
    });
    state.events.push({ type: 'enemyShot' });
  }
}
