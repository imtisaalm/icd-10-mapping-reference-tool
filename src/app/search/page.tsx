import type { Metadata } from "next";
import SearchClient from "./SearchClient";

export const metadata: Metadata = {
  title: "Description Search · ICD-10-CM Mapping Reference Tool",
};

export default function SearchPage() {
  return <SearchClient />;
}
