// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot that drives east along Harbor Avenue toward
// its target, so the frame is what a short game really looks like and the
// same seed always gives the same frame.
import { STEP } from './config.js';
import { makeCar, spawnPoliceCar } from './entities.js';
import { MISSION_DEFS } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 3;
const CHASE_SECONDS = 2.5;
const MISSION_SECONDS = 2.5;

/** The input the autopilot feeds the world: full throttle, steered at a point. */
function autopilotInput(state, target) {
  let reverseUntil = 0;
  let lastReverseEnd = -10;
  return {
    walk() { return { x: 0, y: 0 }; },
    drive() {
      if (state.time < reverseUntil) return -1;
      return 1;
    },
    steer() {
      const p = state.player;
      const want = Math.atan2(target.y - p.y, target.x - p.x);
      let diff = want - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Stuck against something: one short reverse, then carry on. Only once
      // every couple of seconds, so a stuck car never reverses forever.
      if (Math.abs(p.speed) < 25 && state.time > 2 && state.time > lastReverseEnd + 2) {
        reverseUntil = state.time + 0.8;
        lastReverseEnd = reverseUntil;
      }
      if (diff > 0.1) return 1;
      if (diff < -0.1) return -1;
      return 0;
    },
    consume() { return false; },
    consumeClick() { return false; },
    aimWorld() { return null; },
  };
}

function neutralInput() {
  return {
    walk() { return { x: 0, y: 0 }; },
    drive() { return 0; },
    steer() { return 0; },
    consume() { return false; },
    consumeClick() { return false; },
    aimWorld() { return null; },
  };
}

/** Put the player in a fresh car on Harbor Avenue, facing `angle`. */
function stagePlayerCar(state, x, y, angle) {
  const car = makeCar(x, y, angle, 'player', '#e67e22', 0);
  state.cars.push(car);
  state.player.inCar = car.id;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

/** Cars sharing Harbor Avenue so the drive shot has traffic in frame. */
function stageAvenueTraffic(state, spots) {
  for (const spot of spots) {
    const car = makeCar(spot.x, spot.y, spot.dir > 0 ? 0 : Math.PI, 'traffic', spot.color || '#2980b9', spot.speed || 150);
    car.axis = 'x';
    car.dir = spot.dir;
    car.road = 1050;
    car.targetSpeed = spot.speed || 150;
    state.cars.push(car);
  }
}

/**
 * Set the world to the named scene (start, drive, chase or mission; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(neutralInput(), STEP);
    return { screen: SCREEN_TITLE };
  }

  if (name === 'drive') {
    // West along Harbor Avenue: the camera stays centred on the city.
    stagePlayerCar(state, 2150, 1030, Math.PI);
    stageAvenueTraffic(state, [
      { x: 900, y: 1070, dir: 1, speed: 300 },
      { x: 1200, y: 1030, dir: -1, speed: 300 },
      { x: 750, y: 470, dir: 1, speed: 180 },
      { x: 1350, y: 470, dir: -1, speed: 180 },
    ]);
    const input = autopilotInput(state, { x: 600, y: 1030 });
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) world.step(input, STEP);
    state.objective = 'Free roam — find the yellow M1 marker to start: The Getaway';
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    stagePlayerCar(state, 2150, 1030, Math.PI);
    stageAvenueTraffic(state, [
      { x: 900, y: 1070, dir: 1, speed: 300 },
      { x: 1500, y: 1030, dir: -1, speed: 300 },
    ]);
    state.wanted = 3;
    state.lastCrimeT = 0;
    for (let i = 0; i < 3; i += 1) {
      const car = spawnPoliceCar(state, state.rng);
      if (car) {
        car.x = 2380 + i * 50;
        car.y = 1030 - (i % 2) * 40;
        car.speed = 380;
      }
    }
    const input = autopilotInput(state, { x: 600, y: 1030 });
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) world.step(input, STEP);
    state.objective = 'Lose the police — wanted level 3!';
    return { screen: SCREEN_PLAY };
  }

  // mission: the getaway drive, already rolling toward the docks.
  stagePlayerCar(state, 900, 1070, 0);
  stageAvenueTraffic(state, [
    { x: 1500, y: 1030, dir: -1, speed: 200 },
    { x: 1800, y: 1070, dir: 1, speed: 280 },
  ]);
  state.wanted = 2;
  state.lastCrimeT = 0;
  state.mission = {
    def: MISSION_DEFS[0], stage: 1, timer: 88,
    target: { x: 2250, y: 1050, label: 'Meridian Docks' }, kills: 0, needed: 0,
  };
  state.objective = 'Get to the Meridian Docks — 88s left';
  for (let i = 0; i < 2; i += 1) {
    const car = spawnPoliceCar(state, state.rng);
    if (car) {
      car.x = 300 + i * 70;
      car.y = 1030;
      car.speed = 300;
    }
  }
  const input = autopilotInput(state, { x: 2250, y: 1050 });
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) world.step(input, STEP);
  // If the autopilot already reached the docks, re-arm the drive stage so the
  // frame shows the mission in progress, not its outro dialogue.
  if (!state.mission) {
    state.mission = {
      def: MISSION_DEFS[0], stage: 1, timer: 82,
      target: { x: 2250, y: 1050, label: 'Meridian Docks' }, kills: 0, needed: 0,
    };
    state.dialogue = null;
    state.wanted = 2;
    state.objective = 'Get to the Meridian Docks — 82s left';
  } else {
    state.objective = `Get to the Meridian Docks — ${Math.max(0, Math.ceil(state.mission.timer))}s left`;
  }
  return { screen: SCREEN_PLAY };
}
