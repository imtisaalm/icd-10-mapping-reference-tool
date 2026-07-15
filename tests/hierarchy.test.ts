import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/icd/loader";
import { getHierarchy } from "@/lib/icd/hierarchy";

describe("dataset integrity", () => {
  it("loads the expected FY2026 release counts", () => {
    const d = getDataset();
    expect(d.counts.totalEntries).toBe(98186);
    expect(d.counts.validCodes).toBe(74719);
    expect(d.counts.chapters).toBe(22);
    expect(d.counts.blocks).toBeGreaterThan(280);
  });

  it("assigns every category to a chapter and block", () => {
    const d = getDataset();
    const categories = new Set(d.entries.map((e) => e.codeNoDot.slice(0, 3)));
    for (const category of categories) {
      expect(d.categoryPlacement.has(category)).toBe(true);
    }
  });

  it("keeps chapter assignment consistent with chapter ranges for plain categories", () => {
    const d = getDataset();
    // Spot-check well-known chapter boundaries.
    expect(d.chapters[d.categoryPlacement.get("A00")!.chapterIndex].number).toBe("1");
    expect(d.chapters[d.categoryPlacement.get("I50")!.chapterIndex].number).toBe("9");
    expect(d.chapters[d.categoryPlacement.get("Z99")!.chapterIndex].number).toBe("21");
    expect(d.chapters[d.categoryPlacement.get("U07")!.chapterIndex].number).toBe("22");
  });
});

describe("getHierarchy", () => {
  it("builds chapter → block → category → subcategory → code for deep codes", () => {
    const d = getDataset();
    const entry = d.byCodeNoDot.get("E1165")!; // E11.65
    const levels = getHierarchy(entry);
    expect(levels.map((l) => l.level)).toEqual([
      "chapter",
      "block",
      "category",
      "subcategory",
      "code",
    ]);
    expect(levels[2].code).toBe("E11");
    expect(levels[3].code).toBe("E11.6");
    expect(levels[4].code).toBe("E11.65");
  });

  it("shows a category header as its own terminal level", () => {
    const d = getDataset();
    const entry = d.byCodeNoDot.get("I50")!;
    const levels = getHierarchy(entry);
    expect(levels[levels.length - 1]).toMatchObject({ level: "category", code: "I50" });
  });
});
