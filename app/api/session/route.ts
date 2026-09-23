import { viewer, demoAllowed } from "@/lib/auth";
import { errorResponse } from "@/lib/store";
export async function GET(req: Request) {
  try {
    return Response.json(
      { user: await viewer(req), demoAllowed: demoAllowed(req) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
