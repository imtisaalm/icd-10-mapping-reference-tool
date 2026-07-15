/**
 * Verified hierarchy for a code, built only from levels present in the
 * official source data:
 *
 *   Chapter  — from the tabular list chapter ranges
 *   Block    — from the tabular list section ranges
 *   Category / subcategory headers — entries present in the order file
 *   Code     — the entry itself
 *
 * If a level is not present in the source data it is simply omitted;
 * nothing is synthesised.
 */
import type { HierarchyLevel, IcdEntry } from "@/types/icd";
import { getDataset, toDisplayCode } from "./loader";

export function entryKind(entry: IcdEntry): "code" | "category-header" | "subcategory-header" {
  if (entry.validForSubmission) return "code";
  return entry.codeNoDot.length === 3 ? "category-header" : "subcategory-header";
}

export function getHierarchy(entry: IcdEntry): HierarchyLevel[] {
  const dataset = getDataset();
  const levels: HierarchyLevel[] = [];
  const category = entry.codeNoDot.slice(0, 3);

  const placement = dataset.categoryPlacement.get(category);
  if (placement) {
    const chapter = dataset.chapters[placement.chapterIndex];
    const block = chapter.sections[placement.blockIndex];
    levels.push({
      level: "chapter",
      code: `Chapter ${chapter.number} (${chapter.first}–${chapter.last})`,
      description: chapter.description,
    });
    levels.push({
      level: "block",
      code: `${block.first}–${block.last}`,
      description: block.description,
    });
  }

  // Ancestor headers actually present in the order file, from the
  // 3-character category down to the immediate parent.
  for (let len = 3; len < entry.codeNoDot.length; len++) {
    const ancestor = dataset.byCodeNoDot.get(entry.codeNoDot.slice(0, len));
    if (ancestor) {
      levels.push({
        level: len === 3 ? "category" : "subcategory",
        code: toDisplayCode(ancestor.codeNoDot),
        description: ancestor.description,
        validForSubmission: ancestor.validForSubmission,
      });
    }
  }

  levels.push({
    level:
      entry.codeNoDot.length === 3
        ? "category"
        : entry.validForSubmission
          ? "code"
          : "subcategory",
    code: entry.code,
    description: entry.description,
    validForSubmission: entry.validForSubmission,
  });

  return levels;
}
