"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Promoter {
  id: string;
  name: string;
  ig_handle: string | null;
  fit_score: number | null;
}

interface Mix {
  id: string;
  title: string;
  soundcloud_url: string | null;
  vibe_tags: string[] | null;
}

interface Props {
  promoters: Promoter[];
  mixes: Mix[];
  preselectedPromoter: string | null;
}

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "ig_dm", label: "IG DM" },
  { value: "ra_dm", label: "RA DM" },
  { value: "in_person", label: "In-person" },
] as const;

type Channel = "email" | "ig_dm" | "ra_dm" | "in_person";

export function PitchForm({ promoters, mixes, preselectedPromoter }: Props) {
  const router = useRouter();
  const [promoterId, setPromoterId] = useState(preselectedPromoter ?? "");
  const [mixId, setMixId] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<
    "idle" | "drafting" | "ready" | "saving" | "saved" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // Reset fields when channel changes
  useEffect(() => {
    if (channel !== "email") {
      setSubject("");
    }
  }, [channel]);

  async function generateDraft() {
    if (!promoterId) return;
    setStatus("drafting");
    setErrorMsg("");
    try {
      const resp = await fetch("/api/pitches/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoter_id: promoterId,
          mix_id: mixId || null,
          channel,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error ?? "Draft failed");
      }
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
      setStatus("ready");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }

  async function savePitch(asSent: boolean) {
    setStatus("saving");
    const resp = await fetch("/api/pitches/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promoter_id: promoterId,
        mix_id: mixId || null,
        channel,
        subject: subject || null,
        pitch_body: body || null,
        status: asSent ? "sent" : "draft",
      }),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      setErrorMsg(data.error ?? "Save failed");
      setStatus("error");
      return;
    }
    setStatus("saved");
    router.push("/pipeline");
  }

  async function copyToClipboard() {
    const text =
      channel === "email" && subject ? `Subject: ${subject}\n\n${body}` : body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function mailtoLink() {
    const promoter = promoters.find((p) => p.id === promoterId);
    const to = promoter?.ig_handle ? "" : "";
    const params = new URLSearchParams({
      subject: subject || "",
      body: body || "",
    });
    return `mailto:${to}?${params.toString()}`;
  }

  const canGenerate = !!promoterId;
  const canSave = !!promoterId && !!body;
  const showSubject = channel === "email";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Promoter select */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-muted-foreground mb-2">
          Promoter
        </label>
        <select
          value={promoterId}
          onChange={(e) => setPromoterId(e.target.value)}
          className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Select a promoter…</option>
          {promoters.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.ig_handle ? ` (@${p.ig_handle})` : ""}
              {p.fit_score != null ? ` — ${p.fit_score}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Mix select */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-muted-foreground mb-2">
          Mix (optional)
        </label>
        <select
          value={mixId}
          onChange={(e) => setMixId(e.target.value)}
          className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">No mix — pitch without link</option>
          {mixes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
              {m.vibe_tags && m.vibe_tags.length > 0
                ? ` — ${m.vibe_tags.join(", ")}`
                : ""}
            </option>
          ))}
        </select>
        {mixes.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            No mixes yet. Add one at <a href="/mixes" className="underline">/mixes</a>.
          </p>
        )}
      </div>

      {/* Channel picker */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-muted-foreground mb-2">
          Channel
        </label>
        <div className="flex gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              onClick={() => setChannel(c.value)}
              className={`text-xs tracking-wider uppercase px-3 py-1.5 rounded border transition-colors ${
                channel === c.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          onClick={generateDraft}
          disabled={!canGenerate || status === "drafting"}
          className="text-xs tracking-wider uppercase bg-secondary text-secondary-foreground px-4 py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {status === "drafting" ? "Generating…" : "Generate Draft"}
        </button>
        {status === "error" && (
          <p className="text-xs text-red-400">{errorMsg}</p>
        )}
      </div>

      {/* Subject (email only) */}
      {showSubject && (
        <div>
          <label className="block text-xs tracking-wider uppercase text-muted-foreground mb-2">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line…"
            className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* Body */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-muted-foreground mb-2">
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="Write your pitch, or generate a draft above…"
          className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
        />
        {body && (
          <p className="text-xs text-muted-foreground mt-1">
            {body.split(/\s+/).filter(Boolean).length} words
          </p>
        )}
      </div>

      {/* Actions */}
      {canSave && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          <button
            onClick={copyToClipboard}
            className="text-xs tracking-wider uppercase px-3 py-1.5 border border-border rounded hover:bg-card transition-colors"
          >
            {copied ? "Copied" : "Copy to Clipboard"}
          </button>

          {channel === "email" && (
            <a
              href={mailtoLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs tracking-wider uppercase px-3 py-1.5 border border-border rounded hover:bg-card transition-colors"
            >
              Open in Mail ↗
            </a>
          )}

          <div className="flex-1" />

          <button
            onClick={() => savePitch(false)}
            disabled={status === "saving"}
            className="text-xs tracking-wider uppercase px-3 py-1.5 border border-border rounded hover:bg-card transition-colors disabled:opacity-40"
          >
            Save as Draft
          </button>

          <button
            onClick={() => savePitch(true)}
            disabled={status === "saving"}
            className="text-xs tracking-wider uppercase bg-primary text-primary-foreground px-4 py-1.5 rounded hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {status === "saving" ? "Saving…" : "Mark as Sent"}
          </button>
        </div>
      )}
    </div>
  );
}
