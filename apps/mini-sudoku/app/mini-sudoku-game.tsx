"use client";

import { CSSProperties, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  daysBetweenDateKeys,
  displayTime,
  easternDateKey,
} from "@daily-games/game-core";
import {
  createMiniSudoku,
  isSudokuSolved,
  MiniSudokuPuzzle,
  sudokuConflicts,
  SudokuDifficulty,
  SudokuMode,
} from "@/lib/sudoku";

const STORAGE = {
  settings: "mini-sudoku-reimagined:v1:settings",
  stats: "mini-sudoku-reimagined:v1:stats",
};

interface Settings { autoCheck: boolean; }
interface SavedGame {
  puzzleId: string;
  values: number[];
  notes: number[][];
  elapsed: number;
  hints: number;
  completed: boolean;
}
interface Snapshot { values: number[]; notes: number[][]; }
interface Stats {
  currentStreak: number;
  longestStreak: number;
  lastDaily?: string;
  dailyWins: number;
  practiceWins: number;
  best: Partial<Record<SudokuDifficulty, number>>;
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

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

const gameKey = (puzzle: MiniSudokuPuzzle) => `mini-sudoku-reimagined:v1:game:${puzzle.id}`;

export default function MiniSudokuGame() {
  const [mode, setMode] = useState<SudokuMode>("daily");
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>("focused");
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [dateKey, setDateKey] = useState(() => easternDateKey());
  const puzzle = useMemo(
    () => createMiniSudoku({ mode, difficulty, practiceIndex, dailyKey: dateKey }),
    [mode, difficulty, practiceIndex, dateKey],
  );
  const [values, setValues] = useState(() => [...puzzle.givens]);
  const [notes, setNotes] = useState<number[][]>(() => Array.from({ length: 36 }, () => []));
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [settings, setSettings] = useState<Settings>({ autoCheck: true });
  const [history, setHistory] = useState<Snapshot[]>([]);
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
      setSettings(readJson(STORAGE.settings, { autoCheck: true }));
      setStats(readJson(STORAGE.stats, DEFAULT_STATS));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const saved = readJson<SavedGame | null>(gameKey(puzzle), null);
      if (saved?.puzzleId === puzzle.id && saved.values.length === 36) {
        setValues(saved.values);
        setNotes(saved.notes);
        setElapsed(saved.elapsed);
        setHints(saved.hints);
        setCompleted(saved.completed);
        setStarted(saved.elapsed > 0 && !saved.completed);
        completedRef.current = saved.completed;
      } else {
        setValues([...puzzle.givens]);
        setNotes(Array.from({ length: 36 }, () => []));
        setElapsed(0);
        setHints(0);
        setCompleted(false);
        setStarted(false);
        completedRef.current = false;
      }
      setSelected(null);
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
    const saved: SavedGame = { puzzleId: puzzle.id, values, notes, elapsed, hints, completed };
    localStorage.setItem(gameKey(puzzle), JSON.stringify(saved));
  }, [puzzle, values, notes, elapsed, hints, completed, hydrated]);

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
    () => settings.autoCheck ? sudokuConflicts(values, puzzle.regions) : new Set<number>(),
    [settings.autoCheck, values, puzzle.regions],
  );
  const filled = values.filter(Boolean).length;

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
    if (!hydrated || completedRef.current || !isSudokuSolved(values, puzzle)) return;
    completedRef.current = true;
    setCompleted(true);
    setStarted(false);
    recordCompletion(elapsed);
    // This effect records the exact transition to a solved board once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, puzzle, hydrated]);

  const snapshot = (): Snapshot => ({ values: [...values], notes: notes.map((cell) => [...cell]) });

  const enterNumber = (number: number, target = selected) => {
    if (target === null || puzzle.givens[target] || completed) return;
    setHistory((items) => [...items.slice(-39), snapshot()]);
    if (noteMode) {
      const nextNotes = notes.map((cell) => [...cell]);
      nextNotes[target] = nextNotes[target].includes(number)
        ? nextNotes[target].filter((value) => value !== number)
        : [...nextNotes[target], number].sort();
      setNotes(nextNotes);
      if (values[target]) {
        const nextValues = [...values];
        nextValues[target] = 0;
        setValues(nextValues);
      }
    } else {
      const nextValues = [...values];
      nextValues[target] = values[target] === number ? 0 : number;
      setValues(nextValues);
      const nextNotes = notes.map((cell) => [...cell]);
      nextNotes[target] = [];
      if (nextValues[target]) {
        const row = Math.floor(target / 6);
        const column = target % 6;
        const region = puzzle.regions[target];
        nextNotes.forEach((cell, index) => {
          if (
            Math.floor(index / 6) === row ||
            index % 6 === column ||
            puzzle.regions[index] === region
          ) nextNotes[index] = cell.filter((value) => value !== number);
        });
      }
      setNotes(nextNotes);
    }
    setStarted(true);
    setHintCell(null);
  };

  const erase = (target = selected) => {
    if (target === null || puzzle.givens[target] || completed) return;
    if (!values[target] && !notes[target].length) return;
    setHistory((items) => [...items.slice(-39), snapshot()]);
    const nextValues = [...values];
    const nextNotes = notes.map((cell) => [...cell]);
    nextValues[target] = 0;
    nextNotes[target] = [];
    setValues(nextValues);
    setNotes(nextNotes);
    setHintCell(null);
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const row = Math.floor(index / 6);
    const column = index % 6;
    let target: number | null = null;
    if (event.key === "ArrowUp" && row > 0) target = index - 6;
    if (event.key === "ArrowDown" && row < 5) target = index + 6;
    if (event.key === "ArrowLeft" && column > 0) target = index - 1;
    if (event.key === "ArrowRight" && column < 5) target = index + 1;
    if (target !== null) {
      event.preventDefault();
      setSelected(target);
      document.getElementById(`sudoku-cell-${target}`)?.focus();
    } else if (/^[1-6]$/.test(event.key)) {
      event.preventDefault();
      setSelected(index);
      enterNumber(Number(event.key), index);
    } else if (["Backspace", "Delete", "0"].includes(event.key)) {
      event.preventDefault();
      setSelected(index);
      erase(index);
    } else if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      setNoteMode((value) => !value);
    }
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous || completed) return;
    setValues(previous.values);
    setNotes(previous.notes);
    setHistory((items) => items.slice(0, -1));
    setHintCell(null);
  };

  const clearBoard = () => {
    if (!values.some((value, index) => value && !puzzle.givens[index])) return;
    if (!window.confirm("Clear every number and note you entered?")) return;
    setHistory((items) => [...items.slice(-39), snapshot()]);
    setValues([...puzzle.givens]);
    setNotes(Array.from({ length: 36 }, () => []));
    setHintCell(null);
  };

  const hint = () => {
    const incorrect = values.findIndex((value, index) => value && value !== puzzle.solution[index]);
    const target = incorrect >= 0
      ? incorrect
      : (selected !== null && !puzzle.givens[selected] && !values[selected]
          ? selected
          : values.findIndex((value) => !value));
    if (target < 0) return;
    setHistory((items) => [...items.slice(-39), snapshot()]);
    const next = [...values];
    next[target] = puzzle.solution[target];
    setValues(next);
    const nextNotes = notes.map((cell) => [...cell]);
    nextNotes[target] = [];
    setNotes(nextNotes);
    setHintCell(target);
    setSelected(target);
    setHints((value) => value + 1);
    setStarted(true);
    setToast(incorrect >= 0 ? "Corrected one number that could not complete the grid." : "One square revealed.");
  };

  const share = async () => {
    const result = [
      `Mini Sudoku-Reimagined ${mode === "daily" ? dateKey : puzzle.difficulty}`,
      `${displayTime(elapsed)} · ${hints} hint${hints === 1 ? "" : "s"}`,
      "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣",
      "https://aniketgiriyalkar.github.io/games/mini-sudoku-reimagined/",
    ].join("\n");
    try {
      const usedNativeShare = "share" in navigator;
      if (usedNativeShare) await navigator.share({ title: "Mini Sudoku-Reimagined", text: result });
      else await navigator.clipboard.writeText(result);
      setToast(usedNativeShare ? "Shared." : "Result copied.");
    } catch {
      setToast("Sharing was cancelled.");
    }
  };

  const cellStyle = (index: number): CSSProperties => {
    const row = Math.floor(index / 6);
    const column = index % 6;
    return {
      borderTopWidth: row % 2 === 0 ? 3 : 1,
      borderLeftWidth: column % 3 === 0 ? 3 : 1,
      borderRightWidth: column === 5 ? 3 : 1,
      borderBottomWidth: row === 5 ? 3 : 1,
    };
  };

  const selectedValue = selected === null ? 0 : values[selected];
  const selectedRegion = selected === null ? -1 : puzzle.regions[selected];
  const selectedRow = selected === null ? -1 : Math.floor(selected / 6);
  const selectedColumn = selected === null ? -1 : selected % 6;

  return (
    <main className="site-shell">
      <header className="site-nav">
        {/* Intentionally leave the game base path for the portfolio root. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="monogram" href="/" aria-label="Aniket Giriyalkar portfolio home">AG</a>
        <div className="nav-title"><strong>Mini Sudoku-Reimagined</strong><span>Number logic / Offline-first</span></div>
        <nav aria-label="Portfolio navigation">
          <a href="/games/">All games</a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Back to portfolio ↗</a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="game-title">
        <div>
          <p className="eyebrow">Six digits / Thirty-six cells / One exact answer</p>
          <h1 id="game-title"><span>Mini</span><em>Sudoku</em></h1>
        </div>
        <p className="hero-copy">Every row, column, and shaded box needs the digits 1–6 exactly once. Small grid. Serious focus.</p>
      </section>

      <section className="game-layout">
        <aside className="control-panel" aria-label="Game settings">
          <div className="mode-switch" role="group" aria-label="Game mode">
            <button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")} aria-pressed={mode === "daily"}>Daily</button>
            <button className={mode === "practice" ? "active" : ""} onClick={() => setMode("practice")} aria-pressed={mode === "practice"}>Practice</button>
          </div>
          <div className="puzzle-meta">
            <span>{mode === "daily" ? dateKey : `Practice ${practiceIndex + 1}`}</span>
            <strong>{puzzle.difficulty} · 6×6</strong>
          </div>
          {mode === "practice" && (
            <div className="difficulty" role="group" aria-label="Practice difficulty">
              {(["relaxed", "focused", "expert"] as const).map((level) => (
                <button key={level} onClick={() => setDifficulty(level)} aria-pressed={difficulty === level}>{level}</button>
              ))}
              <button className="new-puzzle" onClick={() => setPracticeIndex((value) => value + 1)}>New grid ↗</button>
            </div>
          )}
          <div className="settings-list">
            <div className="setting-row"><span><strong>Auto-check</strong><small>Stripe duplicate digits</small></span><input aria-label="Auto-check duplicate digits" type="checkbox" checked={settings.autoCheck} onChange={(event) => setSettings({ autoCheck: event.target.checked })} /></div>
          </div>
          <dl className="stats-row">
            <div><dt>Streak</dt><dd>{stats.currentStreak}</dd></div>
            <div><dt>Best</dt><dd>{stats.longestStreak}</dd></div>
            <div><dt>Daily wins</dt><dd>{stats.dailyWins}</dd></div>
          </dl>
          <div className="rule-note"><span>Keyboard ready</span><p>Use arrows to move, 1–6 to enter, N for notes, and Delete to erase.</p></div>
        </aside>

        <section className="board-panel" aria-label="Mini Sudoku game board">
          <div className="board-toolbar">
            <div><span>Time</span><strong>{displayTime(elapsed)}</strong></div>
            <div><span>Filled</span><strong>{filled} / 36</strong></div>
            <div><span>Hints</span><strong>{hints}</strong></div>
          </div>

          <div className="sudoku-board" role="grid" aria-label="6 by 6 Mini Sudoku board">
            {values.map((value, index) => {
              const row = Math.floor(index / 6);
              const column = index % 6;
              const peer = selected !== null && (row === selectedRow || column === selectedColumn || puzzle.regions[index] === selectedRegion);
              const same = Boolean(value && selectedValue && value === selectedValue);
              return (
                <button
                  id={`sudoku-cell-${index}`}
                  key={index}
                  role="gridcell"
                  className={`cell ${puzzle.regions[index] % 2 ? "shade" : ""} ${puzzle.givens[index] ? "given" : "entered"} ${selected === index ? "selected" : ""} ${peer ? "peer" : ""} ${same ? "same" : ""} ${conflicts.has(index) ? "conflict" : ""} ${hintCell === index ? "hinted" : ""}`}
                  style={cellStyle(index)}
                  onClick={() => setSelected(index)}
                  onKeyDown={(event) => handleKey(event, index)}
                  aria-label={`Row ${row + 1}, column ${column + 1}, ${value ? `number ${value}` : notes[index].length ? `notes ${notes[index].join(", ")}` : "empty"}${puzzle.givens[index] ? ", given" : ""}`}
                >
                  {value ? <strong>{value}</strong> : (
                    <span className="notes" aria-hidden="true">
                      {[1, 2, 3, 4, 5, 6].map((number) => <i key={number}>{notes[index].includes(number) ? number : ""}</i>)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="number-pad" role="group" aria-label="Number input">
            {[1, 2, 3, 4, 5, 6].map((number) => <button key={number} onClick={() => enterNumber(number)}>{number}</button>)}
          </div>
          <div className="game-actions">
            <button className={noteMode ? "active" : ""} onClick={() => setNoteMode((value) => !value)} aria-pressed={noteMode}>Notes {noteMode ? "on" : "off"}</button>
            <button onClick={() => erase()} disabled={selected === null || Boolean(selected !== null && puzzle.givens[selected])}>Erase</button>
            <button onClick={undo} disabled={!history.length || completed}>Undo</button>
            <button onClick={clearBoard} disabled={completed}>Clear</button>
            <button onClick={hint} disabled={completed}>Hint</button>
          </div>

          {conflicts.size > 0 && <p className="status-message error" role="status">Striped digits repeat in a row, column, or shaded box.</p>}
          {!conflicts.size && !completed && <p className="status-message" role="status">{started ? "Grid in progress. Scan rows, columns, and boxes together." : "Select an empty square to start the clock."}</p>}

          {completed && (
            <div className="completion" role="status">
              <p className="eyebrow">Grid complete</p>
              <h2>All six, everywhere.</h2>
              <p>Finished in {displayTime(elapsed)} with {hints} hint{hints === 1 ? "" : "s"}. {mode === "daily" ? `Your streak is ${stats.currentStreak}.` : "Practice leaves your daily streak untouched."}</p>
              <div><button onClick={share}>Share result</button>{mode === "practice" && <button onClick={() => setPracticeIndex((value) => value + 1)}>Next grid</button>}</div>
            </div>
          )}
        </section>
      </section>

      <section className="rules" aria-labelledby="rules-title">
        <p className="eyebrow">The entire rulebook</p>
        <h2 id="rules-title">One through six.<br />No repeats.</h2>
        <ol>
          <li><span>01</span><p><strong>Every row</strong>Place each digit from 1 through 6 exactly once.</p></li>
          <li><span>02</span><p><strong>Every column</strong>The same six digits appear without a repeat.</p></li>
          <li><span>03</span><p><strong>Every shaded box</strong>Each outlined 2×3 region also contains 1 through 6.</p></li>
        </ol>
      </section>
      <footer><span>AG / Daily Games Reimagined</span><span>Generated locally · Saved locally · Played anywhere</span></footer>
      {toast && <button className="toast" onClick={() => setToast("")} aria-live="polite">{toast}</button>}
    </main>
  );
}
