

(() => {

  const boardEl = document.getElementById('board');
  const cells = Array.from(boardEl.querySelectorAll('.cell'));
  const statusMessage = document.getElementById('statusMessage');
  const scoreXEl = document.getElementById('scoreX');
  const scoreOEl = document.getElementById('scoreO');
  const scoreDrawsEl = document.getElementById('scoreDraws');
  const currentStreakEl = document.getElementById('currentStreak');
  const gameModeEl = document.getElementById('gameMode');
  const playerSymbolEl = document.getElementById('playerSymbol');
  const newGameBtn = document.getElementById('newGameBtn');
  const resetStatsBtn = document.getElementById('resetStatsBtn');
  const restartBtn = document.getElementById('restartBtn');
  const undoBtn = document.getElementById('undoBtn');
  const hintBtn = document.getElementById('hintBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const badgeListEl = document.getElementById('badgeList');
  const badgeModal = document.getElementById('badgeModal');
  const modalBadge = document.getElementById('modalBadge');
  const closeModalBtn = document.getElementById('closeModalBtn');

  
  const WIN_LINES = [
    [0,1,2], [3,4,5], [6,7,8], 
    [0,3,6], [1,4,7], [2,5,8], 
    [0,4,8], [2,4,6]           
  ];

  
  const STORAGE_KEYS = {
    stats: 'ttt_pro_stats',
    badges: 'ttt_pro_badges',
    settings: 'ttt_pro_settings'
  };

 
  let board = Array(9).fill(null);       
  let turn = 'X';
  let gameOver = false;
  let moveHistory = [];                   
  let soundOn = true;

  let stats = loadStats();
  let badges = loadBadges();
  let settings = loadSettings();

  
  gameModeEl.value = settings.mode || 'pvp';
  playerSymbolEl.value = settings.playerSymbol || 'X';
  if (settings.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');

  updateScoreboard();
  renderBadges();
  setStatus('Select your mode to begin.');


  cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
  });
  newGameBtn.addEventListener('click', newGame);
  resetStatsBtn.addEventListener('click', resetStats);
  restartBtn.addEventListener('click', restartRound);
  undoBtn.addEventListener('click', undoMove);
  hintBtn.addEventListener('click', showHint);
  gameModeEl.addEventListener('change', onModeChange);
  playerSymbolEl.addEventListener('change', onSymbolChange);
  soundToggleBtn.addEventListener('click', toggleSound);
  themeToggleBtn.addEventListener('click', toggleTheme);
  closeModalBtn.addEventListener('click', () => hideModal());

  function newGame() {
    clearBoard();
    turn = 'X';
    gameOver = false;
    moveHistory = [];
    setStatus(getTurnLabel());
    saveSettings();
    
    const isPve = isPvE();
    const aiPlaysX = isPve && playerSymbolEl.value === 'O';
    if (aiPlaysX) {
      setTimeout(aiMove, 200);
    }
  }

  function restartRound() {
    clearBoard();
    turn = 'X';
    gameOver = false;
    moveHistory = [];
    setStatus(getTurnLabel());
  }

  function handleCellClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    if (gameOver || board[idx]) return;

    const currentMode = gameModeEl.value;
    const playerIsTurn = (currentMode === 'pvp') || (currentMode.startsWith('pve') && turn === playerSymbolEl.value);

    if (!playerIsTurn) return;

    makeMove(idx, turn);
    if (checkGameState()) return;

    
    if (isPvE() && !gameOver) {
      setTimeout(aiMove, 220);
    }
  }

  function makeMove(index, symbol) {
    board[index] = symbol;
    moveHistory.push({ index, symbol });
    renderBoard();
    playClickSound();
    toggleTurn();
  }

  function toggleTurn() {
    turn = turn === 'X' ? 'O' : 'X';
    if (!gameOver) setStatus(getTurnLabel());
  }

  function getTurnLabel() {
    const vsLabel = isPvE() ? 'vs Computer' : 'vs Player';
    return `Turn: ${turn} • ${vsLabel}`;
  }

  function renderBoard() {
    cells.forEach((cell, i) => {
      cell.textContent = board[i] || '';
      cell.classList.remove('win');
    });
  }

  function clearBoard() {
    board = Array(9).fill(null);
    renderBoard();
  }

  function checkGameState() {
    const winInfo = getWinInfo(board);
    if (winInfo) {
      gameOver = true;
      highlightWin(winInfo.line);
      const winner = winInfo.symbol;
      setStatus(`Winner: ${winner}`);
      updateStatsWinner(winner);
      awardBadgesAfterWin(winner, winInfo);
      return true;
    }
    if (board.every(c => c)) {
      gameOver = true;
      setStatus('Draw!');
      stats.draws++;
      stats.currentStreak = 0;
      saveStats();
      updateScoreboard();
      awardBadgesAfterDraw();
      return true;
    }
    return false;
  }

  function getWinInfo(b) {
    for (const line of WIN_LINES) {
      const [a,b2,c] = line;
      if (b[a] && b[a] === b[b2] && b[a] === b[c]) {
        return { symbol: b[a], line };
      }
    }
    return null;
  }

  function highlightWin(line) {
    line.forEach(i => cells[i].classList.add('win'));
  }

  function isPvE() {
    return gameModeEl.value.startsWith('pve');
  }

  
  function aiMove() {
    if (gameOver) return;
    const mode = gameModeEl.value;
    const aiSymbol = turn;
    let chosen;

    if (mode === 'pve-easy') {
      const empties = board.map((v,i) => v ? null : i).filter(v => v !== null);
      chosen = empties[Math.floor(Math.random() * empties.length)];
    } else {
      chosen = bestMoveMinimax(board, aiSymbol);
    }

    makeMove(chosen, aiSymbol);
    checkGameState();
  }

  function bestMoveMinimax(b, aiSym) {
    const humanSym = aiSym === 'X' ? 'O' : 'X';
    let bestScore = -Infinity;
    let move = null;

    const empties = getEmptyIndices(b);
    
    const priors = [4,0,2,6,8,1,3,5,7].filter(i => empties.includes(i));

    for (const idx of priors) {
      b[idx] = aiSym;
      const score = minimax(b, 0, false, aiSym, humanSym, -Infinity, Infinity);
      b[idx] = null;
      if (score > bestScore) {
        bestScore = score;
        move = idx;
      }
    }
    return move ?? empties[0];
  }

  function minimax(b, depth, isMax, aiSym, humanSym, alpha, beta) {
    const win = getWinInfo(b);
    if (win) {
      return win.symbol === aiSym ? 10 - depth : depth - 10;
    }
    if (b.every(c => c)) return 0;

    const empties = getEmptyIndices(b);

    if (isMax) {
      let best = -Infinity;
      for (const i of empties) {
        b[i] = aiSym;
        const val = minimax(b, depth + 1, false, aiSym, humanSym, alpha, beta);
        b[i] = null;
        best = Math.max(best, val);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const i of empties) {
        b[i] = humanSym;
        const val = minimax(b, depth + 1, true, aiSym, humanSym, alpha, beta);
        b[i] = null;
        best = Math.min(best, val);
        beta = Math.min(beta, val);
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  function getEmptyIndices(b) {
    const out = [];
    for (let i = 0; i < b.length; i++) if (!b[i]) out.push(i);
    return out;
  }

 
  function loadStats() {
    const raw = localStorage.getItem(STORAGE_KEYS.stats);
    return raw ? JSON.parse(raw) : { x: 0, o: 0, draws: 0, currentStreak: 0, lastWinner: null, totalGames: 0, totalWins: 0 };
  }
  function saveStats() {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
  }

  function loadBadges() {
    const raw = localStorage.getItem(STORAGE_KEYS.badges);
    return raw ? JSON.parse(raw) : {
      firstWin: false,
      threeStreak: false,
      fiveWins: false,
      perfectRound: false,
      unstoppable10: false
    };
  }
  function saveBadges() {
    localStorage.setItem(STORAGE_KEYS.badges, JSON.stringify(badges));
  }

  function loadSettings() {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    return raw ? JSON.parse(raw) : { mode: 'pvp', playerSymbol: 'X', theme: 'dark', sound: true };
  }
  function saveSettings() {
    settings = {
      mode: gameModeEl.value,
      playerSymbol: playerSymbolEl.value,
      theme: document.documentElement.getAttribute('data-theme') || 'dark',
      sound: soundOn
    };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }

  function updateStatsWinner(winner) {
    stats.lastWinner = winner;
    stats.totalGames++;
    if (winner === 'X') stats.x++;
    if (winner === 'O') stats.o++;
    
    stats.currentStreak = (stats.currentStreak || 0) + 1;
    stats.totalWins = (stats.totalWins || 0) + 1;
    saveStats();
    updateScoreboard();
  }

  function updateScoreboard() {
    scoreXEl.textContent = stats.x;
    scoreOEl.textContent = stats.o;
    scoreDrawsEl.textContent = stats.draws;
    currentStreakEl.textContent = stats.currentStreak;
  }

  function resetStats() {
    if (!confirm('Reset all stats and badges?')) return;
    stats = { x: 0, o: 0, draws: 0, currentStreak: 0, lastWinner: null, totalGames: 0, totalWins: 0 };
    badges = { firstWin: false, threeStreak: false, fiveWins: false, perfectRound: false, unstoppable10: false };
    saveStats(); saveBadges();
    updateScoreboard();
    renderBadges();
    setStatus('Stats reset. Fresh start!');
  }

  function awardBadgesAfterWin(winner, winInfo) {
    let unlocked = [];

    if (!badges.firstWin) {
      badges.firstWin = true;
      unlocked.push({ key: 'firstWin', label: 'First Win', emoji: '🏅' });
    }
    if (stats.currentStreak >= 3 && !badges.threeStreak) {
      badges.threeStreak = true;
      unlocked.push({ key: 'threeStreak', label: 'On a Roll (3-streak)', emoji: '🔥' });
    }
    if (stats.totalWins >= 5 && !badges.fiveWins) {
      badges.fiveWins = true;
      unlocked.push({ key: 'fiveWins', label: 'Five Wins', emoji: '🎉' });
    }
   
    const movesThisRound = moveHistory.length;
    if (movesThisRound <= 7 && !badges.perfectRound) {
      badges.perfectRound = true;
      unlocked.push({ key: 'perfectRound', label: 'Perfect Round', emoji: '💎' });
    }
    if (stats.currentStreak >= 10 && !badges.unstoppable10) {
      badges.unstoppable10 = true;
      unlocked.push({ key: 'unstoppable10', label: 'Unstoppable (10-streak)', emoji: '🏆' });
    }

    if (unlocked.length) {
      saveBadges();
      renderBadges();
      showBadgeModal(unlocked[0]);
    }
  }

  function awardBadgesAfterDraw() {
    
    renderBadges();
  }

  function renderBadges() {
    const defs = [
      { key: 'firstWin', label: 'First Win', emoji: '🏅' },
      { key: 'threeStreak', label: 'On a Roll (3-streak)', emoji: '🔥' },
      { key: 'fiveWins', label: 'Five Wins', emoji: '🎉' },
      { key: 'perfectRound', label: 'Perfect Round', emoji: '💎' },
      { key: 'unstoppable10', label: 'Unstoppable (10-streak)', emoji: '🏆' },
    ];
    badgeListEl.innerHTML = '';
    defs.forEach(def => {
      const earned = !!badges[def.key];
      const el = document.createElement('div');
      el.className = `badge ${earned ? '' : 'locked'}`;
      el.innerHTML = `<span class="emoji">${def.emoji}</span><span>${def.label}</span>`;
      badgeListEl.appendChild(el);
    });
  }

  function showBadgeModal(badge) {
    modalBadge.innerHTML = `<span class="emoji">${badge.emoji}</span><span>${badge.label}</span>`;
    badgeModal.classList.add('show');
    badgeModal.setAttribute('aria-hidden', 'false');
    playWinSound();
  }

  function hideModal() {
    badgeModal.classList.remove('show');
    badgeModal.setAttribute('aria-hidden', 'true');
    badgeModal.classList.remove('show');
    badgeModal.parentElement?.classList?.remove?.('show');
    badgeModal.closest('.modal')?.classList?.remove('show');
    badgeModal.parentElement?.setAttribute?.('aria-hidden', 'true');
    badgeModal.closest('.modal')?.setAttribute?.('aria-hidden', 'true');
   
    badgeModal.parentElement?.style?.display;
    badgeModal.parentElement && (badgeModal.parentElement.classList.remove('show'));
    badgeModal.parentElement && (badgeModal.parentElement.setAttribute('aria-hidden', 'true'));
    document.getElementById('badgeModal').classList.remove('show');
    document.getElementById('badgeModal').setAttribute('aria-hidden', 'true');
  }

 
  function setStatus(msg) {
    statusMessage.textContent = msg;
  }

  function onModeChange() {
    saveSettings();
    newGame();
  }
  function onSymbolChange() {
    saveSettings();
    newGame();
  }

  function undoMove() {
    if (!moveHistory.length || gameOver) return;
    const last = moveHistory.pop();
    board[last.index] = null;
    renderBoard();
    turn = last.symbol;
    setStatus(getTurnLabel());
    
    if (isPvE() && moveHistory.length) {
      const last2 = moveHistory.pop();
      board[last2.index] = null;
      renderBoard();
      turn = last2.symbol;
      setStatus(getTurnLabel());
    }
    gameOver = false;
    cells.forEach(c => c.classList.remove('win'));
  }

  function showHint() {
    if (gameOver) return;
    const current = turn;
    let move;
    if (isPvE() && current !== playerSymbolEl.value) {
      
      move = bestMoveMinimax([...board], current);
    } else {
    
      move = bestMoveMinimax([...board], current);
    }
    if (typeof move === 'number') {
      cells.forEach(c => c.classList.remove('win'));
      cells[move].classList.add('win'); 
      setStatus(`Hint: try cell ${move + 1}`);
    }
  }

 
  const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
  function playClickSound() {
    if (!soundOn || !audioCtx) return;
    beep(180, 0.04);
  }
  function playWinSound() {
    if (!soundOn || !audioCtx) return;
    beep(660, 0.12);
    setTimeout(() => beep(880, 0.1), 120);
  }
  function beep(freq, duration) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    osc.start();
    setTimeout(() => { osc.stop(); }, duration * 1000);
  }

  function toggleSound() {
    soundOn = !soundOn;
    soundToggleBtn.textContent = soundOn ? '🔊 Sound' : '🔇 Sound';
    saveSettings();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    saveSettings();
  }

  newGame();

})();