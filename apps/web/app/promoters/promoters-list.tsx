"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Promoter {
  id: string;
  name: string;
  ig_handle: string | null;
  ra_url: string | null;
  fit_score: number | null;
  last_active: string | null;
  notes: string | null;
  sound_tags: string[] | null;
  pitch_status: string | null;
  event_count: number;
  last_event: string | null;
}

type FilterTab = "all" | "untouched" | "active" | "closed";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  opened: "Opened",
  replied: "Replied",
  booked: "Booked",
  declined: "Declined",
  ghosted: "Ghosted",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "text-muted-foreground",
  sent: "text-blue-400",
  opened: "text-yellow-400",
  replied: "text-green-400",
  booked: "text-green-300",
  declined: "text-red-400",
  ghosted: "text-muted-foreground/50",
};

function getTab(status: string | null): FilterTab {
  if (!status || status === "draft") return "untouched";
  if (status === "booked" || status === "declined" || status === "ghosted") return "closed";
  return "active";
}

export function PromotersList({ promoters }: { promoters: Promoter[] }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [sort, setSort] = useState<"fit" | "name" | "events" | "last_event">("fit");

  const tabs: { key: FilterTab; label: string }[] = useMemo(() => {
    const counts = { all: 0, untouched: 0, active: 0, closed: 0 };
    for (const p of promoters) {
      counts.all++;
      counts[getTab(p.pitch_status)]++;
    }
    return [
      { key: "all", label: `All ${counts.all}` },
      { key: "untouched", label: `Not Contacted ${counts.untouched}` },
      { key: "active", label: `Active ${counts.active}` },
      { key: "closed", label: `Closed ${counts.closed}` },
    ];
  }, [promoters]);

  const visible = useMemo(() => {
    let list = promoters;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.ig_handle ?? "").toLowerCase().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q)
      );
    }
    if (tab !== "all") {
      list = list.filter((p) => getTab(p.pitch_status) === tab);
    }
    return [...list].sort((a, b) => {
      if (sort === "fit") return (b.fit_score ?? -1) - (a.fit_score ?? -1);
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "events") return b.event_count - a.event_count;
      if (sort === "last_event") {
        if (!a.last_event && !b.last_event) return 0;
        if (!a.last_event) return 1;
        if (!b.last_event) return -1;
        return b.last_event.localeCompare(a.last_event);
      }
      return 0;
    });
  }, [promoters, search, tab, sort]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-sm tracking-widest uppercase">Promoters</h1>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-input border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-4 mb-6 border-b border-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs tracking-wider uppercase transition-colors ${
              tab === t.key
                ? "text-foreground border-b-2 border-foreground pb-3 -mb-3"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-1 mb-4">
        <span className="text-xs text-muted-foreground mr-2">{visible.length} shown · Sort:</span>
        {(["fit", "name", "events", "last_event"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              sort === s
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "fit" ? "Fit" : s === "last_event" ? "Last Event" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No promoters match.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wider uppercase text-muted-foreground">
              <th className="text-left pb-3 pr-4 font-normal">Name</th>
              <th className="text-left pb-3 pr-4 font-normal">Status</th>
              <th className="text-left pb-3 pr-4 font-normal">Events</th>
              <th className="text-left pb-3 pr-4 font-normal">Last Event</th>
              <th className="text-left pb-3 pr-4 font-normal">Fit</th>
              <th className="pb-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border/40 hover:bg-card transition-colors group"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/promoters/${p.id}`}
                    className="font-medium text-foreground group-hover:text-muted-foreground transition-colors"
                  >
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.ig_handle && (
                      <span className="text-xs text-muted-foreground/60">@{p.ig_handle}</span>
                    )}
                    {p.ra_url && (
                      <a
                        href={p.ra_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        RA ↗
                      </a>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  {p.pitch_status && p.pitch_status !== "draft" ? (
                    <span className={`text-xs tracking-wider uppercase ${STATUS_CLASS[p.pitch_status] ?? "text-muted-foreground"}`}>
                      {STATUS_LABEL[p.pitch_status] ?? p.pitch_status}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">
                  {p.event_count > 0 ? p.event_count : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                  {p.last_event ? p.last_event.slice(0, 7) : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="py-3 pr-4 text-xs">
                  {p.fit_score != null ? (
                    <span
                      className={
                        p.fit_score >= 80
                          ? "text-foreground"
                          : p.fit_score >= 65
                            ? "text-muted-foreground"
                            : "text-muted-foreground/50"
                      }
                    >
                      {p.fit_score}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/pitch/new?promoter=${p.id}`}
                    className="text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Pitch →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
