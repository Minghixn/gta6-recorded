// Synthesized sound only: engine hum, police sirens, gunshots and jingles,
// all built from oscillators and a noise buffer. No audio files anywhere.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* sound is decoration, never fatal */ }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure()) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 3000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
      src.stop(ctx.currentTime + dur + 0.02);
    } catch { /* sound is decoration, never fatal */ }
  }

  return {
    ensure,
    /** speed01 is 0..1; on=false silences the engine. */
    setEngine(on, speed01) {
      if (!ctx) return;
      try {
        engineGain.gain.setTargetAtTime(on ? 0.045 + speed01 * 0.05 : 0, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
        engineOsc2.frequency.setTargetAtTime(26 + speed01 * 60, ctx.currentTime, 0.08);
      } catch { /* ignore */ }
    },
    /** The two-tone wail, toggled by the caller on a timer. */
    setSiren(on, time) {
      if (!ctx) return;
      try {
        if (!on) {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          return;
        }
        sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.1);
        if (time - sirenTimer > 0.45) {
          sirenTimer = time;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
        }
      } catch { /* ignore */ }
    },
    shoot() { noiseBurst(0.12, 0.5, 2400); blip(160, 0.08, 'square', 0.12, 60); },
    enemyShoot() { noiseBurst(0.09, 0.22, 1600); },
    hit() { blip(220, 0.12, 'sawtooth', 0.18, 90); },
    hurt() { blip(140, 0.25, 'sawtooth', 0.25, 60); },
    pickup() { blip(660, 0.09, 'sine', 0.22); blip(990, 0.14, 'sine', 0.2); },
    cash() { blip(880, 0.1, 'sine', 0.2); blip(1320, 0.18, 'sine', 0.2); },
    crash() { noiseBurst(0.3, 0.5, 900); },
    explosion() { noiseBurst(0.7, 0.6, 500); blip(70, 0.6, 'sine', 0.3, 30); },
    jingle() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.22, 'triangle', 0.22), i * 130);
      });
    },
    fail() { blip(320, 0.3, 'sawtooth', 0.2, 140); },
  };
}
