// A process-only check avoids continuously waking the free database.
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
