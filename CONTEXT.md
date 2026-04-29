# Prior Work — Compiled

This is the consolidated state of everything you've already designed, scoped, or built across previous threads, so the new MVP doesn't reinvent any of it. Drop this into the repo as `CONTEXT.md` and point Claude Code at it alongside `PRD.md`.

---

## 1. What exists in code already

### Citizen Science Manager (csm) — local Python CLI
A working Python CLI app you've already built and tested. Lives in your local filesystem, not in `gpt-records`. Modules:

- `core` — config, SQLite database, Pydantic models
- `ai_engine` — dual LLM: Gemma 3 4B local via Ollama + GPT-4o API for strategic generation
- `content_pipeline` — video processing via mcp-video, FFmpeg, faster-whisper, scene detection
- `social` — content calendar, post queue, captions
- `network` — contact CRM with SQLite, follow-up alerts, interaction logging
- `mcp_servers` — FastMCP wrappers for OpenCode/Claude Code integration

CLI commands already working:
```
csm network add <name> --role <role> --venue <venue> --ig <handle> --notes <notes>
csm network list [--status cold|warm|hot|booked|friend]
csm network log <id> <note>
csm network followups
csm ai pitch <context>          # GPT-4o
csm ai followup <context>       # Gemma local
csm ai weekly <status>          # GPT-4o
csm ai bio <updates>            # GPT-4o
csm ai party <idea>             # GPT-4o
csm content queue <type> <text> -p <platform> -d <day>
```

**Key fact:** csm is local-only, single-machine. The new web app (gpt-records) is the hosted version. Decide whether csm stays as a local power-user tool or whether the web app fully replaces it.

### Stageside PRD (v1.0 and v1.1)
A full DOCX PRD already exists from earlier work. Key decisions baked in:

- **Not a marketplace.** Career intelligence + workflow tool. Solo-founder safe.
- **Scope expanded in v1.1** from DJs → DJs + electronic music artists (live hardware acts, modular, Ableton live, experimental).
- **Stack chosen:** Next.js 14 App Router + Tailwind + Supabase Postgres/Auth + Mapbox + Anthropic Claude API + Python scrapers + Go microservices later.
- **Hosting:** Vercel frontend, Linode backend services.
- **Pricing target:** $12/mo entry tier — "less than a Beatport top 10 chart."
- **Wedge product candidate:** Free Tech Rider Generator as a standalone tool to seed the email list before launching the full platform.

The Stageside PRD is the *bigger product vision*. The new `gpt-records` MVP is the *personal tool version* — same architecture, single-user, no monetization, ship in 5 evenings.

---

## 2. Venue & promoter intelligence already gathered

### Tier classification (already validated against RA + scene research)

**Entry tier — start here:**
| Venue | Cap | Booker | Path |
|---|---|---|---|
| Bossa Nova Civic Club | 140 | John Barclay | DM + attend regularly, weeknight slots |
| H0L0 | 150 | ReSolute crew | Network through community |
| Jupiter Disco | 100 | Jupiter team | Guest spots on weeknights |
| Mansions | 100 | Mansions team | DM with mix link |
| Gabriela | 80 | Eli Escobar / Rafael Ohayon | Community presence first |

**Mid tier:**
| Venue | Cap | Booker | Path |
|---|---|---|---|
| Good Room (Bad Room) | 80 | Good Room team | Email demo + DM |
| Elsewhere (Zone One) | 200 | Elsewhere programming | Email submission |
| Paragon | 250 | Paragon team | DM / promoter connection |

**Target tier:**
| Venue | Cap | Booker | Path |
|---|---|---|---|
| Signal | 210 | Nick Spector | Build relationship → pitch |
| Public Records | 350 | PR programming | Email press kit, start with Nursery |

These are already seeded in the csm SQLite DB (or were as of the test run with John Barclay, Nick Spector, ReSolute Crew, etc.). Migrate this into the Supabase `promoters` and `venues` tables on day 1 — it's your seed data.

### Other targets identified earlier
Nowadays, Trans-Pecos, TBA Brooklyn, Basement, plus collectives/parties: Jerome, Unter, Disco Tehran, Kindergarten, Paragon, Mhost Likely, Bound, Technofeminism, Wrecked.

---

## 3. Pitch & outreach templates already drafted

### Voice / system prompts (already version 1)

**Venue pitch system prompt:**
> "You are helping an emerging NYC underground DJ craft a concise, respectful pitch to a venue booker or promoter. The DJ performs as Citizen Science — hardware-focused techno/house with an Octatrack-centered dawless setup. Keep it genuine and non-desperate. Never say 'I would love the opportunity' or anything generic."

**Constraints already locked:**
- Under 100 words for DM/email pitch
- Specific about what you bring
- Hardware live element as differentiator
- End with `[SOUNDCLOUD_LINK]` placeholder

**IG caption system prompt:**
> "You write Instagram captions for an underground electronic music artist called Citizen Science. Tone: authentic, slightly mysterious, not try-hard. NYC scene insider. Never use excessive emojis or hashtag spam."

**Other prompt categories defined:** `mix-description`, `event-concept`, `weekly-plan`, `track-analysis`.

Port these system prompts directly into `/apps/web/lib/prompts/` in the new repo.

### Outreach template structure (from earlier n8n design)

Three template tiers already designed:
1. **Initial cold** — first contact
2. **Follow-up warm** — 7-14 day nudge with new mix
3. **Hot reply** — fee, set length, tech rider, promo offer

Decision logic from n8n design:
```
fit_score > 80 + status=target  → high personalization, manual review
fit_score > 60                  → medium personalization, semi-auto
fit_score < 60                  → queued, wait for higher priority

Rate limits: 10 emails/day, 50/week
```

Reuse this logic in the new pipeline engine but keep the no-autosend rule from the new PRD — manual review on everything for v1.

---

## 4. Positioning & differentiation (already locked)

**Citizen Science's actual differentiator:**
> Hybrid live/DJ set — live synths (Octatrack, Digitakt, SH-4d) over records on Technics through a Xone:92. Most DJs at target venues are pure selectors. Position as a live electronic act, not just another DJ.

This goes in your bio, your pitch templates, and the LLM system prompt. It's the only line in every outbound message that doesn't change.

**Bio one-liner (already drafted):**
> "Citizen Science is a Brooklyn-based live hardware and DJ performing techno and house"

---

## 5. Six-month gigging plan (already exists, partially executed)

The earlier strategy thread laid out a month-by-month plan. Adapted to current state (April 2026):

**Already done / in progress:**
- Recording live hardware sets ✓
- SoundCloud / RA / IG profiles ✓
- First cocktail party popup gig played ✓
- Production work on EP ("The Vision," "Feels Like Gold," "White Horizon," "Void of Space") ✓
- Label setup (Florida LLC, DistroKid + Label Worx, Bandcamp) in motion ✓

**Not yet done / blocked by tooling:**
- Systematic outreach to 10+ venues
- Tracked follow-up cadence
- Scene presence at target venues
- Open decks / b2b appearances

The new app exists to unblock the second list.

---

## 6. Competitor landscape (already mapped)

Don't re-research these. Findings:

- **HoneyBook / DJ Intelligence** — corporate/wedding DJ market. N/A.
- **Gigmit** — broken two-sided marketplace, 2-star Trustpilot, lock-in contracts.
- **Booking-Agent.io** — $50/mo contact lookup, no workflow, no scene intel.
- **Resident Advisor** — serves promoters/venues, not artists. No "get booked" flow.
- **EMOM / open mics** — grassroots only, exists in a few cities.
- **Cueup / Djaayz / GigSalad** — corporate/wedding. No live act category.

The gap: there is no tool that combines venue intelligence + scene context + AI outreach + relationship CRM for underground electronic artists. That's still the gap. It's still real.

---

## 7. Decisions already made (don't relitigate)

- Web app, not desktop CLI, for the new build
- Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui
- Supabase Postgres + Supabase Auth (magic link, single email)
- Anthropic Claude API for all LLM calls (drop GPT-4o + Gemma for hosted version)
- GitHub Actions for scheduled scrapers (not Netlify Functions)
- No autosend, ever — every outbound message is human-reviewed
- Email via mailto for cold first touches, Resend/Postmark for follow-ups later
- Manual IG review only in v1 — no scraping
- Resend dual-LLM architecture for v2 only if Claude alone is insufficient

---

## 8. Open questions to resolve before evening 1

1. **What's the current state of `gpt-records`?** Is there a Next.js app there already, or just a README? Does it have the Stageside-style architecture or is it a clean slate? (Need to look at the repo to know.)
2. **csm coexistence:** does the new app replace csm entirely, or do they share the same DB and you keep csm as a power-user CLI? Recommend: web app uses Supabase, csm stays local with its own SQLite, no sync. Eventually port csm features to web.
3. **Seed data migration:** export current csm contacts → JSON → seed script for Supabase. ~5-10 contacts already exist.
4. **Claude API key + Supabase project:** create both before evening 1 starts. Add to Netlify env vars.

---

## 9. What to feed Claude Code on day 1

Three files in the repo root, in this order:
1. `PRD.md` — the v1 spec for the new app
2. `CONTEXT.md` — this document
3. `claude.md` — instruction file: "build only what's specced for the current evening, don't add scope, prefer smallest working solution, ask before adding dependencies"

Then start with evening 1 of the build order.
