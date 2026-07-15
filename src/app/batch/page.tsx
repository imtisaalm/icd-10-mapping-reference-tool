import type { Metadata } from "next";
import BatchClient from "./BatchClient";

export const metadata: Metadata = {
  title: "Batch Validation · ICD-10-CM Mapping Reference Tool",
};

export default function BatchPage() {
  return <BatchClient />;
}
