# Minesweeper

A Minesweeper game built with plain HTML, CSS, and JavaScript. There are no dependencies and no build step. It uses a navy night-sky and sakura-pink theme, with a cherry blossom branch in the corner, falling petals, and a petal shower when you win.

## Running it

Open `index.html` in a browser.

## Controls

- **Left click**: reveal a cell
- **Right click**: place or remove a flag (long-press on a touch screen, or use the Flag mode button)
- **Click a revealed number** that has the right number of flags around it to reveal its remaining neighbors (chording)

## Features

- Three difficulties: Beginner (9x9, 10 mines), Intermediate (16x16, 40 mines), Expert (30x16, 99 mines)
- The first click is always safe: mines are placed after it, never on that cell or its neighbors
- Empty regions open automatically
- Mine counter and timer
- Incorrect flags are marked when you lose
- Petal animation respects the `prefers-reduced-motion` setting

## Project structure

- `index.html`: page layout and the blossom branch (inline SVG)
- `style.css`: theme and board styling
- `game.js`: game logic

## Implementation notes

- The board is a 2D array of cell objects (`mine`, `revealed`, `flagged`, `adjacent`), indexed `grid[row][col]`.
- Mine placement builds a list of every eligible position (everything outside the 3x3 area around the first click), shuffles it with Fisher-Yates, and takes the first N positions.
- Revealing an empty cell expands outward with an iterative flood fill that uses an explicit stack. Recursion could overflow the call stack on a large empty region.
- The game is won when the number of revealed cells equals the total number of cells minus the number of mines.

## Hosting

To publish it with GitHub Pages: Settings, then Pages, then deploy from the `main` branch (root folder).
