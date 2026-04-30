import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { status } = await request.json();
  const validStatuses = [
    "draft",
    "sent",
    "opened",
    "replied",
    "booked",
    "declined",
    "ghosted",
  ];

  if (!validStatuses.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = await createClient();

  const update: Record<string, unknown> = { status };

  if (status === "sent") {
    update.sent_at = new Date().toISOString();
    update.follow_up_due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  } else if (status === "replied") {
    update.replied_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("pitches")
    .update(update)
    .eq("id", params.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
