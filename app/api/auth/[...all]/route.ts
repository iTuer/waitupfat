import { getAuth } from "../../../../lib/auth";
export const dynamic = "force-dynamic";
const allowed = new Set(["sign-up/email", "sign-in/email", "get-session", "sign-out", "change-password"]);
async function handler(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  if (!allowed.has(path)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const response = await getAuth(request).handler(request);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
  catch { return Response.json({ message: "登录服务暂时不可用，请稍后重试" }, { status: 503 }); }
}
export const GET = handler;
export const POST = handler;
