import { NextResponse } from "next/server";

import { getFrontendVersion } from "@/lib/frontend-version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = async () => {
  return NextResponse.json(
    { version: getFrontendVersion() },
    {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    },
  );
};
