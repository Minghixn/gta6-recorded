// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between title, play, paused,
// game over and win screens, with dialogue boxes on top of play.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_SHOT } from './world.js';
import { createInput } from './input.js';
import { createRenderer, computeCamera, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);
// A handle for play-testing and debugging from the browser console.
window.__game = { world, renderer };

// Shooting aims at the mouse: screen pixels plus the camera's world offset.
input.aimWorld = () => {
  const cam = computeCamera(world.state, renderer.view.w, renderer.view.h);
  return { x: input.mouse.x + cam.x, y: input.mouse.y + cam.y };
};

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, world.hasSave());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // The title screen's backdrop is a live city with nobody touching the controls.
  const neutralInput = {
    walk() { return { x: 0, y: 0 }; },
    drive() { return 0; },
    steer() { return 0; },
    consume() { return false; },
    consumeClick() { return false; },
    aimWorld() { return null; },
  };

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensure();
    announce('Playing. Find the yellow M marker to start your first mission.');
  }

  function continueGame() {
    if (!world.load()) return;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensure();
    announce('Continuing your saved run.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.setEngine(false, 0);
    audio.setSiren(false, 0);
    announce('Game over. Port Meridian got the better of you.');
  }

  function showWin() {
    screen = SCREEN_WIN;
    world.save();
    audio.setEngine(false, 0);
    audio.setSiren(false, 0);
    announce('You own Port Meridian. All three missions done.');
  }

  function advanceDialogue() {
    const d = world.state.dialogue;
    if (!d) return false;
    d.index += 1;
    if (d.index >= d.lines.length) {
      const after = d.after;
      world.state.dialogue = null;
      if (after) after();
    }
    return true;
  }

  function handleTitleKeys() {
    if (input.consume('Enter') || input.consume('Space') || input.consumeClick()) {
      startNewGame();
      return;
    }
    if (input.consume('KeyC') && world.hasSave()) continueGame();
  }

  function handlePlayKeys() {
    if (input.consume('KeyP') || input.consume('Escape')) {
      screen = SCREEN_PAUSED;
      audio.setEngine(false, 0);
      audio.setSiren(false, 0);
      announce('Paused.');
    }
  }

  function handlePausedKeys() {
    if (input.consume('KeyP') || input.consume('Escape') || input.consume('Enter')) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (input.consume('KeyS')) {
      world.save();
      world.toast('Progress saved', 2);
    } else if (input.consume('KeyQ')) {
      screen = SCREEN_TITLE;
      announce('Port Meridian. Press Enter to start.');
    }
  }

  function handleOverKeys() {
    if (input.consume('Enter') || input.consume('Space') || input.consumeClick()) startNewGame();
  }

  function handleWinKeys() {
    if (input.consume('Enter') || input.consume('Space') || input.consumeClick()) {
      world.state.won = false;
      screen = SCREEN_PLAY;
      announce('Free roam. Port Meridian is yours.');
    }
  }

  function playSounds(events) {
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_OVER) audio.fail();
    for (const ev of world.state.events) {
      if (ev.type === 'enemyShot') audio.enemyShoot();
      else if (ev.type === 'explosion') audio.explosion();
      else if (ev.type === 'cash') audio.cash();
      else if (ev.type === 'missionComplete') {
        audio.jingle();
        world.save();
      } else if (ev.type === 'missionFailed') audio.fail();
      else if (ev.type === 'hurt') audio.hurt();
    }
  }

  function updateAudio() {
    const state = world.state;
    const driving = screen === SCREEN_PLAY && state.player.inCar !== null;
    audio.setEngine(driving, driving ? Math.abs(state.player.speed) / 540 : 0);
    const policeNear = state.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 700);
    audio.setSiren(screen === SCREEN_PLAY && policeNear, state.time);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(neutralInput, STEP);
      return;
    }
    const events = world.step(input, STEP);
    playSounds(events);
    if (events & EVENT_OVER) endGame();
    else if (world.state.won) showWin();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // Dialogue eats the confirm keys before any screen does.
    if (world.state.dialogue && (input.consume('Enter') || input.consume('Space') || input.consumeClick())) {
      advanceDialogue();
    } else if (screen === SCREEN_TITLE) handleTitleKeys();
    else if (screen === SCREEN_PLAY) handlePlayKeys();
    else if (screen === SCREEN_PAUSED) handlePausedKeys();
    else if (screen === SCREEN_OVER) handleOverKeys();
    else if (screen === SCREEN_WIN) handleWinKeys();

    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    updateAudio();
    renderer.draw(world.state, screen, world.hasSave());
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Port Meridian. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
