// Keyboard and pointer input. Held keys are read every frame; one-shot
// presses (interact, pause, confirm, melee, reload) are queued and taken once,
// so a press between two frames is never lost and never counted twice.
export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, clicked: false, down: false };

  window.addEventListener('keydown', (event) => {
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyR', 'KeyM', 'KeyP', 'Enter', 'Escape'];
    if (!gameKeys.includes(event.code)) return;
    event.preventDefault();
    held.add(event.code);
    if (!event.repeat) pressed.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    held,
    mouse,
    isDown(code) {
      return held.has(code);
    },
    /** True once for a key pressed since the last call; consumes it. */
    consume(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    /** True once for a mouse click since the last call; consumes it. */
    consumeClick() {
      if (!mouse.clicked) return false;
      mouse.clicked = false;
      return true;
    },
    /** -1/0/1 steering from A/D or the arrow keys. */
    steer() {
      const left = held.has('KeyA') || held.has('ArrowLeft');
      const right = held.has('KeyD') || held.has('ArrowRight');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** -1/0/1 drive axis from W/S or the arrow keys. */
    drive() {
      const up = held.has('KeyW') || held.has('ArrowUp');
      const down = held.has('KeyS') || held.has('ArrowDown');
      return (up ? 1 : 0) - (down ? 1 : 0);
    },
    /** -1/0/1 on each axis for walking. */
    walk() {
      const up = held.has('KeyW') || held.has('ArrowUp');
      const down = held.has('KeyS') || held.has('ArrowDown');
      const left = held.has('KeyA') || held.has('ArrowLeft');
      const right = held.has('KeyD') || held.has('ArrowRight');
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },
  };
}
