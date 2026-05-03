"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  promoterId: string;
  initialNotes: string | null;
}

export function PromoterActions({ promoterId, initialNotes }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const [showInteraction, setShowInteraction] = useState(false);
  const [intDate, setIntDate] = useState(new Date().toISOString().slice(0, 10));
  const [intLocation, setIntLocation] = useState("");
  const [intNotes, setIntNotes] = useState("");
  const [intFollowUp, setIntFollowUp] = useState("");
  const [savingInt, setSavingInt] = useState(false);

  async function saveNotes() {
    setSavingNotes(true);
    await fetch(`/api/promoters/${promoterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSavingNotes(false);
    setEditingNotes(false);
    router.refresh();
  }

  async function logInteraction() {
    setSavingInt(true);
    await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promoter_id: promoterId,
        date: intDate,
        location: intLocation || null,
        conversation_notes: intNotes || null,
        follow_up_due: intFollowUp || null,
      }),
    });
    setSavingInt(false);
    setShowInteraction(false);
    setIntNotes("");
    setIntLocation("");
    setIntFollowUp("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs tracking-widest uppercase text-muted-foreground">Notes</span>
          {!editingNotes && (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {notes ? "Edit" : "+ Add note"}
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Notes about this promoter…"
              className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
            <div className="flex gap-2">
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="text-xs tracking-wider uppercase bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {savingNotes ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setNotes(initialNotes ?? "");
                  setEditingNotes(false);
                }}
                className="text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : notes ? (
          <p
            className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setEditingNotes(true)}
          >
            {notes}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/40">No notes.</p>
        )}
      </div>

      {/* Log interaction */}
      <div>
        {!showInteraction ? (
          <button
            onClick={() => setShowInteraction(true)}
            className="text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors border border-border rounded px-3 py-1.5"
          >
            + Log Interaction
          </button>
        ) : (
          <div className="border border-border rounded p-4 space-y-3">
            <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Log Interaction</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Date</label>
                <input
                  type="date"
                  value={intDate}
                  onChange={(e) => setIntDate(e.target.value)}
                  className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Location</label>
                <input
                  type="text"
                  value={intLocation}
                  onChange={(e) => setIntLocation(e.target.value)}
                  placeholder="Club, party, online…"
                  className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <textarea
                value={intNotes}
                onChange={(e) => setIntNotes(e.target.value)}
                rows={3}
                placeholder="What was said…"
                autoFocus
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Follow-up due (optional)</label>
              <input
                type="date"
                value={intFollowUp}
                onChange={(e) => setIntFollowUp(e.target.value)}
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={logInteraction}
                disabled={savingInt || !intDate}
                className="text-xs tracking-wider uppercase bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {savingInt ? "Saving…" : "Log"}
              </button>
              <button
                onClick={() => setShowInteraction(false)}
                className="text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
