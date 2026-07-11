// ---------------------------------------------------------------------------
// Dependency-free word-level diff for the Refined tab "A/B" view.
//
// Tokenizes both sides into words + whitespace runs, computes the longest
// common subsequence via O(n·m) dynamic programming, and emits an ordered
// list of {equal|added|removed} segments. Whitespace is preserved as its own
// tokens so the rendered diff keeps the original line breaks and spacing.
// ---------------------------------------------------------------------------

export type DiffType = 'equal' | 'added' | 'removed';

export interface DiffSegment {
  type: DiffType;
  text: string;
}

/**
 * Upper bound on tokens per side. The LCS table is O(n·m); at 2500×2500 that is
 * ~6.25M cells — the practical ceiling before the diff is not worth showing.
 * Beyond this the caller should hide the toggle rather than block the UI.
 */
const MAX_TOKENS = 2500;

/** Split into alternating runs of whitespace and non-whitespace (words). */
function tokenize(input: string): string[] {
  return input.match(/\s+|\S+/g) ?? [];
}

/**
 * Word-level diff of `before` → `after`.
 *
 * Returns ordered segments describing how to turn `before` into `after`, or
 * `null` when either side exceeds {@link MAX_TOKENS} (caller hides the toggle).
 * Consecutive segments of the same type are merged so rendering stays cheap.
 */
export function diffWords(before: string, after: string): DiffSegment[] | null {
  const source = tokenize(before);
  const target = tokenize(after);

  if (source.length > MAX_TOKENS || target.length > MAX_TOKENS) {
    return null;
  }

  const sourceLength = source.length;
  const targetLength = target.length;

  // dp[i][j] = LCS length of source[i..] and target[j..].
  const dp: number[][] = Array.from({ length: sourceLength + 1 }, () =>
    new Array<number>(targetLength + 1).fill(0),
  );

  for (let i = sourceLength - 1; i >= 0; i--) {
    for (let j = targetLength - 1; j >= 0; j--) {
      dp[i][j] =
        source[i] === target[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < sourceLength && j < targetLength) {
    if (source[i] === target[j]) {
      raw.push({ type: 'equal', text: source[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'removed', text: source[i] });
      i++;
    } else {
      raw.push({ type: 'added', text: target[j] });
      j++;
    }
  }

  while (i < sourceLength) {
    raw.push({ type: 'removed', text: source[i] });
    i++;
  }

  while (j < targetLength) {
    raw.push({ type: 'added', text: target[j] });
    j++;
  }

  // Merge adjacent same-type runs so the renderer emits the fewest nodes.
  const merged: DiffSegment[] = [];
  for (const segment of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === segment.type) {
      last.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}
