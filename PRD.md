# Citizen Science Booking Agent — PRD

**Owner:** Michael (Citizen Science)
**Goal:** Ship a working MVP in 3–5 evenings of vibecoding via Claude Code, deployed to Netlify, that turns NYC underground booking outreach from a vague aspiration into a tracked pipeline.
**North star metric:** First real booking conversation (promoter replies with intent to book) within 60 days of MVP going live.

---

## 1. Problem

Booking outreach for an emerging underground DJ has three failure modes:

1. **No target list.** You don't know which of NYC's ~100 active promoters actually book artists at your level and sound.
2. **No pipeline.** Pitches go out as one-offs, follow-ups get dropped, scene conversations evaporate.
3. **No feedback loop.** You can't tell which pitches work because nothing is measured.

This tool fixes all three. It is not an AI agent that books gigs autonomously. It is a CRM with scraped scene intelligence and LLM-assisted drafting, where the human stays in the loop on every send.

## 2. Non-goals

- Auto-sending messages. Every outbound message is human-reviewed.
- Instagram automation. Manual review only in v1.
- Booking artists other than yourself. Single-user app.
- Mobile-native. Responsive web is enough.
- Auth/multi-user. Single-user, password-gated, single Netlify deploy.

## 3. Users

One user: you. The app assumes you're the artist, the manager, and the operator.

## 4. Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui.
- **Backend:** Next.js API routes for the app surface; a separate Python scraper service for Resident Advisor and venue calendars.
- **DB:** Postgres via Supabase (free tier). Switch from SQLite because Netlify is stateless and you need a hosted DB anyway.
- **Auth:** Supabase Auth, magic link, single allowed email.
- **LLM:** Anthropic API (Claude) for pitch drafting and fit reasoning. OpenAI optional later. Local Gemma drops out of scope for the hosted version.
- **Hosting:** Netlify for the Next.js app. Scrapers run as scheduled GitHub Actions writing to Supabase (simpler than Netlify Functions for this; cron is built in and you get logs).
- **Repo layout:**
  ```
  /apps/web         Next.js app
  /services/scraper Python scraper, run by GH Actions
  /packages/db      Shared schema, migrations (drizzle or supabase migrations)
  ```

## 5. Data model

Postgres schema. Names match what we discussed; types tightened for Postgres.

```sql
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  neighborhood text,
  capacity_estimate int,
  sound_system_notes text,
  website text,
  ra_url text,
  ig_handle text,
  created_at timestamptz default now()
);

create table promoters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  ig_handle text,
  ra_url text,
  email text,
  website text,
  sound_tags text[],
  notes text,
  fit_score numeric,
  first_seen date,
  last_active date,
  manual_ig_reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  ra_id text unique,
  date date not null,
  venue_id uuid references venues(id),
  promoter_id uuid references promoters(id),
  title text,
  lineup_raw text,
  description text,
  ticket_url text,
  scraped_at timestamptz default now()
);

create table artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text unique not null,
  ra_url text,
  soundcloud_url text,
  sound_tags text[],
  follower_estimate int,
  times_booked_nyc int default 0
);

create table event_artists (
  event_id uuid references events(id) on delete cascade,
  artist_id uuid references artists(id) on delete cascade,
  slot_position int,
  primary key (event_id, artist_id)
);

create table mixes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  release_date date,
  soundcloud_url text,
  duration_minutes int,
  bpm_range text,
  vibe_tags text[],
  notes text
);

create table pitches (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid references promoters(id),
  mix_id uuid references mixes(id),
  channel text check (channel in ('email','ig_dm','ra_dm','in_person')),
  template_version text,
  subject text,
  body text,
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  status text check (status in ('draft','sent','opened','replied','booked','declined','ghosted')),
  outcome_notes text,
  follow_up_due date
);

create table scene_interactions (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid references promoters(id),
  event_id uuid references events(id),
  date date not null,
  location text,
  conversation_notes text,
  follow_up_due date,
  follow_up_done boolean default false
);

create table briefs (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid references promoters(id),
  generated_at timestamptz default now(),
  content text not null
);
```

## 6. Scraper service

Python, runs as GitHub Action on schedule. Writes via Supabase REST API or direct Postgres connection.

**Scrapers to build:**

1. **`ra_events.py`** — Paginates RA's NYC listings (`https://ra.co/events/us/newyork`). Pulls 60 days forward. Upserts events. Runs daily at 6am UTC.
2. **`ra_promoter.py`** — Given a promoter slug, pulls their full event history. Run on-demand via repo dispatch or weekly for known promoters.
3. **`venue_calendars.py`** — Site-specific parsers for Public Records, Nowadays, Elsewhere, Good Room. Registry pattern: each venue has a `parse(html) -> List[Event]` function. Runs daily.

**Implementation notes:**
- Use `httpx` + `selectolax` (faster than BS4).
- 1 req / 2sec, real user agent, retry on 429.
- All scrapers idempotent — upsert on `ra_id` or `(venue_id, date, title)`.
- Lineup parsing: regex split on common separators (`,`, `b2b`, `|`, `+`, `/`), then normalize each name (lowercase, strip whitespace, remove "live"/"DJ set" suffixes).
- Artist dedup: `normalized_name` is `lower(regexp_replace(name, '[^a-z0-9]', '', 'g'))`. Manual merge UI in app for ambiguous cases.

## 7. App surface

Pages, in build order:

### `/promoters` — the core view
- Sortable table: name, sound tags, last active, fit score, # of pitches sent, last contact, status.
- Filters: sound tag, venue worked with, recent activity (last 30/60/90 days), pitch status.
- Click promoter → detail page.

### `/promoters/[id]` — promoter detail
- Header: name, IG handle, RA link, contact info.
- "Recent events booked" — last 12 events from `events` joined through `promoter_id`.
- "Artists they book" — aggregated from `event_artists` across their events, with sound tags.
- "Pitch history" — every pitch sent, status, response.
- "Scene interactions" — every logged conversation.
- "Generate brief" button → calls `/api/briefs/generate` → Claude API summarizes everything into a one-page dossier for pre-party prep.
- "Draft pitch" button → opens pitch composer.

### `/pitch/new` — pitch composer
- Select promoter (or pre-filled from promoter page).
- Select mix to attach.
- Channel picker (email / IG DM / RA DM / in-person note).
- Claude API generates first draft based on: promoter's recent lineup, your bio, the selected mix's vibe tags, the channel's tone constraints. Uses a system prompt that bakes in "no LLM slop tells" — no "I hope this email finds you well", no "I'm reaching out because", direct and specific.
- You edit, you send manually (copy to clipboard or "open in Mail" link), you mark sent.

### `/pipeline` — kanban view
- Columns: Drafted / Sent / Opened / Replied / Booked / Declined / Ghosted.
- Drag to update status.
- Auto-flag follow-ups due (7 days no reply → soft nudge; 21 days → archive prompt).

### `/events` — what's coming up in the scene
- Calendar/list view of upcoming NYC events from `events`.
- Filter by promoter, venue, sound tag.
- "Going" toggle — adds it to your scene-presence list.
- Pre-event: surfaces brief for that promoter.
- Post-event: prompts you to log interactions.

### `/mixes` — your output cadence
- List of mixes with release dates.
- Days-since-last-mix counter (target: ≤ 42 days).
- Per-mix: how many pitches it's been attached to, response rate.

### `/dashboard` — Sunday-night digest
- Pipeline metrics: pitches sent this week, response rate over last 30 days, bookings YTD.
- This week's target parties (with briefs ready).
- Follow-ups due.
- Mix cadence status.
- Top 5 promoters by fit score you haven't pitched yet.

## 8. LLM features

Three Claude calls in v1, all from Next.js API routes:

1. **`POST /api/briefs/generate`** — Input: promoter_id. Pulls last 12 events, their lineups, your notes. Output: one-page brief with sections: who they are, what they sound like, who they book, conversation hooks, why you fit. Cached in `briefs` table; regenerate on demand.

2. **`POST /api/pitches/draft`** — Input: promoter_id, mix_id, channel. Output: draft subject + body. System prompt enforces voice (yours, from a stored bio + 2-3 sample messages you've actually sent), no slop phrases, references one specific recent event of theirs.

3. **`POST /api/promoters/score-fit`** — Input: promoter_id. Output: 1-10 fit score + reasoning, written to `promoters.fit_score`. Considers: sound tag overlap, BPM range overlap, capacity range, frequency of booking artists at your follower level.

System prompts for all three live in `/apps/web/lib/prompts/` as TypeScript constants, version-controlled, easy to iterate.

## 9. The honest constraints, baked in

- **No autosend.** Every pitch is reviewed. The "Send" button copies to clipboard or opens mailto/IG; you do the actual send. This is a feature, not a limitation.
- **Manual IG review.** Promoters with `manual_ig_reviewed_at` older than 30 days get flagged. The app reminds you to spend 20 min/week scrolling.
- **Scene presence is tracked but not automated.** The dashboard shows "parties attended this month: 3 / target 6" and that's the nudge.

## 10. Build order — 5 evenings

**Evening 1: skeleton + DB**
- Next.js app scaffolded, deployed to Netlify, Supabase connected.
- Schema migrated.
- Magic-link auth gating single email.
- Empty `/promoters` page rendering from DB.

**Evening 2: scraper v1**
- `ra_events.py` running locally, then as GH Action.
- 60 days of NYC RA events in DB.
- Lineup parsing + artist dedup working end to end.
- Promoters auto-created from event hosts.

**Evening 3: app core**
- `/promoters` table + filters.
- `/promoters/[id]` detail page with event/artist history.
- `/events` calendar view.

**Evening 4: pitch pipeline**
- `pitches` schema + `/pitch/new` composer.
- Claude API draft endpoint working.
- `/pipeline` kanban.
- Manual "mark sent" / "log reply" flows.

**Evening 5: briefs + dashboard + polish**
- Brief generation endpoint + UI.
- Fit scoring batch job.
- `/dashboard` Sunday digest.
- Venue calendar scrapers for Public Records + Nowadays.
- Deploy, smoke test, send first real pitch.

## 11. Out of scope for MVP, candidates for v2

- Email tracking pixels for open detection.
- SoundCloud play count integration.
- Instagram scraping (any form).
- Auto-suggest target promoters based on a new mix's vibe tags.
- Multi-city expansion (Berlin, Detroit).
- Mobile app.
- Outreach to labels, blogs, mix series — different pipeline, different schema.
- Booking contract / fee tracking.

## 12. Risks

- **RA changes their HTML.** Mitigation: scraper has thin parsing layer, alert on parse failures via GH Action notifications.
- **You build it and don't use it.** Mitigation: Sunday digest email forces weekly engagement. If you don't open it for 3 weeks, the project is failing for non-technical reasons and no amount of code will fix it.
- **LLM-drafted pitches sound generic.** Mitigation: prompt includes 2-3 of your real past messages as voice examples; you review and rewrite every send for the first 10 pitches before trusting the template.
- **Supabase free tier limits.** Unlikely to hit at single-user scale, but monitor row counts.

## 13. Success criteria

- 30 days post-launch: 50+ promoters in DB with fit scores, 10+ pitches sent, dashboard checked weekly.
- 60 days post-launch: first promoter reply with booking intent.
- 180 days post-launch: 1-3 confirmed bookings at target venues.

If 30-day metrics aren't hit, the problem isn't the tool — it's usage. Revisit before building more features.
