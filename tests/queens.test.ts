import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticXs,
  countSolutions,
  createPuzzle,
  crownConflicts,
  dailyDifficulty,
  daysBetweenDateKeys,
  easternDateKey,
  isSolved,
  regionsAreConnected,
  type CellMark,
} from "../lib/queens.ts";

test("daily generation is deterministic and uniquely solvable", () => {
  for (const dateKey of ["2026-03-07", "2026-03-08", "2026-03-09"]) {
    const first = createPuzzle({ mode: "daily", dailyKey: dateKey });
    const second = createPuzzle({ mode: "daily", dailyKey: dateKey });
    assert.deepEqual(first, second);
    assert.equal(countSolutions(first.regions, first.size), 1);
    assert.equal(regionsAreConnected(first.regions, first.size), true);
  }
});

test("practice generation covers all board sizes", () => {
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    const puzzle = createPuzzle({ mode: "practice", difficulty, practiceIndex: 4 });
    assert.equal(puzzle.size, difficulty === "easy" ? 6 : difficulty === "medium" ? 7 : 8);
    assert.equal(countSolutions(puzzle.regions, puzzle.size), 1);
  }
});

test("difficulty rotates and date arithmetic survives DST dates", () => {
  assert.notEqual(dailyDifficulty("2026-03-07"), dailyDifficulty("2026-03-08"));
  assert.equal(daysBetweenDateKeys("2026-03-07", "2026-03-08"), 1);
  assert.equal(daysBetweenDateKeys("2026-11-01", "2026-11-02"), 1);
  assert.equal(easternDateKey(new Date("2026-03-08T04:30:00Z")), "2026-03-07");
  assert.equal(easternDateKey(new Date("2026-03-08T05:30:00Z")), "2026-03-08");
});

test("rule validation, derived Xs, and completion agree", () => {
  const puzzle = createPuzzle({ mode: "practice", difficulty: "easy", practiceIndex: 2 });
  const solved: CellMark[] = Array(puzzle.size ** 2).fill("empty");
  puzzle.solution.forEach((column, row) => { solved[row * puzzle.size + column] = "crown"; });
  assert.equal(isSolved(solved, puzzle), true);
  assert.equal(crownConflicts(solved, puzzle.regions, puzzle.size).size, 0);
  const xs = automaticXs(solved, puzzle.regions, puzzle.size);
  assert.equal(xs.size, puzzle.size ** 2 - puzzle.size);

  const broken = [...solved];
  broken[puzzle.solution[0]] = "empty";
  broken[puzzle.solution[0] === 0 ? 1 : 0] = "crown";
  assert.equal(isSolved(broken, puzzle), false);
});
