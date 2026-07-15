import { describe, expect, it } from "vitest";
import { summarizeValidation, validateCode, validateCodes } from "@/lib/icd/validate";

describe("validateCode", () => {
  it("marks canonical codes as valid exact matches", () => {
    const r = validateCode("I50.9");
    expect(r.status).toBe("valid_exact");
    expect(r.is_valid).toBe(true);
    expect(r.matched_code).toBe("I50.9");
    expect(r.official_description).toBe("Heart failure, unspecified");
    expect(r.match_type).toBe("exact");
    expect(r.classification).toBe("ICD-10-CM");
    expect(r.classification_version).toBe("FY2026");
  });

  it("marks lowercase input as valid after normalization", () => {
    const r = validateCode("i50.9");
    expect(r.status).toBe("valid_normalized");
    expect(r.is_valid).toBe(true);
    expect(r.match_type).toBe("normalized");
  });

  it("marks whitespace-padded input as valid after normalization", () => {
    const r = validateCode("  I50.9 ");
    expect(r.status).toBe("valid_normalized");
    expect(r.validation_note).toContain("whitespace");
  });

  it("marks dotless input as valid after normalization", () => {
    const r = validateCode("E119");
    expect(r.status).toBe("valid_normalized");
    expect(r.matched_code).toBe("E11.9");
  });

  it("marks unknown codes as invalid without correcting them", () => {
    const r = validateCode("I99.99");
    expect(r.status).toBe("invalid");
    expect(r.is_valid).toBe(false);
    expect(r.matched_code).toBe("");
  });

  it("marks structurally invalid input as invalid", () => {
    const r = validateCode("XYZ123!");
    expect(r.status).toBe("invalid");
    expect(r.validation_note).toContain("Not corrected automatically");
  });

  it("marks empty values as missing", () => {
    expect(validateCode("").status).toBe("missing");
    expect(validateCode("   ").status).toBe("missing");
    expect(validateCode(null).status).toBe("missing");
  });

  it("marks multi-code fields as ambiguous and does not resolve them", () => {
    const r = validateCode("I50.9; E11.9");
    expect(r.status).toBe("ambiguous");
    expect(r.is_valid).toBe(false);
    expect(r.matched_code).toBe("");
    expect(r.validation_note).toContain("I50.9");
  });

  it("marks non-reportable headers as invalid but identifies them", () => {
    const r = validateCode("I50");
    expect(r.status).toBe("invalid");
    expect(r.is_valid).toBe(false);
    expect(r.match_type).toBe("header");
    expect(r.matched_code).toBe("I50");
    expect(r.validation_note).toContain("not valid for submission");
  });
});

describe("summarizeValidation", () => {
  it("aggregates statuses and percentage", () => {
    const results = validateCodes(["I50.9", "i509", "BOGUS99", "", "I50.9 E11.9"]);
    const summary = summarizeValidation(results);
    expect(summary).toMatchObject({
      total_rows: 5,
      valid_exact: 1,
      valid_normalized: 1,
      invalid: 1,
      missing: 1,
      ambiguous: 1,
      valid_percentage: 40,
      classification: "ICD-10-CM",
      classification_version: "FY2026",
    });
  });

  it("handles empty input", () => {
    expect(summarizeValidation([]).valid_percentage).toBe(0);
  });
});
