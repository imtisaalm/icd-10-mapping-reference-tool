/**
 * Loads the official ICD-10-CM reference files from `data/` and builds the
 * in-memory dataset used by lookup, search, hierarchy and validation.
 *
 * The dataset is built once per server process and cached. No content is
 * generated or inferred: every code, description, flag, chapter and block
 * comes verbatim from the CDC/NCHS release files (see data/provenance.json).
 */
import fs from "node:fs";
import path from "node:path";
import type { ClassificationInfo, IcdChapter, IcdEntry } from "@/types/icd";

const FISCAL_YEAR = "2026";

export interface IcdDataset {
  classification: ClassificationInfo;
  entries: IcdEntry[];
  /** Keyed by code without decimal point, uppercase. */
  byCodeNoDot: Map<string, IcdEntry>;
  chapters: IcdChapter[];
  /**
   * Maps each 3-character category (e.g. "I50") to the index of its chapter
   * in `chapters` and the index of its block within that chapter's sections.
   * Membership is read directly from the official tabular XML, which nests
   * every category inside its section — so codes such as C4A (which the
   * source places in block C43-C44) land correctly without any range
   * arithmetic or guessing.
   */
  categoryPlacement: Map<string, { chapterIndex: number; blockIndex: number }>;
  counts: {
    totalEntries: number;
    validCodes: number;
    headers: number;
    chapters: number;
    blocks: number;
  };
}

/** Inserts the decimal point used in canonical display form. */
export function toDisplayCode(codeNoDot: string): string {
  return codeNoDot.length > 3 ? `${codeNoDot.slice(0, 3)}.${codeNoDot.slice(3)}` : codeNoDot;
}

function parseOrderFile(filePath: string): IcdEntry[] {
  // Fixed-width layout documented in the CDC's icd10OrderFiles.pdf:
  // cols 1-5 order number, 7-13 code, 15 valid-for-submission flag,
  // 17-76 short description, 78+ long description.
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const entries: IcdEntry[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const codeNoDot = line.slice(6, 13).trim().toUpperCase();
    const flag = line.slice(14, 15);
    const shortDescription = line.slice(16, 77).trim();
    const description = line.slice(77).trim();
    if (!codeNoDot) continue;
    entries.push({
      code: toDisplayCode(codeNoDot),
      codeNoDot,
      description,
      shortDescription,
      validForSubmission: flag === "1",
      orderIndex: entries.length,
    });
  }
  return entries;
}

/**
 * Builds the category → chapter/block map from the membership lists the
 * fetch script extracted from the official tabular XML. Nothing is derived;
 * a category that the source does not place in a block is simply left
 * unplaced and its hierarchy omits those levels.
 */
function placeCategories(
  chapters: IcdChapter[]
): Map<string, { chapterIndex: number; blockIndex: number }> {
  const placement = new Map<string, { chapterIndex: number; blockIndex: number }>();
  chapters.forEach((chapter, chapterIndex) => {
    chapter.sections.forEach((section, blockIndex) => {
      for (const category of section.categories) {
        if (!placement.has(category)) {
          placement.set(category, { chapterIndex, blockIndex });
        }
      }
    });
  });
  return placement;
}

function buildDataset(): IcdDataset {
  const dataDir = path.join(process.cwd(), "data");
  const provenance = JSON.parse(
    fs.readFileSync(path.join(dataDir, "provenance.json"), "utf8")
  ) as {
    classification: string;
    release: string;
    source: string;
    sourceUrls: string[];
    license: string;
    retrievedAt: string;
  };

  const entries = parseOrderFile(path.join(dataDir, `icd10cm-order-${FISCAL_YEAR}.txt`));
  const chaptersFile = JSON.parse(
    fs.readFileSync(path.join(dataDir, `icd10cm-chapters-${FISCAL_YEAR}.json`), "utf8")
  ) as { chapters: IcdChapter[] };

  const byCodeNoDot = new Map<string, IcdEntry>();
  let validCodes = 0;
  for (const entry of entries) {
    byCodeNoDot.set(entry.codeNoDot, entry);
    if (entry.validForSubmission) validCodes++;
  }

  const categoryPlacement = placeCategories(chaptersFile.chapters);

  return {
    classification: {
      system: provenance.classification,
      version: `FY${FISCAL_YEAR}`,
      release: provenance.release,
      source: provenance.source,
      sourceUrls: provenance.sourceUrls,
      retrievedAt: provenance.retrievedAt,
      license: provenance.license,
    },
    entries,
    byCodeNoDot,
    chapters: chaptersFile.chapters,
    categoryPlacement,
    counts: {
      totalEntries: entries.length,
      validCodes,
      headers: entries.length - validCodes,
      chapters: chaptersFile.chapters.length,
      blocks: chaptersFile.chapters.reduce((n, c) => n + c.sections.length, 0),
    },
  };
}

let cached: IcdDataset | null = null;

export function getDataset(): IcdDataset {
  if (!cached) cached = buildDataset();
  return cached;
}
