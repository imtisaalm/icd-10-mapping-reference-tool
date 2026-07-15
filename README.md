# ICD-10 Mapping Reference Tool

A reproducible utility for searching and validating standardized diagnosis codes in
healthcare datasets. Version 1 supports **ICD-10-CM FY2026**, using only the official
CDC/NCHS release files.

Diagnosis-code columns in real-world healthcare datasets accumulate formatting drift:
mixed case (`i50.9`), missing decimal points (`E119`), stray whitespace, several codes
crammed into one field (`I50.9; E11.9`), category headers used where a specific code is
required (`I50`), and codes that simply do not exist in the release being used. Before
such data can be linked, aggregated, or analyzed, someone has to answer: *which of these
values are actually valid codes, and what do they mean?*

This tool answers that question conservatively and reproducibly: safe formatting
differences are normalized (and every change is reported), while invalid, missing, and
ambiguous values are flagged — never silently corrected.

## Features

- **Code lookup** — exact lookup with safe normalization, official description,
  valid-for-submission status, and the verified chapter → block → category →
  subcategory hierarchy.
- **Description search** — ranked search over official descriptions (exact phrase,
  phrase, all-terms, word-prefix), with optional fuzzy matching for minor spelling
  errors; fuzzy results are explicitly labelled *approximate*.
- **Batch CSV validation** — upload a CSV, pick the code column, get a row-by-row
  report with `original_code`, `normalized_code`, `is_valid`, `matched_code`,
  `official_description`, `match_type`, `status`, `validation_note`, `classification`,
  and `classification_version`.
- **Downloadable results** — the fully annotated CSV, an invalid-rows-only CSV, and a
  summary report (CSV or JSON) with counts and the validation percentage.
- **Reference information** — every page footer and every export names the
  classification, release, source, and retrieval date.

## Technical architecture

- **Next.js (App Router) + TypeScript**, styled with Tailwind CSS.
- **Data layer** (`src/lib/icd/`): a small server-side library that loads the official
  release files from `data/` into memory once per server process:
  - `loader.ts` — parses the CDC order file and chapter/block definitions
  - `normalize.ts` — safe, deterministic input normalization
  - `lookup.ts` — exact-code lookup
  - `search.ts` — description search with an inverted index
  - `hierarchy.ts` — verified hierarchy assembly
  - `validate.ts` — row-level validation and summaries
- **API routes** (`src/app/api/`): `lookup`, `search`, `validate`, `meta` — all
  server-side; the browser never loads the full dataset.
- **Batch validation** parses CSV files in the browser (PapaParse); only the selected
  code column is sent to the server, in chunks, and processed in memory.

The data model is classification-agnostic (`system` + `version` accompany every
result), so a second classification such as ICD-10-CA could be added as another
dataset implementation without rewriting the application.

## Data source and release

| | |
|---|---|
| Classification | ICD-10-CM |
| Release | FY2026 (effective October 1, 2025 – September 30, 2026) |
| Publisher | CDC / National Center for Health Statistics (NCHS) |
| Files | `icd10cm-Code Descriptions-2026.zip` (order file), `icd10cm-table and index-2026.zip` (tabular XML) |
| Retrieved | 2026-07-14 |
| License | US federal government work (public domain) |

Source: <https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2026/>
(see also <https://www.cdc.gov/nchs/icd/icd-10-cm/index.html>).

The exact provenance is recorded in [`data/provenance.json`](data/provenance.json).
Running `npm run fetch-data` re-downloads the same release from the CDC server and
rebuilds `data/` deterministically, so the dataset can be verified by anyone.

Safe normalizations (always reported, never silent):

1. surrounding whitespace removed
2. lowercase converted to uppercase
3. missing decimal point inserted (its position after the third character is fixed in
   ICD-10-CM, so this is deterministic)
4. a trailing decimal point removed (`E11.` → `E11`)

Everything else is reported as-is:

| Status | Meaning |
|---|---|
| `valid_exact` | input already equals a valid code's canonical form |
| `valid_normalized` | valid after the safe normalizations above |
| `invalid` | not in the release, structurally malformed, or a non-reportable header |
| `missing` | empty field |
| `ambiguous` | more than one code-like value in the field — not resolved automatically |

Codes matching a category/subcategory header (e.g. `I50`) are reported as invalid for
submission but identified (`match_type: header`) with the header's official description.

## Assumptions

- The CDC order file's valid-for-submission flag (column 15) is the authority on
  whether an entry is a reportable code; the flagged subset matches the official
  codes file exactly (74,719 codes in FY2026).
- The decimal point in an ICD-10-CM code always follows the third character, making
  dotless input unambiguous to restore.
- A field containing several code-like tokens is a data-quality problem to report
- Chapter and block membership are taken from the nesting in the official tabular
  XML, not computed from code ranges (this matters for codes such as `C4A`, which
  official ordering places between `C43` and `C44`).

## Limitations

- Validates against **one release** (FY2026). Codes valid in earlier or later fiscal
  years, or in other classifications (ICD-10-CA, WHO ICD-10), may be reported invalid.
- No coding guidance: no Excludes1/Excludes2 notes, no "code first" rules, no laterality
  or seventh-character advice beyond what descriptions state.
- No classification-to-classification mapping (e.g. ICD-10-CM ↔ ICD-10-CA).
- Description search matches the official descriptions only — it has no synonym list,
  so clinical shorthand (e.g. "MI") only matches if the official text contains it.
- Batch validation is capped at 50,000 rows per file in the browser.

## Privacy considerations

- Uploaded CSV files are parsed **in the browser** and are never uploaded as files.
- Only the values of the selected code column are sent to the server for validation,
  processed in memory, and never stored or logged.
- No analytics, no cookies, no accounts.
- The tool is intended for de-identified research datasets. Do not include direct
  patient identifiers in the code column you validate.

## Local setup

Requires Node.js 18+ (developed on Node 22).

```bash
git clone https://github.com/<your-username>/icd-10-mapping-reference-tool.git
cd icd-10-mapping-reference-tool
npm install
npm run dev
```

The official reference files are committed in `data/`, so no setup script is needed
for a normal run. To re-download and rebuild them from the CDC server (requires the
`unzip` command):

```bash
npm run fetch-data
```

## Testing

```bash
npm run lint   # ESLint
npm run test   # Vitest — tests over normalization, lookup, search,
               # hierarchy, validation, and CSV export, run against the full dataset
npm run build  # production build
```

## Deployment (Vercel)

The repository deploys to Vercel with zero configuration:

- **Framework preset:** Next.js (auto-detected)
- **Root directory:** repository root (`package.json` lives there)
- **Build command:** `next build` (default)
- **Environment variables:** none
- The `data/` files are traced into the serverless bundle via
  `outputFileTracingIncludes` in `next.config.ts`.

Import the GitHub repository at <https://vercel.com/new>; pushes to the production
branch redeploy automatically.

## Example input and output

Input (`examples/sample-diagnosis-codes.csv`, synthetic — no real patient data):

```csv
record_id,encounter_date,diagnosis_code,notes
R0001,2026-01-05,I50.9,canonical code
R0002,2026-01-06,i10,lowercase entry
R0003,2026-01-07,E119,missing decimal point
R0010,2026-01-14,I50.9; E11.9,two codes in one field
```

Validated output (validation columns appended; abbreviated):

```csv
...,normalized_code,is_valid,matched_code,official_description,match_type,status,validation_note,classification,classification_version
...,I50.9,true,I50.9,"Heart failure, unspecified",exact,valid_exact,Exact match.,ICD-10-CM,FY2026
...,I10,true,I10,Essential (primary) hypertension,normalized,valid_normalized,Valid after safe normalization: converted to upper case.,ICD-10-CM,FY2026
...,E11.9,true,E11.9,Type 2 diabetes mellitus without complications,normalized,valid_normalized,Valid after safe normalization: inserted the standard decimal point.,ICD-10-CM,FY2026
...,,false,,,none,ambiguous,"Field contains more than one code-like value (I50.9, E11.9). Not resolved automatically; split into one code per row.",ICD-10-CM,FY2026
```

Summary report (JSON):

```json
{
  "total_rows": 15,
  "valid_exact": 4,
  "valid_normalized": 4,
  "invalid": 5,
  "missing": 1,
  "ambiguous": 1,
  "valid_percentage": 53.33,
  "classification": "ICD-10-CM",
  "classification_version": "FY2026"
}
```
