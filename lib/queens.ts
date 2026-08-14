export type Difficulty = "easy" | "medium" | "hard";
export type GameMode = "daily" | "practice";
export type CellMark = "empty" | "x" | "crown";

export interface QueensPuzzle {
  id: string;
  generatorVersion: 1;
  mode: GameMode;
  difficulty: Difficulty;
  size: 6 | 7 | 8;
  regions: number[];
  solution: number[];
  dailyKey?: string;
}

export const SIZE_BY_DIFFICULTY: Record<Difficulty, 6 | 7 | 8> = {
  easy: 6,
  medium: 7,
  hard: 8,
};

const EASTERN_TIME_ZONE = "America/New_York";

export function easternDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function daysBetweenDateKeys(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000,
  );
}

export function dailyDifficulty(dateKey: string): Difficulty {
  const epoch = Date.parse("2026-01-01T12:00:00Z");
  const offset = Math.floor((Date.parse(`${dateKey}T12:00:00Z`) - epoch) / 86_400_000);
  return (["easy", "medium", "hard"] as const)[((offset % 3) + 3) % 3];
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let result = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function orthogonalNeighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const column = index % size;
  const result: number[] = [];
  if (row > 0) result.push(index - size);
  if (row < size - 1) result.push(index + size);
  if (column > 0) result.push(index - 1);
  if (column < size - 1) result.push(index + 1);
  return result;
}

function growRegions(size: number, random: () => number): number[] {
  const regions = Array<number>(size * size).fill(-1);
  const counts = Array<number>(size).fill(1);
  const seeds = shuffled(Array.from({ length: size * size }, (_, index) => index), random).slice(0, size);
  seeds.forEach((cell, region) => {
    regions[cell] = region;
  });

  let remaining = size * size - size;
  while (remaining > 0) {
    const candidates: Array<{ index: number; options: number[] }> = [];
    for (let index = 0; index < regions.length; index += 1) {
      if (regions[index] !== -1) continue;
      const options = [...new Set(
        orthogonalNeighbors(index, size)
          .map((neighbor) => regions[neighbor])
          .filter((region) => region >= 0),
      )];
      if (options.length) candidates.push({ index, options });
    }
    const candidate = candidates[Math.floor(random() * candidates.length)];
    const weighted = shuffled(candidate.options, random).sort(
      (a, b) => counts[a] - counts[b] || random() - 0.5,
    );
    const region = weighted[0];
    regions[candidate.index] = region;
    counts[region] += 1;
    remaining -= 1;
  }
  return regions;
}

function solveRegions(regions: number[], size: number, limit = 2): number[][] {
  const solutions: number[][] = [];
  const columns = new Set<number>();
  const usedRegions = new Set<number>();
  const placement: number[] = [];

  const search = (row: number) => {
    if (solutions.length >= limit) return;
    if (row === size) {
      solutions.push([...placement]);
      return;
    }
    for (let column = 0; column < size; column += 1) {
      const region = regions[row * size + column];
      if (columns.has(column) || usedRegions.has(region)) continue;
      if (row > 0 && Math.abs(placement[row - 1] - column) <= 1) continue;
      columns.add(column);
      usedRegions.add(region);
      placement[row] = column;
      search(row + 1);
      columns.delete(column);
      usedRegions.delete(region);
    }
  };
  search(0);
  return solutions;
}

export function countSolutions(regions: number[], size: number, limit = 2): number {
  return solveRegions(regions, size, limit).length;
}

export function regionsAreConnected(regions: number[], size: number): boolean {
  for (let region = 0; region < size; region += 1) {
    const cells = regions
      .map((value, index) => ({ value, index }))
      .filter((cell) => cell.value === region)
      .map((cell) => cell.index);
    if (!cells.length) return false;
    const seen = new Set<number>([cells[0]]);
    const queue = [cells[0]];
    while (queue.length) {
      const current = queue.shift()!;
      for (const neighbor of orthogonalNeighbors(current, size)) {
        if (regions[neighbor] === region && !seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

function generateUnique(seedText: string, size: 6 | 7 | 8) {
  const random = randomFromSeed(hashSeed(seedText));
  for (let attempt = 0; attempt < 4_000; attempt += 1) {
    const regions = growRegions(size, random);
    const solutions = solveRegions(regions, size, 2);
    if (solutions.length === 1) return { solution: solutions[0], regions };
  }
  throw new Error(`Unable to generate a unique ${size}×${size} Queens board.`);
}

export function createPuzzle(options: {
  mode: GameMode;
  difficulty?: Difficulty;
  dailyKey?: string;
  practiceIndex?: number;
}): QueensPuzzle {
  const dailyKey = options.dailyKey ?? easternDateKey();
  const difficulty = options.mode === "daily"
    ? dailyDifficulty(dailyKey)
    : (options.difficulty ?? "medium");
  const size = SIZE_BY_DIFFICULTY[difficulty];
  const seed = options.mode === "daily"
    ? `queens-v1:daily:${dailyKey}:${size}`
    : `queens-v1:practice:${difficulty}:${options.practiceIndex ?? 0}`;
  const generated = generateUnique(seed, size);
  return {
    id: seed,
    generatorVersion: 1,
    mode: options.mode,
    difficulty,
    size,
    regions: generated.regions,
    solution: generated.solution,
    dailyKey: options.mode === "daily" ? dailyKey : undefined,
  };
}

export function crownConflicts(
  marks: CellMark[],
  regions: number[],
  size: number,
): Set<number> {
  const crowns = marks
    .map((mark, index) => ({ mark, index }))
    .filter((cell) => cell.mark === "crown")
    .map((cell) => cell.index);
  const conflicts = new Set<number>();
  for (let left = 0; left < crowns.length; left += 1) {
    for (let right = left + 1; right < crowns.length; right += 1) {
      const a = crowns[left];
      const b = crowns[right];
      const ar = Math.floor(a / size);
      const ac = a % size;
      const br = Math.floor(b / size);
      const bc = b % size;
      if (
        ar === br ||
        ac === bc ||
        regions[a] === regions[b] ||
        (Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1)
      ) {
        conflicts.add(a);
        conflicts.add(b);
      }
    }
  }
  return conflicts;
}

export function automaticXs(
  marks: CellMark[],
  regions: number[],
  size: number,
): Set<number> {
  const result = new Set<number>();
  marks.forEach((mark, crown) => {
    if (mark !== "crown") return;
    const row = Math.floor(crown / size);
    const column = crown % size;
    const region = regions[crown];
    marks.forEach((otherMark, index) => {
      if (index === crown || otherMark === "crown") return;
      const otherRow = Math.floor(index / size);
      const otherColumn = index % size;
      if (
        otherRow === row ||
        otherColumn === column ||
        regions[index] === region ||
        (Math.abs(otherRow - row) <= 1 && Math.abs(otherColumn - column) <= 1)
      ) result.add(index);
    });
  });
  return result;
}

export function isSolved(marks: CellMark[], puzzle: QueensPuzzle): boolean {
  if (crownConflicts(marks, puzzle.regions, puzzle.size).size) return false;
  const crowns = marks.filter((mark) => mark === "crown").length;
  if (crowns !== puzzle.size) return false;
  return puzzle.solution.every(
    (column, row) => marks[row * puzzle.size + column] === "crown",
  );
}
