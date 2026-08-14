'use strict';
/* ============================================================
 * 键盘 + 触摸输入
 * 方向键 / WASD 移动，Z / K / 空格 / ↑ 跳跃，X / L / Shift 加速跑
 * R 重开本关，M 静音，P 暂停
 * ============================================================ */
const GameInputs = {
  left: false, right: false, run: false, jumpHeld: false,
  _jump: false,
  consumeJump() { const j = this._jump; this._jump = false; return j; },
};
if (typeof window !== 'undefined') window.GameInputs = GameInputs;

(function attach() {
  if (!document || !window) return;

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyX: 'run', KeyL: 'run', ShiftLeft: 'run', ShiftRight: 'run',
    KeyZ: 'jump', KeyK: 'jump', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  };
  const GAME_KEYS = ['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW','KeyZ','KeyK','KeyX','KeyL','ShiftLeft','ShiftRight'];

  window.addEventListener('keydown', (e) => {
    const act = KEYMAP[e.code];
    if (act === 'left') GameInputs.left = true;
    else if (act === 'right') GameInputs.right = true;
    else if (act === 'run') GameInputs.run = true;
    else if (act === 'jump') {
      GameInputs._jump = true;
      GameInputs.jumpHeld = true;
      if (typeof GAME !== 'undefined' && GAME && GAME.onExternalAction) GAME.onExternalAction('jump');
    }
    if (GAME_KEYS.indexOf(e.code) >= 0) e.preventDefault();
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (typeof GAME !== 'undefined' && GAME && GAME.onExternalAction) GAME.onExternalAction('start');
      e.preventDefault();
    }
    if (e.code === 'KeyR') { if (typeof GAME !== 'undefined' && GAME && GAME.onExternalAction) GAME.onExternalAction('restart'); }
    if (e.code === 'KeyM') { if (typeof GAME !== 'undefined' && GAME && GAME.onExternalAction) GAME.onExternalAction('mute'); }
    if (e.code === 'KeyP') { if (typeof GAME !== 'undefined' && GAME && GAME.onExternalAction) GAME.onExternalAction('pause'); }
  });
  window.addEventListener('keyup', (e) => {
    const act = KEYMAP[e.code];
    if (act === 'left') GameInputs.left = false;
    else if (act === 'right') GameInputs.right = false;
    else if (act === 'run') GameInputs.run = false;
    else if (act === 'jump') GameInputs.jumpHeld = false;
  });

  /* 触摸按钮 */
  function bindTouch(id, onDown, onUp) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => { e.preventDefault(); onDown(); };
    const up = (e) => { e.preventDefault(); onUp(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }
  bindTouch('btn-left',  () => { GameInputs.left = true; },  () => { GameInputs.left = false; });
  bindTouch('btn-right', () => { GameInputs.right = true; }, () => { GameInputs.right = false; });
  bindTouch('btn-run',   () => { GameInputs.run = true; },   () => { GameInputs.run = false; });
  bindTouch('btn-jump',  () => { GameInputs._jump = true; GameInputs.jumpHeld = true; }, () => { GameInputs.jumpHeld = false; });

  /* 点击画面 = 开始 / 继续 */
  const canvas = document.getElementById('game');
  if (canvas) {
    canvas.addEventListener('pointerdown', () => {
      if (typeof GAME !== 'undefined' && GAME && GAME.onExternalAction) GAME.onExternalAction('start');
    });
  }
})();
