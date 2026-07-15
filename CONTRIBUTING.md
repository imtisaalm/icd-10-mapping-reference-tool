# Contributing

Thanks for your interest. This is a small portfolio/reference project, but issues and
pull requests are welcome.

## Ground rules

1. **Never invent reference data.** Codes, descriptions, flags, chapters, and blocks
   must come verbatim from the official release files in `data/` (rebuilt with
   `npm run fetch-data`). If the source doesn't provide something, the application
   must omit it, not approximate it.
2. **Never add silent corrections.** Any new normalization must be deterministic,
   reversible in intent, reported in the result, documented on the Methodology page,
   and covered by tests. When in doubt, report instead of repairing.
3. **Keep results reproducible.** Anything user-facing that depends on the dataset
   must carry the classification name and release version.

## Development

```bash
npm install
npm run dev        # dev server
npm run lint       # ESLint
npm run test       # Vitest (runs against the full committed dataset)
npm run build      # production build
npm run fetch-data # rebuild data/ from the official CDC server
```

Please make sure `lint`, `test`, and `build` all pass before opening a pull request,
and add tests for any behavior change in `src/lib/`.

## Updating to a new ICD-10-CM release

1. Update `FISCAL_YEAR` in `scripts/fetch-data.mjs` and `src/lib/icd/loader.ts`.
2. Run `npm run fetch-data`.
3. Update the release counts asserted in `tests/hierarchy.test.ts`.
4. Run the full test suite; investigate any newly failing structural assumptions
   (new code shapes have appeared before — e.g. QA0 in FY2026).
