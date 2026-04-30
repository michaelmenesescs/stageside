import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { promoter_id, mix_id, channel, subject, pitch_body, status } = body;

  if (!promoter_id || !channel) {
    return Response.json(
      { error: "promoter_id and channel required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const row: Record<string, unknown> = {
    promoter_id,
    channel,
    subject: subject ?? null,
    body: pitch_body ?? null,
    status: status ?? "draft",
    mix_id: mix_id ?? null,
    template_version: "v1",
  };

  if (status === "sent") {
    row.sent_at = new Date().toISOString();
    row.follow_up_due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  const { data, error } = await supabase
    .from("pitches")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("Create pitch error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ id: data.id });
}
