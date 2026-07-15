import type { Metadata } from "next";
import LookupClient from "./LookupClient";

export const metadata: Metadata = {
  title: "Code Lookup · ICD-10-CM Mapping Reference Tool",
};

export default function LookupPage() {
  return <LookupClient />;
}
