import { NextResponse } from "next/server";
import { getDataset } from "@/lib/icd/loader";

export const runtime = "nodejs";

export function GET() {
  const dataset = getDataset();
  return NextResponse.json({
    classification: dataset.classification,
    counts: dataset.counts,
  });
}
