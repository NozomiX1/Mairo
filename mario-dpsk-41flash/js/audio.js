/* =============================================================================
 * audio.js - procedural chiptune sound. No audio files: everything is
 * synthesised with oscillators and noise buffers.
 * ========================================================================== */
(function (global) {
  'use strict';

  const M = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi note -> Hz

  // note names -> midi
  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function nm(s) {
    const m = /^([A-G]#?)(-?\d)$/.exec(s);
    if (!m) return 60;
    return NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  }

  /* ------------------------------------------------------------------ music */
  // Original themes in the spirit of 8-bit platformers (not transcriptions).
  const SONGS = {
    overworld: {
      bpm: 200,
      lead: [
        'E5:1','G5:1','A5:1','G5:1','E5:1','D5:1','E5:2',
        'G5:1','A5:1','B5:1','A5:1','G5:1','E5:1','D5:2',
        'C5:1','E5:1','G5:1','E5:1','A5:1','G5:1','E5:2',
        'D5:1','E5:1','G5:1','B5:1','A5:1','G5:1','E5:2',
        'E6:1','D6:1','B5:1','G5:1','A5:1','B5:1','C6:2',
        'B5:1','A5:1','G5:1','E5:1','D5:1','E5:1','G5:2'
      ],
      bass: [
        'E2:2','B2:2','E2:2','B2:2','C3:2','G2:2','C3:2','G2:2',
        'A2:2','E3:2','A2:2','E3:2','G2:2','D3:2','G2:2','D3:2',
        'E2:2','B2:2','E2:2','B2:2','A2:2','E3:2','B2:2','G2:2',
        'C3:2','G2:2','A2:2','E3:2','B2:2','G2:2','E2:2','B2:2'
      ]
    },
    underground: {
      bpm: 230,
      lead: [
        'C4:1','C5:1','A3:1','A4:1','A#3:1','A#4:1','C4:2',
        'C4:1','C5:1','A3:1','A4:1','A#3:1','A#4:1','C4:2',
        'F3:1','F4:1','D3:1','D4:1','D#3:1','D#4:1','F3:2',
        'F3:1','F4:1','D3:1','D4:1','D#3:1','D#4:1','F3:2'
      ],
      bass: [
        'C2:2','C2:2','C2:2','C2:1','C2:1',
        'C2:2','C2:2','C2:2','C2:1','C2:1',
        'F2:2','F2:2','F2:2','F2:1','F2:1',
        'F2:2','F2:2','F2:2','F2:1','F2:1'
      ]
    },
    star: {
      bpm: 300,
      lead: [
        'C6:1','C6:1','A5:1','C6:1','F6:1','C6:1','A5:1','C6:1',
        'G5:1','G5:1','E5:1','G5:1','C6:1','G5:1','E5:1','G5:1',
        'A5:1','A5:1','F5:1','A5:1','D6:1','A5:1','F5:1','A5:1',
        'G5:1','A5:1','B5:1','C6:1','D6:1','C6:1','B5:1','G5:1'
      ],
      bass: [
        'C3:1','C3:1','C3:1','C3:1','F3:1','F3:1','F3:1','F3:1',
        'G3:1','G3:1','G3:1','G3:1','C3:1','C3:1','C3:1','C3:1'
      ]
    }
  };

  // Parse 'E5:1' sequences into [midi, beats] pairs.
  function parseTrack(list) {
    return list.map((tok) => {
      const [n, d] = tok.split(':');
      return [nm(n), parseFloat(d)];
    });
  }

  function parseSong(song) {
    return {
      bpm: song.bpm,
      lead: parseTrack(song.lead).concat(parseTrack(song.lead)),
      bass: parseTrack(song.bass).concat(parseTrack(song.bass))
    };
  }

  const PARSED = {};
  for (const k of Object.keys(SONGS)) PARSED[k] = parseSong(SONGS[k]);

  /* ------------------------------------------------------------------ engine */
  const Audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    enabled: true,
    muted: false,
    _noise: null,
    _track: null,
    _idx: { lead: 0, bass: 0 },
    _next: { lead: 0, bass: 0 },
    _step: 0,
    _timer: null,
    _curSong: null,
    _freq: 48000,

    init() {
      if (this.ctx) return;
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) { this.enabled = false; return; }
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);

      // one shared noise buffer
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    },

    resume() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    /** True when sound can actually be produced. */
    ready() {
      return !!(this.enabled && this.ctx);
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.42;
    },

    /* ------------------------------------------------------------ primitives */
    _tone(opts) {
      if (!this.enabled || !this.ctx) return;
      const t0 = opts.t || this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = opts.type || 'square';
      osc.frequency.setValueAtTime(opts.f0, t0);
      if (opts.f1 !== undefined) {
        if (opts.exp) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + opts.dur);
        else osc.frequency.linearRampToValueAtTime(Math.max(20, opts.f1), t0 + opts.dur);
      }
      const vol = opts.vol === undefined ? 0.3 : opts.vol;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
      osc.connect(gain);
      gain.connect(opts.bus || this.sfxGain);
      osc.start(t0);
      osc.stop(t0 + opts.dur + 0.02);
    },

    _noiseBurst(dur, vol, filterFrom, filterTo, t) {
      if (!this.enabled || !this.ctx) return;
      const t0 = t || this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noise;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(filterFrom, t0);
      flt.frequency.exponentialRampToValueAtTime(Math.max(60, filterTo), t0 + dur);
      flt.Q.value = 1.1;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(gain); gain.connect(this.sfxGain);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    },

    /* ------------------------------------------------------------------- SFX */
    jump(big) {
      this.resume();
      this._tone({ type: 'square', f0: big ? 230 : 320, f1: big ? 700 : 900, dur: 0.24, vol: 0.22 });
      this._tone({ type: 'triangle', f0: big ? 115 : 160, f1: big ? 350 : 450, dur: 0.2, vol: 0.12 });
    },
    bump() {
      this.resume();
      this._tone({ type: 'square', f0: 320, f1: 120, dur: 0.1, vol: 0.2 });
      this._noiseBurst(0.08, 0.14, 900, 200);
    },
    coin() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      this._tone({ type: 'square', f0: M(83), dur: 0.07, vol: 0.22, t });
      this._tone({ type: 'square', f0: M(88), dur: 0.32, vol: 0.22, t: t + 0.07 });
    },
    stomp() {
      this.resume();
      this._noiseBurst(0.1, 0.22, 1400, 200);
      this._tone({ type: 'square', f0: 500, f1: 150, dur: 0.09, vol: 0.16 });
    },
    kick() {
      this.resume();
      this._tone({ type: 'square', f0: 200, f1: 60, dur: 0.16, vol: 0.24 });
      this._noiseBurst(0.12, 0.16, 800, 120);
    },
    brick() {
      this.resume();
      this._noiseBurst(0.26, 0.3, 2600, 260);
      this._tone({ type: 'square', f0: 420, f1: 90, dur: 0.2, vol: 0.16 });
    },
    powerupAppear() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 8; i++) {
        this._tone({ type: 'square', f0: 200 + i * 90, dur: 0.06, vol: 0.13, t: t + i * 0.045 });
      }
    },
    powerup() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      const seq = [72, 76, 79, 84, 79, 84, 88, 91];
      seq.forEach((n, i) => {
        this._tone({ type: 'square', f0: M(n), dur: 0.11, vol: 0.2, t: t + i * 0.06 });
        this._tone({ type: 'triangle', f0: M(n - 12), dur: 0.11, vol: 0.12, t: t + i * 0.06 });
      });
    },
    pipe() {
      this.resume();
      this._tone({ type: 'square', f0: 700, f1: 120, dur: 0.5, vol: 0.22, exp: true });
    },
    shrink() {
      this.resume();
      this._tone({ type: 'square', f0: 600, f1: 150, dur: 0.4, vol: 0.2, exp: true });
    },
    fireball() {
      this.resume();
      this._tone({ type: 'sawtooth', f0: 900, f1: 200, dur: 0.14, vol: 0.14 });
    },
    hurt() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      this._tone({ type: 'square', f0: 400, f1: 90, dur: 0.5, vol: 0.24, t });
      this._tone({ type: 'triangle', f0: 200, f1: 60, dur: 0.5, vol: 0.16, t });
    },
    oneUp() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      [76, 81, 84, 88].forEach((n, i) => {
        this._tone({ type: 'square', f0: M(n), dur: 0.13, vol: 0.2, t: t + i * 0.1 });
      });
    },
    flagpole() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 14; i++) {
        this._tone({ type: 'square', f0: 400 + i * 70, dur: 0.07, vol: 0.16, t: t + i * 0.06 });
      }
    },
    stageClear() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      const seq = [[79, 0.14], [79, 0.14], [79, 0.14], [76, 0.16], [79, 0.14], [83, 0.4], [76, 0.5]];
      let at = 0;
      for (const [n, d] of seq) {
        this._tone({ type: 'square', f0: M(n), dur: d, vol: 0.22, t: t + at });
        this._tone({ type: 'triangle', f0: M(n - 12), dur: d, vol: 0.13, t: t + at });
        at += d;
      }
    },
    gameOver() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      const seq = [[72, 0.2], [71, 0.2], [69, 0.2], [67, 0.5]];
      let at = 0;
      for (const [n, d] of seq) {
        this._tone({ type: 'square', f0: M(n), dur: d, vol: 0.22, t: t + at });
        at += d;
      }
    },
    warning() {
      this.resume();
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        this._tone({ type: 'square', f0: 880, dur: 0.12, vol: 0.2, t: t + i * 0.22 });
        this._tone({ type: 'square', f0: 660, dur: 0.12, vol: 0.2, t: t + i * 0.22 + 0.11 });
      }
    },

    /* ----------------------------------------------------------------- music */
    playMusic(name, opts) {
      this.init();
      if (!this.enabled) return;
      if (this._curSong === name && !(opts && opts.restart)) return;
      this.stopMusic();
      const song = PARSED[name];
      if (!song) return;
      this._curSong = name;
      this._song = song;
      this._idx = { lead: 0, bass: 0 };
      this._next = { lead: this.ctx.currentTime + 0.08, bass: this.ctx.currentTime + 0.08 };
      const tick = () => {
        if (!this._song) return;
        const beat = 60 / this._song.bpm;
        const now = this.ctx.currentTime;
        for (const part of ['lead', 'bass']) {
          const track = this._song[part];
          while (this._next[part] < now + 0.25) {
            const [midi, beats] = track[this._idx[part] % track.length];
            const dur = beats * beat;
            if (part === 'lead') {
              this._tone({ type: 'square', f0: M(midi), dur: dur * 0.86, vol: 0.13, t: this._next[part], bus: this.musicGain });
            } else {
              this._tone({ type: 'triangle', f0: M(midi), dur: dur * 0.9, vol: 0.16, t: this._next[part], bus: this.musicGain });
            }
            this._next[part] += dur;
            this._idx[part]++;
          }
        }
        this._timer = setTimeout(tick, 60);
      };
      tick();
    },

    stopMusic() {
      this._song = null;
      this._curSong = null;
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    },

    duckMusic(on) {
      if (this.musicGain) this.musicGain.gain.value = on ? 0.12 : 0.5;
    }
  };

  global.MarioAudio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
