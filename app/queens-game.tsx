"use client";

import { CSSProperties, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  automaticXs,
  CellMark,
  createPuzzle,
  crownConflicts,
  daysBetweenDateKeys,
  Difficulty,
  easternDateKey,
  GameMode,
  isSolved,
  QueensPuzzle,
} from "@/lib/queens";

const STORAGE = {
  settings: "queens-reimagined:v1:settings",
  stats: "queens-reimagined:v1:stats",
};

interface Settings {
  autoCheck: boolean;
  autoXs: boolean;
}

interface SavedGame {
  puzzleId: string;
  marks: CellMark[];
  elapsed: number;
  hints: number;
  completed: boolean;
}

interface Stats {
  currentStreak: number;
  longestStreak: number;
  lastDaily?: string;
  dailyWins: number;
  practiceWins: number;
  best: Partial<Record<Difficulty, number>>;
  completedIds: string[];
}

const DEFAULT_STATS: Stats = {
  currentStreak: 0,
  longestStreak: 0,
  dailyWins: 0,
  practiceWins: 0,
  best: {},
  completedIds: [],
};

const REGION_COLORS = [
  "#c9b6ff",
  "#83c7f4",
  "#f5a5b9",
  "#f6cc72",
  "#81d6b6",
  "#f0a678",
  "#a9c6ff",
  "#d9a7d9",
];

const displayTime = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60)
    .toString()
    .padStart(2, "0")}`;

const gameStorageKey = (puzzle: QueensPuzzle) =>
  `queens-reimagined:v1:game:${puzzle.id}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function QueensGame() {
  const [mode, setMode] = useState<GameMode>("daily");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [dateKey, setDateKey] = useState(() => easternDateKey());
  const puzzle = useMemo(
    () => createPuzzle({ mode, difficulty, practiceIndex, dailyKey: dateKey }),
    [mode, difficulty, practiceIndex, dateKey],
  );
  const [marks, setMarks] = useState<CellMark[]>(() => Array(puzzle.size ** 2).fill("empty"));
  const [history, setHistory] = useState<CellMark[][]>([]);
  const [settings, setSettings] = useState<Settings>({ autoCheck: true, autoXs: true });
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [hints, setHints] = useState(0);
  const [hintCell, setHintCell] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const completedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettings(readJson(STORAGE.settings, { autoCheck: true, autoXs: true }));
      setStats(readJson(STORAGE.stats, DEFAULT_STATS));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const saved = readJson<SavedGame | null>(gameStorageKey(puzzle), null);
      if (saved?.puzzleId === puzzle.id && saved.marks.length === puzzle.size ** 2) {
        setMarks(saved.marks);
        setElapsed(saved.elapsed);
        setHints(saved.hints);
        setCompleted(saved.completed);
        setStarted(saved.elapsed > 0 && !saved.completed);
        completedRef.current = saved.completed;
      } else {
        setMarks(Array(puzzle.size ** 2).fill("empty"));
        setElapsed(0);
        setHints(0);
        setCompleted(false);
        setStarted(false);
        completedRef.current = false;
      }
      setHistory([]);
      setHintCell(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [puzzle, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const saved: SavedGame = { puzzleId: puzzle.id, marks, elapsed, hints, completed };
    localStorage.setItem(gameStorageKey(puzzle), JSON.stringify(saved));
  }, [puzzle, marks, elapsed, hints, completed, hydrated]);

  useEffect(() => {
    if (!started || completed) return;
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [started, completed]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = easternDateKey();
      if (current !== dateKey) setDateKey(current);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [dateKey]);

  const conflicts = useMemo(
    () => settings.autoCheck ? crownConflicts(marks, puzzle.regions, puzzle.size) : new Set<number>(),
    [marks, puzzle, settings.autoCheck],
  );
  const derivedXs = useMemo(
    () => settings.autoXs ? automaticXs(marks, puzzle.regions, puzzle.size) : new Set<number>(),
    [marks, puzzle, settings.autoXs],
  );
  const crownCount = marks.filter((mark) => mark === "crown").length;

  const recordCompletion = (finalElapsed: number) => {
    setStats((current) => {
      if (current.completedIds.includes(puzzle.id)) return current;
      const next: Stats = {
        ...current,
        completedIds: [...current.completedIds.slice(-99), puzzle.id],
      };
      if (mode === "daily") {
        const gap = current.lastDaily ? daysBetweenDateKeys(current.lastDaily, dateKey) : null;
        next.currentStreak = gap === 1 ? current.currentStreak + 1 : 1;
        next.longestStreak = Math.max(current.longestStreak, next.currentStreak);
        next.lastDaily = dateKey;
        next.dailyWins = current.dailyWins + 1;
      } else {
        next.practiceWins = current.practiceWins + 1;
        next.best = {
          ...current.best,
          [puzzle.difficulty]: Math.min(current.best[puzzle.difficulty] ?? Infinity, finalElapsed),
        };
      }
      localStorage.setItem(STORAGE.stats, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!hydrated || completedRef.current || !isSolved(marks, puzzle)) return;
    completedRef.current = true;
    setCompleted(true);
    setStarted(false);
    recordCompletion(elapsed);
    // recordCompletion depends on the exact completion transition only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, puzzle, hydrated]);

  const commitMarks = (next: CellMark[]) => {
    if (completed) return;
    setHistory((items) => [...items.slice(-39), marks]);
    setMarks(next);
    setStarted(true);
    setHintCell(null);
  };

  const cycleCell = (index: number) => {
    const next = [...marks];
    const displayed = marks[index] === "empty" && derivedXs.has(index) ? "x" : marks[index];
    next[index] = displayed === "empty" ? "x" : displayed === "x" ? "crown" : "empty";
    commitMarks(next);
  };

  const setCell = (index: number, mark: CellMark) => {
    if (marks[index] === mark) return;
    const next = [...marks];
    next[index] = mark;
    commitMarks(next);
  };

  const handleCellKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const row = Math.floor(index / puzzle.size);
    const column = index % puzzle.size;
    let target: number | null = null;
    if (event.key === "ArrowUp" && row > 0) target = index - puzzle.size;
    if (event.key === "ArrowDown" && row < puzzle.size - 1) target = index + puzzle.size;
    if (event.key === "ArrowLeft" && column > 0) target = index - 1;
    if (event.key === "ArrowRight" && column < puzzle.size - 1) target = index + 1;
    if (target !== null) {
      event.preventDefault();
      document.getElementById(`queen-cell-${target}`)?.focus();
    } else if (event.key === "x" || event.key === "X") {
      event.preventDefault();
      setCell(index, "x");
    } else if (["q", "Q", "c", "C"].includes(event.key)) {
      event.preventDefault();
      setCell(index, "crown");
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      setCell(index, "empty");
    }
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous || completed) return;
    setMarks(previous);
    setHistory((items) => items.slice(0, -1));
    setHintCell(null);
  };

  const clearBoard = () => {
    if (!marks.some((mark) => mark !== "empty")) return;
    if (!window.confirm("Clear every crown and X from this board?")) return;
    commitMarks(Array(puzzle.size ** 2).fill("empty"));
  };

  const hint = () => {
    const incorrect = marks.findIndex(
      (mark, index) => mark === "crown" && puzzle.solution[Math.floor(index / puzzle.size)] !== index % puzzle.size,
    );
    if (incorrect >= 0) {
      setHintCell(incorrect);
      setToast("One crown is in a cell that cannot complete the puzzle.");
    } else {
      const row = puzzle.solution.findIndex(
        (column, rowIndex) => marks[rowIndex * puzzle.size + column] !== "crown",
      );
      if (row >= 0) {
        setHintCell(row * puzzle.size + puzzle.solution[row]);
        setToast(`Look closely at row ${row + 1}.`);
      }
    }
    setHints((value) => value + 1);
    setStarted(true);
  };

  const share = async () => {
    const result = [
      `Queens-Reimagined ${mode === "daily" ? dateKey : puzzle.difficulty}`,
      `${displayTime(elapsed)} · ${hints} hint${hints === 1 ? "" : "s"}`,
      `${"👑".repeat(Math.min(puzzle.size, 8))}`,
      "https://aniketgiriyalkar.github.io/games/queens-reimagined/",
    ].join("\n");
    try {
      const usedNativeShare = "share" in navigator;
      if (usedNativeShare) await navigator.share({ title: "Queens-Reimagined", text: result });
      else await navigator.clipboard.writeText(result);
      setToast(usedNativeShare ? "Shared." : "Result copied.");
    } catch {
      setToast("Sharing was cancelled.");
    }
  };

  const regionStyle = (index: number): CSSProperties => {
    const row = Math.floor(index / puzzle.size);
    const column = index % puzzle.size;
    const region = puzzle.regions[index];
    return {
      background: REGION_COLORS[region % REGION_COLORS.length],
      borderTopWidth: row === 0 || puzzle.regions[index - puzzle.size] !== region ? 3 : 1,
      borderRightWidth: column === puzzle.size - 1 || puzzle.regions[index + 1] !== region ? 3 : 1,
      borderBottomWidth: row === puzzle.size - 1 || puzzle.regions[index + puzzle.size] !== region ? 3 : 1,
      borderLeftWidth: column === 0 || puzzle.regions[index - 1] !== region ? 3 : 1,
    };
  };

  return (
    <main className="site-shell">
      <header className="site-nav">
        {/* This intentionally leaves the game base path for the portfolio root. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="monogram" href="/" aria-label="Aniket Giriyalkar portfolio home">AG</a>
        <div className="nav-title"><strong>Queens-Reimagined</strong><span>Daily logic / Offline-first</span></div>
        <nav aria-label="Portfolio navigation">
          <a href="/games/">All games</a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Back to portfolio ↗</a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="game-title">
        <div>
          <p className="eyebrow">Logic grid / No account / Your streak stays here</p>
          <h1 id="game-title"><span>Queens</span><em>Reimagined</em></h1>
        </div>
        <p className="hero-copy">One crown in every row, column, and color. No two crowns may touch—even at the corners.</p>
      </section>

      <section className="game-layout">
        <aside className="control-panel" aria-label="Game settings">
          <div className="mode-switch" role="group" aria-label="Game mode">
            <button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")} aria-pressed={mode === "daily"}>Daily</button>
            <button className={mode === "practice" ? "active" : ""} onClick={() => setMode("practice")} aria-pressed={mode === "practice"}>Practice</button>
          </div>

          <div className="puzzle-meta">
            <span>{mode === "daily" ? dateKey : `Practice ${practiceIndex + 1}`}</span>
            <strong>{puzzle.difficulty} · {puzzle.size}×{puzzle.size}</strong>
          </div>

          {mode === "practice" && (
            <div className="difficulty" role="group" aria-label="Practice difficulty">
              {(["easy", "medium", "hard"] as const).map((level) => (
                <button key={level} onClick={() => setDifficulty(level)} aria-pressed={difficulty === level}>{level}</button>
              ))}
              <button className="new-puzzle" onClick={() => setPracticeIndex((value) => value + 1)}>New board ↗</button>
            </div>
          )}

          <div className="settings-list">
            <div className="setting-row"><span><strong>Auto-check</strong><small>Stripe rule conflicts</small></span><input aria-label="Auto-check rule conflicts" type="checkbox" checked={settings.autoCheck} onChange={(event) => setSettings({ ...settings, autoCheck: event.target.checked })} /></div>
            <div className="setting-row"><span><strong>Auto-place Xs</strong><small>Show blocked cells</small></span><input aria-label="Automatically show blocked cells" type="checkbox" checked={settings.autoXs} onChange={(event) => setSettings({ ...settings, autoXs: event.target.checked })} /></div>
          </div>

          <dl className="stats-row">
            <div><dt>Streak</dt><dd>{stats.currentStreak}</dd></div>
            <div><dt>Best</dt><dd>{stats.longestStreak}</dd></div>
            <div><dt>Daily wins</dt><dd>{stats.dailyWins}</dd></div>
          </dl>

          <div className="rule-note">
            <span>How to mark</span>
            <p>Tap once for ×, twice for a crown. Use arrow keys to move; X and Q place marks.</p>
          </div>
        </aside>

        <section className="board-panel" aria-label="Queens game board">
          <div className="board-toolbar">
            <div><span>Time</span><strong>{displayTime(elapsed)}</strong></div>
            <div><span>Crowns</span><strong>{crownCount} / {puzzle.size}</strong></div>
            <div><span>Hints</span><strong>{hints}</strong></div>
          </div>

          <div
            className="queens-board"
            role="grid"
            aria-label={`${puzzle.size} by ${puzzle.size} Queens board`}
            style={{ "--board-size": puzzle.size } as CSSProperties}
          >
            {marks.map((mark, index) => {
              const shown = mark === "empty" && derivedXs.has(index) ? "auto-x" : mark;
              return (
                <button
                  id={`queen-cell-${index}`}
                  key={index}
                  role="gridcell"
                  className={`cell ${shown} ${conflicts.has(index) ? "conflict" : ""} ${hintCell === index ? "hinted" : ""}`}
                  style={regionStyle(index)}
                  onClick={() => cycleCell(index)}
                  onKeyDown={(event) => handleCellKey(event, index)}
                  aria-label={`Row ${Math.floor(index / puzzle.size) + 1}, column ${(index % puzzle.size) + 1}, ${shown === "crown" ? "crown" : shown.includes("x") ? "marked X" : "empty"}`}
                >
                  {shown === "crown" ? <span aria-hidden="true">♛</span> : shown.includes("x") ? <span aria-hidden="true">×</span> : null}
                </button>
              );
            })}
          </div>

          <div className="game-actions">
            <button onClick={undo} disabled={!history.length || completed}>Undo</button>
            <button onClick={clearBoard} disabled={completed || !marks.some((mark) => mark !== "empty")}>Clear</button>
            <button onClick={hint} disabled={completed}>Hint</button>
          </div>

          {conflicts.size > 0 && <p className="status-message error" role="status">Those striped crowns break a row, column, region, or touching rule.</p>}
          {!conflicts.size && !completed && <p className="status-message" role="status">{started ? "Board in progress. Keep narrowing the regions." : "Place your first mark to start the clock."}</p>}

          {completed && (
            <div className="completion" role="status">
              <p className="eyebrow">Grid complete</p>
              <h2>Crowned in {displayTime(elapsed)}.</h2>
              <p>{hints ? `${hints} hint${hints === 1 ? "" : "s"} used.` : "Solved without a hint."} {mode === "daily" ? `Your streak is ${stats.currentStreak}.` : "Practice does not change your daily streak."}</p>
              <div>
                <button onClick={share}>Share result</button>
                {mode === "practice" && <button onClick={() => setPracticeIndex((value) => value + 1)}>Next board</button>}
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="rules" aria-labelledby="rules-title">
        <p className="eyebrow">The whole rulebook</p>
        <h2 id="rules-title">Three constraints.<br />One clean solution.</h2>
        <ol>
          <li><span>01</span><p><strong>Rows + columns</strong>Every row and every column gets exactly one crown.</p></li>
          <li><span>02</span><p><strong>Color regions</strong>Each outlined color region gets exactly one crown.</p></li>
          <li><span>03</span><p><strong>No touching</strong>Crowns cannot sit in neighboring cells, including diagonals.</p></li>
        </ol>
      </section>

      <footer><span>AG / Daily Games Reimagined</span><span>Generated locally · Saved locally · Played anywhere</span></footer>
      {toast && <button className="toast" onClick={() => setToast("")} aria-live="polite">{toast}</button>}
    </main>
  );
}
