import assert from "node:assert/strict";
import test from "node:test";
import {
  countSudokuSolutions,
  createMiniSudoku,
  dailySudokuDifficulty,
  isSudokuSolved,
  miniSudokuRegions,
  sudokuConflicts,
} from "../apps/mini-sudoku/lib/sudoku.ts";

test("daily Mini Sudoku is deterministic and uniquely solvable", () => {
  for (const dateKey of ["2026-08-14", "2026-08-15", "2026-08-16"]) {
    const first = createMiniSudoku({ mode: "daily", dailyKey: dateKey });
    const second = createMiniSudoku({ mode: "daily", dailyKey: dateKey });
    assert.deepEqual(first, second);
    assert.equal(countSudokuSolutions(first.givens, first.regions), 1);
  }
});

test("practice generation covers all clue difficulties", () => {
  const clueCounts: number[] = [];
  for (const difficulty of ["relaxed", "focused", "expert"] as const) {
    const puzzle = createMiniSudoku({ mode: "practice", difficulty, practiceIndex: 5 });
    clueCounts.push(puzzle.givens.filter(Boolean).length);
    assert.equal(countSudokuSolutions(puzzle.givens, puzzle.regions), 1);
    assert.equal(isSudokuSolved(puzzle.solution, puzzle), true);
  }
  assert.ok(clueCounts[0] >= clueCounts[1]);
  assert.ok(clueCounts[1] >= clueCounts[2]);
});

test("regions contain six cells and difficulty rotates", () => {
  const regions = miniSudokuRegions();
  for (let region = 0; region < 6; region += 1) {
    assert.equal(regions.filter((value) => value === region).length, 6);
  }
  assert.notEqual(dailySudokuDifficulty("2026-08-14"), dailySudokuDifficulty("2026-08-15"));
});

test("duplicate digits are reported as conflicts", () => {
  const puzzle = createMiniSudoku({ mode: "practice", difficulty: "relaxed", practiceIndex: 1 });
  const board = Array(36).fill(0);
  board[0] = 3;
  board[1] = 3;
  assert.deepEqual([...sudokuConflicts(board, puzzle.regions)].sort((a, b) => a - b), [0, 1]);
});
