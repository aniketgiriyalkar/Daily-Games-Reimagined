import {
  easternDateKey,
  hashSeed,
  randomFromSeed,
  shuffled,
} from "@daily-games/game-core";

export type SudokuDifficulty = "relaxed" | "focused" | "expert";
export type SudokuMode = "daily" | "practice";

export interface MiniSudokuPuzzle {
  id: string;
  generatorVersion: 1;
  mode: SudokuMode;
  difficulty: SudokuDifficulty;
  size: 6;
  regions: number[];
  givens: number[];
  solution: number[];
  dailyKey?: string;
}

const TARGET_CLUES: Record<SudokuDifficulty, number> = {
  relaxed: 22,
  focused: 17,
  expert: 13,
};

export function miniSudokuRegions(): number[] {
  return Array.from({ length: 36 }, (_, index) => {
    const row = Math.floor(index / 6);
    const column = index % 6;
    return Math.floor(row / 2) * 2 + Math.floor(column / 3);
  });
}

function baseSolution(): number[] {
  const shifts = [0, 3, 1, 4, 2, 5];
  return Array.from({ length: 36 }, (_, index) => {
    const row = Math.floor(index / 6);
    const column = index % 6;
    return ((column + shifts[row]) % 6) + 1;
  });
}

function createSolution(random: () => number): number[] {
  const source = baseSolution();
  const digits = shuffled([1, 2, 3, 4, 5, 6], random);
  const rowBands = shuffled([0, 1, 2], random);
  const columnStacks = shuffled([0, 1], random);
  const rows = rowBands.flatMap((band) =>
    shuffled([band * 2, band * 2 + 1], random),
  );
  const columns = columnStacks.flatMap((stack) =>
    shuffled([stack * 3, stack * 3 + 1, stack * 3 + 2], random),
  );
  return rows.flatMap((row) =>
    columns.map((column) => digits[source[row * 6 + column] - 1]),
  );
}

function candidates(board: number[], index: number, regions: number[]): number[] {
  if (board[index]) return [];
  const row = Math.floor(index / 6);
  const column = index % 6;
  const region = regions[index];
  const used = new Set<number>();
  for (let cursor = 0; cursor < 36; cursor += 1) {
    if (
      Math.floor(cursor / 6) === row ||
      cursor % 6 === column ||
      regions[cursor] === region
    ) {
      if (board[cursor]) used.add(board[cursor]);
    }
  }
  return [1, 2, 3, 4, 5, 6].filter((value) => !used.has(value));
}

export function countSudokuSolutions(
  input: number[],
  regions = miniSudokuRegions(),
  limit = 2,
): number {
  const board = [...input];
  let solutions = 0;
  const search = () => {
    if (solutions >= limit) return;
    let target = -1;
    let options: number[] = [];
    for (let index = 0; index < board.length; index += 1) {
      if (board[index]) continue;
      const next = candidates(board, index, regions);
      if (!next.length) return;
      if (target === -1 || next.length < options.length) {
        target = index;
        options = next;
      }
    }
    if (target === -1) {
      solutions += 1;
      return;
    }
    for (const value of options) {
      board[target] = value;
      search();
      board[target] = 0;
    }
  };
  search();
  return solutions;
}

export function dailySudokuDifficulty(dateKey: string): SudokuDifficulty {
  const epoch = Date.parse("2026-01-01T12:00:00Z");
  const offset = Math.floor((Date.parse(`${dateKey}T12:00:00Z`) - epoch) / 86_400_000);
  return (["relaxed", "focused", "expert"] as const)[((offset % 3) + 3) % 3];
}

function carvePuzzle(solution: number[], difficulty: SudokuDifficulty, random: () => number): number[] {
  const board = [...solution];
  const regions = miniSudokuRegions();
  const target = TARGET_CLUES[difficulty];
  for (const index of shuffled(Array.from({ length: 36 }, (_, cell) => cell), random)) {
    if (board.filter(Boolean).length <= target) break;
    const previous = board[index];
    board[index] = 0;
    if (countSudokuSolutions(board, regions, 2) !== 1) board[index] = previous;
  }
  return board;
}

export function createMiniSudoku(options: {
  mode: SudokuMode;
  difficulty?: SudokuDifficulty;
  dailyKey?: string;
  practiceIndex?: number;
}): MiniSudokuPuzzle {
  const dailyKey = options.dailyKey ?? easternDateKey();
  const difficulty = options.mode === "daily"
    ? dailySudokuDifficulty(dailyKey)
    : (options.difficulty ?? "focused");
  const seed = options.mode === "daily"
    ? `mini-sudoku-v1:daily:${dailyKey}`
    : `mini-sudoku-v1:practice:${difficulty}:${options.practiceIndex ?? 0}`;
  const random = randomFromSeed(hashSeed(seed));
  const solution = createSolution(random);
  const givens = carvePuzzle(solution, difficulty, random);
  return {
    id: seed,
    generatorVersion: 1,
    mode: options.mode,
    difficulty,
    size: 6,
    regions: miniSudokuRegions(),
    givens,
    solution,
    dailyKey: options.mode === "daily" ? dailyKey : undefined,
  };
}

export function sudokuConflicts(values: number[], regions = miniSudokuRegions()): Set<number> {
  const conflicts = new Set<number>();
  for (let left = 0; left < 36; left += 1) {
    if (!values[left]) continue;
    for (let right = left + 1; right < 36; right += 1) {
      if (values[left] !== values[right]) continue;
      if (
        Math.floor(left / 6) === Math.floor(right / 6) ||
        left % 6 === right % 6 ||
        regions[left] === regions[right]
      ) {
        conflicts.add(left);
        conflicts.add(right);
      }
    }
  }
  return conflicts;
}

export function isSudokuSolved(values: number[], puzzle: MiniSudokuPuzzle): boolean {
  return values.every((value, index) => value === puzzle.solution[index]);
}
