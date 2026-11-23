// Drawing only: the city, the cars, the people, the HUD, the live minimap and
// every menu screen. Flat canvas shapes and system text, nothing fetched.
import {
  CAR_R, PALETTE, PISTOL_MAG, PLAYER_R, ROAD_W, WORLD_H, WORLD_W,
} from './config.js';
import { missionTarget, idleObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = 196;

/** The camera keeps the player centred and never shows past the city's edge. */
export function computeCamera(state, viewW, viewH) {
  const p = state.player;
  let x = p.x - viewW / 2;
  let y = p.y - viewH / 2;
  if (viewW >= WORLD_W) x = (WORLD_W - viewW) / 2;
  else x = Math.max(0, Math.min(WORLD_W - viewW, x));
  if (viewH >= WORLD_H) y = (WORLD_H - viewH) / 2;
  else y = Math.max(0, Math.min(WORLD_H - viewH, y));
  return { x, y };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { w: 1280, h: 720, ratio: 1 };
  const fonts = new Map();

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    view.ratio = ratio;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * ratio);
    canvas.height = Math.round(view.h * ratio);
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawCity(state, cam) {
    const city = state.city;
    context.fillStyle = PALETTE.sidewalk;
    context.fillRect(0, 0, WORLD_W, WORLD_H);
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      for (const tree of park.trees) {
        context.fillStyle = '#2d5a27';
        context.beginPath();
        context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#4d8a3d';
        context.beginPath();
        context.arc(tree.x - 2, tree.y - 2, tree.r * 0.6, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Roads.
    context.fillStyle = PALETTE.asphalt;
    for (const line of city.lines) {
      context.fillRect(line - ROAD_W / 2, 0, ROAD_W, WORLD_H);
      context.fillRect(0, line - ROAD_W / 2, WORLD_W, ROAD_W);
    }
    // Lane dashes.
    context.fillStyle = PALETTE.lane;
    for (const line of city.lines) {
      for (let d = 0; d < WORLD_W; d += 60) {
        context.fillRect(d, line - 2, 28, 4);
        context.fillRect(line - 2, d, 4, 28);
      }
    }
    // Buildings with roofs and windows.
    for (const b of city.buildings) {
      context.fillStyle = b.roof;
      context.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(255, 240, 180, 0.5)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx * 7 + cy * 3 + b.windows) % 4 === 0) continue;
          context.fillRect(b.x + 8 + cx * 26, b.y + 8 + cy * 26, 12, 14);
        }
      }
    }
    // City border water on the east edge: the harbour.
    context.fillStyle = PALETTE.water;
    context.fillRect(WORLD_W - 40, 0, 40, WORLD_H);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 0; y < WORLD_H; y += 90) {
      context.fillRect(WORLD_W - 34, y + ((state.time * 20) % 90), 26, 3);
    }
  }

  function drawCar(car, isPlayer, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const w = 44;
    const h = 22;
    if (car.kind === 'police') {
      context.fillStyle = '#f5f5f5';
      roundRect(-w / 2, -h / 2, w, h, 6);
      context.fill();
      context.fillStyle = '#1a1a1a';
      context.fillRect(-6, -h / 2, 12, h);
      // Flashing light bar.
      const phase = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = phase ? '#ff2d2d' : '#2d7dff';
      context.fillRect(-8, -h / 2 - 4, 8, 5);
      context.fillStyle = phase ? '#2d7dff' : '#ff2d2d';
      context.fillRect(0, -h / 2 - 4, 8, 5);
      context.fillStyle = '#111111';
      text('PD', -w / 2 + 4, 4, 10, '#111111', 'left', 'bold');
    } else {
      context.fillStyle = car.color;
      roundRect(-w / 2, -h / 2, w, h, 6);
      context.fill();
      context.fillStyle = 'rgba(20, 30, 40, 0.85)';
      roundRect(-8, -h / 2 + 3, 14, h - 6, 3);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(w / 2 - 8, -h / 2 + 3, 4, h - 6);
    }
    if (isPlayer) {
      context.strokeStyle = '#ffd76a';
      context.lineWidth = 2.5;
      roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 8);
      context.stroke();
    }
    // Damage smoke.
    if (car.hp < 45 && !car.dead) {
      context.fillStyle = 'rgba(120,120,120,0.7)';
      context.beginPath();
      context.arc(-w / 2 + 4, 0, 6 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, color, label) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath();
    context.arc(2, 2, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#222222';
    context.fillRect(8, -2, 8, 4);
    context.restore();
    if (label) {
      text(label, x, y - 16, 12, '#ffffff', 'center', 'bold');
    }
  }

  function drawMarker(state) {
    const target = missionTarget(state);
    if (!target) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    context.save();
    context.strokeStyle = '#ffd76a';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255, 215, 106, 0.25)';
    context.beginPath();
    context.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    context.fill();
    // Beacon column.
    context.fillStyle = 'rgba(255, 215, 106, 0.18)';
    context.fillRect(target.x - 4, target.y - 260, 8, 260);
    text(target.label, target.x, target.y - 46, 16, '#ffd76a', 'center', 'bold');
    context.restore();
    // Off-screen direction arrow at the screen edge.
    const cam = computeCamera(state, view.w, view.h);
    if (target.x < cam.x || target.x > cam.x + view.w || target.y < cam.y || target.y > cam.y + view.h) {
      const cx = Math.max(60, Math.min(view.w - 60, target.x - cam.x));
      const cy = Math.max(60, Math.min(view.h - 60, target.y - cam.y));
      const dist = Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y));
      context.save();
      context.translate(cx, cy);
      context.rotate(Math.atan2(target.y - state.player.y, target.x - state.player.x));
      context.fillStyle = '#ffd76a';
      context.beginPath();
      context.moveTo(16, 0);
      context.lineTo(-10, -10);
      context.lineTo(-10, 10);
      context.closePath();
      context.fill();
      context.restore();
      text(`${target.label} · ${dist}m`, cx, cy + 30, 13, '#ffd76a', 'center', 'bold');
    }
  }

  function drawWorld(state) {
    const cam = computeCamera(state, view.w, view.h);
    context.save();
    context.translate(-cam.x, -cam.y);
    drawCity(state, cam);
    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob * 3) * 2;
      context.fillStyle = pk.kind === 'health' ? '#2ecc71' : pk.kind === 'ammo' ? '#f39c12' : '#ffd76a';
      context.beginPath();
      context.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.stroke();
      text(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + bob + 4, 12, '#ffffff', 'center', 'bold');
    }
    drawMarker(state);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color);
    for (const enemy of state.enemies) {
      if (!enemy.dead) drawPerson(enemy.x, enemy.y, enemy.angle, enemy.color, '!');
    }
    const playerCarId = state.player.inCar;
    for (const car of state.cars) {
      if (!car.dead) drawCar(car, car.id === playerCarId, state.time);
    }
    // The player on foot.
    if (state.player.inCar === null) {
      const p = state.player;
      const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
      if (!blink) {
        drawPerson(p.x, p.y, p.angle, '#27ae60');
        // Aim line.
        context.strokeStyle = 'rgba(255,255,255,0.5)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
        context.lineTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
        context.stroke();
      }
    }
    // Bullets and particles.
    for (const b of state.bullets) {
      context.fillStyle = '#ffe27a';
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.restore();
  }

  function drawMinimap(state) {
    const size = MINIMAP;
    const x0 = view.w - size - 16;
    const y0 = 16;
    const scale = size / WORLD_W;
    context.save();
    context.fillStyle = 'rgba(10, 14, 20, 0.85)';
    roundRect(x0 - 4, y0 - 4, size + 8, size + 8, 8);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 1.5;
    context.stroke();
    context.beginPath();
    context.rect(x0, y0, size, size);
    context.clip();
    context.fillStyle = '#7a7a70';
    context.fillRect(x0, y0, size, size);
    context.fillStyle = '#3a3a42';
    for (const line of state.city.lines) {
      context.fillRect(x0 + (line - ROAD_W / 2) * scale, y0, ROAD_W * scale, size);
      context.fillRect(x0, y0 + (line - ROAD_W / 2) * scale, size, ROAD_W * scale);
    }
    context.fillStyle = '#4a4a48';
    for (const b of state.city.buildings) {
      context.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    }
    context.fillStyle = '#2e6b34';
    for (const park of state.city.parks) {
      context.fillRect(x0 + park.x * scale, y0 + park.y * scale, park.w * scale, park.h * scale);
    }
    context.fillStyle = '#3f6f8e';
    context.fillRect(x0 + (WORLD_W - 40) * scale, y0, 40 * scale, size);
    const target = missionTarget(state);
    if (target) {
      const pulse = 3 + Math.sin(state.time * 4) * 1.5;
      context.fillStyle = '#ffd76a';
      context.beginPath();
      context.arc(x0 + target.x * scale, y0 + target.y * scale, pulse + 2, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.dead) continue;
      if (car.kind === 'police') {
        context.fillStyle = '#2d7dff';
        context.beginPath();
        context.arc(x0 + car.x * scale, y0 + car.y * scale, 3.5, 0, Math.PI * 2);
        context.fill();
      } else if (car.id === state.player.inCar) {
        context.fillStyle = '#ffd76a';
        context.beginPath();
        context.arc(x0 + car.x * scale, y0 + car.y * scale, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      context.fillStyle = '#ff2d2d';
      context.beginPath();
      context.arc(x0 + enemy.x * scale, y0 + enemy.y * scale, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Player arrow.
    const px = x0 + state.player.x * scale;
    const py = y0 + state.player.y * scale;
    context.save();
    context.translate(px, py);
    context.rotate(state.player.angle);
    context.fillStyle = '#2ecc71';
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('PORT MERIDIAN', x0 + size / 2, y0 + size + 20, 11, 'rgba(255,255,255,0.75)', 'center', 'bold');
  }

  function drawHud(state) {
    // Top-left status panel.
    context.fillStyle = 'rgba(10, 14, 20, 0.72)';
    roundRect(14, 14, 268, 108, 10);
    context.fill();
    // Health bar.
    context.fillStyle = '#222222';
    roundRect(28, 28, 180, 16, 5);
    context.fill();
    const hpFrac = Math.max(0, state.health / 100);
    context.fillStyle = hpFrac > 0.5 ? '#2ecc71' : hpFrac > 0.25 ? '#f39c12' : '#e74c3c';
    roundRect(28, 28, 180 * hpFrac, 16, 5);
    context.fill();
    text(`HP ${Math.ceil(state.health)}`, 216, 41, 13, '#ffffff', 'left', 'bold');
    text(`$${state.cash.toLocaleString('en-US')}`, 28, 74, 24, '#2ecc71', 'left', 'bold');
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, 28, 104, 22, '#ffd76a', 'left');
    text(`AMMO ${state.ammo}/${state.reserveAmmo}`, 150, 104, 14, '#ffffff', 'left', 'bold');
    // Objective bar, bottom left.
    const objective = state.objective || idleObjective(state);
    context.fillStyle = 'rgba(10, 14, 20, 0.72)';
    const objW = Math.min(view.w - 32, 560);
    roundRect(14, view.h - 64, objW, 50, 10);
    context.fill();
    context.fillStyle = '#ffd76a';
    context.fillRect(14, view.h - 64, 5, 50);
    text('OBJECTIVE', 30, view.h - 44, 11, '#ffd76a', 'left', 'bold');
    text(objective, 30, view.h - 24, 15, '#ffffff', 'left');
    // Speed, bottom centre, while driving.
    if (state.player.inCar !== null) {
      const mph = Math.round(Math.abs(state.player.speed) * 0.16);
      text(`${mph}`, view.w / 2, view.h - 30, 44, '#ffffff', 'center', 'bold');
      text('MPH', view.w / 2, view.h - 8, 12, 'rgba(255,255,255,0.7)', 'center', 'bold');
    }
    // Toast message.
    if (state.message && state.time < state.messageUntil) {
      text(state.message, view.w / 2, 90, 20, '#ffd76a', 'center', 'bold');
    }
    drawMinimap(state);
    // Controls hint, bottom right.
    text('WASD move/drive · E enter car · Click shoot · F melee · R reload · P pause', view.w - 18, view.h - 14, 12, 'rgba(255,255,255,0.55)', 'right');
  }

  function drawDialogue(state) {
    const d = state.dialogue;
    if (!d) return;
    const w = Math.min(view.w - 60, 760);
    const x = (view.w - w) / 2;
    const y = view.h - 190;
    context.fillStyle = 'rgba(8, 10, 16, 0.92)';
    roundRect(x, y, w, 130, 12);
    context.fill();
    context.strokeStyle = '#ffd76a';
    context.lineWidth = 2;
    roundRect(x, y, w, 130, 12);
    context.stroke();
    const line = d.lines[d.index];
    // Wrap the line to the box.
    const words = line.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      context.font = `16px ${FONT}`;
      if (context.measureText(test).width > w - 48 && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    lines.forEach((ln, i) => {
      text(ln, x + 24, y + 38 + i * 22, 16, '#ffffff', 'left');
    });
    text(d.index + 1 < d.lines.length ? 'Enter ▸' : 'Enter — start', x + w - 24, y + 112, 13, '#ffd76a', 'right', 'bold');
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = Math.min(view.w - 40, 680);
    const lineH = 30;
    const h = 150 + lines.length * lineH + 70;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2;
    context.fillStyle = 'rgba(8, 10, 16, 0.88)';
    roundRect(x, y, w, h, 14);
    context.fill();
    context.strokeStyle = accent || '#ffd76a';
    context.lineWidth = 2;
    roundRect(x, y, w, h, 14);
    context.stroke();
    text(title, view.w / 2, y + 72, 46, '#ffffff', 'center', 'bold');
    lines.forEach((ln, i) => {
      text(ln, view.w / 2, y + 128 + i * lineH, 18, 'rgba(255,255,255,0.85)', 'center');
    });
    text(prompt, view.w / 2, y + h - 32, 18, '#ffd76a', 'center', 'bold');
  }

  function drawTitle(state, saveExists) {
    drawWorld(state);
    context.fillStyle = 'rgba(8, 10, 16, 0.55)';
    context.fillRect(0, 0, view.w, view.h);
    text('PORT MERIDIAN', view.w / 2, view.h * 0.3, 72, '#ffffff', 'center', 'bold');
    text('An open-world crime story — a city of your own', view.w / 2, view.h * 0.3 + 44, 20, '#ffd76a', 'center');
    const lines = [
      'Steal cars. Outrun the police. Run three story missions.',
      'WASD move and drive · E enter / exit a car · Click to shoot',
      'F melee · R reload · P pause · progress saves to this browser',
    ];
    lines.forEach((ln, i) => {
      text(ln, view.w / 2, view.h * 0.52 + i * 30, 18, 'rgba(255,255,255,0.9)', 'center');
    });
    const prompt = saveExists
      ? 'Press Enter to start a new game · Press C to continue your saved run'
      : 'Press Enter or click to start';
    text(prompt, view.w / 2, view.h * 0.52 + 3 * 30 + 26, 20, '#ffd76a', 'center', 'bold');
    text('A completely original game. No part of it comes from any other game.', view.w / 2, view.h - 24, 13, 'rgba(255,255,255,0.55)', 'center');
  }

  function draw(state, screen, saveExists) {
    context.setTransform(view.ratio, 0, 0, view.ratio, 0, 0);
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, view.w, view.h);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, saveExists);
      return;
    }
    drawWorld(state);
    drawHud(state);
    drawDialogue(state);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(8, 10, 16, 0.6)';
      context.fillRect(0, 0, view.w, view.h);
      drawPanel('Paused', [
        `Cash $${state.cash.toLocaleString('en-US')} · Missions done: ${state.missionsDone.filter(Boolean).length}/3`,
        'Your progress saves when a mission ends — and right now, with S.',
      ], 'Press P to resume · S save · Q quit to title');
    } else if (screen === SCREEN_OVER) {
      context.fillStyle = 'rgba(8, 10, 16, 0.6)';
      context.fillRect(0, 0, view.w, view.h);
      drawPanel('GAME OVER', [
        'Port Meridian got the better of you this time.',
        `Cash $${state.cash.toLocaleString('en-US')} · Cars stolen ${state.stats.carsStolen} · Takedowns ${state.stats.kills}`,
        `Missions finished: ${state.missionsDone.filter(Boolean).length}/3`,
      ], 'Press Enter to try again');
    } else if (screen === SCREEN_WIN) {
      context.fillStyle = 'rgba(8, 10, 16, 0.55)';
      context.fillRect(0, 0, view.w, view.h);
      drawPanel('PORT MERIDIAN IS YOURS', [
        'All three missions done. The streets, the docks, the whole city — yours.',
        `Final cash $${state.cash.toLocaleString('en-US')} · Cars stolen ${state.stats.carsStolen} · Takedowns ${state.stats.kills}`,
        'Thank you for playing. Free roam stays open — keep driving.',
      ], 'Press Enter to keep playing', '#2ecc71');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view, computeCamera };
}
