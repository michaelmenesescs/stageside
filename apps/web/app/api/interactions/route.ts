import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = await createClient();

  const { promoter_id, date, location, conversation_notes, follow_up_due } = body;

  if (!promoter_id || !date) {
    return NextResponse.json({ error: "promoter_id and date required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scene_interactions")
    .insert({
      promoter_id,
      date,
      location: location || null,
      conversation_notes: conversation_notes || null,
      follow_up_due: follow_up_due || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
