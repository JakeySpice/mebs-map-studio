/**
 * Subsequence fuzzy score of `query` against `text`. Returns -Infinity when
 * `query` isn't a subsequence of `text`; higher is better. Rewards consecutive
 * runs, matches at word starts (space / punctuation / camelCase boundaries),
 * and an early first match. Case-insensitive. Plenty for a node picker — no
 * external matcher.
 */
export function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let qi = 0;
  let run = 0;
  let firstIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      run = 0;
      continue;
    }
    if (firstIdx === -1) firstIdx = ti;
    let bonus = 1;
    run += 1;
    bonus += (run - 1) * 4; // consecutive characters are worth much more
    const prev = ti > 0 ? text[ti - 1] : " ";
    const isWordStart =
      ti === 0 ||
      /[\s\-_/.,()]/.test(prev) ||
      (/[a-z]/.test(prev) && /[A-Z]/.test(text[ti]));
    if (isWordStart) bonus += 6;
    score += bonus;
    qi += 1;
  }
  if (qi < q.length) return -Infinity; // not all query chars consumed
  // bias toward earlier first hits and shorter haystacks (tighter match)
  score -= firstIdx * 0.5;
  score -= t.length * 0.05;
  return score;
}
