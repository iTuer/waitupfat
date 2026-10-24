import { first, query } from "../../../../db";
import { getAuth } from "../../../../lib/auth";
import { appOrigin } from "../../../../lib/origin";
import { approvalStatus, mealKinds, foodEmojis } from "../../../../lib/rules";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();
    const auth = await getAuth(req).api.getSession({ headers: req.headers });
    if (!auth) fail("请先登录", 401);
    const uid = auth.user.id;
    if (req.method !== "GET") {
      if (req.headers.get("origin") !== appOrigin(req)) fail("请求来源不正确", 403);
      if (!req.headers.get("content-type")?.includes("application/json")) fail("请求格式不正确", 415);
      if (Number(req.headers.get("content-length") || 0) > 12000) fail("内容过长", 413);
    }
    if (req.method === "GET" && action === "data") {
      const mine = url.searchParams.get("scope") !== "square";
      const offset = Math.max(0, Math.min(10000, parseInt(url.searchParams.get("offset") || "0") || 0));
      const rows = await query(`
        SELECT m.id, m.owner, m.title, m.note, m.kind, m.emoji, m.visibility, m.eaten_at,
        m.created_at::double precision AS created_at, u.name AS author,
        (SELECT COUNT(*)::int FROM votes v WHERE v.meal_id=m.id AND v.value=1) AS up,
        (SELECT COUNT(*)::int FROM votes v WHERE v.meal_id=m.id AND v.value=-1) AS down,
        (SELECT value FROM votes v WHERE v.meal_id=m.id AND v.user_id=$1) AS "myVote",
        (SELECT COUNT(*)::int FROM likes l WHERE l.meal_id=m.id) AS hearts,
        (SELECT COUNT(*)::int FROM likes l WHERE l.meal_id=m.id AND l.user_id=$1) AS "myLike"
        FROM meals m JOIN "user" u ON u.id=m.owner
        WHERE m.withdrawn=0 AND ${mine ? "m.owner=$1" : "m.visibility='public'"}
        ORDER BY m.created_at DESC, m.id DESC LIMIT 31 OFFSET $2
      `, [uid, offset]);
      return json({ meals: rows.slice(0, 30).map(m => ({ ...m, mine: m.owner === uid, owner: undefined, status: approvalStatus(m.up, m.down, m.visibility) })), more: rows.length > 30 });
    }
    if (req.method === "GET" && action === "profile") {
      const [counts, pref, votesCount] = await Promise.all([
        first("SELECT COUNT(*)::int total, COUNT(DISTINCT substr(eaten_at,1,10))::int days, COALESCE(SUM(CASE WHEN substr(eaten_at,1,10)=$1 THEN 1 ELSE 0 END),0)::int today FROM meals WHERE owner=$2 AND withdrawn=0", [url.searchParams.get("day") || "", uid]),
        first("SELECT breakfast,lunch,dinner,enabled FROM settings WHERE user_id=$1", [uid]),
        first("SELECT COUNT(*)::int total FROM votes v JOIN meals m ON m.id=v.meal_id WHERE v.user_id=$1 AND m.withdrawn=0", [uid]),
      ]);
      return json({ name: auth.user.name, counts, votes: votesCount?.total || 0, settings: pref || { breakfast: "08:30", lunch: "12:30", dinner: "18:30", enabled: 0 } });
    }
    if (req.method !== "POST") return json({ error: "页面不存在" }, 404);
    const raw = await req.text();
    if (raw.length > 12000) fail("内容过长", 413);
    let b: any; try { b = JSON.parse(raw); } catch { fail("请求格式不正确"); }
    if (!b || typeof b !== "object" || Array.isArray(b)) fail("请求格式不正确");
    if (action === "meal") {
      const title = clean(b.title, 80), note = clean(b.note, 600);
      if (!title || !mealKinds.includes(b.kind) || !["public", "private"].includes(b.visibility)) fail("请填写食物、餐次和可见范围");
      if (!foodEmojis.includes(b.emoji)) fail("请选择食物图标");
      if (typeof b.eatenAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.eatenAt) || !Number.isFinite(Date.parse(b.eatenAt))) fail("请选择有效日期时间");
      const recent = await first("SELECT COUNT(*)::int n FROM meals WHERE owner=$1 AND created_at>$2", [uid, Date.now() - 3600000]);
      if (Number(recent?.n) >= 30) fail("这一小时记录有点多，稍后再试", 429);
      const id = clean(b.id, 60);
      if (!/^[0-9a-f-]{36}$/.test(id)) fail("记录编号不正确");
      const inserted = await query("INSERT INTO meals(id,owner,title,note,kind,emoji,visibility,eaten_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING RETURNING id", [id, uid, title, note, b.kind, b.emoji, b.visibility, b.eatenAt, Date.now()]);
      if (!inserted.length) {
        const existing = await first("SELECT owner FROM meals WHERE id=$1", [id]);
        if (existing?.owner !== uid) fail("记录编号冲突，请刷新后重试", 409);
      }
      return json({ ok: true });
    }
    if (["vote", "like", "publish", "withdraw"].includes(action || "")) {
      const id = clean(b.id, 60);
      const m = await first("SELECT owner,visibility FROM meals WHERE id=$1 AND withdrawn=0", [id]);
      if (!m || (m.owner !== uid && m.visibility !== "public")) fail("记录不存在", 404);
      if (action === "publish" || action === "withdraw") {
        if (m.owner !== uid) fail("只能操作自己的记录", 403);
        if (action === "publish") await query("UPDATE meals SET visibility='public' WHERE id=$1 AND owner=$2", [id, uid]);
        else await query("UPDATE meals SET withdrawn=1 WHERE id=$1 AND owner=$2", [id, uid]);
      } else {
        if (m.visibility !== "public") fail("私密记录不能参与公开互动", 403);
        if (m.owner === uid) fail("把这一票留给饭友吧，不能审批或点赞自己", 403);
        if (action === "vote") {
          if (![1, -1].includes(b.value)) fail("请选择支持或暂不支持");
          await query("INSERT INTO votes(meal_id,user_id,value,reason,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(meal_id,user_id) DO UPDATE SET value=excluded.value,reason=excluded.reason,created_at=excluded.created_at", [id, uid, b.value, clean(b.reason, 200), Date.now()]);
        } else {
          if (typeof b.liked !== "boolean") fail("点赞状态不正确");
          if (b.liked) await query("INSERT INTO likes(meal_id,user_id) VALUES($1,$2) ON CONFLICT(meal_id,user_id) DO NOTHING", [id, uid]);
          else await query("DELETE FROM likes WHERE meal_id=$1 AND user_id=$2", [id, uid]);
        }
      }
      return json({ ok: true });
    }
    if (action === "settings") {
      for (const key of ["breakfast", "lunch", "dinner"]) if (typeof b[key] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b[key])) fail("请填写有效提醒时间");
      await query("INSERT INTO settings(user_id,breakfast,lunch,dinner,enabled) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET breakfast=excluded.breakfast,lunch=excluded.lunch,dinner=excluded.dinner,enabled=excluded.enabled", [uid, b.breakfast, b.lunch, b.dinner, b.enabled ? 1 : 0]);
      return json({ ok: true });
    }
    return json({ error: "页面不存在" }, 404);
  } catch (e: any) {
    if (Number.isInteger(e.status) && e.status >= 400 && e.status < 500) return json({ error: e.message }, e.status);
    console.error("app_request_failed", e?.name, e?.code);
    return json({ error: "服务暂时开小差了，请重试" }, 500);
  }
}
export const GET = handler;
export const POST = handler;
