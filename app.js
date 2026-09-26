/**
 * Tils & Twists — Main Game Engine
 * A fully-featured 100-level sliding tile puzzle PWA
 *
 * Architecture:
 *  - GameState   : immutable board representation
 *  - GameSave    : localStorage persistence layer
 *  - PuzzleBoard : DOM rendering + touch/click input
 *  - App         : screen router + top-level orchestrator
 *  - Confetti    : canvas-based particle celebration
 */

'use strict';

/* ════════════════════════════════════════════
   SECTION 1 — GAME STATE ENGINE
════════════════════════════════════════════ */

/**
 * Creates a solved board of size n×n.
 * Tiles are numbered 1…(n²-1), empty tile = 0.
 * Returns a flat array; index = row*n + col.
 */
function createSolvedBoard(n) {
  const total = n * n;
  const board = [];
  for (let i = 1; i < total; i++) board.push(i);
  board.push(0); // empty at bottom-right
  return board;
}

/** Returns position of the empty tile (value 0) */
function findEmpty(board) {
  return board.indexOf(0);
}

/**
 * Returns an array of indices adjacent to the empty cell
 * that can validly slide into it.
 */
function getMovableTiles(board, n) {
  const emptyIdx = findEmpty(board);
  const row = Math.floor(emptyIdx / n);
  const col = emptyIdx % n;
  const movable = [];
  if (row > 0) movable.push(emptyIdx - n); // above
  if (row < n-1) movable.push(emptyIdx + n); // below
  if (col > 0) movable.push(emptyIdx - 1); // left
  if (col < n-1) movable.push(emptyIdx + 1); // right
  return movable;
}

/** Clones board, swaps tile at tileIdx with empty */
function moveTile(board, tileIdx) {
  const next = [...board];
  const emptyIdx = findEmpty(next);
  [next[emptyIdx], next[tileIdx]] = [next[tileIdx], next[emptyIdx]];
  return next;
}

/**
 * Shuffles a board by making shuffleMoves random valid moves.
 * Guarantees solvability (because we only make valid moves from solved).
 */
function shuffleBoard(n, shuffleMoves) {
  let board = createSolvedBoard(n);
  let lastEmpty = findEmpty(board);

  for (let i = 0; i < shuffleMoves; i++) {
    const movable = getMovableTiles(board, n);
    // Avoid immediate undo (unless only 1 option)
    const filtered = movable.filter(idx => idx !== lastEmpty);
    const pick = filtered.length > 0
      ? filtered[Math.floor(Math.random() * filtered.length)]
      : movable[0];
    lastEmpty = findEmpty(board);
    board = moveTile(board, pick);
  }
  return board;
}

/** Returns true if the board is in solved state */
function isSolved(board) {
  const n2 = board.length;
  for (let i = 0; i < n2 - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[n2 - 1] === 0;
}

/** Count how many tiles are in their correct positions */
function countInPlace(board) {
  let count = 0;
  for (let i = 0; i < board.length - 1; i++) {
    if (board[i] === i + 1) count++;
  }
  return count;
}

/* ════════════════════════════════════════════
   SECTION 2 — PERSISTENCE (localStorage)
════════════════════════════════════════════ */

const SAVE_KEY = 'tils_twists_save_v1';

const GameSave = {
  /** Default save structure */
  _defaults() {
    return {
      currentLevel: 1,
      highestUnlocked: 1,
      levelResults: {}, // { levelId: { stars, moves, time, completed } }
      settings: {
        sound: true,
        vibration: true,
        highlightInPlace: true,
        animations: true,
      },
      totalMoves: 0,
      totalTime: 0,
      installDismissed: false,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return this._defaults();
      return { ...this._defaults(), ...JSON.parse(raw) };
    } catch {
      return this._defaults();
    }
  },

  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  },

  /** Record a level completion */
  recordCompletion(data, levelId, moves, timeSeconds, stars) {
    const prev = data.levelResults[levelId];
    const isNew = !prev || !prev.completed;
    const newBestMoves = !prev || moves < prev.moves;
    const newBestTime  = !prev || timeSeconds < prev.time;

    data.levelResults[levelId] = {
      completed: true,
      stars: Math.max(stars, prev ? prev.stars : 0),
      moves: newBestMoves ? moves : prev.moves,
      time:  newBestTime  ? timeSeconds : prev.time,
    };

    if (isNew) {
      data.totalMoves += moves;
      data.totalTime  += timeSeconds;
      // unlock next level
      if (levelId < 100) {
        data.highestUnlocked = Math.max(data.highestUnlocked, levelId + 1);
      }
    }

    return { isNew, newBestMoves, newBestTime };
  },
};

/* ════════════════════════════════════════════
   SECTION 3 — SOUND ENGINE (Web Audio API)
════════════════════════════════════════════ */

const Sound = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function playTone(freq, type, duration, vol = 0.15, attack = 0.01, decay = 0.1) {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ac.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + duration + decay);
    } catch {}
  }

  return {
    slide() { playTone(440, 'sine', 0.08, 0.12); },
    invalid() { playTone(180, 'square', 0.12, 0.08); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => playTone(f, 'sine', 0.3, 0.2), i * 120);
      });
    },
    click() { playTone(600, 'sine', 0.06, 0.08); },
    star()  { playTone(880, 'sine', 0.15, 0.15); },
  };
})();

/* ════════════════════════════════════════════
   SECTION 4 — CONFETTI ENGINE
════════════════════════════════════════════ */

const Confetti = (() => {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let raf = null;

  const COLORS = [
    '#7c3aed','#a855f7','#06b6d4','#22d3ee',
    '#ec4899','#f472b6','#fbbf24','#4ade80',
    '#fff','#e879f9',
  ];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function spawn(count = 80) {
    resize();
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        r: 4 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2,
        life: 1,
        decay: 0.008 + Math.random() * 0.006,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.vx *= 0.99;
      p.rot += p.rotV;
      p.life -= p.decay;
    }
    if (particles.length > 0) raf = requestAnimationFrame(draw);
  }

  return {
    burst(count = 100) {
      spawn(count);
      if (!raf) draw();
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = null;
      particles = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
})();

/* ════════════════════════════════════════════
   SECTION 5 — TOAST NOTIFICATIONS
════════════════════════════════════════════ */

function showToast(message, type = 'info', duration = 2200) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ════════════════════════════════════════════
   SECTION 6 — VIBRATION
════════════════════════════════════════════ */

function vibrate(pattern) {
  if (navigator.vibrate && App.save.settings.vibration) {
    navigator.vibrate(pattern);
  }
}

/* ════════════════════════════════════════════
   SECTION 7 — PUZZLE BOARD RENDERER
════════════════════════════════════════════ */

class PuzzleBoard {
  constructor(container) {
    this.container = container;
    this.board = null;
    this.n = 0;
    this.tileEls = [];
    this.onMove = null;
    this._touchStart = null;
    this._setupSwipe();
  }

  /** Renders the board from state */
  render(board, n) {
    this.board = board;
    this.n = n;
    this.container.innerHTML = '';
    this.container.className = `puzzle-board grid-${n}`;
    this.tileEls = [];

    for (let i = 0; i < board.length; i++) {
      const val = board[i];
      const el = document.createElement('div');
      el.className = val === 0 ? 'tile empty' : 'tile';
      if (val !== 0) {
        el.textContent = val;
        el.dataset.n = val;
        el.dataset.idx = i;
        el.setAttribute('aria-label', `Tile ${val}`);
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');

        // Highlight if in correct position
        if (App.save.settings.highlightInPlace && val === i + 1) {
          el.classList.add('in-place');
        }

        el.addEventListener('click', () => this._handleTileClick(i));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') this._handleTileClick(i);
        });
      }
      this.container.appendChild(el);
      this.tileEls.push(el);
    }
  }

  /** Update tile in-place highlight */
  _updateInPlace() {
    if (!App.save.settings.highlightInPlace) return;
    this.tileEls.forEach((el, i) => {
      const val = this.board[i];
      if (val !== 0 && el) {
        el.classList.toggle('in-place', val === i + 1);
      }
    });
  }

  _handleTileClick(idx) {
    const movable = getMovableTiles(this.board, this.n);
    if (!movable.includes(idx)) {
      // Invalid move — small shake
      const el = this.tileEls[idx];
      if (el) {
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = '';
        el.style.transform = 'translateX(-4px)';
        setTimeout(() => el.style.transform = '', 100);
      }
      if (App.save.settings.sound) Sound.invalid();
      vibrate([30]);
      return;
    }
    this._animateMove(idx);
  }

  _animateMove(tileIdx) {
    const emptyIdx = findEmpty(this.board);
    const tileEl = this.tileEls[tileIdx];
    const emptyEl = this.tileEls[emptyIdx];

    // Animate
    if (tileEl && App.save.settings.animations) {
      tileEl.classList.add('sliding');
    }

    // Update state
    this.board = moveTile(this.board, tileIdx);

    // Re-render
    this.render(this.board, this.n);

    if (App.save.settings.sound) Sound.slide();
    vibrate([18]);

    if (this.onMove) this.onMove(this.board);
  }

  /** Swipe gesture support */
  _setupSwipe() {
    this.container.addEventListener('touchstart', (e) => {
      this._touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    this.container.addEventListener('touchend', (e) => {
      if (!this._touchStart) return;
      const dx = e.changedTouches[0].clientX - this._touchStart.x;
      const dy = e.changedTouches[0].clientY - this._touchStart.y;
      this._touchStart = null;

      const absDx = Math.abs(dx), absDy = Math.abs(dy);
      if (absDx < 10 && absDy < 10) return; // tap, not swipe

      // Determine swipe direction → move empty tile opposite
      let emptyIdx = findEmpty(this.board);
      const eRow = Math.floor(emptyIdx / this.n);
      const eCol = emptyIdx % this.n;

      let targetIdx = -1;
      if (absDx > absDy) {
        // Horizontal swipe
        if (dx > 0 && eCol > 0)          targetIdx = emptyIdx - 1; // swipe right → move tile left of empty
        else if (dx < 0 && eCol < this.n - 1) targetIdx = emptyIdx + 1;
      } else {
        // Vertical swipe
        if (dy > 0 && eRow > 0)          targetIdx = emptyIdx - this.n;
        else if (dy < 0 && eRow < this.n - 1) targetIdx = emptyIdx + this.n;
      }

      if (targetIdx !== -1 && this.board[targetIdx] !== 0) {
        this._animateMove(targetIdx);
      }
    }, { passive: true });

    // Keyboard arrow key support
    document.addEventListener('keydown', (e) => {
      if (App.currentScreen !== 'game') return;
      if (!this.board) return;
      const emptyIdx = findEmpty(this.board);
      const eRow = Math.floor(emptyIdx / this.n);
      const eCol = emptyIdx % this.n;
      let targetIdx = -1;

      if (e.key === 'ArrowLeft'  && eCol < this.n-1) targetIdx = emptyIdx + 1;
      if (e.key === 'ArrowRight' && eCol > 0)         targetIdx = emptyIdx - 1;
      if (e.key === 'ArrowUp'    && eRow < this.n-1)  targetIdx = emptyIdx + this.n;
      if (e.key === 'ArrowDown'  && eRow > 0)         targetIdx = emptyIdx - this.n;

      if (targetIdx !== -1 && this.board[targetIdx] !== 0) {
        e.preventDefault();
        this._animateMove(targetIdx);
      }
    });
  }

  /** Apply board-solved CSS animation */
  celebrateSolve() {
    this.container.classList.add('board-solved');
    setTimeout(() => this.container.classList.remove('board-solved'), 800);
  }
}

/* ════════════════════════════════════════════
   SECTION 8 — MAIN APP ORCHESTRATOR
════════════════════════════════════════════ */

const App = {
  save: null,
  currentScreen: 'home',
  currentLevel: null,
  board: null,
  puzzleBoard: null,
  moves: 0,
  timerInterval: null,
  elapsedSeconds: 0,
  deferredInstall: null,

  /* ── DOM References ── */
  els: {},

  init() {
    this.save = GameSave.load();
    this._cacheEls();
    this._buildLevelSelect();
    this._updateHomeStats();
    this._registerServiceWorker();
    this._setupInstallPrompt();
    this._setupSettingsScreen();
    this._applySettings();
    this._showScreen('home');
  },

  _cacheEls() {
    const ids = [
      'home-screen','level-screen','game-screen','settings-screen',
      'btn-play','btn-continue','btn-levels','btn-settings',
      'btn-back-from-levels','btn-back-from-settings',
      'level-list-container',
      'game-level-number','game-level-name','game-zone-name',
      'stat-moves','stat-time','stat-best',
      'btn-restart','btn-hint','btn-pause',
      'puzzle-board',
      'win-modal','win-stars','win-moves','win-time','win-best-moves','win-best-time',
      'btn-next-level','btn-replay','btn-levels-from-win',
      'install-banner','btn-install-app','btn-dismiss-install',
      'stat-completed','stat-percent','stat-streak',
      'setting-sound','setting-vibration','setting-highlight','setting-animations',
      'btn-reset-progress',
      'progress-fill',
    ];
    ids.forEach(id => {
      this.els[id] = document.getElementById(id);
    });

    // Button event listeners
    this.els['btn-play'].addEventListener('click',     () => { Sound.click(); this._goToCurrentLevel(); });
    this.els['btn-continue'] && this.els['btn-continue'].addEventListener('click', () => { Sound.click(); this._goToCurrentLevel(); });
    this.els['btn-levels'].addEventListener('click',   () => { Sound.click(); this._showScreen('level'); });
    this.els['btn-settings'].addEventListener('click', () => { Sound.click(); this._showScreen('settings'); });
    this.els['btn-back-from-levels'].addEventListener('click',   () => { Sound.click(); this._showScreen('home'); });
    this.els['btn-back-from-settings'].addEventListener('click', () => { Sound.click(); this._showScreen('home'); });
    this.els['btn-restart'].addEventListener('click',  () => { Sound.click(); this._restartLevel(); });
    this.els['btn-pause'].addEventListener('click',    () => { Sound.click(); this._showScreen('home'); this._stopTimer(); });
    this.els['btn-next-level'].addEventListener('click', () => { Sound.click(); this._nextLevel(); });
    this.els['btn-replay'].addEventListener('click',     () => { Sound.click(); this._hideWinModal(); this._restartLevel(); });
    this.els['btn-levels-from-win'].addEventListener('click', () => { Sound.click(); this._hideWinModal(); this._showScreen('level'); });
    this.els['btn-install-app'].addEventListener('click',      () => this._installApp());
    this.els['btn-dismiss-install'].addEventListener('click',  () => this._dismissInstall());

    // Puzzle board
    this.puzzleBoard = new PuzzleBoard(this.els['puzzle-board']);
    this.puzzleBoard.onMove = (newBoard) => this._onBoardMove(newBoard);
  },

  /* ── Screen Navigation ── */
  _showScreen(name) {
    const screenMap = {
      home:     'home-screen',
      level:    'level-screen',
      game:     'game-screen',
      settings: 'settings-screen',
    };
    Object.values(screenMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(screenMap[name]);
    if (target) target.classList.remove('hidden');
    this.currentScreen = name;

    if (name === 'level') this._refreshLevelCards();
    if (name === 'home')  this._updateHomeStats();
  },

  /* ── Home Screen ── */
  _updateHomeStats() {
    const completed = Object.values(this.save.levelResults).filter(r => r.completed).length;
    const total = 100;
    const pct = Math.round((completed / total) * 100);

    if (this.els['stat-completed']) this.els['stat-completed'].textContent = completed;
    if (this.els['stat-percent'])   this.els['stat-percent'].textContent   = pct + '%';
    if (this.els['stat-streak'])    this.els['stat-streak'].textContent    = this._calcStreak();

    // Progress bar
    if (this.els['progress-fill']) {
      this.els['progress-fill'].style.width = pct + '%';
    }

    // Show/hide continue button
    const continueBtn = this.els['btn-continue'];
    if (continueBtn) {
      continueBtn.style.display = completed > 0 ? 'flex' : 'none';
      const lvl = LEVEL_DATA[this.save.highestUnlocked - 1];
      if (lvl) continueBtn.querySelector('span') && (continueBtn.querySelector('span').textContent = `Continue • Level ${lvl.id}`);
    }
  },

  _calcStreak() {
    let streak = 0;
    for (let i = 1; i <= 100; i++) {
      if (this.save.levelResults[i] && this.save.levelResults[i].completed) streak++;
      else break;
    }
    return streak;
  },

  /* ── Level Select ── */
  _buildLevelSelect() {
    const container = this.els['level-list-container'];
    if (!container) return;
    container.innerHTML = '';

    const zones = [
      { name: 'Baby Steps',    from: 1,  to: 10,  cls: 'zone-0' },
      { name: 'Getting Warm',  from: 11, to: 25,  cls: 'zone-1' },
      { name: 'Rising Heat',   from: 26, to: 45,  cls: 'zone-2' },
      { name: 'Hot Stuff',     from: 46, to: 70,  cls: 'zone-3' },
      { name: 'Expert Zone',   from: 71, to: 85,  cls: 'zone-4' },
      { name: 'Master Class',  from: 86, to: 100, cls: 'zone-5' },
    ];

    zones.forEach(zone => {
      // Zone header
      const header = document.createElement('div');
      header.className = `zone-header ${zone.cls}`;
      header.innerHTML = `
        <div class="zone-badge">${zone.name}</div>
        <div class="zone-line"></div>
      `;
      container.appendChild(header);

      // Level grid
      const grid = document.createElement('div');
      grid.className = 'level-grid';

      for (let lvlId = zone.from; lvlId <= zone.to; lvlId++) {
        const card = this._createLevelCard(lvlId);
        grid.appendChild(card);
      }
      container.appendChild(grid);
    });
  },

  _createLevelCard(lvlId) {
    const card = document.createElement('div');
    card.id = `lc-${lvlId}`;
    card.className = 'level-card';
    card.dataset.level = lvlId;
    this._updateLevelCard(card, lvlId);
    card.addEventListener('click', () => {
      const isLocked = lvlId > this.save.highestUnlocked;
      if (isLocked) {
        showToast('Complete previous levels first!', 'error');
        vibrate([50, 30, 50]);
        return;
      }
      Sound.click();
      this._startLevel(lvlId);
    });
    return card;
  },

  _updateLevelCard(card, lvlId) {
    const isCompleted = !!(this.save.levelResults[lvlId] && this.save.levelResults[lvlId].completed);
    const isLocked    = lvlId > this.save.highestUnlocked;
    const isCurrent   = lvlId === this.save.highestUnlocked && !isCompleted;
    const stars        = isCompleted ? (this.save.levelResults[lvlId].stars || 0) : 0;

    card.classList.toggle('locked',    isLocked);
    card.classList.toggle('completed', isCompleted);
    card.classList.toggle('current',   isCurrent);

    const starStr = isCompleted
      ? ['★','★','★'].map((s, i) => `<span class="${i < stars ? 'star-gold' : 'star-empty'}">${s}</span>`).join('')
      : (isCurrent ? '<span style="color:var(--cyan-400);font-size:0.65rem;">●</span>' : '');

    card.innerHTML = `
      <div class="lc-num">${lvlId}</div>
      <div class="lc-stars">${starStr}</div>
    `;

    if (isLocked) {
      card.innerHTML = `<div class="lc-num" style="font-size:1rem;opacity:0.5">🔒</div>`;
    }
  },

  _refreshLevelCards() {
    for (let i = 1; i <= 100; i++) {
      const card = document.getElementById(`lc-${i}`);
      if (card) this._updateLevelCard(card, i);
    }
  },

  /* ── Level Start / Restart ── */
  _goToCurrentLevel() {
    this._startLevel(this.save.highestUnlocked);
  },

  _startLevel(lvlId) {
    const levelDef = LEVEL_DATA[lvlId - 1];
    if (!levelDef) return;

    this.currentLevel = levelDef;
    this.save.currentLevel = lvlId;
    GameSave.save(this.save);

    this.moves = 0;
    this.elapsedSeconds = 0;

    // Build shuffled board
    this.board = shuffleBoard(levelDef.grid, levelDef.shuffleMoves);

    this._renderGameScreen();
    this._showScreen('game');
    this._startTimer();
  },

  _restartLevel() {
    this._stopTimer();
    this._startLevel(this.currentLevel.id);
  },

  _nextLevel() {
    this._hideWinModal();
    const nextId = this.currentLevel.id + 1;
    if (nextId > 100) {
      showToast('🎉 You completed all 100 levels!', 'success', 3000);
      this._showScreen('home');
      return;
    }
    this._startLevel(nextId);
  },

  /* ── Game Screen Render ── */
  _renderGameScreen() {
    const lvl = this.currentLevel;

    // Header
    if (this.els['game-level-number']) this.els['game-level-number'].textContent = `Level ${lvl.id}`;
    if (this.els['game-level-name'])   this.els['game-level-name'].textContent   = lvl.name;
    if (this.els['game-zone-name'])    this.els['game-zone-name'].textContent    = lvl.zoneName;

    // Stats
    this._updateMovesStat();
    this._updateTimeStat();
    this._updateBestStat();

    // Board
    this.puzzleBoard.render(this.board, lvl.grid);
  },

  _updateMovesStat() {
    if (this.els['stat-moves']) this.els['stat-moves'].textContent = this.moves;
  },

  _updateTimeStat() {
    if (this.els['stat-time']) {
      const m = Math.floor(this.elapsedSeconds / 60);
      const s = this.elapsedSeconds % 60;
      this.els['stat-time'].textContent = `${m}:${String(s).padStart(2, '0')}`;
    }
  },

  _updateBestStat() {
    const prev = this.save.levelResults[this.currentLevel.id];
    if (this.els['stat-best']) {
      this.els['stat-best'].textContent = prev && prev.completed ? prev.moves : '—';
    }
  },

  /* ── Timer ── */
  _startTimer() {
    this._stopTimer();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      this._updateTimeStat();
    }, 1000);
  },

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  /* ── Board Move Handler ── */
  _onBoardMove(newBoard) {
    this.board = newBoard;
    this.moves++;
    this._updateMovesStat();

    if (isSolved(newBoard)) {
      this._stopTimer();
      this.puzzleBoard.celebrateSolve();

      setTimeout(() => {
        this._handleLevelComplete();
      }, 400);
    }
  },

  /* ── Level Complete ── */
  _handleLevelComplete() {
    const par = getLevelPar(this.currentLevel);
    let stars = 1;
    if (this.moves <= par.threeStars) stars = 3;
    else if (this.moves <= par.twoStars) stars = 2;

    const { isNew, newBestMoves } = GameSave.recordCompletion(
      this.save, this.currentLevel.id, this.moves, this.elapsedSeconds, stars
    );
    GameSave.save(this.save);

    // Confetti & sound
    Confetti.burst(120);
    if (App.save.settings.sound) Sound.win();
    vibrate([50, 30, 50, 30, 100]);

    // Show modal
    this._showWinModal(stars, isNew, newBestMoves);
  },

  /* ── Win Modal ── */
  _showWinModal(stars, isNew, newBestMoves) {
    const modal = document.getElementById('win-modal');
    const overlay = modal.closest('.modal-overlay');

    // Stars display
    const starsEl = this.els['win-stars'];
    if (starsEl) {
      starsEl.innerHTML = [1, 2, 3].map(i =>
        `<span class="${i <= stars ? 'star-gold' : 'star-empty'}" style="filter:${i <= stars ? 'drop-shadow(0 0 8px #fbbf24)' : 'none'}">${i <= stars ? '★' : '☆'}</span>`
      ).join('');
    }

    // Animate stars one by one
    const starEls = starsEl ? starsEl.querySelectorAll('span') : [];
    starEls.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'scale(0)';
      el.style.transition = 'none';
      setTimeout(() => {
        el.style.transition = 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)';
        el.style.opacity = '1';
        el.style.transform = 'scale(1)';
        if (i < stars && App.save.settings.sound) setTimeout(() => Sound.star(), 50);
      }, i * 150 + 100);
    });

    // Stats
    if (this.els['win-moves']) this.els['win-moves'].textContent = this.moves;
    if (this.els['win-time']) {
      const m = Math.floor(this.elapsedSeconds / 60);
      const s = this.elapsedSeconds % 60;
      this.els['win-time'].textContent = `${m}:${String(s).padStart(2, '0')}`;
    }

    const prev = this.save.levelResults[this.currentLevel.id];
    if (this.els['win-best-moves']) this.els['win-best-moves'].textContent = prev ? prev.moves : this.moves;
    if (this.els['win-best-time']) {
      const bm = Math.floor((prev ? prev.time : this.elapsedSeconds) / 60);
      const bs = (prev ? prev.time : this.elapsedSeconds) % 60;
      this.els['win-best-time'].textContent = `${bm}:${String(bs).padStart(2,'0')}`;
    }

    // Next level button visibility
    if (this.els['btn-next-level']) {
      this.els['btn-next-level'].style.display = this.currentLevel.id < 100 ? 'flex' : 'none';
    }

    overlay.classList.add('visible');
  },

  _hideWinModal() {
    const overlay = document.querySelector('#win-modal').closest('.modal-overlay');
    overlay.classList.remove('visible');
    Confetti.stop();
  },

  /* ── Settings ── */
  _setupSettingsScreen() {
    const toggles = {
      'setting-sound':      'sound',
      'setting-vibration':  'vibration',
      'setting-highlight':  'highlightInPlace',
      'setting-animations': 'animations',
    };
    Object.entries(toggles).forEach(([elId, key]) => {
      const el = this.els[elId];
      if (!el) return;
      el.checked = this.save.settings[key];
      el.addEventListener('change', () => {
        this.save.settings[key] = el.checked;
        GameSave.save(this.save);
        if (key === 'sound') Sound.click();
      });
    });

    const resetBtn = this.els['btn-reset-progress'];
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset ALL progress? This cannot be undone.')) {
          this.save = GameSave._defaults();
          GameSave.save(this.save);
          this._buildLevelSelect();
          this._updateHomeStats();
          showToast('Progress reset!', 'info');
          this._showScreen('home');
        }
      });
    }
  },

  _applySettings() {
    // nothing extra needed; toggles read live from this.save.settings
  },

  /* ── Install Prompt (PWA) ── */
  _setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstall = e;
      if (!this.save.installDismissed) {
        setTimeout(() => {
          const banner = this.els['install-banner'];
          if (banner) banner.classList.add('visible');
        }, 3000);
      }
    });
    window.addEventListener('appinstalled', () => {
      this.deferredInstall = null;
      const banner = this.els['install-banner'];
      if (banner) banner.classList.remove('visible');
      showToast('App installed! 🎉', 'success', 3000);
    });
  },

  async _installApp() {
    if (!this.deferredInstall) {
      showToast('Open in Chrome/Edge to install', 'info');
      return;
    }
    const banner = this.els['install-banner'];
    if (banner) banner.classList.remove('visible');
    this.deferredInstall.prompt();
    const { outcome } = await this.deferredInstall.userChoice;
    if (outcome === 'accepted') showToast('Installing…', 'success');
    this.deferredInstall = null;
  },

  _dismissInstall() {
    const banner = this.els['install-banner'];
    if (banner) banner.classList.remove('visible');
    this.save.installDismissed = true;
    GameSave.save(this.save);
  },

  /* ── Service Worker ── */
  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },
};

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => App.init());
