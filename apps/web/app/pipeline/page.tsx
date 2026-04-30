import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PipelineCard } from "./pipeline-card";

const COLUMNS = [
  { status: "draft", label: "Draft" },
  { status: "sent", label: "Sent" },
  { status: "opened", label: "Opened" },
  { status: "replied", label: "Replied" },
  { status: "booked", label: "Booked" },
  { status: "declined", label: "Declined" },
  { status: "ghosted", label: "Ghosted" },
] as const;

type PitchStatus = (typeof COLUMNS)[number]["status"];

interface Pitch {
  id: string;
  channel: string | null;
  subject: string | null;
  body: string | null;
  status: PitchStatus | null;
  sent_at: string | null;
  replied_at: string | null;
  follow_up_due: string | null;
  outcome_notes: string | null;
  promoters: { id: string; name: string; ig_handle: string | null } | null;
}

export default async function PipelinePage() {
  const supabase = await createClient();

  const { data: pitches } = await supabase
    .from("pitches")
    .select(
      "id, channel, subject, body, status, sent_at, replied_at, follow_up_due, outcome_notes, promoters(id, name, ig_handle)"
    )
    .order("sent_at", { ascending: false, nullsFirst: false })
    .returns<Pitch[]>();

  const today = new Date().toISOString().slice(0, 10);

  const byStatus = Object.fromEntries(
    COLUMNS.map((c) => [c.status, [] as Pitch[]])
  ) as Record<PitchStatus, Pitch[]>;

  for (const pitch of pitches ?? []) {
    const s = pitch.status ?? "draft";
    if (s in byStatus) {
      byStatus[s as PitchStatus].push(pitch);
    }
  }

  const total = pitches?.length ?? 0;
  const sent = byStatus.sent.length + byStatus.opened.length + byStatus.replied.length + byStatus.booked.length;
  const replied = byStatus.replied.length + byStatus.booked.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-sm tracking-widest uppercase mb-1">Pipeline</h1>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              {sent} sent · {replied} replied
              {sent > 0
                ? ` · ${Math.round((replied / sent) * 100)}% reply rate`
                : ""}
            </p>
          )}
        </div>
        <Link
          href="/pitch/new"
          className="text-xs tracking-wider uppercase bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition-opacity"
        >
          New Pitch
        </Link>
      </div>

      {total === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-muted-foreground mb-4">No pitches yet.</p>
          <Link
            href="/pitch/new"
            className="text-xs tracking-wider uppercase underline text-muted-foreground hover:text-foreground transition-colors"
          >
            Draft your first pitch →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3 min-h-[400px]">
          {COLUMNS.map((col) => {
            const cards = byStatus[col.status];
            return (
              <div key={col.status} className="min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs tracking-wider uppercase text-muted-foreground">
                    {col.label}
                  </span>
                  {cards.length > 0 && (
                    <span className="text-xs text-muted-foreground/60">
                      {cards.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {cards.map((pitch) => (
                    <PipelineCard
                      key={pitch.id}
                      pitch={pitch}
                      today={today}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
