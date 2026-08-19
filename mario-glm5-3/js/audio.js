'use strict';
/* ============================================================
 * audio.js — Web Audio 音效与音乐（全部合成，无外部资源）
 * ============================================================ */
const Sound = (() => {

  let ctx = null, master = null, muted = false;
  let musicTimer = null;

  // ---------- 初始化（首次用户交互时） ----------
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  // ---------- 音名 -> 频率 ----------
  const NOTE_RE = /^([A-G])(b|#)?(-?\d)$/;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(note) {
    const m = NOTE_RE.exec(note);
    if (!m) return 0;
    let s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const oct = parseInt(m[3], 10);
    const n = s + (oct + 1) * 12;    // MIDI 号
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  // ---------- 基础发声 ----------
  function tone(type, f0, f1, t0, dur, vol, decay) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    if (decay) g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    else g.gain.setValueAtTime(vol, t0 + dur - 0.005), g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
  }

  function noise(t0, dur, vol, fMax) {
    if (!ctx) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, Math.max(1, n), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(fMax || 3000, t0);
    f.frequency.exponentialRampToValueAtTime(200, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur);
  }

  const now = () => (ctx ? ctx.currentTime : 0);

  // ---------- 音效 ----------
  const sfx = {
    jump()      { if (!ensure()) return; const t = now(); tone('square', 210, 760, t, 0.22, 0.16, false); },
    jumpBig()   { if (!ensure()) return; const t = now(); tone('square', 180, 660, t, 0.26, 0.16, false); },
    stomp()     { if (!ensure()) return; const t = now(); tone('square', 350, 90, t, 0.14, 0.2, true); noise(t, 0.08, 0.12, 1200); },
    kick()      { if (!ensure()) return; const t = now(); tone('square', 500, 160, t, 0.09, 0.2, true); },
    bump()      { if (!ensure()) return; const t = now(); tone('square', 120, 70, t, 0.09, 0.22, true); },
    brick()     { if (!ensure()) return; const t = now(); noise(t, 0.25, 0.3, 2600); tone('square', 260, 60, t, 0.18, 0.16, true); },
    coin()      { if (!ensure()) return; const t = now(); tone('square', freq('B5'), 0, t, 0.09, 0.18, false); tone('square', freq('E6'), 0, t + 0.09, 0.5, 0.18, true); },
    fireball()  { if (!ensure()) return; const t = now(); noise(t, 0.12, 0.18, 900); tone('square', 880, 220, t, 0.1, 0.1, true); },
    appear()    { if (!ensure()) return; const t = now(); ['C5','E5','G5','C6'].forEach((n, i) => tone('square', freq(n), 0, t + i * 0.035, 0.05, 0.14, false)); },
    powerup()   { if (!ensure()) return; const t = now();
                  const seq = ['C4','G4','C5','G4','D5','A4','D5','A4','E5','B4','E5','B4','F5','C5','F5','C5','G5','D5','G5','D5','C6'];
                  seq.forEach((n, i) => tone('square', freq(n), 0, t + i * 0.036, 0.05, 0.15, false)); },
    shrink()    { if (!ensure()) return; const t = now(); tone('square', freq('C5'), freq('C4'), t, 0.35, 0.18, true); tone('square', freq('G4'), freq('G3'), t + 0.04, 0.3, 0.12, true); },
    oneup()     { if (!ensure()) return; const t = now(); ['E5','G5','E6','C6','D6','G6'].forEach((n, i) => tone('square', freq(n), 0, t + i * 0.09, 0.1, 0.15, false)); },
    flagpole()  { if (!ensure()) return; const t = now(); for (let i = 0; i < 10; i++) tone('square', freq('G5') * Math.pow(0.944, i), 0, t + i * 0.055, 0.06, 0.14, false); },
    pause()     { if (!ensure()) return; const t = now(); tone('square', freq('E6'), 0, t, 0.07, 0.15, false); tone('square', freq('C6'), 0, t + 0.09, 0.07, 0.15, false); tone('square', freq('E6'), 0, t + 0.18, 0.07, 0.15, false); },
    warning()   { if (!ensure()) return; const t = now(); for (let i = 0; i < 3; i++) tone('square', freq('E6'), 0, t + i * 0.18, 0.1, 0.16, false); },
  };

  // ---------- 音乐序列器 ----------
  // 音符格式: [音名或null(休止), 时长(以步为单位)]
  function N(str) { return str.split(' ').map(s => { const [n, d] = s.split(/[:x]/); return [n === '.' ? null : n, d ? +d : 1]; }); }

  const SONGS = {
    over: {
      step: 0.152, loop: true,
      lead: [].concat(
        N('E5 E5 .:1 E5 .:1 C5 E5 .:1 G5 .:3 G4 .:3'),
        // A 段 ×2
        N('C5 .:1 G4 .:1 E4 .:1 A4 .:1 B4 .:1 Bb4 A4 .:1'),
        N('G4 E5 G5 A5 .:1 F5 G5 .:1 E5 .:1 C5 D5 B4 .:2'),
        N('C5 .:1 G4 .:1 E4 .:1 A4 .:1 B4 .:1 Bb4 A4 .:1'),
        N('G4 E5 G5 A5 .:1 F5 G5 .:1 E5 .:1 C5 D5 B4 .:2'),
        // B 段
        N('.:3 G5 F#5 F5 D#5 .:1 E5 .:1 G#4 A4 C5 .:1 A4 C5 D5 .:3'),
        N('.:3 G5 F#5 F5 D#5 .:1 E5 .:1 C6 .:1 C6 C6 .:4'),
        N('.:3 G5 F#5 F5 D#5 .:1 E5 .:1 G#4 A4 C5 .:1 A4 C5 D5 .:3'),
        N('.:3 Eb5 .:3 D5 .:3 C5 .:6')
      ),
      bass: [].concat(
        N('D3 D3 .:1 D3 .:1 D3 D3 .:1 G3 .:3 G2 .:3'),
        N('C3 .:1 G2 .:1 E2 .:1 F2 .:1 G2 .:1 Gb2 F2 .:1'),
        N('E2 C3 E3 F3 .:1 D3 E3 .:1 C3 .:1 A2 B2 G2 .:2'),
        N('C3 .:1 G2 .:1 E2 .:1 F2 .:1 G2 .:1 Gb2 F2 .:1'),
        N('E2 C3 E3 F3 .:1 D3 E3 .:1 C3 .:1 A2 B2 G2 .:2'),
        N('.:3 D3 D3 D3 .:1 C3 .:1 C3 C3 C3 .:1 C3 C3 C3 .:3'),
        N('.:3 D3 D3 D3 .:1 C3 .:1 C3 .:1 C3 C3 .:4'),
        N('.:3 D3 D3 D3 .:1 C3 .:1 C3 C3 C3 .:1 C3 C3 C3 .:3'),
        N('.:3 Ab2 .:3 Bb2 .:3 C3 .:6')
      ),
    },
    underground: {
      step: 0.16, loop: true,
      lead: [].concat(
        N('C4 C5 A3 A4 Bb3 Bb4 .:2'),
        N('C4 C5 A3 A4 Bb3 Bb4 .:2'),
        N('F3 F4 D3 D4 Eb3 Eb4 .:2'),
        N('F3 F4 D3 D4 Eb3 Eb4 .:2'),
        N('G3 G4 E3 E4 F3 F4 .:2'),
        N('G3 G4 E3 E4 F3 F4 .:2'),
        N('Ab3 Ab4 F3 F4 Gb3 Gb4 .:2'),
        N('Ab3 Ab4 F3 F4 Gb3 Gb4 .:2'),
        N('C4 C5 A3 A4 Bb3 Bb4 .:2'),
        N('C4 C5 A3 A4 Bb3 Bb4 .:2'),
        N('F3 F4 D3 D4 Eb3 Eb4 .:2'),
        N('F3 F4 D3 D4 Eb3 Eb4 .:2'),
        N('G3 G4 E3 E4 F3 F4 .:2'),
        N('Ab3 Ab4 F3 F4 Gb3 Gb4 .:2'),
        N('C4 C5 A3 A4 Bb3 Bb4 .:2'),
        N('C4 C5 A3 A4 Bb3 Bb4 .:4')
      ),
      bass: [].concat(
        N('.:8'), N('.:8'), N('.:8'), N('.:8'),
        N('.:8'), N('.:8'), N('.:8'), N('.:8'),
        N('.:8'), N('.:8'), N('.:8'), N('.:8'),
        N('.:8'), N('.:8'), N('.:8'), N('.:8')
      ),
    },
    star: {
      step: 0.085, loop: true,
      lead: [].concat(
        N('C5 C5 C5 G4 G4 G4 E5 E5 E5 C5 C5 C5 F5 F5 F5 C5 C5 C5'),
        N('G5 G5 G5 D5 D5 D5 F5 F5 F5 D5 D5 D5 G5 G5 G5 B5 B5 B5')
      ),
      bass: [].concat(
        N('C3 C3 C3 C3 C3 C3 C3 C3 C3 C3 C3 C3 F3 F3 F3 F3 F3 F3'),
        N('G3 G3 G3 G3 G3 G3 B3 B3 B3 B3 B3 B3 G3 G3 G3 D3 D3 D3')
      ),
    },
  };

  // 一次性小曲（覆盖当前音乐）
  const JINGLES = {
    die:    { step: 0.17, lead: N('B4 .:1 F5 .:2 F5 F5 E5 D5 C5 .:1 E4 .:1 E4 .:1 C4 .:2'), bass: [] },
    clear:  { step: 0.095, lead: N('G3 C4 E4 G4 C5 E5 G5 .:4 Ab3 C4 Eb4 Ab4 C5 Eb5 Ab5 .:4 Bb3 D4 F4 Bb4 D5 F5 Bb5 .:4 C4 .:12'), bass: [] },
    gameover: { step: 0.17, lead: N('C5 .:2 G4 .:2 E4 .:2 A4 B4 A4 Ab4 Bb4 Ab4 .:2 G4 F4 G4 .:4'), bass: [] },
    win:    { step: 0.12, lead: N('C5 E5 G5 C6 E6 G6 .:2 E6 G6 C7 .:8'), bass: [] },
  };

  // ---------- 播放状态 ----------
  let cur = null;         // {song, leadIdx, bassIdx, leadT, bassT, step, speed}
  let jingleUntil = 0;
  let pending = [];

  function playNote(ch, note, t, step) {
    const dur = note[1] * step;
    if (note[0]) {
      const type = ch === 'lead' ? 'square' : 'triangle';
      const vol = ch === 'lead' ? 0.10 : 0.12;
      const o = tone(type, freq(note[0]), 0, t, Math.max(0.05, dur * 0.92), vol, true);
      if (o) pending.push({ o, at: t });
    }
    return dur;
  }

  function totalLen(arr) { let s = 0; for (const n of arr) s += n[1]; return s; }

  function schedule() {
    if (!ctx || !cur) return;
    const horizon = now() + 0.18;
    while (cur.leadT < horizon) {
      const step = cur.step / cur.speed;
      const song = cur.song;
      const n = song.lead[cur.leadIdx % song.lead.length];
      cur.leadT += Math.max(0.03, playNote('lead', n, cur.leadT, step));
      cur.leadIdx++;
      if (!song.loop && cur.leadIdx >= song.lead.length) { cur.leadDone = true; break; }
    }
    while (cur.bassT < horizon) {
      const step = cur.step / cur.speed;
      const song = cur.song;
      const n = song.bass[cur.bassIdx % song.bass.length];
      cur.bassT += Math.max(0.03, playNote('bass', n, cur.bassT, step));
      cur.bassIdx++;
      if (!song.loop && cur.bassIdx >= song.bass.length) break;
    }
    // 清理已结束的音源引用
    pending = pending.filter(p => p.at > now() - 5);
  }

  function startMusic(name, speed) {
    if (!ensure()) return;
    stopMusic();
    const song = SONGS[name];
    if (!song) return;
    cur = { song, leadIdx: 0, bassIdx: 0, leadT: now() + 0.05, bassT: now() + 0.05, step: song.step, speed: speed || 1 };
    if (!musicTimer) musicTimer = setInterval(() => { if (cur && !pausedFlag) schedule(); }, 40);
  }

  function setSpeed(sp) { if (cur) cur.speed = sp; }

  function stopMusic() {
    if (cur) { cur = null; }
    pending.forEach(p => { try { p.o.stop(); } catch (e) {} });
    pending = [];
  }

  function playJingle(name, onDone) {
    if (!ensure()) { if (onDone) onDone(); return; }
    stopMusic();
    const j = JINGLES[name];
    if (!j) { if (onDone) onDone(); return; }
    let t = now() + 0.05;
    for (const n of j.lead) {
      const d = n[1] * j.step;
      if (n[0]) tone('square', freq(n[0]), 0, t, Math.max(0.05, d * 0.9), 0.12, true);
      t += d;
    }
    if (onDone) setTimeout(onDone, (t - now()) * 1000);
  }

  let pausedFlag = false;
  function setPaused(p) {
    pausedFlag = p;
    if (!p && ctx && cur) { cur.leadT = cur.bassT = now() + 0.05; }
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 1;
    return muted;
  }

  return { ensure, sfx, startMusic, stopMusic, setSpeed, playJingle, toggleMute, setPaused, get muted() { return muted; } };
})();
