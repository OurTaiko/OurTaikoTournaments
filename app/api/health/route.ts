import { db } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db().ping();
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
