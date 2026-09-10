/**
 * Distilling free-text "what would you like to see?" answers into the
 * most-requested themes. Shared logic with Email Commander (which uses it to
 * build the requested-designs block in reminder emails); here it feeds the
 * "Top requests" line on the webinar stats panel.
 */

/**
 * Words that are never a request in themselves. `design(s)` is the question's
 * own wording so everyone repeats it; the rest are modifiers that only carry
 * meaning attached to a subject ("small" is noise, "small butterflies" isn't).
 */
const GENERIC = new Set(
  ("design designs one two small big large quick fast easy simple full half side sided " +
   "new different cool fun nice pretty beautiful detailed bold art paint painting face " +
   "faces stroke kind type types colors color people adults kids children boys girls real " +
   "work line lines round tips made").split(" ")
);
/** Placeholder answers — mostly staff tests. Left in, they top the chart. */
const NOISE = new Set(
  "test testing any all anything everything none na n/a idk yes no sure good ok okay".split(" ")
);
const STOP = new Set(
  ("a an and are as at be but by for from how i in is it like me more my not of on or see " +
   "the to want with would you your really just done them that this every get getting those").split(" ")
);

/** Fold plurals so "butterflies" and "butterfly" are one theme. */
function stem(w: string): string {
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

/**
 * Distill free-text answers into the most-requested themes.
 *
 * Counts recurring WORDS and PAIRS, not whole answers — real answers are
 * almost all unique ("Ghost butterflies", "Quick butterflies for long lines",
 * "Monarch"), so counting identical strings finds nothing and ranks staff
 * "test" entries first. Verified against 50 real answers from the Claire
 * webinar, which yields: butterflies, monarch, eye designs, ghost, rainbow.
 */
export function topDesigns(answers: string[], limit = 6): string[] {
  const uni = new Map<string, { display: string; n: number }>();
  const bi = new Map<string, { display: string; n: number }>();

  for (const answer of answers) {
    const norm = answer.toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
    if (!norm || NOISE.has(norm)) continue;
    const words = norm.split(" ").filter((w) => w.length > 2 && !STOP.has(w) && !NOISE.has(w));

    // Count each theme at most once per answer, so one rambling reply can't
    // stuff the chart.
    const seenU = new Set<string>();
    const seenB = new Set<string>();
    words.forEach((w, i) => {
      const key = stem(w);
      if (!seenU.has(key)) {
        const hit = uni.get(key);
        if (hit) hit.n++;
        else uni.set(key, { display: w, n: 1 });
        seenU.add(key);
      }
      if (i < words.length - 1) {
        const pair = `${key} ${stem(words[i + 1])}`;
        if (!seenB.has(pair)) {
          const hit = bi.get(pair);
          if (hit) hit.n++;
          else bi.set(pair, { display: `${w} ${words[i + 1]}`, n: 1 });
          seenB.add(pair);
        }
      }
    });
  }

  const out: { phrase: string; n: number; pair: boolean }[] = [];
  const claimed = new Set<string>();
  for (const [key, v] of [...bi.entries()].filter(([, v]) => v.n >= 2).sort((a, b) => b[1].n - a[1].n)) {
    out.push({ phrase: v.display, n: v.n, pair: true });
    key.split(" ").forEach((w) => claimed.add(w));
  }
  for (const [key, v] of uni.entries()) {
    if (v.n < 2 || claimed.has(key) || GENERIC.has(key)) continue;
    out.push({ phrase: v.display, n: v.n, pair: false });
  }
  return out
    .sort((a, b) => b.n - a.n || Number(b.pair) - Number(a.pair))
    .slice(0, limit)
    .map((x) => x.phrase);
}
