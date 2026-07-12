// ---------------------------------------------------------------------------
// Tape-transport sound — opt-in, Web Audio-synthesized micro-sounds.
//
// No asset files: every sound is generated on the fly from oscillators so the
// bundle stays byte-free and the timbre is tunable in code. Two sounds:
//   • transportClick() — a soft click when an explicit refine starts.
//   • tapeStop()       — a low "thunk" when that refine completes successfully.
//
// Design constraints:
//   • One lazily-created, shared AudioContext. Browsers block audio until a
//     user gesture, so the context is only ever created/resumed from inside a
//     gesture-driven call path (the header toggle, processNow()).
//   • Disabled by default; persisted in localStorage under `mdr-sound-enabled`.
//   • Both play functions are silent no-ops when sound is disabled, when the
//     Web Audio API is unavailable, or during SSR.
//   • A suspended context is resumed opportunistically; if it does not resume
//     quickly the sound is dropped rather than queued, so stale clicks never
//     fire late.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'mdr-sound-enabled';

/** If a suspended context has not resumed within this window, drop the sound. */
const RESUME_DROP_MS = 120;

/** In-memory mirror of the persisted flag, so hot-path reads avoid storage. */
let enabledCache: boolean | null = null;

/** The single shared context, created lazily inside a user gesture. */
let audioContext: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

/** Resolve a usable AudioContext constructor, tolerating Safari's prefix. */
function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext;
  return ctor ?? null;
}

/**
 * Get (or lazily create) the shared AudioContext. Returns null when Web Audio
 * is unavailable or during SSR. MUST be reached from a user gesture the first
 * time so the browser permits playback.
 */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    audioContext = new Ctor();
  } catch {
    // Some environments throw if too many contexts exist — degrade silently.
    audioContext = null;
  }
  return audioContext;
}

/** Read the persisted flag; defaults to OFF and tolerates blocked storage. */
function readEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Whether tape-transport sound is currently enabled. */
export function isSoundEnabled(): boolean {
  if (enabledCache === null) enabledCache = readEnabled();
  return enabledCache;
}

/**
 * Enable or disable tape-transport sound and persist the choice. Enabling from
 * within a user gesture also eagerly creates/resumes the context so the very
 * next play (the confirmation click) is unlocked.
 */
export function setSoundEnabled(enabled: boolean): void {
  enabledCache = enabled;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
      // Storage blocked (private mode) — flag still applies for this session.
    }
  }
  if (enabled) {
    const ctx = getContext();
    // Resume now, inside the gesture, so the unlock is settled before playback.
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }
}

/**
 * Run `render` against a running context. If the context is suspended, resume
 * it and play only once it is actually running — but drop the sound if that
 * does not happen within RESUME_DROP_MS so a delayed resume never fires a stale
 * click. `render` receives the context and the scheduling start time.
 */
function withRunningContext(
  render: (ctx: AudioContext, startTime: number) => void,
): void {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;

  if (ctx.state === 'running') {
    render(ctx, ctx.currentTime);
    return;
  }

  if (ctx.state === 'suspended') {
    let dropped = false;
    const dropTimer = setTimeout(() => {
      dropped = true;
    }, RESUME_DROP_MS);
    ctx
      .resume()
      .then(() => {
        clearTimeout(dropTimer);
        if (dropped || ctx.state !== 'running') return;
        render(ctx, ctx.currentTime);
      })
      .catch(() => clearTimeout(dropTimer));
  }
  // 'closed' or any other state → drop.
}

/** Free oscillator/gain nodes once a one-shot voice has finished. */
function disconnectOnEnd(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
  source.onended = () => {
    source.disconnect();
    for (const node of nodes) node.disconnect();
  };
}

/**
 * A soft, short transport click for refine start. A ~30ms triangle burst near
 * 1.2kHz with an exponential decay — reads as a tactile button-in, not a beep.
 */
export function transportClick(): void {
  withRunningContext((ctx, t0) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t0);

    // Peak stays subtle (<= 0.08); exponential fall to near-silence in ~30ms.
    gain.gain.setValueAtTime(0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);

    osc.connect(gain).connect(ctx.destination);
    disconnectOnEnd(osc, gain);
    osc.start(t0);
    osc.stop(t0 + 0.035);
  });
}

/**
 * A low "thunk" for completion — a ~110ms sine sweeping 180Hz → 60Hz with a
 * quick attack and decay, like a tape transport coming to rest.
 */
export function tapeStop(): void {
  withRunningContext((ctx, t0) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.1);

    // Quick attack to a subtle peak (<= 0.1), then decay to near-silence.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);

    osc.connect(gain).connect(ctx.destination);
    disconnectOnEnd(osc, gain);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  });
}
