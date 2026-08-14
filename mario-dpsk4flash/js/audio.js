'use strict';
/* ============================================================
 * 8-bit 音效 + 背景音乐（Web Audio 实时合成，无外部资源）
 * ============================================================ */
const AudioSys = (function () {
  let ctx = null, master = null, muted = false;
  let themeTimer = null, currentTheme = null;

  function ensure() {
    if (typeof window === 'undefined' || !window.AudioContext && !window.webkitAudioContext) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      try { ctx = new AC(); } catch (e) { return false; }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.4;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(freq, dur, type, vol, delay, slide) {
    if (!ctx || muted || !freq) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, vol, delay) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol || 0.2;
    src.connect(g); g.connect(master);
    src.start(t0);
  }

  function sfx(name) {
    if (!ensure()) return;
    switch (name) {
      case 'jump':     tone(220, 0.13, 'square', 0.10, 0, 620); break;
      case 'coin':     tone(988, 0.07, 'square', 0.11); tone(1319, 0.30, 'square', 0.11, 0.07); break;
      case 'stomp':    noise(0.08, 0.16); tone(320, 0.10, 'square', 0.09, 0, 140); break;
      case 'bump':     tone(150, 0.09, 'square', 0.14, 0, 70); break;
      case 'brick':    noise(0.16, 0.22); tone(120, 0.12, 'square', 0.12, 0, 60); break;
      case 'powerup':  [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,0.09,'square',0.11,i*0.07)); break;
      case 'powerdown':[1568,1319,1047,784,659,523,392].forEach((f,i)=>tone(f,0.10,'square',0.10,i*0.07)); break;
      case 'fireball': tone(900, 0.16, 'square', 0.07, 0, 250); break;
      case 'kick':     noise(0.10, 0.20); tone(200, 0.10, 'square', 0.10, 0, 90); break;
      case 'die':      [988,784,659,523,392,262].forEach((f,i)=>tone(f,0.13,'triangle',0.16,i*0.13)); break;
      case 'oneup':    [659,784,988,1319,1047,784,659,1047,1319].forEach((f,i)=>tone(f,0.09,'square',0.11,i*0.08)); break;
      case 'flag':     tone(600, 0.9, 'square', 0.08, 0, 180); break;
      case 'clear':    [523,659,784,1047,784,1047,1319,1568,2093].forEach((f,i)=>tone(f,0.13,'square',0.11,i*0.11)); break;
      case 'pause':    tone(500, 0.05, 'square', 0.10); tone(750, 0.05, 'square', 0.10, 0.06); break;
    }
  }

  const M = m => 440 * Math.pow(2, (m - 69) / 12);

  const THEMES = {
    ground: {
      bpm: 132,
      notes: [
        [76,.5],[76,.5],[76,.5],[0,.5],[72,.25],[76,.25],[79,1],[0,1],
        [74,1.5],[0,.5],
        [72,1],[0,.5],[67,.5],[64,1],[0,.5],
        [69,1],[0,.5],[71,.5],[70,.5],[69,.5],[67,.5],
        [76,.5],[79,.5],[81,.5],[77,.5],[79,.5],[76,.5],[72,.5],[74,.5],
        [71,2],[0,1],
      ],
    },
    star: {
      bpm: 152,
      notes: [
        [72,.25],[76,.25],[79,.25],[84,.25],[79,.25],[76,.25],[72,.25],[76,.25],
        [79,.25],[84,.25],[79,.25],[76,.25],[72,.25],[76,.25],[79,.25],[84,.25],
        [86,.25],[84,.25],[81,.25],[77,.25],[81,.25],[84,.25],[86,.25],[84,.25],
        [81,.25],[77,.25],[74,.25],[77,.25],[81,.25],[86,.25],[81,.25],[77,.25],
      ],
    },
  };

  function playTheme(name) {
    stopTheme();
    if (!ensure() || muted) return;
    const t = THEMES[name];
    if (!t) return;
    currentTheme = name;
    const beat = 60 / t.bpm;
    let t0 = 0, total = 0;
    for (const [m, b] of t.notes) {
      const dur = b * beat;
      if (m) tone(M(m), dur * 0.95, 'square', 0.055, t0, null);
      t0 += dur;
      total += dur;
    }
    themeTimer = setTimeout(() => playTheme(name), total * 1000 - 30);
  }

  function stopTheme() {
    if (themeTimer) { clearTimeout(themeTimer); themeTimer = null; }
    currentTheme = null;
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.4;
    if (muted) stopTheme();
  }
  function isMuted() { return muted; }
  function toggleMute() { setMuted(!muted); return muted; }

  return { sfx, playTheme, stopTheme, setMuted, toggleMute, isMuted, ensure };
})();
