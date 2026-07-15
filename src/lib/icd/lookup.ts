/**
 * Exact-code lookup with safe normalization.
 */
import type { LookupResult, NormalizationChange } from "@/types/icd";
import { getDataset } from "./loader";
import { entryKind, getHierarchy } from "./hierarchy";
import { normalizeCodeInput } from "./normalize";

const CHANGE_LABELS: Record<NormalizationChange, string> = {
  trimmed_whitespace: "removed surrounding whitespace",
  uppercased: "converted to upper case",
  added_decimal_point: "inserted the standard decimal point",
  removed_trailing_decimal_point: "removed a trailing decimal point",
};

export function describeChanges(changes: NormalizationChange[]): string {
  return changes.map((c) => CHANGE_LABELS[c]).join("; ");
}

export function lookupCode(query: string): LookupResult {
  const dataset = getDataset();
  const base = { query, classification: dataset.classification };

  const normalized = normalizeCodeInput(query);
  if (normalized.status === "empty") {
    return { ...base, status: "empty", note: "No code was provided." };
  }
  if (normalized.status === "ambiguous") {
    return {
      ...base,
      status: "ambiguous",
      note: `${normalized.reason}. Look up one code at a time.`,
      candidates: normalized.candidates,
    };
  }
  if (normalized.status === "malformed") {
    return { ...base, status: "malformed", note: normalized.reason + "." };
  }

  const entry = dataset.byCodeNoDot.get(normalized.codeNoDot);
  if (!entry) {
    return {
      ...base,
      status: "not_found",
      note: `"${normalized.display}" is not present in ${dataset.classification.system} ${dataset.classification.version}.`,
      changes: normalized.changes,
    };
  }

  const matchType = normalized.changes.length === 0 ? "exact" : "normalized";
  return {
    ...base,
    status: "found",
    matchType,
    changes: normalized.changes,
    note:
      matchType === "exact"
        ? "Exact match."
        : `Matched after safe normalization: ${describeChanges(normalized.changes)}.`,
    entry: {
      code: entry.code,
      description: entry.description,
      shortDescription: entry.shortDescription,
      validForSubmission: entry.validForSubmission,
      kind: entryKind(entry),
    },
    hierarchy: getHierarchy(entry),
  };
}
