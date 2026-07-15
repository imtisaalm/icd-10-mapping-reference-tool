import type { Metadata } from "next";
import { getDataset } from "@/lib/icd/loader";

export const metadata: Metadata = {
  title: "About · ICD-10-CM Mapping Reference Tool",
};

export default function AboutPage() {
  const { classification } = getDataset();
  return (
    <article className="max-w-3xl space-y-8 text-sm leading-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">About</h1>
        <p className="mt-2">
          A reproducible utility for searching and validating standardized diagnosis codes in
          healthcare datasets.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">What it does</h2>
        <p>
          The tool answers three narrow questions about {classification.system} diagnosis codes:
          What does this code mean, according to the official release? Which codes match this
          clinical term? And in this dataset, which code values are valid, which needed safe
          reformatting, and which are invalid, missing, or ambiguous?
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">What it is not</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Not a diagnostic tool — it says nothing about patients or clinical decisions.</li>
          <li>
            Not a billing or coding authority — payer rules, coding guidelines, and medical
            necessity are out of scope.
          </li>
          <li>
            Not a code mapper — it does not translate between ICD-10-CM and other
            classifications such as ICD-10-CA or the base WHO ICD-10.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Data and privacy</h2>
        <p>
          The reference data is the official {classification.system} {classification.release}{" "}
          from {classification.source}, retrieved {classification.retrievedAt} (US federal
          government work, public domain). Uploaded CSV files are read in the browser; only the
          selected code column is sent to the server for validation, processed in memory, and
          never stored. Do not upload files containing direct patient identifiers — the tool is
          designed for de-identified research datasets.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Why this exists</h2>
        <p>
          Diagnosis-code columns in real-world datasets accumulate formatting drift — mixed
          case, missing decimal points, several codes in one field, retired codes from earlier
          releases. This project demonstrates a careful, reproducible approach to that everyday
          data-quality problem: strict separation of official data from application logic,
          conservative normalization, and honest reporting instead of silent correction.
        </p>
      </section>
    </article>
  );
}
