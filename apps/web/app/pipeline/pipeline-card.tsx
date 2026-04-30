"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Pitch {
  id: string;
  channel: string | null;
  subject: string | null;
  status: string | null;
  sent_at: string | null;
  follow_up_due: string | null;
  promoters: { id: string; name: string; ig_handle: string | null } | null;
}

const STATUS_OPTIONS = [
  "draft",
  "sent",
  "opened",
  "replied",
  "booked",
  "declined",
  "ghosted",
] as const;

export function PipelineCard({
  pitch,
  today,
}: {
  pitch: Pitch;
  today: string;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);

  const followUpOverdue =
    pitch.follow_up_due && pitch.follow_up_due <= today &&
    !["booked", "declined", "ghosted"].includes(pitch.status ?? "");

  async function moveTo(newStatus: string) {
    setMoving(true);
    await fetch(`/api/pitches/${pitch.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setMoving(false);
  }

  const promoter = Array.isArray(pitch.promoters)
    ? pitch.promoters[0]
    : pitch.promoters;

  return (
    <div
      className={`border rounded p-2.5 text-xs bg-card ${followUpOverdue ? "border-yellow-500/50" : "border-border"} ${moving ? "opacity-50" : ""}`}
    >
      {promoter && (
        <a
          href={`/promoters/${promoter.id}`}
          className="font-medium text-foreground hover:text-muted-foreground transition-colors block mb-0.5 truncate"
        >
          {promoter.name}
        </a>
      )}

      {pitch.subject && (
        <p className="text-muted-foreground truncate mb-1">{pitch.subject}</p>
      )}

      <div className="flex items-center gap-2 text-muted-foreground/70">
        {pitch.channel && <span>{pitch.channel.replace("_", " ")}</span>}
        {pitch.sent_at && (
          <span>{pitch.sent_at.slice(0, 10)}</span>
        )}
      </div>

      {followUpOverdue && (
        <p className="text-yellow-500 mt-1">
          Follow-up due {pitch.follow_up_due}
        </p>
      )}

      {/* Move to dropdown */}
      <div className="mt-2">
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) moveTo(e.target.value);
          }}
          className="w-full bg-input border border-border rounded px-1.5 py-1 text-xs text-muted-foreground focus:outline-none"
        >
          <option value="" disabled>
            Move to…
          </option>
          {STATUS_OPTIONS.filter((s) => s !== pitch.status).map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
