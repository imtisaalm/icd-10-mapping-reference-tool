"use client";

import { useState } from "react";
import type { LookupResult } from "@/types/icd";

const LEVEL_LABELS: Record<string, string> = {
  chapter: "Chapter",
  block: "Block",
  category: "Category",
  subcategory: "Subcategory",
  code: "Code",
};

const STATUS_MESSAGES: Record<string, string> = {
  not_found: "Code not found",
  malformed: "Input not recognized as an ICD-10-CM code",
  ambiguous: "Ambiguous input",
  empty: "Enter a code to look up",
};

export default function LookupClient() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lookup?code=${encodeURIComponent(input)}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setResult((await res.json()) as LookupResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">Code lookup</h1>
        <p className="mt-1 text-sm text-muted">
          Enter one ICD-10-CM code (for example <span className="font-mono">I50.9</span>).
          Case, surrounding whitespace, and a missing decimal point are normalized safely;
          anything else is reported, never guessed.
        </p>
      </section>

      <form onSubmit={runLookup} className="flex max-w-md gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. I50.9"
          aria-label="ICD-10-CM code"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {result && result.status !== "found" && (
        <div className="max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">{STATUS_MESSAGES[result.status] ?? result.status}</p>
          {result.note && <p className="mt-1 text-muted">{result.note}</p>}
          {result.candidates && (
            <p className="mt-1">
              Values found:{" "}
              {result.candidates.map((c) => (
                <span key={c} className="mr-2 font-mono">
                  {c}
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {result && result.status === "found" && result.entry && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-lg font-semibold">{result.entry.code}</span>
              <span
                className={
                  result.entry.validForSubmission
                    ? "rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs text-green-900"
                    : "rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900"
                }
              >
                {result.entry.validForSubmission
                  ? "Valid for submission"
                  : result.entry.kind === "category-header"
                    ? "Category header — not valid for submission"
                    : "Subcategory header — not valid for submission"}
              </span>
              <span
                className={
                  result.matchType === "exact"
                    ? "rounded border border-border px-2 py-0.5 text-xs text-muted"
                    : "rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-900"
                }
              >
                {result.matchType === "exact" ? "Exact match" : "Matched after normalization"}
              </span>
            </div>
            <p className="mt-2 text-sm">{result.entry.description}</p>
            {result.matchType === "normalized" && (
              <p className="mt-2 text-xs text-muted">{result.note}</p>
            )}
            <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
              {result.classification.system} {result.classification.version} ·{" "}
              {result.classification.source}
            </p>
          </div>

          {result.hierarchy && (
            <div className="rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Hierarchy
              </h2>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {result.hierarchy.map((level, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="w-28 py-2 pr-3 align-top text-xs uppercase tracking-wide text-muted">
                        {LEVEL_LABELS[level.level]}
                      </td>
                      <td className="w-40 py-2 pr-3 align-top font-mono text-xs">{level.code}</td>
                      <td className="py-2 align-top">{level.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">
                Only hierarchy levels present in the official source data are shown.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
