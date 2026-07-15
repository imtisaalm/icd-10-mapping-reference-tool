import { NextRequest, NextResponse } from "next/server";
import { searchDescriptions } from "@/lib/icd/search";
import { getDataset } from "@/lib/icd/loader";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }
  const fuzzy = params.get("fuzzy") !== "0";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
  const results = searchDescriptions(q, { fuzzy, limit });
  return NextResponse.json({
    query: q,
    fuzzy,
    results,
    classification: getDataset().classification,
  });
}
