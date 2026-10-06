/**
 * Minesweeper
 *
 * The board is a 2D array of cell objects: grid[row][col].
 * Each cell tracks: { mine, revealed, flagged, adjacent }.
 * Mines are placed on the first click so that click (and the cells around it)
 * can never be a mine.
 */

const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

const FLAG_GLYPH = "✿";
const MINE_GLYPH = "✹";
const LONG_PRESS_MS = 400;
const MAX_AMBIENT_PETALS = 18;

const dom = {
  board: document.getElementById("board"),
  minesLeft: document.getElementById("mines"),
  time: document.getElementById("time"),
  status: document.getElementById("status"),
  flagToggle: document.getElementById("flagmode"),
  restart: document.getElementById("restart"),
  levelButtons: document.querySelectorAll("#levels .opt"),
  petals: document.getElementById("petals"),
};

const state = {
  difficulty: "beginner",
  rows: 0,
  cols: 0,
  mineCount: 0,
  grid: [],
  minesPlaced: false,
  gameOver: false,
  flagsUsed: 0,
  revealedCount: 0,
  elapsed: 0,
  timerId: null,
  flagMode: false,
};

/* ---------- Setup ---------- */

function startGame() {
  clearInterval(state.timerId);

  const { rows, cols, mines } = DIFFICULTIES[state.difficulty];
  Object.assign(state, {
    rows,
    cols,
    mineCount: mines,
    grid: createGrid(rows, cols),
    minesPlaced: false,
    gameOver: false,
    flagsUsed: 0,
    revealedCount: 0,
    elapsed: 0,
    timerId: null,
  });

  buildBoardElements();
  dom.minesLeft.textContent = state.mineCount;
  dom.time.textContent = 0;
  dom.status.textContent = "";
  dom.status.className = "";
}

function createGrid(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    }))
  );
}

function buildBoardElements() {
  dom.board.replaceChildren();
  dom.board.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell))`;

  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const button = document.createElement("button");
      button.className = "cell";
      button.dataset.row = row;
      button.dataset.col = col;
      dom.board.appendChild(button);
    }
  }
}

function cellElement(row, col) {
  return dom.board.children[row * state.cols + col];
}

/* ---------- Board logic ---------- */

/** Calls fn(row, col) for each in-bounds cell touching (row, col). */
function forEachNeighbor(row, col, fn) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
        fn(r, c);
      }
    }
  }
}

function countFlaggedNeighbors(row, col) {
  let count = 0;
  forEachNeighbor(row, col, (r, c) => {
    if (state.grid[r][c].flagged) count++;
  });
  return count;
}

/** Randomly places mines, keeping the first click and its neighbors clear. */
function placeMines(safeRow, safeCol) {
  const candidates = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const nearFirstClick = Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1;
      if (!nearFirstClick) candidates.push([r, c]);
    }
  }

  // Fisher-Yates shuffle, then take the first `mineCount` positions
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const [r, c] of candidates.slice(0, state.mineCount)) {
    state.grid[r][c].mine = true;
  }

  // Precompute the adjacent mine count for every cell
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      let count = 0;
      forEachNeighbor(r, c, (nr, nc) => {
        if (state.grid[nr][nc].mine) count++;
      });
      state.grid[r][c].adjacent = count;
    }
  }

  state.minesPlaced = true;
}

function startTimer() {
  state.timerId = setInterval(() => {
    state.elapsed++;
    dom.time.textContent = state.elapsed;
  }, 1000);
}

function reveal(row, col) {
  const cell = state.grid[row][col];
  if (state.gameOver || cell.revealed || cell.flagged) return;

  if (!state.minesPlaced) {
    placeMines(row, col);
    startTimer();
  }

  if (cell.mine) {
    lose(row, col);
    return;
  }

  floodReveal(row, col);

  if (state.revealedCount === state.rows * state.cols - state.mineCount) {
    win();
  }
}

/**
 * Reveals a cell, and keeps expanding through cells with no adjacent mines.
 * Uses an explicit stack rather than recursion so large empty regions
 * can't overflow the call stack.
 */
function floodReveal(startRow, startCol) {
  const stack = [[startRow, startCol]];

  while (stack.length > 0) {
    const [row, col] = stack.pop();
    const cell = state.grid[row][col];
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;
    state.revealedCount++;
    render(row, col);

    if (cell.adjacent === 0) {
      forEachNeighbor(row, col, (r, c) => stack.push([r, c]));
    }
  }
}

function toggleFlag(row, col) {
  const cell = state.grid[row][col];
  if (state.gameOver || cell.revealed) return;

  cell.flagged = !cell.flagged;
  state.flagsUsed += cell.flagged ? 1 : -1;
  dom.minesLeft.textContent = state.mineCount - state.flagsUsed;
  render(row, col);
}

/** Clicking a revealed number with enough flags around it reveals the rest. */
function chord(row, col) {
  const cell = state.grid[row][col];
  if (state.gameOver || !cell.revealed || cell.adjacent === 0) return;
  if (countFlaggedNeighbors(row, col) !== cell.adjacent) return;

  forEachNeighbor(row, col, (r, c) => reveal(r, c));
}

/* ---------- Rendering ---------- */

function render(row, col) {
  const cell = state.grid[row][col];
  const element = cellElement(row, col);

  element.className = "cell";
  element.textContent = "";

  if (cell.revealed) {
    element.classList.add("open");
    if (cell.mine) {
      element.classList.add("mine");
      element.textContent = MINE_GLYPH;
    } else if (cell.adjacent > 0) {
      element.classList.add(`n${cell.adjacent}`);
      element.textContent = cell.adjacent;
    }
  } else if (cell.flagged) {
    element.classList.add("flag");
    element.textContent = FLAG_GLYPH;
  }
}

/* ---------- End of game ---------- */

function endGame(outcome, message) {
  state.gameOver = true;
  clearInterval(state.timerId);
  dom.status.className = outcome;
  dom.status.textContent = message;
}

function lose(hitRow, hitCol) {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      if (cell.mine && !cell.flagged) {
        cell.revealed = true;
        render(r, c);
      } else if (!cell.mine && cell.flagged) {
        cellElement(r, c).classList.add("wrong");
      }
    }
  }

  cellElement(hitRow, hitCol).classList.add("boom");
  endGame("lose", `Mine hit after ${state.elapsed}s. Press New game to try again.`);
}

function win() {
  // Flag any mines the player didn't mark
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
        render(r, c);
      }
    }
  }

  state.flagsUsed = state.mineCount;
  dom.minesLeft.textContent = 0;
  endGame("win", `Garden cleared in ${state.elapsed}s.`);
  spawnPetals(70);
}

/* ---------- Falling petals (decoration) ---------- */

function spawnPetals(count) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  for (let i = 0; i < count; i++) {
    const petal = document.createElement("div");
    petal.className = "petal";
    petal.style.left = `${Math.random() * 100}vw`;
    petal.style.setProperty("--s", `${10 + Math.random() * 12}px`);
    petal.style.setProperty("--d", `${7 + Math.random() * 8}s`);
    petal.style.setProperty("--x", `${Math.random() * 160 - 40}px`);
    // Stagger bursts so they don't all fall in a single sheet
    petal.style.animationDelay = count > 5 ? `${Math.random() * 2.5}s` : "0s";
    petal.addEventListener("animationend", () => petal.remove());
    dom.petals.appendChild(petal);
  }
}

setInterval(() => {
  if (!document.hidden && dom.petals.childElementCount < MAX_AMBIENT_PETALS) {
    spawnPetals(1);
  }
}, 1100);

/* ---------- Input ---------- */

let longPressTimer = null;
let longPressFired = false;

/** Returns { row, col } for the cell an event happened on, or null. */
function cellFromEvent(event) {
  const element = event.target.closest(".cell");
  if (!element) return null;
  return { row: Number(element.dataset.row), col: Number(element.dataset.col) };
}

dom.board.addEventListener("click", (event) => {
  const target = cellFromEvent(event);
  if (!target) return;

  // A long press already placed a flag; ignore the click that follows it
  if (longPressFired) {
    longPressFired = false;
    return;
  }

  const { row, col } = target;
  if (state.grid[row][col].revealed) {
    chord(row, col);
  } else if (state.flagMode) {
    toggleFlag(row, col);
  } else {
    reveal(row, col);
  }
});

dom.board.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const target = cellFromEvent(event);
  if (target) toggleFlag(target.row, target.col);
});

dom.board.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  const target = cellFromEvent(event);
  if (!target) return;

  longPressFired = false;
  longPressTimer = setTimeout(() => {
    longPressFired = true;
    toggleFlag(target.row, target.col);
  }, LONG_PRESS_MS);
});

["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
  dom.board.addEventListener(type, () => clearTimeout(longPressTimer));
});

dom.restart.addEventListener("click", startGame);

dom.levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.difficulty = button.dataset.level;
    dom.levelButtons.forEach((b) => b.setAttribute("aria-pressed", b === button));
    startGame();
  });
});

dom.flagToggle.addEventListener("click", () => {
  state.flagMode = !state.flagMode;
  dom.flagToggle.setAttribute("aria-pressed", state.flagMode);
});

/* ---------- Init ---------- */

startGame();
spawnPetals(8);
