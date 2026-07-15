/**
 * fetch-data.mjs
 *
 * Downloads the official CDC/NCHS ICD-10-CM release files and prepares the
 * reference data used by this application:
 *
 *   data/icd10cm-order-2026.txt        — official "order" file (all codes +
 *                                        headers, descriptions, valid-for-
 *                                        submission flag), committed verbatim
 *   data/icd10cm-chapters-2026.json    — chapter and block (section) ranges
 *                                        extracted from the official tabular XML
 *   data/provenance.json               — source URLs, release, retrieval date
 *
 * Source (public domain, US federal government work):
 *   https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2026/
 *
 * Requires: Node 18+ (built-in fetch) and the `unzip` command (preinstalled
 * on macOS and most Linux distributions).
 *
 * Usage: node scripts/fetch-data.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FISCAL_YEAR = "2026";
const BASE_URL = `https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/${FISCAL_YEAR}/`;
const CODES_ZIP = `icd10cm-Code%20Descriptions-${FISCAL_YEAR}.zip`;
const TABULAR_ZIP = `icd10cm-table%20and%20index-${FISCAL_YEAR}.zip`;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(projectRoot, "data");
mkdirSync(dataDir, { recursive: true });

async function download(url, dest) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/**
 * Extracts chapter and block (section) definitions from the official
 * ICD-10-CM tabular XML. Only data present in the source file is emitted;
 * nothing is inferred or invented.
 */
function extractChapters(xml) {
  const chapters = [];
  const chapterRe = /<chapter>([\s\S]*?)<\/chapter>/g;
  let m;
  while ((m = chapterRe.exec(xml)) !== null) {
    const block = m[1];
    const number = block.match(/<name>([^<]+)<\/name>/)?.[1]?.trim();
    const desc = block.match(/<desc>([^<]+)<\/desc>/)?.[1]?.trim();
    if (!number || !desc) throw new Error("Unexpected chapter structure in tabular XML");
    // Chapter <desc> ends with its code range, e.g. "… (A00-B99)".
    const rangeMatch = desc.match(/\(([A-Z][0-9A-Z]{2})-([A-Z][0-9A-Z]{2})\)\s*$/);
    if (!rangeMatch) throw new Error(`No code range found in chapter desc: ${desc}`);

    // Section descriptions come from the chapter's <sectionIndex>.
    const sectionDescs = new Map();
    const sectionRefRe = /<sectionRef first="([^"]+)" last="([^"]+)" id="([^"]*)">\s*([\s\S]*?)\s*<\/sectionRef>/g;
    let s;
    while ((s = sectionRefRe.exec(block)) !== null) {
      sectionDescs.set(s[3], {
        first: s[1],
        last: s[2],
        description: s[4].replace(/\s+/g, " ").trim(),
      });
    }

    // The <section> elements nest every category (3-character <name>) they
    // contain, so category membership is read directly from the source with
    // no range arithmetic.
    const sections = [];
    const sectionRe = /<section id="([^"]+)">([\s\S]*?)<\/section>/g;
    while ((s = sectionRe.exec(block)) !== null) {
      const id = s[1];
      const body = s[2];
      const ref = sectionDescs.get(id);
      // Categories are the 3-character <name> elements (e.g. "C43", and
      // since FY2026 also letter-second-character categories like "QA0").
      const categories = [...body.matchAll(/<name>([A-Z][0-9A-Z][0-9A-Z])<\/name>/g)].map(
        (c) => c[1]
      );
      if (!ref) {
        // A few purely descriptive grouping sections (e.g. "C00-C96
        // Malignant neoplasms") contain no codes and are not part of the
        // chapter's block index; skip them.
        if (categories.length === 0) continue;
        throw new Error(`Section ${id} missing from sectionIndex in chapter ${number}`);
      }
      sections.push({ ...ref, categories: [...new Set(categories)] });
    }
    if (sections.length === 0) throw new Error(`No sections found for chapter ${number}`);
    chapters.push({
      number,
      description: desc.replace(/\s*\([A-Z0-9]+-[A-Z0-9]+\)\s*$/, ""),
      first: rangeMatch[1],
      last: rangeMatch[2],
      sections,
    });
  }
  return chapters;
}

const tmp = mkdtempSync(path.join(tmpdir(), "icd10cm-"));
try {
  await download(BASE_URL + CODES_ZIP, path.join(tmp, "codes.zip"));
  await download(BASE_URL + TABULAR_ZIP, path.join(tmp, "tabular.zip"));

  execFileSync("unzip", ["-o", "-q", path.join(tmp, "codes.zip"), `icd10cm-order-${FISCAL_YEAR}.txt`, "-d", tmp]);
  execFileSync("unzip", ["-o", "-q", path.join(tmp, "tabular.zip"), `icd10cm-tabular-${FISCAL_YEAR}.xml`, "-d", tmp]);

  const orderFile = path.join(tmp, `icd10cm-order-${FISCAL_YEAR}.txt`);
  const orderLines = readFileSync(orderFile, "utf8").split(/\r?\n/).filter(Boolean);
  if (orderLines.length < 90000) {
    throw new Error(`Order file looks truncated (${orderLines.length} lines)`);
  }
  copyFileSync(orderFile, path.join(dataDir, `icd10cm-order-${FISCAL_YEAR}.txt`));
  console.log(`Order file: ${orderLines.length} entries`);

  const xml = readFileSync(path.join(tmp, `icd10cm-tabular-${FISCAL_YEAR}.xml`), "utf8");
  const chapters = extractChapters(xml);
  if (chapters.length !== 22) {
    throw new Error(`Expected 22 chapters, found ${chapters.length}`);
  }
  writeFileSync(
    path.join(dataDir, `icd10cm-chapters-${FISCAL_YEAR}.json`),
    JSON.stringify({ fiscalYear: FISCAL_YEAR, chapters }, null, 2)
  );
  console.log(`Chapters: ${chapters.length}, blocks: ${chapters.reduce((n, c) => n + c.sections.length, 0)}`);

  writeFileSync(
    path.join(dataDir, "provenance.json"),
    JSON.stringify(
      {
        classification: "ICD-10-CM",
        release: `FY${FISCAL_YEAR} (effective October 1, ${FISCAL_YEAR - 1} – September 30, ${FISCAL_YEAR})`,
        source: "CDC / National Center for Health Statistics (NCHS)",
        sourceUrls: [BASE_URL + CODES_ZIP, BASE_URL + TABULAR_ZIP],
        license:
          "US federal government work (public domain). See https://www.cdc.gov/nchs/icd/icd-10-cm/index.html",
        retrievedAt: new Date().toISOString().slice(0, 10),
        files: [`icd10cm-order-${FISCAL_YEAR}.txt`, `icd10cm-chapters-${FISCAL_YEAR}.json`],
      },
      null,
      2
    )
  );
  console.log("Wrote data/provenance.json");
  console.log("Done.");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
