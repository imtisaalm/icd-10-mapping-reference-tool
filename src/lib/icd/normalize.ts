/**
 * Safe normalization of user-supplied ICD-10-CM code input.
 *
 * Only reversible, unambiguous formatting differences are corrected:
 *   - surrounding whitespace
 *   - lower/upper case
 *   - a missing decimal point (its position is fixed after the third
 *     character in ICD-10-CM, so re-inserting it is deterministic)
 *   - a trailing decimal point with nothing after it (e.g. "E11.")
 *
 * Anything that would require a guess is reported instead of corrected:
 *   - several code-like values in one field → ambiguous
 *   - a decimal point in an unexpected position, multiple decimal points,
 *     or characters outside the ICD-10-CM code structure → malformed
 */
import type { NormalizationChange, NormalizeResult } from "@/types/icd";

/**
 * Structural shape of an ICD-10-CM code (without decimal point): a letter
 * followed by 2–6 alphanumeric characters, at least one of them a digit.
 * (The second character is usually a digit, but FY2026 introduced
 * letter-second-character codes such as QA0.)
 */
const CODE_SHAPE = /^[A-Z](?=[0-9A-Z]*[0-9])[0-9A-Z]{2,6}$/;

/** Loose shape used to recognise code-like tokens when detecting multiple values. */
const CODE_LIKE = /^[A-Za-z](?=[0-9A-Za-z.]*[0-9])[0-9A-Za-z]{1,6}(\.[0-9A-Za-z]{0,4})?\.?$/;

export function normalizeCodeInput(raw: string | null | undefined): NormalizeResult {
  if (raw === null || raw === undefined) return { status: "empty" };

  const changes: NormalizationChange[] = [];
  const trimmed = raw.trim();
  if (trimmed === "") return { status: "empty" };
  if (trimmed !== raw) changes.push("trimmed_whitespace");

  // Multiple values in one field (e.g. "I50.9; E11.9") cannot be resolved
  // to a single code without guessing.
  const tokens = trimmed.split(/[,;|/\s]+/).filter(Boolean);
  if (tokens.length > 1) {
    const codeLike = tokens.filter((t) => CODE_LIKE.test(t));
    if (codeLike.length >= 2) {
      return {
        status: "ambiguous",
        reason: "Field contains more than one code-like value",
        candidates: codeLike.map((t) => t.toUpperCase().replace(/\.$/, "")),
      };
    }
    return {
      status: "malformed",
      reason: "Field contains multiple values that are not all recognisable as codes",
      cleaned: trimmed,
    };
  }

  let value = trimmed;
  if (value !== value.toUpperCase()) {
    value = value.toUpperCase();
    changes.push("uppercased");
  }

  const dotCount = (value.match(/\./g) ?? []).length;
  if (dotCount > 1) {
    return {
      status: "malformed",
      reason: "Contains more than one decimal point",
      cleaned: value,
    };
  }
  if (dotCount === 1) {
    const dotIndex = value.indexOf(".");
    if (dotIndex === value.length - 1) {
      // "E11." → "E11": trailing separator with nothing after it.
      value = value.slice(0, -1);
      changes.push("removed_trailing_decimal_point");
    } else if (dotIndex === 3) {
      value = value.replace(".", "");
    } else {
      // e.g. "I5.09" — repositioning the decimal would be a guess.
      return {
        status: "malformed",
        reason: "Decimal point is not in the standard ICD-10-CM position (after the third character)",
        cleaned: value,
      };
    }
  } else if (value.length > 3) {
    // Dotless input such as "I509": the decimal position is deterministic.
    changes.push("added_decimal_point");
  }

  if (!CODE_SHAPE.test(value)) {
    return {
      status: "malformed",
      reason:
        "Does not match the ICD-10-CM code structure (a letter followed by 2–6 alphanumeric characters, including at least one digit)",
      cleaned: value,
    };
  }

  return {
    status: "ok",
    codeNoDot: value,
    display: value.length > 3 ? `${value.slice(0, 3)}.${value.slice(3)}` : value,
    changes,
  };
}
