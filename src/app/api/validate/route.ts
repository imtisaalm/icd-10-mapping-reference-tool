import { NextRequest, NextResponse } from "next/server";
import { summarizeValidation, validateCodes } from "@/lib/icd/validate";

export const runtime = "nodejs";

/** Rows accepted per request; the client sends larger files in chunks. */
const MAX_CODES_PER_REQUEST = 5000;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const codes = (body as { codes?: unknown })?.codes;
  if (!Array.isArray(codes)) {
    return NextResponse.json(
      { error: 'Expected JSON body of the form { "codes": string[] }' },
      { status: 400 }
    );
  }
  if (codes.length > MAX_CODES_PER_REQUEST) {
    return NextResponse.json(
      { error: `At most ${MAX_CODES_PER_REQUEST} codes per request` },
      { status: 400 }
    );
  }
  if (!codes.every((c) => c === null || typeof c === "string")) {
    return NextResponse.json({ error: "Codes must be strings or null" }, { status: 400 });
  }

  const results = validateCodes(codes as (string | null)[]);
  return NextResponse.json({ results, summary: summarizeValidation(results) });
}
