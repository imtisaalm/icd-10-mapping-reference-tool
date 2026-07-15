import Link from "next/link";
import { getDataset } from "@/lib/icd/loader";

const TOOLS = [
  {
    href: "/lookup",
    title: "Code lookup",
    description: "Look up an exact ICD-10-CM code and see its official description and hierarchy.",
  },
  {
    href: "/search",
    title: "Description search",
    description: "Search official code descriptions by clinical terms, with optional fuzzy matching.",
  },
  {
    href: "/batch",
    title: "Batch CSV validation",
    description: "Validate a column of diagnosis codes in a CSV file and download annotated results.",
  },
];

export default function HomePage() {
  const { classification, counts } = getDataset();
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          ICD-10-CM Mapping Reference Tool
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          A reproducible utility for searching and validating standardized diagnosis codes in
          healthcare datasets. All codes, descriptions, and hierarchy levels come verbatim from
          the official CDC/NCHS release; nothing is invented or silently corrected.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <h2 className="font-medium text-accent">{tool.title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted">{tool.description}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Reference dataset
        </h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Classification", classification.system],
            ["Release", classification.release],
            ["Data source", classification.source],
            ["Source data retrieved", classification.retrievedAt],
            ["Codes valid for submission", counts.validCodes.toLocaleString("en-US")],
            ["Total entries (incl. headers)", counts.totalEntries.toLocaleString("en-US")],
            ["Chapters", String(counts.chapters)],
            ["Blocks (sections)", String(counts.blocks)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-md border border-border bg-surface p-4 text-sm leading-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          About ICD-10-CM
        </h2>
        <div className="mt-2 max-w-3xl space-y-2">
          <p>
            ICD-10-CM (International Classification of Diseases, 10th Revision, Clinical
            Modification) is the United States&apos; adaptation of the WHO&apos;s ICD-10, maintained
            by the CDC&apos;s National Center for Health Statistics. It is used to code diagnoses
            in US clinical and administrative data.
          </p>
          <p>
            ICD-10-CM differs from both the base WHO ICD-10 and other national adaptations such
            as ICD-10-CA (Canada). Codes valid in one classification may be absent or carry
            different meanings in another; this tool validates against {classification.system}{" "}
            {classification.version} only.
          </p>
          <p>
            This tool is intended for reference, research-data preparation, and portfolio
            demonstration. It is not a diagnostic tool and is not an authority for billing or
            coding decisions.
          </p>
        </div>
      </section>
    </div>
  );
}
