/**
 * Row-level validation of diagnosis codes, used by batch CSV validation.
 *
 * Ambiguous and invalid values are reported, never silently replaced.
 */
import type { RowValidation, ValidationSummary } from "@/types/icd";
import { getDataset } from "./loader";
import { describeChanges } from "./lookup";
import { normalizeCodeInput } from "./normalize";

export function validateCode(raw: string | null | undefined): RowValidation {
  const dataset = getDataset();
  const base = {
    original_code: raw ?? "",
    normalized_code: "",
    is_valid: false,
    matched_code: "",
    official_description: "",
    match_type: "none" as RowValidation["match_type"],
    classification: dataset.classification.system,
    classification_version: dataset.classification.version,
  };

  const normalized = normalizeCodeInput(raw);

  if (normalized.status === "empty") {
    return {
      ...base,
      status: "missing",
      validation_note: "No code provided.",
    };
  }

  if (normalized.status === "ambiguous") {
    return {
      ...base,
      status: "ambiguous",
      validation_note: `${normalized.reason} (${normalized.candidates.join(", ")}). Not resolved automatically; split into one code per row.`,
    };
  }

  if (normalized.status === "malformed") {
    return {
      ...base,
      normalized_code: normalized.cleaned,
      status: "invalid",
      validation_note: `${normalized.reason}. Not corrected automatically.`,
    };
  }

  const entry = dataset.byCodeNoDot.get(normalized.codeNoDot);

  if (!entry) {
    return {
      ...base,
      normalized_code: normalized.display,
      status: "invalid",
      validation_note: `Not found in ${dataset.classification.system} ${dataset.classification.version}.`,
    };
  }

  if (!entry.validForSubmission) {
    const kind = entry.codeNoDot.length === 3 ? "category" : "subcategory";
    return {
      ...base,
      normalized_code: normalized.display,
      matched_code: entry.code,
      official_description: entry.description,
      match_type: "header",
      status: "invalid",
      validation_note: `Matches the ${kind} header "${entry.code}" (${entry.description}), which is not valid for submission; a more specific code is required. Not corrected automatically.`,
    };
  }

  const exact = normalized.changes.length === 0;
  return {
    ...base,
    normalized_code: normalized.display,
    is_valid: true,
    matched_code: entry.code,
    official_description: entry.description,
    match_type: exact ? "exact" : "normalized",
    status: exact ? "valid_exact" : "valid_normalized",
    validation_note: exact
      ? "Exact match."
      : `Valid after safe normalization: ${describeChanges(normalized.changes)}.`,
  };
}

export function validateCodes(values: (string | null | undefined)[]): RowValidation[] {
  return values.map(validateCode);
}

export function summarizeValidation(results: RowValidation[]): ValidationSummary {
  const dataset = getDataset();
  const count = (status: RowValidation["status"]) =>
    results.filter((r) => r.status === status).length;
  const validExact = count("valid_exact");
  const validNormalized = count("valid_normalized");
  const total = results.length;
  return {
    total_rows: total,
    valid_exact: validExact,
    valid_normalized: validNormalized,
    invalid: count("invalid"),
    missing: count("missing"),
    ambiguous: count("ambiguous"),
    valid_percentage:
      total === 0 ? 0 : Math.round(((validExact + validNormalized) / total) * 10000) / 100,
    classification: dataset.classification.system,
    classification_version: dataset.classification.version,
  };
}
