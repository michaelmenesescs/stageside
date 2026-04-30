import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PITCH_DRAFT_SYSTEM } from "@/lib/prompts";

const CHANNEL_TONE: Record<string, string> = {
  email: "Email pitch. Include subject line on first line as 'Subject: ...'. Keep under 120 words after the subject.",
  ig_dm: "Instagram DM. No subject line. Casual but specific. Under 80 words.",
  ra_dm: "Resident Advisor DM. No subject line. Slightly more formal than IG DM. Under 60 words.",
  in_person: "In-person note or follow-up after meeting. Conversational, references something from the conversation. Under 60 words.",
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  const { promoter_id, mix_id, channel } = await request.json();
  if (!promoter_id || !channel) {
    return Response.json(
      { error: "promoter_id and channel required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Fetch promoter + their recent events
  const [promoterRes, eventsRes, mixRes] = await Promise.all([
    supabase
      .from("promoters")
      .select("name, ig_handle, ra_url, sound_tags, notes, fit_score")
      .eq("id", promoter_id)
      .single(),

    supabase
      .from("events")
      .select("date, title, lineup_raw, venues(name)")
      .eq("promoter_id", promoter_id)
      .order("date", { ascending: false })
      .limit(6),

    mix_id
      ? supabase
          .from("mixes")
          .select("title, soundcloud_url, vibe_tags, bpm_range, notes")
          .eq("id", mix_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (promoterRes.error || !promoterRes.data) {
    return Response.json({ error: "Promoter not found" }, { status: 404 });
  }

  const promoter = promoterRes.data;
  const events = eventsRes.data ?? [];
  const mix = mixRes.data;

  // Build context for Claude
  const recentEvents = events
    .map((e) => {
      const venueName = Array.isArray(e.venues)
        ? e.venues[0]?.name
        : (e.venues as { name: string } | null)?.name;
      return `${e.date?.slice(0, 10)}: ${e.title ?? "Event"} at ${venueName ?? "?"} — ${e.lineup_raw ?? "lineup unknown"}`;
    })
    .join("\n");

  const userPrompt = `
Promoter/booker: ${promoter.name}
${promoter.ig_handle ? `IG: @${promoter.ig_handle}` : ""}
${promoter.ra_url ? `RA: ${promoter.ra_url}` : ""}
Sound tags: ${(promoter.sound_tags ?? []).join(", ") || "unknown"}
Fit score: ${promoter.fit_score ?? "unscored"}
Notes: ${promoter.notes ?? "none"}

Their recent bookings:
${recentEvents || "No events scraped yet."}

${mix ? `Mix to reference:\nTitle: ${mix.title}\n${mix.soundcloud_url ? `Link: ${mix.soundcloud_url}` : ""}\nVibe: ${(mix.vibe_tags ?? []).join(", ") || "none"}\n${mix.notes ?? ""}` : "No mix selected — pitch without specific mix reference."}

Channel: ${channel}
${CHANNEL_TONE[channel] ?? "Keep it concise."}

Write the pitch now. Just the message, no preamble.`.trim();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: PITCH_DRAFT_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse subject if email
    let subject: string | null = null;
    let body = text;
    if (channel === "email") {
      const subjectMatch = text.match(/^Subject:\s*(.+)\n/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = text.replace(/^Subject:\s*.+\n\n?/i, "").trim();
      }
    }

    return Response.json({ subject, body });
  } catch (err) {
    console.error("Claude API error:", err);
    return Response.json({ error: "Draft generation failed" }, { status: 500 });
  }
}
