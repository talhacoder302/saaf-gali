import { connection } from "next/server";

import { getHealth } from "@/server/health";

export async function GET() {
  // Always run at request time, never prerender at build.
  await connection();
  const health = await getHealth();
  return Response.json(health, { status: health.ok ? 200 : 503 });
}
