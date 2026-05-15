let API;

if (window.location.hostname.includes("github.dev")) {
  API = window.location.origin.replace("-5500", "-3000");
} else if (window.location.hostname.includes("github.io")) {
  API = "https://sudoku-1g0x.onrender.com";
} else {
  API = "http://localhost:3000";
}

let notesMode = false;
let notes = Array.from({ length: 9 }, () =>
  Array.from({ length: 9 }, () => new Set())
);
let solvingByAdmin = false;

function cloneBoard(board) {
  return board.map(row => [...row]);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function isValid(board, row, col, num) {
  for (let x = 0; x < 9; x++) {
    if (x !== col && board[row][x] === num) return false;
  }
  for (let y = 0; y < 9; y++) {
    if (y !== row && board[y][col] === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const r = boxRow + y, c = boxCol + x;
      if ((r !== row || c !== col) && board[r][c] === num) return false;
    }
  }
  return true;
}

function findBestEmpty(board) {
  let bestCell = null;
  let smallest = 10;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] !== 0) continue;
      let options = 0;
      for (let num = 1; num <= 9; num++) {
        if (isValid(board, row, col, num)) options++;
      }
      if (options < smallest) {
        smallest = options;
        bestCell = { row, col };
      }
    }
  }
  return bestCell;
}

function solve(board) {
  const empty = findBestEmpty(board);
  if (!empty) return true;
  const { row, col } = empty;
  const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const num of numbers) {
    if (isValid(board, row, col, num)) {
      board[row][col] = num;
      if (solve(board)) return true;
      board[row][col] = 0;
    }
  }
  return false;
}

function countSolutions(board, limit = 2) {
  let count = 0;
  function helper(b) {
    if (count >= limit) return;
    const empty = findBestEmpty(b);
    if (!empty) { count++; return; }
    const { row, col } = empty;
    for (let num = 1; num <= 9; num++) {
      if (isValid(b, row, col, num)) {
        b[row][col] = num;
        helper(b);
        b[row][col] = 0;
      }
    }
  }
  helper(cloneBoard(board));
  return count;
}

function generateSolvedBoard() {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  solve(board);
  return board;
}

function generatePuzzle(clues = 34) {
  const board = generateSolvedBoard();
  const cells = [];
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < 9; col++)
      cells.push({ row, col });

  shuffle(cells);

  let filled = 81;
  let attempts = 0;
  let rejections = 0;

  for (const cell of cells) {
    if (filled <= clues) break;
    const { row, col } = cell;
    const backup = board[row][col];
    board[row][col] = 0;
    attempts++;

    if (countSolutions(board, 2) !== 1) {
      board[row][col] = backup;
      rejections++;
    } else {
      filled--;
    }
  }

  return { board, attempts, rejections };
}

function buildCandidateMap(board) {
  const map = [];
  for (let r = 0; r < 9; r++) {
    map[r] = [];
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) { map[r][c] = []; continue; }
      const candidates = [];
      for (let num = 1; num <= 9; num++)
        if (isValid(board, r, c, num)) candidates.push(num);
      map[r][c] = candidates;
    }
  }
  return map;
}

function eliminateFromPeers(map, r, c, num) {
  for (let i = 0; i < 9; i++) {
    map[r][i] = map[r][i].filter(n => n !== num);
    map[i][c] = map[i][c].filter(n => n !== num);
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dy = 0; dy < 3; dy++)
    for (let dx = 0; dx < 3; dx++)
      map[br + dy][bc + dx] = map[br + dy][bc + dx].filter(n => n !== num);
}

function applyNakedSingles(board, map) {
  let progress = false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0 || map[r][c].length !== 1) continue;
      const num = map[r][c][0];
      board[r][c] = num;
      map[r][c] = [];
      eliminateFromPeers(map, r, c, num);
      progress = true;
    }
  }
  return progress;
}

function applyHiddenSingles(board, map) {
  let progress = false;

  function tryPlace(r, c, num) {
    if (board[r][c] !== 0) return;
    board[r][c] = num;
    map[r][c] = [];
    eliminateFromPeers(map, r, c, num);
    progress = true;
  }

  for (let r = 0; r < 9; r++) {
    for (let num = 1; num <= 9; num++) {
      const cols = [];
      for (let c = 0; c < 9; c++)
        if (map[r][c].includes(num)) cols.push(c);
      if (cols.length === 1) tryPlace(r, cols[0], num);
    }
  }

  for (let c = 0; c < 9; c++) {
    for (let num = 1; num <= 9; num++) {
      const rows = [];
      for (let r = 0; r < 9; r++)
        if (map[r][c].includes(num)) rows.push(r);
      if (rows.length === 1) tryPlace(rows[0], c, num);
    }
  }

  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      for (let num = 1; num <= 9; num++) {
        const positions = [];
        for (let dy = 0; dy < 3; dy++)
          for (let dx = 0; dx < 3; dx++) {
            const r = br * 3 + dy, c = bc * 3 + dx;
            if (map[r][c].includes(num)) positions.push([r, c]);
          }
        if (positions.length === 1) tryPlace(positions[0][0], positions[0][1], num);
      }
    }
  }

  return progress;
}

function applyNakedPairs(board, map) {
  let progress = false;

  function processGroup(cells) {
    const pairs = cells.filter(([r, c]) => map[r][c].length === 2);
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const [r1, c1] = pairs[i];
        const [r2, c2] = pairs[j];
        const a = map[r1][c1], b = map[r2][c2];
        if (a[0] !== b[0] || a[1] !== b[1]) continue;
        for (const [r, c] of cells) {
          if ((r === r1 && c === c1) || (r === r2 && c === c2)) continue;
          const before = map[r][c].length;
          map[r][c] = map[r][c].filter(n => n !== a[0] && n !== a[1]);
          if (map[r][c].length < before) progress = true;
        }
      }
    }
  }

  for (let r = 0; r < 9; r++)
    processGroup(Array.from({ length: 9 }, (_, c) => [r, c]));

  for (let c = 0; c < 9; c++)
    processGroup(Array.from({ length: 9 }, (_, r) => [r, c]));

  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++) {
      const cells = [];
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++)
          cells.push([br * 3 + dy, bc * 3 + dx]);
      processGroup(cells);
    }

  return progress;
}

function isLogicSolvable(puzzle) {
  const board = cloneBoard(puzzle);
  const map = buildCandidateMap(board);

  while (true) {
    let progress = false;
    progress = applyNakedSingles(board, map) || progress;
    progress = applyHiddenSingles(board, map) || progress;
    progress = applyNakedPairs(board, map) || progress;
    if (!progress) break;
  }

  return board.every(row => row.every(cell => cell !== 0));
}

function generateLogicPuzzle(clues = 34) {
  let puzzleAttempts = 0;
  while (true) {
    puzzleAttempts++;
    const { board, attempts, rejections } = generatePuzzle(clues);
    if (isLogicSolvable(board)) {
      return { board, puzzleAttempts, attempts, rejections };
    }
  }
}

class SudokuBoard {
  constructor(board) {
    this.board = board.map(row => row.slice());
    this.fixed = Array.from({ length: 9 }, () => Array(9).fill(false));

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[r][c] !== 0) this.fixed[r][c] = true;
      }
    }
  }

  get(row, col) { return this.board[row][col]; }

  set(row, col, value) {
    if (!this.fixed[row][col]) this.board[row][col] = value;
  }

  isFixed(row, col) { return this.fixed[row][col]; }

  reset() {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (!this.fixed[r][c]) this.board[r][c] = 0;
  }

  clone() { return new SudokuBoard(this.board); }

  lockAllCells() {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        this.fixed[r][c] = true;
  }
}

class SudokuUI {
  constructor(boardManager) {
    this.boardManager = boardManager;
    this.boardElement = document.getElementById('board');
    this.selected = null;

    this.createBoard();
    this.createNumberPad();
  }

  createBoard() {
    this.boardElement.innerHTML = '';

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');

        if ((col + 1) % 3 === 0 && col < 8) cell.classList.add('border-right');
        if ((row + 1) % 3 === 0 && row < 8) cell.classList.add('border-bottom');

        const value = this.boardManager.get(row, col);
        if (value !== 0) cell.textContent = value;
        if (this.boardManager.isFixed(row, col)) cell.classList.add('fixed');

        cell.addEventListener('click', () => this.selectCell(row, col));
        this.boardElement.appendChild(cell);
      }
    }
  }

  selectCell(row, col) {
    if (this.boardManager.isFixed(row, col)) return;
    this.selected = { row, col };
    this.render();
  }

  createNumberPad() {
    const pad = document.getElementById('number-pad');
    pad.innerHTML = '';

    for (let num = 1; num <= 9; num++) {
      const btn = document.createElement('div');
      btn.classList.add('number-btn');
      btn.textContent = num;
      btn.addEventListener('click', () => this.inputNumber(num));
      pad.appendChild(btn);
    }
  }

  inputNumber(num) {
    if (!this.selected) return;
    const { row, col } = this.selected;

    if (notesMode) {
      if (notes[row][col].has(num)) notes[row][col].delete(num);
      else notes[row][col].add(num);
      this.render();
      return;
    }

    if (!isValid(this.boardManager.board, row, col, num)) return;

    notes[row][col].clear();
    this.boardManager.set(row, col, num);
    this.render();

    const cell = document.querySelectorAll('.cell')[row * 9 + col];
    if (cell) {
      cell.classList.add('pop');
      setTimeout(() => cell.classList.remove('pop'), 150);
    }
  }

  render() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.remove('selected', 'invalid', 'notes'));

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = cells[row * 9 + col];
        const value = this.boardManager.get(row, col);

        if (value === 0) {
          if (notes[row][col].size > 0) {
            cell.classList.add("notes");
            cell.innerHTML = `
              <div class="candidates">
                ${[1,2,3,4,5,6,7,8,9].map(n =>
                  `<div>${notes[row][col].has(n) ? n : ""}</div>`
                ).join("")}
              </div>
            `;
          } else {
            cell.textContent = "";
          }
        } else {
          cell.textContent = value;
        }

        if (this.selected && this.selected.row === row && this.selected.col === col)
          cell.classList.add('selected');

        if (value !== 0 && !isValid(this.boardManager.board, row, col, value))
          cell.classList.add('invalid');
      }
    }

    if (!solvingByAdmin && isBoardValid(this.boardManager.board)) showWinScreen();
  }
}

function isBoardValid(board) {
  for (let r = 0; r < 9; r++) {
    const seen = new Set();
    for (let c = 0; c < 9; c++) {
      const v = board[r][c];
      if (v < 1 || v > 9 || seen.has(v)) return false;
      seen.add(v);
    }
  }

  for (let c = 0; c < 9; c++) {
    const seen = new Set();
    for (let r = 0; r < 9; r++) {
      const v = board[r][c];
      if (v < 1 || v > 9 || seen.has(v)) return false;
      seen.add(v);
    }
  }

  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = new Set();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const v = board[br * 3 + r][bc * 3 + c];
          if (v < 1 || v > 9 || seen.has(v)) return false;
          seen.add(v);
        }
      }
    }
  }

  return true;
}

function showWinScreen() {
  stopTimer();
  const win = document.getElementById("win-screen");
  win.style.display = "block";
  win.classList.add("show");
  startConfetti();

  const user = getLoggedUser();
  win.textContent = user ? `🎉 Bravo ${user} ! 🎉` : "🎉 Puzzle Solved! 🎉";
}

function hideWinScreen() {
  const win = document.getElementById('win-screen');
  if (win) {
    win.classList.remove('show');
    win.style.display = "none";
    clearConfetti();
  }
}

function startConfetti() {
  const win = document.getElementById('win-screen');
  if (!win) return;

  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.background = `hsl(${Math.random() * 360}, 70%, 50%)`;
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    win.appendChild(confetti);
    setTimeout(() => confetti.remove(), 3000);
  }
}

function clearConfetti() {
  const win = document.getElementById('win-screen');
  if (!win) return;
  win.querySelectorAll('.confetti').forEach(p => p.remove());
}

function getLoggedUser() {
  return localStorage.getItem("loggedUser");
}

function setLoggedUser(username) {
  if (username) localStorage.setItem("loggedUser", username);
  else localStorage.removeItem("loggedUser");
}

function isAdmin() {
  return getLoggedUser() === "Admin";
}

async function loginUser(username, password) {
  const res = await fetch(`${API}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!res.ok) { showToast("❌ " + data.error); return false; }

  localStorage.setItem("token", data.token);
  localStorage.setItem("loggedUser", data.username);
  updateAccountUI();
  showToast("🎉 Logged in!");
  return true;
}

async function registerUser(username, password) {
  const res = await fetch(`${API}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!res.ok) { showToast("❌ " + data.error); return false; }

  showToast("✅ Account created!");
  return true;
}

function logoutUser() {
  localStorage.removeItem("token");
  localStorage.removeItem("loggedUser");
  updateAccountUI();
  showToast("👋 Logged out");
}

function updateAccountUI() {
  const display = document.getElementById("account-display");
  const login = document.getElementById("account-login");
  const usernameSpan = document.getElementById("account-username");
  const solveBtn = document.getElementById("solve");
  const user = getLoggedUser();

  if (user) {
    display.style.display = "flex";
    login.style.display = "none";
    usernameSpan.textContent = "Logged as: " + user;
    solveBtn.style.display = isAdmin() ? "inline-block" : "none";
  } else {
    display.style.display = "none";
    login.style.display = "flex";
    solveBtn.style.display = "none";
  }

  updateAdminDebug();
}

function updateAdminDebug() {
  document.getElementById("admin-debug").style.display = isAdmin() ? "block" : "none";
}

function refreshDebugData() {
  document.getElementById("debug-output").textContent =
    "Logged user: " + getLoggedUser() + "\n\nAccounts: (server-side only)";
}

document.getElementById("debug-refresh").addEventListener("click", () => {
  refreshDebugData();
  showToast("🔍 Debug data refreshed");
});

document.getElementById("debug-clear").addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("loggedUser");
  showToast("🗑️ Local storage cleared");
  refreshDebugData();
});

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

let boardManager, ui, timer, interval;

function startTimer() {
  clearInterval(interval);
  timer = 0;

  interval = setInterval(() => {
    timer++;
    const minutes = String(Math.floor(timer / 60)).padStart(2, '0');
    const seconds = String(timer % 60).padStart(2, '0');
    document.getElementById('timer').textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(interval);
}

function newGame() {
  const clues = Number(document.getElementById('difficulty').value);
  document.getElementById('gen-stats').textContent = 'Generating puzzle…';

  setTimeout(() => {
    const { board } = generateLogicPuzzle(clues);
    boardManager = new SudokuBoard(board);
    ui = new SudokuUI(boardManager);
    hideWinScreen();
    startTimer();
    document.getElementById('gen-stats').textContent = 'Puzzle Ready !!!';
  }, 20);
}

updateAccountUI();

document.getElementById('new-game').addEventListener('click', newGame);

document.getElementById('solve').addEventListener('click', () => {
  solvingByAdmin = true;
  solve(boardManager.board);
  boardManager.lockAllCells();
  ui.render();
  showWinScreen();
  solvingByAdmin = false;
});

document.getElementById('reset').addEventListener('click', () => {
  hideWinScreen();
  boardManager.reset();
  ui.render();
});

document.getElementById('win-screen').addEventListener('click', hideWinScreen);

document.addEventListener('keydown', event => {
  if (!ui || !ui.selected) return;
  const key = Number(event.key);

  if (key >= 1 && key <= 9) ui.inputNumber(key);

  if (event.key === 'Backspace' || event.key === 'Delete') {
    const { row, col } = ui.selected;
    boardManager.set(row, col, 0);
    notes[row][col].clear();
    ui.render();
  }
});

document.getElementById("notes-toggle").addEventListener("click", () => {
  notesMode = !notesMode;
  document.getElementById("notes-toggle").textContent =
    notesMode ? "✏️ Notes ON" : "✏️ Notes";
});

document.getElementById("theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

document.getElementById("account-toggle").addEventListener("click", () => {
  const panel = document.getElementById("account-panel");
  panel.style.display = (panel.style.display === "flex") ? "none" : "flex";
});

document.getElementById("login-btn").addEventListener("click", () => {
  const u = document.getElementById("login-username").value.trim();
  const p = document.getElementById("login-password").value;
  loginUser(u, p);
});

document.getElementById("register-btn").addEventListener("click", async () => {
  const u = document.getElementById("login-username").value.trim();
  const p = document.getElementById("login-password").value;
  const success = await registerUser(u, p);
  if (success) await loginUser(u, p);
});

document.getElementById("logout-btn").addEventListener("click", logoutUser);

updateAccountUI();
newGame();