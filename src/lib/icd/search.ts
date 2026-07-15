/**
 * Description search over the official code table.
 *
 * Matching tiers (strict to loose):
 *   1. exact phrase   — the description equals the query
 *   2. phrase         — the description contains the query as a phrase
 *   3. all-terms      — every query term matches a word (or word prefix)
 *   4. approximate    — at least one term only matches within a small edit
 *                       distance (optional; results are labelled)
 *
 * Every returned description is verbatim source data; only ranking is ours.
 */
import type { SearchResult } from "@/types/icd";
import { getDataset, type IcdDataset } from "./loader";
import { entryKind } from "./hierarchy";

interface SearchIndex {
  /** Lower-cased long description per entry (parallel to dataset.entries). */
  descLower: string[];
  /** token → indexes of entries whose description contains the token. */
  postings: Map<string, number[]>;
  /** All distinct tokens, for prefix and fuzzy scans. */
  vocabulary: string[];
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

let cachedIndex: SearchIndex | null = null;

function getIndex(dataset: IcdDataset): SearchIndex {
  if (cachedIndex) return cachedIndex;
  const descLower: string[] = [];
  const postings = new Map<string, number[]>();
  dataset.entries.forEach((entry, i) => {
    const lower = entry.description.toLowerCase();
    descLower.push(lower);
    for (const token of new Set(tokenize(lower))) {
      const list = postings.get(token);
      if (list) list.push(i);
      else postings.set(token, [i]);
    }
  });
  cachedIndex = { descLower, postings, vocabulary: [...postings.keys()] };
  return cachedIndex;
}

/**
 * Levenshtein distance with early exit once `max` is exceeded.
 */
export function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

interface TermMatch {
  entryIndexes: Set<number>;
  fuzzyOnly: boolean;
}

function matchTerm(term: string, index: SearchIndex, fuzzy: boolean): TermMatch | null {
  const matched = new Set<number>();
  let exactOrPrefix = false;

  const exact = index.postings.get(term);
  if (exact) {
    exactOrPrefix = true;
    for (const i of exact) matched.add(i);
  }
  // Word-prefix matching, e.g. "diabet" → "diabetes", "diabetic".
  if (term.length >= 3) {
    for (const token of index.vocabulary) {
      if (token.length > term.length && token.startsWith(term)) {
        exactOrPrefix = true;
        for (const i of index.postings.get(token)!) matched.add(i);
      }
    }
  }
  if (exactOrPrefix) return { entryIndexes: matched, fuzzyOnly: false };

  if (fuzzy && term.length >= 4) {
    const maxDistance = term.length >= 7 ? 2 : 1;
    for (const token of index.vocabulary) {
      if (boundedEditDistance(term, token, maxDistance) <= maxDistance) {
        for (const i of index.postings.get(token)!) matched.add(i);
      }
    }
    if (matched.size > 0) return { entryIndexes: matched, fuzzyOnly: true };
  }
  return null;
}

export interface SearchOptions {
  fuzzy?: boolean;
  limit?: number;
}

export function searchDescriptions(query: string, options: SearchOptions = {}): SearchResult[] {
  const { fuzzy = true, limit = 50 } = options;
  const dataset = getDataset();
  const index = getIndex(dataset);

  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const phrase = terms.join(" ");

  // Every term must match somewhere; otherwise we return nothing rather
  // than a loosely related list.
  const termMatches: TermMatch[] = [];
  for (const term of terms) {
    const match = matchTerm(term, index, fuzzy);
    if (!match) return [];
    termMatches.push(match);
  }

  // Intersect, starting from the smallest set.
  termMatches.sort((a, b) => a.entryIndexes.size - b.entryIndexes.size);
  let candidates = [...termMatches[0].entryIndexes];
  for (const tm of termMatches.slice(1)) {
    candidates = candidates.filter((i) => tm.entryIndexes.has(i));
    if (candidates.length === 0) return [];
  }
  const anyFuzzy = termMatches.some((tm) => tm.fuzzyOnly);

  const results: SearchResult[] = candidates.map((i) => {
    const entry = dataset.entries[i];
    const desc = index.descLower[i];
    let matchType: SearchResult["matchType"];
    let score: number;
    if (!anyFuzzy && desc === phrase) {
      matchType = "exact-phrase";
      score = 100;
    } else if (!anyFuzzy && desc.includes(phrase)) {
      matchType = "phrase";
      score = 80 + (desc.startsWith(phrase) ? 5 : 0);
    } else if (!anyFuzzy) {
      matchType = "all-terms";
      score = 60;
    } else {
      matchType = "approximate";
      score = 30;
    }
    // Prefer reportable codes slightly, and shorter (more general)
    // descriptions among equals.
    if (entry.validForSubmission) score += 3;
    score -= Math.min(desc.length / 200, 2);
    return {
      code: entry.code,
      description: entry.description,
      validForSubmission: entry.validForSubmission,
      kind: entryKind(entry),
      matchType,
      approximate: anyFuzzy,
      score: Math.round(score * 100) / 100,
    };
  });

  results.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return results.slice(0, limit);
}
