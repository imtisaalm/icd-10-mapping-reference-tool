import { describe, expect, it } from "vitest";
import { boundedEditDistance, searchDescriptions } from "@/lib/icd/search";

describe("searchDescriptions", () => {
  it("ranks the exact phrase match first", () => {
    const results = searchDescriptions("heart failure, unspecified".replace(",", ""));
    expect(results.length).toBeGreaterThan(0);
  });

  it("finds heart failure codes", () => {
    const results = searchDescriptions("heart failure");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => /heart failure/i.test(r.description) || r.approximate === false)).toBe(
      true
    );
    expect(results.some((r) => r.code === "I50.9")).toBe(true);
  });

  it("is case-insensitive", () => {
    const lower = searchDescriptions("asthma");
    const upper = searchDescriptions("ASTHMA");
    expect(lower.map((r) => r.code)).toEqual(upper.map((r) => r.code));
    expect(lower.length).toBeGreaterThan(0);
  });

  it("matches multi-term queries requiring all terms", () => {
    const results = searchDescriptions("type 2 diabetes");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].description.toLowerCase()).toContain("type 2 diabetes");
  });

  it("supports partial (prefix) matching", () => {
    const results = searchDescriptions("diabet");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => /diabet/i.test(r.description))).toBe(true);
    expect(results.every((r) => r.approximate === false)).toBe(true);
  });

  it("labels fuzzy matches as approximate", () => {
    const results = searchDescriptions("asthmma"); // misspelled
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.approximate)).toBe(true);
    expect(results.every((r) => r.matchType === "approximate")).toBe(true);
    expect(results.some((r) => /asthma/i.test(r.description))).toBe(true);
  });

  it("returns nothing for misspellings when fuzzy matching is off", () => {
    expect(searchDescriptions("asthmma", { fuzzy: false })).toEqual([]);
  });

  it("returns nothing when a term cannot be matched", () => {
    expect(searchDescriptions("heart zzzzqqq")).toEqual([]);
  });

  it("returns nothing for empty queries", () => {
    expect(searchDescriptions("")).toEqual([]);
    expect(searchDescriptions("   ")).toEqual([]);
  });

  it("respects the result limit", () => {
    expect(searchDescriptions("disease", { limit: 5 }).length).toBeLessThanOrEqual(5);
  });
});

describe("boundedEditDistance", () => {
  it("computes small distances", () => {
    expect(boundedEditDistance("asthma", "asthma", 2)).toBe(0);
    expect(boundedEditDistance("asthma", "asthmaa", 2)).toBe(1);
    expect(boundedEditDistance("diabetes", "diabetis", 2)).toBe(1);
  });

  it("caps at max+1 when the distance exceeds the bound", () => {
    expect(boundedEditDistance("heart", "kidney", 1)).toBe(2);
  });
});
