/**
 * Admission control for vitest runs across every worktree on this machine.
 *
 * This file caps CONCURRENT RUNS; `maxWorkers` in `vitest.shared.config.ts` caps the workers within
 * one. The second cap without the first is what took the box down: that config budgets a few GB for
 * one run, but with a worktree per feature (private-feat1, private-feat2, private_calc, ...) and an
 * agent session or two in each, four simultaneous `vitest run`s is routine, and four times the
 * budget does not fit alongside five VS Code windows.
 *
 * ## Why this is not a mutex any more
 *
 * It used to be one: a run took an exclusive lock and every other run waited. That traded the crash
 * for a worse problem. A run's FOOTPRINT and its DURATION are unrelated — a single-file check and a
 * 20-minute `test:all` both cost about `maxWorkers` forks while they run — so an exclusive slot made
 * a ten-second run queue behind a twenty-minute one for no memory benefit at all. Worse, the wait
 * had a 30-minute timeout that THREW, so a queueing problem surfaced as a red suite.
 *
 * What actually needs bounding is total committed memory, so that is what is measured. A run is
 * admitted when the box has room for it and waits when it does not. On an idle box several runs go
 * at once; on a loaded one they serialize exactly as the mutex did. Nothing needs to know whether a
 * run is "big".
 *
 * COMMIT is the number that matters, not free physical memory. An exhausted commit limit is not a
 * clean OOM — a fork dies of a native `AlignedAlloc` failure and takes whatever else is near the
 * limit (the IDE) with it. A full root run peaks at ~4.85GB of commit across its forks, while
 * editors and other sessions on a shared machine can sit close to the limit. {@link RESERVE_GB} is what keeps the last few GB for them.
 *
 * ## Why globalSetup and not a wrapper script
 *
 * A wrapper on the `test` scripts only covers invocations that go through them. In practice runs are
 * launched every other way too — `npx vitest run` straight from a package directory, the IDE's
 * vitest extension, `pnpm --filter ... test` — and those are the ones that actually stacked up.
 * globalSetup is inside vitest, so every entry point is covered, and it runs before the worker pool
 * forks, which is where the memory is.
 *
 * State lives in the user's temp dir, deliberately outside any worktree, which is what makes this
 * machine-wide rather than per-checkout.
 *
 * ## Watch mode
 *
 * Needs no special case, though it looks like it should. Vitest calls `globalSetup` once per watch
 * SESSION and tears it down as soon as the first pass finishes, so a watcher holds a slot for that
 * pass, drops it when it goes idle, and never re-takes it for the re-runs a file change triggers
 * (verified 2026-09-03). It therefore cannot sit on a slot and starve the other worktrees.
 */
import { mkdirSync, openSync, readdirSync, readFileSync, unlinkSync, writeSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import os from 'node:os';

import type { TestProject } from 'vitest/node';

const ROOT = join(os.tmpdir(), 'sheetxl-vitest');
/** Runs that have been admitted and are executing. */
const ACTIVE = join(ROOT, 'active');
/** Runs that are queued. Presence here is what makes the queue FIFO — see {@link isMyTurn}. */
const WAITING = join(ROOT, 'waiting');
/**
 * Held for the length of ONE admission decision — read the state, decide, record the outcome — and
 * never for the length of a run.
 *
 * Deciding and recording have to be one step or the gate does not gate. Without this, two runs
 * launched seconds apart both reach the decision before either has written itself down, both see an
 * empty `active`, and both go: observed 2026-09-08, a second run started 3s after the first and was
 * admitted immediately with no wait at all. Vitest takes a few seconds to reach `globalSetup`, which
 * is easily enough to lose the race, and the cooldown below cannot help because it has nothing to
 * compare against yet.
 *
 * This is the one genuinely exclusive lock in the file, and the distinction from the mutex it
 * replaced is the point: that one was held for twenty minutes, this one for a few milliseconds.
 */
const GATE = join(ROOT, 'gate.lock');

/**
 * What one fork is assumed to cost, in GB of commit.
 *
 * A full root run (698 files, both projects) peaked at 4.85GB of private commit
 * across twelve forks at the default `maxWorkers` of 6. Rounded up, because the estimate has to hold
 * for the heaviest run anyone launches, not the average one, and because admitting one run too many
 * is the failure this file exists to prevent.
 */
const FORK_WEIGHT_GB = 0.5;

/** The pool size per project — the same knob `vitest.shared.config.ts` sets `maxWorkers` from. */
const WORKERS = Number(process.env.SHEETXL_TEST_WORKERS) || 6;

/** What a run that fills every project's pool costs. The default comes out at 6GB, the measured full run. */
const FULL_RUN_WEIGHT_GB = FORK_WEIGHT_GB * WORKERS * 2;

/**
 * What THIS run is assumed to cost: its forks at {@link FORK_WEIGHT_GB} each. Vitest never forks
 * more workers than a project has files to run, so each project is charged
 * `min(WORKERS, its file count)` — a single-file check is two forks, 1GB, and does not queue behind
 * a budget sized for the full suite. Raising the pool without {@link WORKERS} following is how the
 * accounting drifts.
 *
 * The file count is the run's filters (the paths on the command line) globbed per project. An entry
 * point that does not expose them — an IDE re-run, say — globs unfiltered and is charged as a full
 * run, which is the safe direction to be wrong in.
 */
async function runWeightGB(project: TestProject): Promise<number> {
  try {
    const filters = (project.vitest as { filenamePattern?: string[] }).filenamePattern;
    let forks = 0;
    for (const each of project.vitest.projects) {
      const { testFiles } = await each.globTestFiles(filters);
      forks += Math.min(WORKERS, testFiles.length);
    }
    return Math.min(FULL_RUN_WEIGHT_GB, FORK_WEIGHT_GB * forks);
  } catch {
    return FULL_RUN_WEIGHT_GB;
  }
}

/**
 * Commit left alone no matter what. This is the IDE's and the agent sessions' headroom: the crash
 * this file prevents is not the test run dying, it is VS Code dying because a test run took the last
 * of the commit.
 *
 * Sized for what those need to keep running, not for the test run - the run is budgeted by
 * {@link RUN_WEIGHT_GB}. It was 10GB until 2026-09-11, which on a day with 10-11GB of commit free
 * admitted nothing on merit: every run, however small, waited the full timeout and then started
 * anyway, so the gate gated nothing and cost ten minutes.
 */
const RESERVE_GB = 3;

/**
 * Hard ceiling on concurrent runs, independent of memory. Commit is the binding constraint on this
 * box, but a machine with lots of it would still thrash 32 threads across six runs and finish every
 * one of them later than running them three at a time.
 */
const MAX_CONCURRENT = 3;

/**
 * How long a freshly admitted FULL run gets to itself before another may be admitted. A smaller run
 * ramps to a smaller peak and gets a proportionally shorter window (see {@link rampMs}).
 *
 * Without this the memory check races the thing it is checking. Free commit describes what running
 * runs are using NOW, but a run that started five seconds ago has forked maybe two of its twelve
 * workers and is nowhere near its 4.85GB peak — so a second run reads a box that looks empty,
 * admits, and both then ramp into the same headroom. Which is the original crash, arrived at by a
 * more careful route.
 *
 * Staggering also just schedules better: the ramp is the expensive part, and overlapping two of them
 * is worse than overlapping two steady states.
 */
const ADMIT_COOLDOWN_MS = 45 * 1000;

/** The cooldown an admitted run imposes on the next one, scaled by what it was charged. */
function rampMs(entry: Entry): number {
  const weight = entry.weightGB ?? FULL_RUN_WEIGHT_GB;
  return ADMIT_COOLDOWN_MS * Math.min(1, weight / FULL_RUN_WEIGHT_GB);
}

/** How long to spin for {@link GATE} before deciding without it. */
const GATE_WAIT_MS = 5000;
/** A gate held longer than this belongs to a process that died mid-decision. */
const GATE_STALE_MS = 30 * 1000;

const POLL_MS = 2000;
/** Stay quiet for the first poll or two, then say what is being waited on. */
const REPORT_EVERY_MS = 15000;
/**
 * How long to wait before giving up and running ANYWAY.
 *
 * Deliberately not an error. A wait this long means the accounting is wrong — a crashed run left a
 * stale entry, or the box is genuinely full — and in neither case is failing the suite the right
 * answer. Failing turns a scheduling problem into a test result, which is exactly the behavior that
 * made the old mutex worse than the problem it solved. Proceeding may be slow; it is never a lie.
 */
const WAIT_TIMEOUT_MS = 10 * 60 * 1000;

interface Entry {
  pid: number;
  cwd: string;
  started: number;
  /** What the run was charged. Missing on entries written before it was recorded: read as a full run. */
  weightGB?: number;
}

/**
 * Whether a pid is still running. EPERM means it exists but belongs to another user, which counts as
 * alive; only ESRCH proves the entry is gone and the file is stale. That case is routine here — a
 * `taskkill` on a runaway run leaves exactly this behind.
 */
function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Live entries in `dir`, with dead ones unlinked on the way past.
 *
 * A half-written or unparseable file counts as dead rather than blocking forever on it. Two readers
 * can unlink the same stale file concurrently; the `catch` is that race and not an error.
 */
function readLive(dir: string): Entry[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const live: Entry[] = [];
  for (const name of names) {
    const path = join(dir, name);
    let entry: Entry | null = null;
    try {
      entry = JSON.parse(readFileSync(path, 'utf8')) as Entry;
    } catch {
      /* missing or caught half-written */
    }
    if (entry && isAlive(entry.pid)) {
      live.push(entry);
      continue;
    }
    try {
      unlinkSync(path);
    } catch {
      /* someone else cleared it first */
    }
  }
  return live;
}

function write(dir: string, entry: Entry): void {
  mkdirSync(dir, { recursive: true });
  // `w`, not `wx`: re-running with a recycled pid must overwrite rather than throw.
  const fd = openSync(join(dir, `${entry.pid}.json`), 'w');
  writeSync(fd, JSON.stringify(entry));
  closeSync(fd);
}

function remove(dir: string, pid: number): void {
  try {
    unlinkSync(join(dir, `${pid}.json`));
  } catch {
    /* already gone */
  }
}

/**
 * Free commit in GB, or `null` if it cannot be determined.
 *
 * Node exposes free PHYSICAL memory (`os.freemem()`) and nothing about the commit limit, which is
 * the number that actually governs the failure mode here, so this shells out. Once per admission
 * attempt, ~200ms, which is noise against a run measured in minutes.
 *
 * Returning `null` FAILS OPEN — {@link canAdmit} then falls back to {@link MAX_CONCURRENT} alone.
 * A box where the counter cannot be read is not a box where tests should refuse to run.
 */
function freeCommitGB(): number | null {
  if (process.platform !== 'win32') {
    // Linux/macOS: no commit limit in the Windows sense. Available physical is the useful proxy.
    const free = os.freemem() / 1024 ** 3;
    return Number.isFinite(free) ? free : null;
  }
  try {
    const script =
      "$c = Get-Counter '\\Memory\\Committed Bytes','\\Memory\\Commit Limit'; " +
      '($c.CounterSamples[1].CookedValue - $c.CounterSamples[0].CookedValue)';
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const bytes = Number(out.trim());
    return Number.isFinite(bytes) ? bytes / 1024 ** 3 : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `decide` with {@link GATE} held, so that reading the state and recording a decision cannot
 * interleave with another run doing the same.
 *
 * FAILS OPEN in both directions. A gate held longer than {@link GATE_STALE_MS} is broken — the only
 * way that happens is a process dying between create and unlink, and inheriting a permanent deadlock
 * from a crashed run is strictly worse than the over-admission it would prevent. Likewise, waiting
 * out {@link GATE_WAIT_MS} proceeds without it: the critical section is milliseconds long, so if it
 * is somehow unavailable for seconds the accounting is already broken and blocking the suite on it
 * helps nobody.
 */
async function withGate<T>(decide: () => T): Promise<T> {
  const deadline = Date.now() + GATE_WAIT_MS;
  let held = false;
  for (;;) {
    try {
      mkdirSync(ROOT, { recursive: true });
      const fd = openSync(GATE, 'wx');
      writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
      closeSync(fd);
      held = true;
      break;
    } catch (err) {
      // `EEXIST` is the ordinary "someone holds it". Windows adds two more for the SAME situation:
      // a file another process has unlinked but still holds a handle to is *delete-pending*, and an
      // open of it fails `EPERM`/`EACCES` rather than `EEXIST`. Rethrowing those aborted the entire
      // vitest run — the one outcome the fail-open contract above exists to prevent — and the retry
      // below already handles them correctly: the read fails, the holder reads as stale, and the
      // loop tries again until the deadline.
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES') throw err;
      let holder: { pid: number; at: number } | null = null;
      try {
        holder = JSON.parse(readFileSync(GATE, 'utf8'));
      } catch {
        /* missing or caught half-written — treated as stale below */
      }
      if (!holder || !isAlive(holder.pid) || Date.now() - holder.at > GATE_STALE_MS) {
        try {
          unlinkSync(GATE);
        } catch {
          /* someone else broke it first */
        }
        continue;
      }
      if (Date.now() > deadline) break;
      await sleep(25);
    }
  }
  try {
    return decide();
  } finally {
    if (held) {
      try {
        unlinkSync(GATE);
      } catch {
        /* already gone */
      }
    }
  }
}

/**
 * FIFO fairness.
 *
 * Without this, admission is a polling free-for-all and nothing stops a stream of runs from starving
 * one unlucky waiter indefinitely — which on a busy box is not hypothetical, it is what happens. A
 * waiter may go only when no other LIVE waiter has been queued longer; `started` ties break by pid so
 * two runs that queued in the same millisecond still agree on an order.
 */
function isMyTurn(mine: Entry, waiting: Entry[]): boolean {
  return !waiting.some(
    (other) =>
      other.pid !== mine.pid &&
      (other.started < mine.started || (other.started === mine.started && other.pid < mine.pid))
  );
}

/**
 * The gate is RE-ENTRANT per process, and has to be: vitest applies a root-level `globalSetup` once
 * per project, so a two-project run calls `setup` twice. Those calls get separate module instances,
 * so the refcount lives on a global symbol rather than in module scope — without it the second call
 * queues behind the slot its own process already holds and waits until the timeout.
 */
const STATE_KEY = Symbol.for('sheetxl.vitest.admission');
const state: { count: number } = ((globalThis as any)[STATE_KEY] ??= { count: 0 });

interface Verdict {
  ok: boolean;
  /** Why not, for the periodic report. Only meaningful when `ok` is false. */
  reason?: string;
}

function canAdmit(mine: Entry): Verdict {
  // Our own pid in `active` means another module instance in this process was admitted first (see
  // STATE_KEY) — that is not contention with anyone.
  const others = readLive(ACTIVE).filter((entry) => entry.pid !== mine.pid);
  if (others.length >= MAX_CONCURRENT) {
    return { ok: false, reason: `${others.length} runs already active (max ${MAX_CONCURRENT})` };
  }
  // An active entry's `started` is its ADMISSION time, not its queue time — see `acquire`.
  const ramping = others.find((entry) => Date.now() - entry.started < rampMs(entry));
  if (ramping) {
    return {
      ok: false,
      reason: `a run started ${Math.round((Date.now() - ramping.started) / 1000)}s ago and is still ramping up`
    };
  }
  const weight = mine.weightGB ?? FULL_RUN_WEIGHT_GB;
  const free = freeCommitGB();
  if (free !== null && free - RESERVE_GB < weight) {
    return {
      ok: false,
      reason: `${free.toFixed(1)}GB commit free, need ${weight}GB plus a ${RESERVE_GB}GB reserve`
    };
  }
  if (!isMyTurn(mine, readLive(WAITING))) {
    return { ok: false, reason: 'another run has been queued longer' };
  }
  return { ok: true };
}

/**
 * `started` is re-stamped on the way in, so an ACTIVE entry dates from ADMISSION rather than from
 * when the run queued. {@link ADMIT_COOLDOWN_MS} reads it to tell a run that is still forking its
 * workers from one that has settled, and a run that waited ten minutes would otherwise look ten
 * minutes settled the instant it started.
 */
function acquire(entry: Entry): void {
  state.count++;
  if (state.count === 1) write(ACTIVE, { ...entry, started: Date.now() });
}

function release(): void {
  if (state.count === 0) return;
  state.count--;
  if (state.count > 0) return;
  remove(ACTIVE, process.pid);
  remove(WAITING, process.pid);
}

/**
 * A hard kill of the runner skips `teardown`, so the entry outlives the run. That is what the
 * liveness check in {@link readLive} recovers from, but releasing on signals keeps the common Ctrl-C
 * case clean so the next run starts immediately instead of polling once.
 */
let hooksInstalled = false;

function installReleaseHooks(): void {
  // Once per PROCESS, not once per project — `setup` runs per project and would otherwise stack
  // duplicate listeners on every signal.
  if (hooksInstalled) return;
  hooksInstalled = true;
  process.on('exit', release);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      release();
      process.exit(1);
    });
  }
}

export default async function setup(project: TestProject): Promise<() => void> {
  // Already admitted by an earlier project in this same process: just take the refcount.
  if (state.count > 0) {
    state.count++;
    return release;
  }

  const mine: Entry = {
    pid: process.pid,
    cwd: process.cwd(),
    started: Date.now(),
    weightGB: await runWeightGB(project)
  };

  installReleaseHooks();

  let queued = false;
  let admitted = false;
  let lastReport = 0;

  for (;;) {
    // Deciding and recording are ONE step, under GATE — see that constant for what happens when
    // they are two.
    const verdict = await withGate((): Verdict => {
      const v = canAdmit(mine);
      if (v.ok) acquire(mine);
      return v;
    });
    if (verdict.ok) {
      admitted = true;
      break;
    }

    // Only announce ourselves as waiting once we actually are — an entry written before the first
    // attempt would make every uncontended run look like a queued one to whoever polls next.
    if (!queued) {
      write(WAITING, mine);
      queued = true;
    }

    const waited = Date.now() - mine.started;
    if (waited > WAIT_TIMEOUT_MS) {
      console.error(
        `[vitest-admission] waited ${Math.round(waited / 60000)}m; starting anyway. ` +
          `If the box is not actually busy, check for stale entries under ${ROOT}.`
      );
      break;
    }
    if (waited - lastReport >= REPORT_EVERY_MS) {
      lastReport = waited;
      const active = readLive(ACTIVE).filter((entry) => entry.pid !== mine.pid);
      const where = active.map((entry) => `${entry.cwd} (pid ${entry.pid})`).join(', ');
      console.error(
        `[vitest-admission] waiting ${Math.round(waited / 1000)}s: ${verdict.reason}.` +
          (where ? ` Active: ${where}` : '')
      );
    }
    await sleep(POLL_MS);
  }

  if (queued) remove(WAITING, process.pid);
  // Timed out rather than admitted: nothing recorded us, and a run nobody can see is a run the next
  // admission decision will not budget for.
  if (!admitted) acquire(mine);
  return release;
}
