import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/http";

export async function GET(request: NextRequest) {
  const admin = getAdmin(request);
  return NextResponse.json(
    { admin },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

