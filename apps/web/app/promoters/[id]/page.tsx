import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface PromoterDetail {
  id: string;
  name: string;
  ig_handle: string | null;
  ra_url: string | null;
  email: string | null;
  website: string | null;
  sound_tags: string[] | null;
  fit_score: number | null;
  notes: string | null;
  last_active: string | null;
}

interface Event {
  id: string;
  date: string;
  title: string | null;
  lineup_raw: string | null;
  ticket_url: string | null;
  // Supabase returns joined rows as object (to-one) or array (to-many)
  venues: { name: string } | { name: string }[] | null;
}

interface Artist {
  name: string;
  times_booked: number;
}

interface Pitch {
  id: string;
  channel: string | null;
  subject: string | null;
  status: string | null;
  sent_at: string | null;
  replied_at: string | null;
  outcome_notes: string | null;
}

interface SceneInteraction {
  id: string;
  date: string;
  location: string | null;
  conversation_notes: string | null;
  follow_up_due: string | null;
  follow_up_done: boolean;
}

export default async function PromoterDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [promoterRes, eventsRes, pitchesRes, interactionsRes] =
    await Promise.all([
      supabase
        .from("promoters")
        .select(
          "id,name,ig_handle,ra_url,email,website,sound_tags,fit_score,notes,last_active"
        )
        .eq("id", params.id)
        .single(),

      supabase
        .from("events")
        .select("id,date,title,lineup_raw,ticket_url,venues(name)")
        .eq("promoter_id", params.id)
        .order("date", { ascending: false })
        .limit(12),

      supabase
        .from("pitches")
        .select(
          "id,channel,subject,status,sent_at,replied_at,outcome_notes"
        )
        .eq("promoter_id", params.id)
        .order("sent_at", { ascending: false }),

      supabase
        .from("scene_interactions")
        .select(
          "id,date,location,conversation_notes,follow_up_due,follow_up_done"
        )
        .eq("promoter_id", params.id)
        .order("date", { ascending: false }),
    ]);

  if (promoterRes.error || !promoterRes.data) {
    notFound();
  }

  const promoter = promoterRes.data as PromoterDetail;
  const events = (eventsRes.data ?? []) as unknown as Event[];
  const pitches = (pitchesRes.data ?? []) as Pitch[];
  const interactions = (interactionsRes.data ?? []) as SceneInteraction[];

  // Build artist frequency from events
  const artistCounts: Record<string, number> = {};
  for (const ev of events) {
    if (!ev.lineup_raw) continue;
    for (const name of ev.lineup_raw.split(",")) {
      const trimmed = name.trim();
      if (trimmed) {
        artistCounts[trimmed] = (artistCounts[trimmed] ?? 0) + 1;
      }
    }
  }
  const topArtists: Artist[] = Object.entries(artistCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([name, times_booked]) => ({ name, times_booked }));

  const statusColor: Record<string, string> = {
    draft: "text-muted-foreground",
    sent: "text-blue-400",
    opened: "text-yellow-400",
    replied: "text-green-400",
    booked: "text-green-300",
    declined: "text-red-400",
    ghosted: "text-muted-foreground/50",
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <div className="mb-4">
          <Link
            href="/promoters"
            className="text-xs text-muted-foreground tracking-wider uppercase hover:text-foreground transition-colors"
          >
            ← Promoters
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg tracking-widest uppercase mb-2">
              {promoter.name}
            </h1>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              {promoter.ig_handle && (
                <span>@{promoter.ig_handle}</span>
              )}
              {promoter.ra_url && (
                <a
                  href={promoter.ra_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  RA ↗
                </a>
              )}
              {promoter.email && (
                <a
                  href={`mailto:${promoter.email}`}
                  className="hover:text-foreground transition-colors"
                >
                  {promoter.email}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {promoter.fit_score != null && (
              <div className="text-right">
                <div className="text-2xl font-light">{promoter.fit_score}</div>
                <div className="text-xs text-muted-foreground tracking-wider uppercase">
                  Fit
                </div>
              </div>
            )}
            <Link
              href={`/pitch/new?promoter=${promoter.id}`}
              className="text-xs tracking-wider uppercase bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition-opacity"
            >
              Draft Pitch
            </Link>
          </div>
        </div>

        {promoter.sound_tags && promoter.sound_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {promoter.sound_tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {promoter.notes && (
          <p className="text-sm text-muted-foreground mt-4 max-w-2xl">
            {promoter.notes}
          </p>
        )}
      </div>

      {/* Recent events */}
      <Section title="Recent Events" count={events.length}>
        {events.length === 0 ? (
          <Empty>No events scraped yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs tracking-wider uppercase text-muted-foreground">
                <th className="text-left pb-2 pr-6 font-normal">Date</th>
                <th className="text-left pb-2 pr-6 font-normal">Event</th>
                <th className="text-left pb-2 pr-6 font-normal">Venue</th>
                <th className="text-left pb-2 font-normal">Lineup</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-border/40 hover:bg-card transition-colors"
                >
                  <td className="py-2.5 pr-6 text-muted-foreground whitespace-nowrap text-xs">
                    {ev.date}
                  </td>
                  <td className="py-2.5 pr-6">
                    {ev.ticket_url ? (
                      <a
                        href={ev.ticket_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-muted-foreground transition-colors"
                      >
                        {ev.title ?? "Untitled"} ↗
                      </a>
                    ) : (
                      ev.title ?? "Untitled"
                    )}
                  </td>
                  <td className="py-2.5 pr-6 text-muted-foreground text-xs">
                    {Array.isArray(ev.venues)
                      ? (ev.venues[0]?.name ?? "—")
                      : (ev.venues?.name ?? "—")}
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                    {ev.lineup_raw ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Artists they book */}
      {topArtists.length > 0 && (
        <Section title="Artists They Book">
          <div className="flex flex-wrap gap-2">
            {topArtists.map((a) => (
              <span
                key={a.name}
                className="text-xs bg-card border border-border px-2.5 py-1 rounded-full"
              >
                {a.name}
                {a.times_booked > 1 && (
                  <span className="ml-1.5 text-muted-foreground">
                    ×{a.times_booked}
                  </span>
                )}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Pitch history */}
      <Section title="Pitch History" count={pitches.length}>
        {pitches.length === 0 ? (
          <Empty>No pitches sent yet.</Empty>
        ) : (
          <div className="space-y-3">
            {pitches.map((p) => (
              <div
                key={p.id}
                className="border border-border rounded p-4 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs tracking-wider uppercase text-muted-foreground">
                      {p.channel ?? "—"}
                    </span>
                    {p.status && (
                      <span
                        className={`text-xs tracking-wider uppercase ${statusColor[p.status] ?? "text-muted-foreground"}`}
                      >
                        {p.status}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {p.sent_at ? p.sent_at.slice(0, 10) : "Not sent"}
                  </span>
                </div>
                {p.subject && (
                  <p className="text-muted-foreground text-xs">{p.subject}</p>
                )}
                {p.outcome_notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {p.outcome_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Scene interactions */}
      <Section title="Scene Interactions" count={interactions.length}>
        {interactions.length === 0 ? (
          <Empty>No interactions logged yet.</Empty>
        ) : (
          <div className="space-y-3">
            {interactions.map((i) => (
              <div
                key={i.id}
                className="border border-border rounded p-4 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {i.date}
                    {i.location ? ` · ${i.location}` : ""}
                  </span>
                  {i.follow_up_due && !i.follow_up_done && (
                    <span className="text-xs text-yellow-400">
                      Follow-up due {i.follow_up_due}
                    </span>
                  )}
                </div>
                {i.conversation_notes && (
                  <p className="text-muted-foreground text-xs">
                    {i.conversation_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs tracking-widest uppercase text-muted-foreground">
          {title}
        </h2>
        {count != null && (
          <span className="text-xs text-muted-foreground/60">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
