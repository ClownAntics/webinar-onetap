import { NextRequest, NextResponse } from "next/server";
import { getEmployee } from "@/lib/auth";
import { appSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/admin/webinar/delete { webinarId }
 *
 * Removes a webinar from THIS app: its setup row and any email/SMS drafts
 * Email Commander has written for it. Registrations, attendance and visits are
 * kept — they are history (revenue attribution reads them) and harmless once
 * the card is gone.
 *
 * Two guards:
 *  - Refuses while any send is scheduled or already sent. A scheduled campaign
 *    lives in Omnisend and would still go out to customers; it must be
 *    cancelled in Email Commander first. Deleting the row underneath it would
 *    hide that fact, not fix it.
 *  - If the webinar still exists in Zoom, it will reappear on the dashboard as
 *    NEEDS SETUP — by design. The app lists Zoom's webinars; delete it in Zoom
 *    too if it is truly gone. The UI says so before confirming.
 */
export async function POST(req: NextRequest) {
  const auth = await getEmployee();
  if (auth.reason !== "ok") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { webinarId } = (await req.json().catch(() => ({}))) as { webinarId?: string };
  if (!webinarId || !/^\d{9,12}$/.test(webinarId)) {
    return NextResponse.json({ error: "webinarId required" }, { status: 400 });
  }

  const sb = appSupabase();

  // Guard: anything live in Omnisend blocks deletion.
  const { data: live } = await sb
    .from("webinar_campaigns")
    .select("send_key, variant, status")
    .eq("webinar_id", webinarId)
    .in("status", ["scheduled", "paused", "started", "sent"]);
  if (live && live.length > 0) {
    const scheduled = live.filter((r) => r.status !== "sent").length;
    return NextResponse.json(
      {
        error:
          scheduled > 0
            ? `${scheduled} send(s) are scheduled in Omnisend for this webinar. Cancel them in Email Commander first — deleting here would not stop them going out.`
            : `This webinar has sends that already went out. It is history now; archive rather than delete.`,
      },
      { status: 409 }
    );
  }

  // Drafts and test records are ours to drop; nothing has left the building.
  await sb.from("webinar_experiments").delete().eq("webinar_id", webinarId);
  await sb.from("webinar_campaigns").delete().eq("webinar_id", webinarId);
  const { error } = await sb.from("webinar_config").delete().eq("webinar_id", webinarId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, webinarId });
}
