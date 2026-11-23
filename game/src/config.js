// Port Meridian tuning: every number the game balances on lives here, so a
// tweak never means hunting through the simulation.
export const STEP = 1 / 60;
export const WORLD_W = 2600;
export const WORLD_H = 2600;
export const ROAD_GAP = 300;
export const ROAD_OFF = 150;
export const ROAD_W = 90;
export const SAVE_KEY = 'port-meridian-save-v1';

export const PLAYER_R = 13;
export const CAR_R = 17;
export const WALK_SPEED = 195;
export const CAR_ACCEL = 470;
export const CAR_MAX_SPEED = 540;
export const CAR_REVERSE_MAX = 200;
export const CAR_BRAKE = 760;
export const CAR_TURN = 2.7;
export const CAR_DRAG = 0.55;

export const PISTOL_MAG = 12;
export const PISTOL_DAMAGE = 1;
export const PISTOL_RANGE = 620;
export const ENEMY_HP = 3;
export const ENEMY_SHOOT_RANGE = 330;
export const PLAYER_MAX_HEALTH = 100;

export const MISSION_REWARDS = [500, 750, 1200];

export const PALETTE = {
  grass: '#4d7a44',
  sidewalk: '#8d8d84',
  asphalt: '#33333a',
  lane: '#d8c95a',
  park: '#3e6b34',
  water: '#3f6f8e',
};

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
  '#16a085', '#d35400', '#7f8c8d', '#b03a5b', '#2c3e50',
];

export const PED_COLORS = [
  '#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c',
  '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9', '#ffeaa7',
];
