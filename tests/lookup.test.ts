import { describe, expect, it } from "vitest";
import { lookupCode } from "@/lib/icd/lookup";

describe("lookupCode", () => {
  it("finds a canonical code exactly", () => {
    const r = lookupCode("I50.9");
    expect(r.status).toBe("found");
    expect(r.matchType).toBe("exact");
    expect(r.entry?.code).toBe("I50.9");
    expect(r.entry?.description).toBe("Heart failure, unspecified");
    expect(r.entry?.validForSubmission).toBe(true);
    expect(r.entry?.kind).toBe("code");
  });

  it("reports classification metadata", () => {
    const r = lookupCode("I50.9");
    expect(r.classification.system).toBe("ICD-10-CM");
    expect(r.classification.version).toBe("FY2026");
    expect(r.classification.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("finds lowercase input via normalization", () => {
    const r = lookupCode("i50.9");
    expect(r.status).toBe("found");
    expect(r.matchType).toBe("normalized");
    expect(r.changes).toContain("uppercased");
  });

  it("finds dotless input via normalization", () => {
    const r = lookupCode("I509");
    expect(r.status).toBe("found");
    expect(r.matchType).toBe("normalized");
    expect(r.entry?.code).toBe("I50.9");
  });

  it("identifies category headers", () => {
    const r = lookupCode("I50");
    expect(r.status).toBe("found");
    expect(r.entry?.kind).toBe("category-header");
    expect(r.entry?.validForSubmission).toBe(false);
  });

  it("identifies 3-character codes that are themselves valid", () => {
    const r = lookupCode("I10");
    expect(r.status).toBe("found");
    expect(r.entry?.kind).toBe("code");
    expect(r.entry?.validForSubmission).toBe(true);
  });

  it("returns a verified hierarchy including chapter and block", () => {
    const r = lookupCode("I50.9");
    const levels = r.hierarchy!.map((h) => h.level);
    expect(levels[0]).toBe("chapter");
    expect(levels[1]).toBe("block");
    expect(levels).toContain("category");
    expect(r.hierarchy![0].description).toBe("Diseases of the circulatory system");
  });

  it("places letter-third-character codes in the correct block (C4A)", () => {
    const r = lookupCode("C4A.0");
    expect(r.status).toBe("found");
    const block = r.hierarchy!.find((h) => h.level === "block");
    expect(block?.code).toBe("C43–C44");
  });

  it("handles letter-second-character codes introduced in FY2026 (QA0…)", () => {
    const r = lookupCode("qa00101");
    expect(r.status).toBe("found");
    expect(r.entry?.code).toBe("QA0.0101");
    const chapter = r.hierarchy!.find((h) => h.level === "chapter");
    expect(chapter?.code).toContain("Chapter 17");
  });

  it("reports codes that do not exist", () => {
    const r = lookupCode("I99.99");
    expect(r.status).toBe("not_found");
  });

  it("reports empty input", () => {
    expect(lookupCode("").status).toBe("empty");
  });

  it("reports ambiguous multi-code input without guessing", () => {
    const r = lookupCode("I50.9, E11.9");
    expect(r.status).toBe("ambiguous");
    expect(r.candidates).toEqual(["I50.9", "E11.9"]);
    expect(r.entry).toBeUndefined();
  });

  it("reports malformed input", () => {
    expect(lookupCode("not a code !!").status).toBe("malformed");
  });
});
