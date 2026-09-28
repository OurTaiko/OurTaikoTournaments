import {
  login,
  loginReturnTo,
  callback,
  logout,
  demoAllowed,
  saveSession,
  cookie,
} from "@/lib/auth";
import { errorResponse, originCheck, runtime } from "@/lib/store";
import { safeReturnTo } from "@/lib/auth-navigation";
import { RuleError } from "@/lib/rules";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  let returnTo = safeReturnTo(new URL(req.url).searchParams.get("returnTo"));
  try {
    if (action === "callback") returnTo = await loginReturnTo(req);
    if (action === "login") return await login(new URL(req.url).searchParams.get("returnTo") ?? "/");
    if (action === "callback") return await callback(req);
    throw new RuleError("找不到此入口。", 404);
  } catch (e) {
    const message = e instanceof RuleError ? e.message : "登录未完成，请重试。";
    return new Response(null, {
      status: 302,
      headers: {
        Location:
          runtime.APP_ORIGIN + "/login?returnTo=" + encodeURIComponent(returnTo) + "&authError=" + encodeURIComponent(message),
        "Cache-Control": "no-store",
      },
    });
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    originCheck(req);
    const { action } = await params;
    if (action === "logout") return await logout(req);
    if (action === "demo") {
      if (!demoAllowed(req)) throw new RuleError("演示管理仅在本机开放。", 403);
      const id = await saveSession({
        kind: "demo",
        sub: "local-demo",
        name: "本地演示管理员",
        username: "demo",
      });
      return Response.json(
        { ok: true },
        { headers: { "Set-Cookie": cookie(id) } },
      );
    }
    throw new RuleError("找不到此入口。", 404);
  } catch (e) {
    return errorResponse(e);
  }
}
