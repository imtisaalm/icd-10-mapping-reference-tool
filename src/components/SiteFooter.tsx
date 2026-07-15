import { getDataset } from "@/lib/icd/loader";

export default function SiteFooter() {
  const { classification } = getDataset();
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-4 text-xs text-muted">
        <p>
          Classification: {classification.system} · Release: {classification.release} · Source:{" "}
          {classification.source} · Retrieved: {classification.retrievedAt}
        </p>
        <p>
          Reference and research-data preparation tool only — not a diagnostic tool and not an
          authority for billing or coding decisions.
        </p>
      </div>
    </footer>
  );
}
