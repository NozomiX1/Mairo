'use strict';
/* ============================================================
 * audio.js — Web Audio 合成音效 + 8-bit 背景音乐序列器
 * 全部音色由代码实时合成，无外部资源。
 * ============================================================ */
const AudioSys = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* 音名 -> 频率，如 'C#5' */
  function freq(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) return 0;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]
      + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const midi = (parseInt(m[3], 10) + 1) * 12 + base;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* 基础振荡器音（带可选滑音与包络） */
  function tone(o) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.when || 0);
    const dur = o.dur || 0.1;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(Math.max(1, o.from), t0);
    if (o.to && o.to !== o.from) {
      if (o.slide === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(1, o.to), t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.25, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  /* 白噪声（踩扁/碎砖等） */
  function noise(o) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.when || 0);
    const dur = o.dur || 0.2;
    const len = Math.max(1, Math.floor(dur * ctx.sampleRate));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  /* ---------------- 音效表 ---------------- */
  const sfx = {
    jump()    { tone({ from: 330, to: 780, dur: 0.16, vol: 0.2 }); },
    jumpBig() { tone({ from: 250, to: 640, dur: 0.2,  vol: 0.2 }); },
    coin() {
      tone({ from: freq('B5'), dur: 0.07, vol: 0.2 });
      tone({ from: freq('E6'), dur: 0.45, vol: 0.2, when: 0.07 });
    },
    stomp() {
      tone({ from: 420, to: 60, dur: 0.12, vol: 0.3 });
      noise({ dur: 0.08, vol: 0.14, filter: 900 });
    },
    bump()  { tone({ from: 130, to: 80, dur: 0.09, vol: 0.3 }); },
    brick() {
      noise({ dur: 0.25, vol: 0.35, filter: 700 });
      tone({ from: 220, to: 55, dur: 0.2, vol: 0.18 });
    },
    appear() {
      for (let i = 0; i < 8; i++) tone({ from: 220 + i * 95, dur: 0.06, vol: 0.13, when: i * 0.045 });
    },
    powerUp() {
      ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C6', 'E6', 'G6']
        .forEach((n, i) => tone({ from: freq(n), dur: 0.09, vol: 0.16, when: i * 0.058 }));
    },
    shrink() {
      ['C6', 'G5', 'E5', 'C5', 'G4', 'E4', 'C4']
        .forEach((n, i) => tone({ from: freq(n), dur: 0.09, vol: 0.16, when: i * 0.07 }));
    },
    kick() {
      tone({ from: 540, to: 90, dur: 0.09, vol: 0.28 });
      noise({ dur: 0.06, vol: 0.12, filter: 1400 });
    },
    die() {
      ['B4', 'F5', 'F5', 'F5', 'E5', 'D5', 'C5', 'G4', 'E4', 'C4']
        .forEach((n, i) => tone({ from: freq(n), dur: 0.15, vol: 0.2, when: i * 0.13 }));
    },
    flag()  { tone({ from: 1500, to: 180, dur: 0.75, vol: 0.18 }); },
    clear() {
      ['G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G5', 'C7']
        .forEach((n, i) => tone({ from: freq(n), dur: 0.17, vol: 0.17, when: i * 0.12 }));
      tone({ from: freq('E5'), dur: 0.9, vol: 0.14, when: 1.0 });
      tone({ from: freq('C5'), dur: 0.9, vol: 0.14, when: 1.0 });
    },
    tick()  { tone({ from: 1100, dur: 0.03, vol: 0.11 }); },
    oneUp() {
      ['E5', 'G5', 'E6', 'C6', 'D6', 'G6']
        .forEach((n, i) => tone({ from: freq(n), dur: 0.1, vol: 0.18, when: i * 0.09 }));
    },
  };

  function play(name) {
    if (sfx[name]) { ensure(); sfx[name](); }
  }

  /* ---------------- BGM：原创欢快 8-bit 循环 ---------------- */
  const Bgm = (() => {
    const STEP = 0.135;                 // 每步时长(秒)
    const _ = null;
    /* 旋律：64 步（8 小节），C 大调 */
    const mel = [
      'E5', 'G5', 'A5', _, 'G5', 'E5', 'C5', _,
      'D5', 'E5', 'F5', _, 'E5', 'D5', 'C5', _,
      'E5', 'G5', 'A5', _, 'C6', 'B5', 'A5', 'G5',
      'A5', 'G5', 'E5', 'D5', 'C5', _, _, _,

      'F5', 'A5', 'C6', _, 'B5', 'G5', 'E5', _,
      'F5', 'A5', 'C6', _, 'D6', 'C6', 'B5', 'A5',
      'G5', 'B5', 'D6', _, 'C6', 'A5', 'F5', 'D5',
      'E5', 'G5', 'C6', _, 'C5', _, _, _,
    ];
    const bass = [
      'C3', _, 'G2', _, 'C3', _, 'G2', _,
      'D3', _, 'A2', _, 'D3', _, 'A2', _,
      'C3', _, 'G2', _, 'E3', _, 'G2', _,
      'F2', 'G2', 'C3', _, 'C3', _, _, _,

      'F2', _, 'C3', _, 'F2', _, 'C3', _,
      'F2', _, 'C3', _, 'G2', _, 'D3', _,
      'G2', _, 'D3', _, 'F2', _, 'A2', _,
      'C3', _, 'G2', _, 'C3', _, _, _,
    ];
    let timer = null;
    let stepIdx = 0;
    let nextTime = 0;

    function scheduleNote(name, t, type, vol, dur) {
      const f = freq(name);
      if (!f) return;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.setValueAtTime(vol, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + dur + 0.03);
    }

    function loop() {
      if (!ctx) return;
      while (nextTime < ctx.currentTime + 0.18) {
        const i = stepIdx % mel.length;
        const t = nextTime;
        if (mel[i])  scheduleNote(mel[i],  t, 'square',   0.085, STEP * 0.92);
        if (bass[i]) scheduleNote(bass[i], t, 'triangle', 0.17,  STEP * 0.9);
        if (i % 4 === 2) { // 轻微打击感
          const len = Math.floor(0.03 * ctx.sampleRate);
          const buf = ctx.createBuffer(1, len, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.value = 0.05;
          src.connect(g); g.connect(master);
          src.start(t);
        }
        stepIdx++;
        nextTime += STEP;
      }
    }

    return {
      start() {
        if (!ensure()) return;
        this.stop();
        stepIdx = 0;
        nextTime = ctx.currentTime + 0.06;
        timer = setInterval(loop, 40);
      },
      stop() {
        if (timer) { clearInterval(timer); timer = null; }
      },
    };
  })();

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.55;
    return muted;
  }
  function isMuted() { return muted; }
  /* 首次用户交互时解锁音频 */
  function unlock() { ensure(); }

  return { play, Bgm, toggleMute, isMuted, unlock, freq };
})();
