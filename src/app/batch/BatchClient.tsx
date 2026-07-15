"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import type { RowValidation, ValidationSummary } from "@/types/icd";
import { objectsToCsv, rowsToCsv } from "@/lib/csv";

/** Keep requests comfortably under the API's per-request cap. */
const CHUNK_SIZE = 2000;
const MAX_ROWS = 50000;
const PREVIEW_ROWS = 200;

const APPENDED_COLUMNS: (keyof RowValidation & string)[] = [
  "original_code",
  "normalized_code",
  "is_valid",
  "matched_code",
  "official_description",
  "match_type",
  "status",
  "validation_note",
  "classification",
  "classification_version",
];

const STATUS_LABELS: Record<RowValidation["status"], string> = {
  valid_exact: "Valid (exact)",
  valid_normalized: "Valid (normalized)",
  invalid: "Invalid",
  missing: "Missing",
  ambiguous: "Ambiguous",
};

const STATUS_STYLES: Record<RowValidation["status"], string> = {
  valid_exact: "text-green-900",
  valid_normalized: "text-blue-900",
  invalid: "text-red-800",
  missing: "text-muted",
  ambiguous: "text-amber-900",
};

interface ParsedCsv {
  fileName: string;
  headers: string[];
  rows: string[][];
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BatchClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [columnIndex, setColumnIndex] = useState(0);
  const [results, setResults] = useState<RowValidation[] | null>(null);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setParsed(null);
    setResults(null);
    setSummary(null);
    setError(null);
    setColumnIndex(0);
  }

  function handleFile(file: File | undefined, headerRow: boolean) {
    reset();
    if (!file) return;
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: (output) => {
        const data = output.data as string[][];
        if (data.length === 0) {
          setError("The file appears to be empty.");
          return;
        }
        const headers = headerRow
          ? data[0].map((h, i) => (h?.trim() ? h.trim() : `Column ${i + 1}`))
          : data[0].map((_, i) => `Column ${i + 1}`);
        const rows = headerRow ? data.slice(1) : data;
        if (rows.length === 0) {
          setError("The file contains a header row but no data rows.");
          return;
        }
        if (rows.length > MAX_ROWS) {
          setError(`The file has ${rows.length.toLocaleString("en-US")} rows; the limit is ${MAX_ROWS.toLocaleString("en-US")}.`);
          return;
        }
        setParsed({ fileName: file.name, headers, rows });
        // Preselect a likely code column if one is named accordingly.
        const guess = headers.findIndex((h) => /code|icd|dx|diag/i.test(h));
        setColumnIndex(guess >= 0 ? guess : 0);
      },
      error: (err) => setError(`Could not parse the file: ${err.message}`),
    });
  }

  async function runValidation() {
    if (!parsed) return;
    setBusy("Validating…");
    setError(null);
    try {
      const codes = parsed.rows.map((row) => row[columnIndex] ?? "");
      const all: RowValidation[] = [];
      for (let start = 0; start < codes.length; start += CHUNK_SIZE) {
        setBusy(
          `Validating… ${Math.min(start + CHUNK_SIZE, codes.length).toLocaleString("en-US")} / ${codes.length.toLocaleString("en-US")} rows`
        );
        const res = await fetch("/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes: codes.slice(start, start + CHUNK_SIZE) }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Validation request failed (${res.status})`);
        }
        const data = (await res.json()) as { results: RowValidation[] };
        all.push(...data.results);
      }
      setResults(all);

      const count = (status: RowValidation["status"]) =>
        all.filter((r) => r.status === status).length;
      const valid = count("valid_exact") + count("valid_normalized");
      setSummary({
        total_rows: all.length,
        valid_exact: count("valid_exact"),
        valid_normalized: count("valid_normalized"),
        invalid: count("invalid"),
        missing: count("missing"),
        ambiguous: count("ambiguous"),
        valid_percentage: all.length === 0 ? 0 : Math.round((valid / all.length) * 10000) / 100,
        classification: all[0]?.classification ?? "ICD-10-CM",
        classification_version: all[0]?.classification_version ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
      setResults(null);
      setSummary(null);
    } finally {
      setBusy(null);
    }
  }

  const stem = parsed ? parsed.fileName.replace(/\.csv$/i, "") : "results";

  function downloadValidatedCsv() {
    if (!parsed || !results) return;
    const headers = [...parsed.headers, ...APPENDED_COLUMNS.filter((c) => c !== "original_code")];
    const rows = parsed.rows.map((row, i) => {
      const r = results[i];
      return [
        ...parsed.headers.map((_, col) => row[col] ?? ""),
        r.normalized_code,
        String(r.is_valid),
        r.matched_code,
        r.official_description,
        r.match_type,
        r.status,
        r.validation_note,
        r.classification,
        r.classification_version,
      ];
    });
    download(`${stem}.validated.csv`, rowsToCsv(headers, rows), "text/csv");
  }

  function downloadInvalidCsv() {
    if (!results) return;
    const invalid = results.filter((r) => !r.is_valid);
    download(
      `${stem}.invalid-rows.csv`,
      objectsToCsv(APPENDED_COLUMNS, invalid),
      "text/csv"
    );
  }

  function downloadSummary(format: "csv" | "json") {
    if (!summary) return;
    if (format === "json") {
      download(`${stem}.summary.json`, JSON.stringify(summary, null, 2), "application/json");
    } else {
      const keys = Object.keys(summary) as (keyof ValidationSummary & string)[];
      download(`${stem}.summary.csv`, objectsToCsv(keys, [summary]), "text/csv");
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">Batch CSV validation</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a CSV file, choose the column that contains diagnosis codes, and get a
          row-by-row validation report. Ambiguous or invalid values are flagged, never replaced.
        </p>
        <p className="mt-1 text-xs text-muted">
          Privacy: the file is read in your browser. Only the values of the selected code column
          are sent to the server for validation, processed in memory, and never stored.
        </p>
      </section>

      <section className="max-w-2xl space-y-3 rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            onChange={(e) => handleFile(e.target.files?.[0], hasHeader)}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => {
                setHasHeader(e.target.checked);
                const file = fileInputRef.current?.files?.[0];
                if (file) handleFile(file, e.target.checked);
              }}
              className="accent-[var(--accent)]"
            />
            First row is a header
          </label>
        </div>

        {parsed && (
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">
                Code column
              </span>
              <select
                value={columnIndex}
                onChange={(e) => setColumnIndex(Number(e.target.value))}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {parsed.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={runValidation}
              disabled={busy !== null}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ?? `Validate ${parsed.rows.length.toLocaleString("en-US")} rows`}
            </button>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {summary && results && (
        <>
          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Summary</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
              {(
                [
                  ["Total rows", summary.total_rows.toLocaleString("en-US")],
                  ["Valid — exact", summary.valid_exact.toLocaleString("en-US")],
                  ["Valid — normalized", summary.valid_normalized.toLocaleString("en-US")],
                  ["Invalid", summary.invalid.toLocaleString("en-US")],
                  ["Missing", summary.missing.toLocaleString("en-US")],
                  ["Ambiguous", summary.ambiguous.toLocaleString("en-US")],
                  ["Valid percentage", `${summary.valid_percentage}%`],
                  ["Classification", `${summary.classification} ${summary.classification_version}`],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="border-b border-border pb-2">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button
                onClick={downloadValidatedCsv}
                className="rounded-md border border-border bg-background px-3 py-1.5 hover:border-accent"
              >
                Download validated CSV
              </button>
              <button
                onClick={downloadInvalidCsv}
                className="rounded-md border border-border bg-background px-3 py-1.5 hover:border-accent"
              >
                Download invalid rows only
              </button>
              <button
                onClick={() => downloadSummary("csv")}
                className="rounded-md border border-border bg-background px-3 py-1.5 hover:border-accent"
              >
                Download summary (CSV)
              </button>
              <button
                onClick={() => downloadSummary("json")}
                className="rounded-md border border-border bg-background px-3 py-1.5 hover:border-accent"
              >
                Download summary (JSON)
              </button>
            </div>
          </section>

          <section className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Original</th>
                  <th className="px-3 py-2 font-medium">Normalized</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Matched code</th>
                  <th className="px-3 py-2 font-medium">Official description</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, PREVIEW_ROWS).map((r, i) => (
                  <tr key={i} className="border-b border-border align-top last:border-b-0">
                    <td className="px-3 py-2 text-xs text-muted">{i + 1}</td>
                    <td className="px-3 py-2 font-mono">{r.original_code || "—"}</td>
                    <td className="px-3 py-2 font-mono">{r.normalized_code || "—"}</td>
                    <td className={`px-3 py-2 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.matched_code || "—"}</td>
                    <td className="px-3 py-2">{r.official_description || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.validation_note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length > PREVIEW_ROWS && (
              <p className="px-3 py-2 text-xs text-muted">
                Showing the first {PREVIEW_ROWS} of {results.length.toLocaleString("en-US")} rows.
                Download the validated CSV for the complete report.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
