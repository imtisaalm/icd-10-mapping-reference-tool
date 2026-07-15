import type { Metadata } from "next";
import { getDataset } from "@/lib/icd/loader";

export const metadata: Metadata = {
  title: "Methodology · ICD-10-CM Mapping Reference Tool",
};

export default function MethodologyPage() {
  const { classification } = getDataset();
  return (
    <article className="max-w-3xl space-y-8 text-sm leading-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">Methodology</h1>
        <p className="mt-2 text-muted">
          How this tool normalizes input, matches codes, and stays reproducible.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Reference data</h2>
        <p>
          Every code, description, valid-for-submission flag, chapter, and block in this tool
          comes verbatim from the official {classification.system} {classification.release}{" "}
          files published by {classification.source} (retrieved {classification.retrievedAt}).
          The application performs no clinical interpretation and generates no content of its
          own; it only formats, indexes, and reports what the source files contain.
        </p>
        <p>
          Where the source data does not provide a hierarchy level for a code, that level is
          simply omitted from the display. No hierarchy is constructed from assumptions.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">How codes are normalized</h2>
        <p>
          Only formatting differences that can be corrected with zero ambiguity are considered
          safe, and every applied change is reported alongside the result:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Surrounding whitespace is removed.</li>
          <li>Lowercase input is converted to uppercase.</li>
          <li>
            A missing decimal point is inserted. In ICD-10-CM the decimal point always sits
            after the third character, so <span className="font-mono">I509</span> resolves to{" "}
            <span className="font-mono">I50.9</span> deterministically.
          </li>
          <li>
            A trailing decimal point with nothing after it (for example{" "}
            <span className="font-mono">E11.</span>) is removed.
          </li>
        </ul>
        <p>
          Everything else is reported rather than repaired: a decimal point in a non-standard
          position, several codes in one field, or characters outside the ICD-10-CM code
          structure. When more than one code could be intended, the value is labelled{" "}
          <em>ambiguous</em> and left untouched.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Exact versus approximate matching</h2>
        <p>
          A lookup or validation result is an <em>exact match</em> when the input already equals
          the canonical form of a code in the reference table, and a <em>normalized match</em>{" "}
          when one of the safe corrections above was needed first. Both resolve to a single,
          verifiable entry in the official table.
        </p>
        <p>
          Description search is different: it ranks results by how well the official description
          matches the query (exact phrase, phrase, all terms, word prefixes). When a search term
          only matches within a small spelling distance (for example <em>asthmma</em> →{" "}
          <em>asthma</em>), results are explicitly labelled <em>approximate</em> and shown only
          when no exact term matches exist. Approximate matching is never used for code
          validation — only for helping a person find descriptions.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Why invalid codes are never silently corrected</h2>
        <p>
          In research and healthcare data preparation, an automatic &quot;fix&quot; is a silent
          data change: it can shift a diagnosis to a different clinical concept and is invisible
          in downstream analysis. This tool therefore reports invalid, missing, and ambiguous
          values with a note explaining what was found, and leaves the decision to the data
          owner. Codes that match a category or subcategory header (such as{" "}
          <span className="font-mono">I50</span>) are identified as headers that are not valid
          for submission, rather than being &quot;upgraded&quot; to a more specific code.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Reproducibility</h2>
        <p>
          Results are only meaningful relative to a specific classification release, because
          codes are added, revised, and retired every fiscal year. Every result and every export
          from this tool therefore carries the classification name ({classification.system}) and
          release ({classification.version}). The exact source files and retrieval date are
          recorded in the repository, and a documented script re-downloads the same release from
          the official CDC server, so the dataset can be rebuilt and verified by anyone.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Scope</h2>
        <p>
          Version 1 supports {classification.system} only. The data layer is written against a
          classification-neutral interface so that a second classification (such as ICD-10-CA)
          could be added as a separate, clearly labelled dataset without rewriting the
          application. Mapping between classifications is out of scope for this version.
        </p>
      </section>
    </article>
  );
}
