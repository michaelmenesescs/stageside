import { createClient } from "@/lib/supabase/server";
import { PromotersList } from "./promoters-list";

export const revalidate = 0;

interface Promoter {
  id: string;
  name: string;
  ig_handle: string | null;
  ra_url: string | null;
  fit_score: number | null;
  last_active: string | null;
  notes: string | null;
  sound_tags: string[] | null;
}

interface PitchRow {
  promoter_id: string;
  status: string | null;
  sent_at: string | null;
}

interface EventRow {
  promoter_id: string | null;
  date: string;
}

export default async function PromotersPage() {
  const supabase = await createClient();

  const [promotersRes, pitchesRes, eventsRes] = await Promise.all([
    supabase
      .from("promoters")
      .select("id, name, ig_handle, ra_url, fit_score, last_active, notes, sound_tags")
      .order("fit_score", { ascending: false, nullsFirst: false })
      .returns<Promoter[]>(),

    supabase
      .from("pitches")
      .select("promoter_id, status, sent_at")
      .returns<PitchRow[]>(),

    supabase
      .from("events")
      .select("promoter_id, date")
      .not("promoter_id", "is", null)
      .order("date", { ascending: false })
      .returns<EventRow[]>(),
  ]);

  const promoters = promotersRes.data ?? [];
  const pitches = pitchesRes.data ?? [];
  const events = eventsRes.data ?? [];

  // Per-promoter pitch status (best active status wins)
  const STATUS_RANK: Record<string, number> = {
    booked: 6,
    replied: 5,
    opened: 4,
    sent: 3,
    declined: 2,
    ghosted: 1,
    draft: 0,
  };

  const pitchStatus: Record<string, string> = {};
  for (const p of pitches) {
    if (!p.promoter_id || !p.status) continue;
    const current = pitchStatus[p.promoter_id];
    if (!current || (STATUS_RANK[p.status] ?? -1) > (STATUS_RANK[current] ?? -1)) {
      pitchStatus[p.promoter_id] = p.status;
    }
  }

  // Per-promoter event count + last event date
  const eventCount: Record<string, number> = {};
  const lastEventDate: Record<string, string> = {};
  for (const e of events) {
    if (!e.promoter_id) continue;
    eventCount[e.promoter_id] = (eventCount[e.promoter_id] ?? 0) + 1;
    if (!lastEventDate[e.promoter_id] || e.date > lastEventDate[e.promoter_id]) {
      lastEventDate[e.promoter_id] = e.date;
    }
  }

  const enriched = promoters.map((p) => ({
    ...p,
    pitch_status: pitchStatus[p.id] ?? null,
    event_count: eventCount[p.id] ?? 0,
    last_event: lastEventDate[p.id] ?? null,
  }));

  return <PromotersList promoters={enriched} />;
}
