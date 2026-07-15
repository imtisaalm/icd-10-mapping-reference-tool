import { describe, expect, it } from "vitest";
import { normalizeCodeInput } from "@/lib/icd/normalize";

describe("normalizeCodeInput", () => {
  it("accepts a canonical code unchanged", () => {
    const r = normalizeCodeInput("I50.9");
    expect(r).toEqual({ status: "ok", codeNoDot: "I509", display: "I50.9", changes: [] });
  });

  it("accepts a 3-character category code unchanged", () => {
    const r = normalizeCodeInput("I50");
    expect(r).toEqual({ status: "ok", codeNoDot: "I50", display: "I50", changes: [] });
  });

  it("uppercases lowercase input", () => {
    const r = normalizeCodeInput("i50.9");
    expect(r).toMatchObject({ status: "ok", codeNoDot: "I509", changes: ["uppercased"] });
  });

  it("trims surrounding whitespace", () => {
    const r = normalizeCodeInput("  I50.9\t");
    expect(r).toMatchObject({ status: "ok", codeNoDot: "I509", changes: ["trimmed_whitespace"] });
  });

  it("adds the decimal point to dotless input", () => {
    const r = normalizeCodeInput("I509");
    expect(r).toMatchObject({
      status: "ok",
      display: "I50.9",
      changes: ["added_decimal_point"],
    });
  });

  it("handles long codes without a dot", () => {
    const r = normalizeCodeInput("s72001a");
    expect(r).toMatchObject({ status: "ok", display: "S72.001A" });
  });

  it("removes a trailing decimal point", () => {
    const r = normalizeCodeInput("E11.");
    expect(r).toMatchObject({
      status: "ok",
      codeNoDot: "E11",
      changes: ["removed_trailing_decimal_point"],
    });
  });

  it("treats empty and whitespace-only input as missing", () => {
    expect(normalizeCodeInput("")).toEqual({ status: "empty" });
    expect(normalizeCodeInput("   ")).toEqual({ status: "empty" });
    expect(normalizeCodeInput(null)).toEqual({ status: "empty" });
    expect(normalizeCodeInput(undefined)).toEqual({ status: "empty" });
  });

  it("flags multiple code-like values as ambiguous, preserving candidates", () => {
    const r = normalizeCodeInput("I50.9; E11.9");
    expect(r).toMatchObject({ status: "ambiguous", candidates: ["I50.9", "E11.9"] });
  });

  it("flags space-separated codes as ambiguous", () => {
    expect(normalizeCodeInput("I509 E119")).toMatchObject({ status: "ambiguous" });
  });

  it("rejects a decimal point in a non-standard position rather than guessing", () => {
    expect(normalizeCodeInput("I5.09")).toMatchObject({ status: "malformed" });
  });

  it("rejects multiple decimal points", () => {
    expect(normalizeCodeInput("I5.0.9")).toMatchObject({ status: "malformed" });
  });

  it("rejects input that does not match the code structure", () => {
    expect(normalizeCodeInput("HELLO")).toMatchObject({ status: "malformed" });
    expect(normalizeCodeInput("123")).toMatchObject({ status: "malformed" });
    expect(normalizeCodeInput("I509999999")).toMatchObject({ status: "malformed" });
  });
});
