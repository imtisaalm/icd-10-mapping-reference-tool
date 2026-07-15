import { describe, expect, it } from "vitest";
import { csvEscape, objectsToCsv, rowsToCsv } from "@/lib/csv";

describe("csvEscape", () => {
  it("passes plain values through", () => {
    expect(csvEscape("I50.9")).toBe("I50.9");
    expect(csvEscape(42)).toBe("42");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    expect(csvEscape("Heart failure, unspecified")).toBe('"Heart failure, unspecified"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("a\nb")).toBe('"a\nb"');
  });

  it("renders null and undefined as empty", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
});

describe("rowsToCsv", () => {
  it("produces a header row and CRLF line endings", () => {
    const csv = rowsToCsv(["code", "desc"], [["I50.9", "Heart failure, unspecified"]]);
    expect(csv).toBe('code,desc\r\nI50.9,"Heart failure, unspecified"\r\n');
  });
});

describe("objectsToCsv", () => {
  it("emits columns in the given key order", () => {
    const csv = objectsToCsv(["b", "a"], [{ a: 1, b: 2 }]);
    expect(csv.startsWith("b,a\r\n2,1")).toBe(true);
  });
});
