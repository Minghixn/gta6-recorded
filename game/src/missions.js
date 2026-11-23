// Port Meridian's three story missions: a getaway drive, a hot delivery under
// police attention, and a turf takeover. Each mission is a small state machine
// with dialogue, an objective, a target marker and a cash reward.
import { MISSION_REWARDS } from './config.js';
import { spawnGang } from './entities.js';

export const MISSION_DEFS = [
  {
    id: 0,
    name: 'The Getaway',
    giver: 'Rosa Vega',
    reward: MISSION_REWARDS[0],
    start: { x: 750, y: 690, label: 'M1' },
    intro: [
      "Rosa Vega: 'Kid, my crew just lifted a haul from the Meridian Docks — and the harbour patrol is already on the move.'",
      "Rosa Vega: 'I need a driver. Steal any car on the street, then get to the docks before they lock the gates.'",
      "Rosa Vega: 'Drive like the whole city is watching. Because it is.'",
    ],
    outro: [
      "Rosa Vega: 'Clean run. The crew is safe, the haul is ours.'",
      "Rosa Vega: 'You drive like you were born in this city, kid. There is more work where that came from.'",
    ],
  },
  {
    id: 1,
    name: 'Hot Package',
    giver: 'Dante Cole',
    reward: MISSION_REWARDS[1],
    start: { x: 1050, y: 810, label: 'M2' },
    intro: [
      "Dante Cole: 'Listen close. A package is waiting at the old depot — and it is very, very hot.'",
      "Dante Cole: 'Pick it up, run it to the west-side drop, then the south-side drop. The police will be sniffing around.'",
      "Dante Cole: 'Do not stop. Do not get caught. Do not open the package.'",
    ],
    outro: [
      "Dante Cole: 'Both drops made. You are cooler under pressure than half my crew.'",
      "Dante Cole: 'The money is yours. Spend it somewhere the cameras cannot see.'",
    ],
  },
  {
    id: 2,
    name: 'Turf War',
    giver: 'Rosa Vega',
    reward: MISSION_REWARDS[2],
    start: { x: 450, y: 1110, label: 'M3' },
    intro: [
      "Rosa Vega: 'The Harbor Rats have been pushing into our streets all week. Tonight it ends.'",
      "Rosa Vega: 'Go to their corner on the east side and take the turf back. All six of them. No half measures.'",
      "Rosa Vega: 'Come back standing, and Port Meridian is ours.'",
    ],
    outro: [
      "Rosa Vega: 'It is done. The Rats are gone and the streets are ours.'",
      "Rosa Vega: 'Port Meridian belongs to you now, kid. Every corner, every road, every sunrise.'",
    ],
  },
];

/** The next mission the player has not finished, or null when all are done. */
export function nextMissionDef(state) {
  for (const def of MISSION_DEFS) if (!state.missionsDone[def.id]) return def;
  return null;
}

/** The yellow start pad for the next mission, so the player always knows where to go. */
export function missionStartPad(state) {
  const def = nextMissionDef(state);
  return def ? def.start : null;
}

function setObjective(state, text) {
  state.objective = text;
}

/** Begin a mission: play its intro dialogue, then arm stage 0. */
export function startMission(state, def) {
  state.mission = { def, stage: 0, timer: 0, target: null, kills: 0, needed: 0 };
  state.dialogue = {
    lines: def.intro,
    index: 0,
    after: () => { armMissionStage(state); },
  };
  state.events.push({ type: 'missionStart' });
}

function armMissionStage(state) {
  const m = state.mission;
  if (!m) return;
  if (m.def.id === 0) {
    setObjective(state, 'Steal a car — press E next to any car on the street');
  } else if (m.def.id === 1) {
    m.target = { x: 1350, y: 1650, label: 'Pickup' };
    setObjective(state, 'Pick up the package at the old depot');
  } else {
    m.target = { x: 1950, y: 1950, label: 'Rival turf' };
    setObjective(state, 'Get to the Harbor Rats corner on the east side');
  }
}

function completeMission(state) {
  const m = state.mission;
  if (!m) return;
  state.cash += m.def.reward;
  state.missionsDone[m.def.id] = true;
  state.events.push({ type: 'missionComplete', reward: m.def.reward });
  state.dialogue = {
    lines: m.def.outro,
    index: 0,
    after: () => {
      if (state.missionsDone.every(Boolean)) state.won = true;
      setObjective(state, nextMissionDef(state)
        ? `Free roam — find the yellow ${nextMissionDef(state).start.label} marker to start: ${nextMissionDef(state).name}`
        : 'Port Meridian is yours.');
    },
  };
  state.mission = null;
  setObjective(state, 'Mission complete!');
}

function failMission(state, reason) {
  state.mission = null;
  state.events.push({ type: 'missionFailed', reason });
  setObjective(state, `Mission failed — ${reason}. Find the yellow M marker to retry.`);
}

function playerAt(state, target, radius) {
  return Math.hypot(state.player.x - target.x, state.player.y - target.y) < radius;
}

/** Advance the active mission one step: stages, timers, arrivals, kills. */
export function updateMissions(state, dt, rng) {
  const m = state.mission;
  if (!m || state.dialogue) return;
  const p = state.player;

  if (m.def.id === 0) {
    if (m.stage === 0) {
      if (p.inCar !== null) {
        m.stage = 1;
        m.timer = 90;
        m.target = { x: 2250, y: 1050, label: 'Meridian Docks' };
        state.wanted = Math.max(state.wanted, 2);
        state.lastCrimeT = state.time;
        setObjective(state, 'Get to the Meridian Docks — the harbour patrol is closing in!');
        state.events.push({ type: 'toast', text: 'Wanted level 2 — lose the patrol!' });
      }
    } else if (m.stage === 1) {
      m.timer -= dt;
      setObjective(state, `Get to the Meridian Docks — ${Math.max(0, Math.ceil(m.timer))}s left`);
      if (playerAt(state, m.target, 75)) completeMission(state);
      else if (m.timer <= 0) failMission(state, 'you ran out of time');
    }
    return;
  }

  if (m.def.id === 1) {
    if (m.stage === 0) {
      if (playerAt(state, m.target, 65)) {
        m.stage = 1;
        m.target = { x: 1950, y: 450, label: 'West drop' };
        state.wanted = Math.max(state.wanted, 1);
        state.lastCrimeT = state.time;
        setObjective(state, 'Package secured — deliver it to the west-side drop');
        state.events.push({ type: 'toast', text: 'Package picked up — the police are watching!' });
      }
    } else if (m.stage === 1) {
      if (playerAt(state, m.target, 65)) {
        m.stage = 2;
        m.target = { x: 450, y: 2250, label: 'South drop' };
        setObjective(state, 'First drop made — now the south-side drop');
      }
    } else if (m.stage === 2) {
      if (playerAt(state, m.target, 65)) completeMission(state);
    }
    return;
  }

  // Mission 3: turf war.
  if (m.stage === 0) {
    if (playerAt(state, m.target, 80)) {
      m.stage = 1;
      m.needed = 6;
      m.kills = 0;
      spawnGang(state, rng, m.target.x, m.target.y, 6);
      setObjective(state, 'Take out the Harbor Rats — 0/6 down');
      state.events.push({ type: 'toast', text: 'The Harbor Rats are here — fight!' });
    }
  } else if (m.stage === 1) {
    const down = 6 - state.enemies.filter((e) => !e.dead).length;
    setObjective(state, `Take out the Harbor Rats — ${down}/6 down`);
    if (state.enemies.filter((e) => !e.dead).length === 0) completeMission(state);
  }
}

/** The marker the HUD and the minimap should point at right now. */
export function missionTarget(state) {
  if (state.mission && state.mission.target) return state.mission.target;
  const pad = missionStartPad(state);
  return pad ? { x: pad.x, y: pad.y, label: pad.label } : null;
}

/** The objective line the HUD shows when no mission is running. */
export function idleObjective(state) {
  const def = nextMissionDef(state);
  if (!def) return 'Port Meridian is yours.';
  return `Free roam — find the yellow ${def.start.label} marker to start: ${def.name}`;
}
