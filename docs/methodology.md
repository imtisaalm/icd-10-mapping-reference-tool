# Methodology

This document mirrors the in-app Methodology page and records how the ICD-10 Mapping
Reference Tool normalizes input, matches codes, and stays reproducible.

## Reference data

Every code, description, valid-for-submission flag, chapter, and block comes verbatim
from the official ICD-10-CM FY2026 release published by the CDC / National Center for
Health Statistics (retrieved 2026-07-14; see `data/provenance.json`). The application
performs no clinical interpretation and generates no content of its own.

Two source files are used:

- **Order file** (`icd10cm-order-2026.txt`) — the complete list of categories,
  subcategory headers, and codes, in official order, with short and long descriptions
  and the valid-for-submission flag. 98,186 entries in FY2026, of which 74,719 are
  valid for submission (matching the official codes file exactly).
- **Tabular XML** (`icd10cm-tabular-2026.xml`) — the 22 chapters and 289 blocks
  (sections), including which categories each block contains. Membership is read from
  the XML's nesting, not computed from code ranges, so codes the source places
  "out of alphabetical order" (such as `C4A` between `C43` and `C44`) are handled
  exactly as published.

If the source does not provide a hierarchy level for a code, that level is omitted.
No hierarchy is constructed from assumptions.

## Safe normalization

Only formatting differences that can be corrected with zero ambiguity are applied,
and every applied change is reported with the result:

| Input | Normalized | Change reported |
|---|---|---|
| ` I50.9 ` | `I50.9` | removed surrounding whitespace |
| `i50.9` | `I50.9` | converted to upper case |
| `I509` | `I50.9` | inserted the standard decimal point |
| `E11.` | `E11` | removed a trailing decimal point |

The decimal insertion is deterministic because ICD-10-CM places the decimal point
after the third character, always.

Reported, never repaired:

- a decimal point in a non-standard position (`I5.09`)
- more than one decimal point (`I5.0.9`)
- several code-like values in one field (`I50.9; E11.9`) → **ambiguous**
- characters outside the code structure (`HELLO`, `123`) → **invalid**

The structural pre-check accepts a letter followed by 2–6 alphanumeric characters
including at least one digit; final validity is always dataset membership, not shape.

## Exact vs. normalized vs. approximate

- **Exact match** — the input already equals the canonical form of an entry.
- **Normalized match** — one or more safe corrections were needed first. Both exact
  and normalized matches resolve to a single verifiable entry.
- **Approximate (search only)** — description search falls back to fuzzy term
  matching (bounded edit distance 1, or 2 for terms of 7+ letters) only when a term
  has no exact or prefix match, and such results are explicitly labelled. Approximate
  matching is never used for code validation.

## Why invalid codes are never silently corrected

An automatic "fix" is a silent data change: it can move a diagnosis to a different
clinical concept and is invisible downstream. The tool therefore reports invalid,
missing, and ambiguous values with an explanatory note and leaves the decision to the
data owner. Category/subcategory headers (e.g. `I50`) are identified as headers not
valid for submission rather than "upgraded" to a specific code.

## Reproducibility

- Every result and export carries the classification (`ICD-10-CM`) and release
  (`FY2026`).
- `data/provenance.json` records the source URLs, license, and retrieval date.
- `npm run fetch-data` rebuilds `data/` from the official CDC server, so the entire
  dataset is verifiable and the release can be upgraded deliberately (see
  CONTRIBUTING.md).
- The dataset integrity tests assert the exact FY2026 entry counts and chapter
  placements, so an accidental data change fails CI-style checks locally.
