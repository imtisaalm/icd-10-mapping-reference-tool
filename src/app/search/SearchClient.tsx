"use client";

import { useState } from "react";
import type { SearchResult } from "@/types/icd";

const MATCH_LABELS: Record<SearchResult["matchType"], string> = {
  "exact-phrase": "Exact phrase",
  phrase: "Phrase",
  "all-terms": "All terms",
  approximate: "Approximate",
};

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [fuzzy, setFuzzy] = useState(true);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&fuzzy=${fuzzy ? "1" : "0"}`
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { results: SearchResult[] };
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">Description search</h1>
        <p className="mt-1 text-sm text-muted">
          Search the official ICD-10-CM descriptions by clinical terms, for example{" "}
          <em>heart failure</em>, <em>asthma</em>, or <em>type 2 diabetes</em>. Matching is
          case-insensitive; fuzzy results for minor spelling errors are labelled as approximate.
        </p>
      </section>

      <form onSubmit={runSearch} className="flex max-w-xl flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. heart failure"
          aria-label="Search terms"
          className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={fuzzy}
            onChange={(e) => setFuzzy(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Allow fuzzy matching
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <p className="text-sm text-muted">
          No matches. Every search term must match a description word; try fewer or more general
          terms{fuzzy ? "" : ", or enable fuzzy matching"}.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          {results[0].approximate && (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              No exact term matches were found. The results below are approximate matches based
              on small spelling differences — verify before use.
            </p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Official description</th>
                <th className="px-4 py-2 font-medium">Match</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.code} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 font-mono">{r.code}</td>
                  <td className="px-4 py-2">{r.description}</td>
                  <td className="px-4 py-2 text-xs text-muted">{MATCH_LABELS[r.matchType]}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.validForSubmission ? (
                      <span className="text-green-900">Valid for submission</span>
                    ) : (
                      <span className="text-amber-900">Header — not valid for submission</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-muted">
            {results.length} result{results.length === 1 ? "" : "s"} (up to 50 shown), ranked by
            match quality.
          </p>
        </div>
      )}
    </div>
  );
}
