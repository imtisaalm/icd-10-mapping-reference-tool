/**
 * Shared types for the ICD reference data layer.
 *
 * The data model is deliberately classification-agnostic where possible so a
 * second classification (e.g. ICD-10-CA) can be added later as another
 * dataset implementation without rewriting consumers.
 */

/** Identifies a classification system + release. */
export interface ClassificationInfo {
  /** e.g. "ICD-10-CM" */
  system: string;
  /** e.g. "FY2026" */
  version: string;
  /** Human-readable release description. */
  release: string;
  /** Publisher of the source data. */
  source: string;
  /** URLs the data was retrieved from. */
  sourceUrls: string[];
  /** ISO date the source data was retrieved. */
  retrievedAt: string;
  /** Licensing / usage notes. */
  license: string;
}

/** One entry from the official code table (a category, subcategory, or code). */
export interface IcdEntry {
  /** Canonical display form with decimal point, e.g. "I50.9". */
  code: string;
  /** Storage form without decimal point, e.g. "I509". */
  codeNoDot: string;
  /** Official long description. */
  description: string;
  /** Official short description. */
  shortDescription: string;
  /**
   * True when the source marks this entry as valid for submission
   * (a complete, reportable code rather than a header).
   */
  validForSubmission: boolean;
  /** Zero-based position in the official order file. */
  orderIndex: number;
}

/** How specific an entry is, as determinable from the source data. */
export type EntryKind = "code" | "category-header" | "subcategory-header";

/** A block (section) of categories inside a chapter, from the tabular list. */
export interface IcdBlock {
  /** First category of the block, e.g. "I30". */
  first: string;
  /** Last category of the block, e.g. "I5A". */
  last: string;
  description: string;
  /** Categories the source tabular list nests inside this block. */
  categories: string[];
}

/** A chapter from the official tabular list. */
export interface IcdChapter {
  /** Chapter number as published, e.g. "9". */
  number: string;
  description: string;
  first: string;
  last: string;
  sections: IcdBlock[];
}

/** One level of the verified hierarchy for a code. */
export interface HierarchyLevel {
  level: "chapter" | "block" | "category" | "subcategory" | "code";
  /** Display code or range, e.g. "Chapter 9", "I30-I5A", "I50", "I50.9". */
  code: string;
  description: string;
  /** Present for category/subcategory/code levels. */
  validForSubmission?: boolean;
}

export type NormalizationChange =
  | "trimmed_whitespace"
  | "uppercased"
  | "added_decimal_point"
  | "removed_trailing_decimal_point";

export type NormalizeResult =
  | { status: "empty" }
  | { status: "ambiguous"; reason: string; candidates: string[] }
  | { status: "malformed"; reason: string; cleaned: string }
  | {
      status: "ok";
      /** Storage form without dot. */
      codeNoDot: string;
      /** Canonical display form with dot where applicable. */
      display: string;
      changes: NormalizationChange[];
    };

export interface LookupResult {
  query: string;
  status: "found" | "not_found" | "empty" | "malformed" | "ambiguous";
  matchType?: "exact" | "normalized";
  changes?: NormalizationChange[];
  note?: string;
  candidates?: string[];
  entry?: {
    code: string;
    description: string;
    shortDescription: string;
    validForSubmission: boolean;
    kind: EntryKind;
  };
  hierarchy?: HierarchyLevel[];
  classification: ClassificationInfo;
}

export type SearchMatchType = "exact-phrase" | "phrase" | "all-terms" | "approximate";

export interface SearchResult {
  code: string;
  description: string;
  validForSubmission: boolean;
  kind: EntryKind;
  matchType: SearchMatchType;
  /** True when fuzzy matching was needed for at least one query term. */
  approximate: boolean;
  score: number;
}

export type ValidationStatus =
  | "valid_exact"
  | "valid_normalized"
  | "invalid"
  | "missing"
  | "ambiguous";

export interface RowValidation {
  original_code: string;
  normalized_code: string;
  is_valid: boolean;
  matched_code: string;
  official_description: string;
  match_type: "exact" | "normalized" | "header" | "none";
  status: ValidationStatus;
  validation_note: string;
  classification: string;
  classification_version: string;
}

export interface ValidationSummary {
  total_rows: number;
  valid_exact: number;
  valid_normalized: number;
  invalid: number;
  missing: number;
  ambiguous: number;
  /** Percentage of rows that are valid (exact + normalized), 0-100. */
  valid_percentage: number;
  classification: string;
  classification_version: string;
}
