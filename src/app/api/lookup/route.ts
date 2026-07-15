import { NextRequest, NextResponse } from "next/server";
import { lookupCode } from "@/lib/icd/lookup";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (code.length > 64) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }
  return NextResponse.json(lookupCode(code));
}
