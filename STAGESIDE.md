# Stageside — Product Spec (v2)

**Owner:** Michael (Citizen Science)
**Repo:** `gpt-records` (rename to `stageside`)
**Mission:** Get Michael booked at NYC underground venues by running the full DJ career operating system in one place — booking pipeline, content engine, and social metrics all feeding each other.
**Success metric:** First confirmed booking at a target NYC venue within 90 days of launch.

---

## 1. The integrated theory

A booking pitch at the NYC underground level isn't just an email — it's the email plus what the promoter sees when they click your IG. If your last post was 6 weeks ago, the pitch dies. If your SoundCloud has 200 plays on the last mix, you're a hobbyist. If your IG shows you in the room at Bossa Nova last weekend, you're already part of the scene.

So Stageside has three loops, not one, and they all reinforce each other:

1. **Booking loop** — discover promoters, research, pitch, follow up, show up.
2. **Content loop** — record performances, cut clips, schedule posts, track metrics, repeat.
3. **Scene loop** — attend parties, log conversations, follow up on real-world contacts.

Pitches reference recent posts and recent mixes. Content gets seeded with venue tags from upcoming pitches. Scene interactions surface as content prompts ("posted from H0L0 last night, log who you talked to"). Metrics from socials become evidence in pitches ("3.2k IG followers, last mix has 1.4k SC plays"). One product, three loops, one north star: get booked.

## 2. What this is and isn't

**Is:** A single-user web app (cloud) plus a local CLI (Mac) that work together. The web app is the planning, tracking, and lightweight surface. The CLI is the heavy local processing.

**Isn't:** A SaaS, a marketplace, or a fully autonomous agent. Every outbound message and every social post is human-reviewed.

## 3. Architecture — split brain, shared memory

```
┌─────────────────────────────────────────────────────────────────┐
│                  CLOUD HALF (Netlify + Supabase)                │
│                                                                 │
│  Next.js 14 App Router                                          │
│    /dashboard /promoters /pitch /pipeline /events               │
│    /content /clips /calendar /metrics /tech-rider               │
│                                                                 │
│  Supabase                                                       │
│    Postgres (CRM, pipeline, scheduled posts, metrics history)   │
│    Storage (clip files, thumbnails, mix art, tech rider PDFs)   │
│    Auth (magic link, single user)                               │
│                                                                 │
│  GitHub Actions (cron)                                          │
│    Scrapers (RA, venue calendars, contact discovery)            │
│    Metrics fetchers (SC, YT, TikTok, IG public)                 │
│    Follow-up triggers, weekly digest                            │
│                                                                 │
│  Anthropic Claude API                                           │
│    Pitch drafts, briefs, captions, fit scoring                  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │  Supabase Storage + REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL HALF (Mac, csm CLI)                    │
│                                                                 │
│  Python CLI (existing csm, refactored)                          │
│    ingest    — drop video in, runs full pipeline                │
│    clips     — generate N clips from one video                  │
│    upload    — push artifacts to Supabase                       │
│    sync      — pull caption drafts back, etc.                   │
│                                                                 │
│  Heavy tools                                                    │
│    FFmpeg, faster-whisper, scene detection                      │
│    Ollama (local Gemma for caption candidates, fast/cheap)      │
│                                                                 │
│  Local SQLite (working state, not source of truth)              │
└─────────────────────────────────────────────────────────────────┘
```

**Source of truth:** Supabase. Local SQLite is a working cache that syncs up.

**Why split:** Video processing on Netlify is impossible (10s timeouts, stateless FS). Scheduling and metrics on a Mac that might be asleep is unreliable. Each half does what it's good at.

## 4. The product surface (cloud half)

Pages, in build order:

### `/dashboard` — Sunday digest
- **Booking:** pitches sent this week, response rate (30d), bookings YTD
- **Content:** posts published this week, days since last post per platform, top-performing post (last 30d)
- **Metrics:** total followers across platforms (delta from last week), top-growing platform, mix plays delta
- **Scene:** parties attended this month vs target (6/mo)
- **Action items:** follow-ups due, posts scheduled today, target parties this week with briefs ready, next clip to post

### `/promoters` and `/promoters/[id]`
Same as v1. The detail page now also surfaces: "Recent posts that mention this venue," "Posts where you're at this neighborhood." Pitch drafts get richer because the LLM can pull recent post engagement as evidence.

### `/pitch/new`
Same as v1, but the LLM context now includes: top-performing recent post, latest mix with play count, total follower count. The AI can write "my last mix on SoundCloud just crossed 1k plays" because that data is real and current.

### `/pipeline`
Kanban. Same as v1.

### `/events`
RA scrape + "Going" toggle. Triggers content prompts: "You're going to H0L0 Friday — schedule a story post."

### `/content` — The content hub (NEW)
This is where the CSM merge lives.

**Sections:**
- **Library:** all clips from `clips` table, filtered by source video, format, date, used/unused. Thumbnail grid.
- **Drafts:** clips with caption drafts ready, awaiting your edit + scheduling.
- **Queue:** scheduled posts, by platform, by date.
- **Published:** posts that went out, with current metrics.

**Filters:** platform (IG / TikTok / YT / SC), format (reel, story, post, full mix), tag, performance tier (top/mid/low based on engagement).

### `/clips/[id]` — Single clip detail
- Video preview (streamed from Supabase Storage)
- Source video, time range, scene detection metadata
- Whisper transcript
- Caption candidates (3-5 generated by Claude based on transcript + your bio)
- "Refine caption" button → Claude regenerates with your edits as context
- Schedule button → opens scheduler modal (platform, date/time)
- "Post now" → manual flow: copies caption, opens platform app

### `/calendar` — Content calendar
- Weekly/monthly view of scheduled and published posts across all platforms
- Drag to reschedule
- Color-coded by platform
- "Gap warnings" when there are 3+ days with no posts on a platform
- Optimal-time hints based on past engagement (e.g., "Tuesdays 7pm get 2.3x your average")

### `/metrics` — Cross-platform dashboard
Aggregated view of:
- **Followers:** time series, all platforms, with weekly/monthly deltas
- **Engagement:** likes/comments/shares per post, average per platform, trend
- **Mix performance:** SoundCloud plays, YouTube views, completion rates where available
- **Per-post breakdown:** every published post with its current metrics, sortable
- **Top content:** what's worked best, by format and topic, last 90 days

Data is fetched by the `metrics_fetcher` GH Actions on schedule, stored in `metrics_snapshots` table for time-series.

### `/mixes`
Same as v1 with metrics overlay (SC plays, YT views).

### `/tech-rider`
Same as v1.

### `/scene`
Activity feed: new RA events, new SoundCloud uploads from tracked promoters, your own scheduled posts, your own published posts with engagement.

## 5. Data model — additions over v1

Existing tables from v1 (`venues`, `promoters`, `events`, `artists`, `event_artists`, `mixes`, `pitches`, `scene_interactions`, `briefs`, `tech_riders`) — unchanged.

New tables:

```sql
create table source_videos (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  recorded_at timestamptz,
  duration_seconds int,
  format text,                          -- live_set, studio_jam, b_roll
  venue_id uuid references venues(id),  -- if shot at a venue
  storage_path text,                    -- supabase storage key, original
  ingested_at timestamptz,
  notes text
);

create table clips (
  id uuid primary key default gen_random_uuid(),
  source_video_id uuid references source_videos(id) on delete cascade,
  start_seconds numeric,
  end_seconds numeric,
  duration_seconds numeric generated always as (end_seconds - start_seconds) stored,
  storage_path text,                    -- supabase storage key, the cut clip
  thumbnail_path text,
  transcript text,
  scene_score numeric,                  -- from scene detection, "interestingness"
  format text check (format in ('reel','story','tiktok','yt_short','post')),
  vibe_tags text[],
  generated_at timestamptz default now()
);

create table caption_drafts (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid references clips(id) on delete cascade,
  text text not null,
  hashtags text[],
  generated_by text,                    -- 'claude' or 'gemma_local'
  generated_at timestamptz default now(),
  is_chosen boolean default false
);

create table scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid references clips(id),
  caption_draft_id uuid references caption_drafts(id),
  platform text check (platform in ('instagram','tiktok','youtube','soundcloud','twitter')),
  format text,                          -- reel, story, post, short
  scheduled_for timestamptz not null,
  status text check (status in ('scheduled','ready','published','skipped','failed')),
  published_at timestamptz,
  external_post_id text,                -- platform's ID, for metrics lookup
  external_url text,
  notes text
);

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  handle text not null,
  account_url text,
  api_credentials jsonb,                -- tokens, encrypted
  last_synced_at timestamptz,
  unique (platform, handle)
);

create table metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references social_accounts(id),
  post_id uuid references scheduled_posts(id),  -- nullable for account-level snapshots
  captured_at timestamptz default now(),
  followers int,
  following int,
  total_posts int,
  likes int,
  comments int,
  shares int,
  views int,
  plays int,                            -- for SC mixes
  saves int,
  reach int,
  metadata jsonb                        -- platform-specific extras
);

create index idx_metrics_account_time on metrics_snapshots(account_id, captured_at desc);
create index idx_metrics_post_time on metrics_snapshots(post_id, captured_at desc);
```

## 6. The local CLI — csm refactored

Existing `csm` codebase keeps the heavy modules (`content_pipeline`, `ai_engine` for local Gemma), drops the modules that now live in the web app (`network`, `social` calendar, parts of `core`).

**New csm command surface:**

```
csm ingest <video_path> [--format live_set|studio_jam|b_roll] [--venue <name>]
   → Uploads original to Supabase Storage
   → Creates source_videos row
   → Triggers full pipeline: scene detection, transcription, clip generation
   → Reports back: "Generated 7 candidate clips, view in web app"

csm clips generate <source_video_id> [--count 5] [--format reel]
   → Re-runs clip generation with different params
   → Useful when first pass missed good moments

csm clips export <clip_id>
   → Downloads a clip back to local disk for manual editing in DaVinci/Premiere

csm sync
   → Two-way sync: pulls down caption drafts to refine locally if you want
   → Pushes up any local changes
   → Syncs metrics snapshots if local fetcher ran

csm post <scheduled_post_id>
   → For when you're at the laptop and want to manually trigger
   → Copies caption to clipboard, opens platform URL in browser
   → Marks status='published' after you confirm

csm metrics fetch [--platform <p>]
   → Local fallback for metrics fetching
   → Useful for platforms where the API needs OAuth that's easier from laptop
```

**Pipeline internals (already exist in csm, just retargeted):**

1. **Scene detection** — PySceneDetect identifies cuts. For a DJ set this finds energy shifts, drops, transitions.
2. **Whisper transcription** — faster-whisper gets timestamps for any vocals/announcements (rare for DJ sets, common for studio jam talkthroughs).
3. **Clip selection** — heuristic + Gemma-scored: pick N moments that are visually distinct, audio-energetic, and (if applicable) contain quotable transcript snippets. For a DJ set: bias toward drops and transitions. For a studio jam: bias toward moments with audible new elements coming in.
4. **Cutting** — FFmpeg cuts clips to spec (9:16 reel format default, 60s max for reels, 30s for stories, 15s for TikTok hooks).
5. **Thumbnail generation** — FFmpeg pulls the most visually-interesting frame.
6. **Caption candidates** — local Gemma generates 3 caption candidates per clip in your voice. Web app generates 1-2 more with Claude when you open the clip detail page (better quality, costs API credits, only on-demand).

**Why local Gemma for first-pass captions:** captioning 7 clips per video × Claude API = real money over time. Gemma running locally on your Mac is free and fast enough. You only burn Claude tokens when you're refining a caption you've decided to actually post.

## 7. Posting infrastructure — honest options

**Phase 0 default: assisted manual posting.**
- App tells you which clip is scheduled for which platform at what time
- Push notification (or email) at scheduled time
- One click: caption copied to clipboard, platform deeplink opened
- You tap post in the platform app
- 20 seconds per post, zero risk of TOS issues

**Phase 0.5: Buffer / Later integration.**
- After 4 weeks of manual posting validates the workflow
- $15-30/mo to outsource the actual API call
- Stageside writes to Buffer's API, Buffer posts to Meta/TikTok/YT
- Trustworthy, official, costs money

**Never: headless browser automation.**
- Plays Whack-a-mole with platform anti-bot systems
- Account ban risk is real
- Not worth it

**Direct Meta Graph API (later, optional):**
- Instagram Business account + FB Page link required
- Once set up, can post reels and feed posts via API
- Stories are more restricted
- Worth it once you're posting 5+/week

For Phase 0, build the manual posting flow well. The push-notification + clipboard-copy + deeplink experience can be elegant if it's done right.

## 8. Metrics fetching — what's actually possible

| Platform | API | Requires | Reliability |
|---|---|---|---|
| SoundCloud | REST API, OAuth | App registration | Good, stable |
| YouTube | Data API v3 | Google Cloud project | Good, stable |
| TikTok | Display API | Developer registration | Limited fields, OK |
| Instagram | Graph API | Business account + FB Page | Good once set up, painful to set up |
| Bandcamp | No public API | — | Scrape public profile pages, fragile |
| Twitter/X | Paid API only | $100/mo+ | Not worth it |

Build metrics fetchers in priority order: SoundCloud first (most important for DJ credibility), then YouTube (mix uploads), then TikTok, then IG (only after Business account is set up). Bandcamp is best-effort scraping. Skip Twitter.

Each fetcher is a GH Action job in `/services/scraper/jobs/metrics_*.py`, snapshots into `metrics_snapshots` daily.

## 9. LLM endpoints — additions over v1

All Claude Sonnet, all in `/apps/web/lib/prompts/`.

### `POST /api/captions/generate`
**Input:** clip_id (uses transcript, video metadata, your bio)
**Output:** 2 polished caption candidates with hashtag sets
**System prompt (port from csm):**
> "You write Instagram captions for an underground electronic music artist called Citizen Science — Brooklyn-based hybrid live/DJ act using Octatrack, Digitakt, SH-4d. Tone: authentic, slightly mysterious, not try-hard. NYC scene insider. Never use excessive emojis or hashtag spam. Under 80 words. 3-5 relevant hashtags. Make it feel like a real person in the scene, not a brand."

### `POST /api/content/strategize`
**Input:** date range, upcoming events, recent post performance
**Output:** content plan for next 7 days — what to post, what platform, what time, why
**System prompt:** "You are a content strategist for an emerging DJ. You understand the algorithm dynamics of IG Reels (consistency + first 3 seconds), TikTok (hook + sound trends), and SoundCloud (mix length + tagging). Generate a specific 7-day plan that ties to the artist's upcoming events and current content library."

### `POST /api/metrics/insights`
**Input:** last 30/90 days of metrics snapshots
**Output:** 3-5 specific observations and recommendations (which posts performed, what time of day works, what format is winning)
**Caching:** generated weekly, stored in DB, surfaced on `/metrics`

## 10. Build order — revised, 8 evenings

The merge expands scope. Plan accordingly.

**Evening 1: Foundation (cloud)**
- Next.js scaffold, Supabase, schema (v1 tables only — no clips yet), auth, deploy
- Seed JSON imported

**Evening 2: Booking core**
- `/promoters` + detail page
- RA scraper running as GH Action
- 60 days of NYC events in DB

**Evening 3: Pitch pipeline**
- `/pitch/new` + Claude draft endpoint
- `/pipeline` kanban
- Briefs

**Evening 4: Content schema + Storage**
- Add `source_videos`, `clips`, `caption_drafts`, `scheduled_posts`, `social_accounts`, `metrics_snapshots` tables
- Supabase Storage bucket setup with RLS
- `/content` library page (read-only first, lists rows from DB)

**Evening 5: csm refactor + ingest**
- Strip csm to content pipeline + ai_engine
- Implement `csm ingest` end-to-end: video → scenes → clips → upload → DB rows
- Test with a real recording you have lying around
- Verify clips show up in `/content`

**Evening 6: Caption generation + scheduling**
- Local Gemma caption candidates during ingest
- `/clips/[id]` detail page with caption editor
- Claude refinement endpoint
- Scheduler modal, writes to `scheduled_posts`
- `/calendar` view

**Evening 7: Manual posting flow + first metrics fetcher**
- Notification system (email digest morning of, or browser push)
- Deeplink + clipboard copy on post action
- "Mark as published" + capture external URL
- SoundCloud metrics fetcher (GH Action), populates `metrics_snapshots`
- Basic `/metrics` page showing SC followers + mix plays

**Evening 8: Tech rider + dashboard + first send**
- Tech rider builder + react-pdf
- `/dashboard` integrated digest (booking + content + metrics + scene)
- YT metrics fetcher
- Send first real pitch
- Schedule first post

Evenings 1-3 are the v1 spec. Evenings 4-8 are the merge. If life gets busy, you have a usable booking tool after evening 3 and can continue the content side in parallel.

## 11. Phase 0.5 — added if used 2+ weeks

- Buffer/Later integration for actual auto-posting
- TikTok + IG metrics fetchers (after IG Business account setup)
- Content strategist endpoint
- Cross-loop integrations: pitches reference recent post performance, content prompts triggered by upcoming events
- Bandcamp scraping
- Optimal posting time analysis from your own data

## 12. Phase 1 — multi-tenant SaaS

Same gate as before: Phase 0 must produce 1+ booking and weekly usage for 60+ days. Then revisit the Stageside v1.1 SaaS PRD.

## 13. Risks specific to the merged scope

**Scope creep across two products.** The booking pipeline and the content engine are each big enough to fail on their own. The discipline: build evenings 1-3 (booking) to a usable state before touching evening 4. Don't half-build both halves.

**Local CLI dependency.** If your Mac is the only place that processes video, you're stuck without it. Mitigation: keep originals in Supabase Storage so any Mac with csm checked out can re-run the pipeline. Don't lose source videos.

**Caption fatigue.** Generating 5 captions per clip × 5 clips per video × weekly cadence = a lot of caption editing. Mitigation: ruthlessly cut captions to one polished one per post. Don't try to publish 5 versions of the same clip.

**Metrics ≠ insight.** Tracking follower counts is satisfying and meaningless. Mitigation: the `/metrics` page surfaces only metrics that have a job — promoter pitch evidence, content strategy decisions, gap warnings. No vanity dashboards.

**The cost of perfection.** A 4k 60fps DJ set takes forever to process. Mitigation: csm processes a 720p proxy by default, originals stay archived. Clips are 1080p, fine for IG/TikTok.

## 14. What's still not in scope

Phase 0 of the merged product still excludes:
- Multi-user
- South Florida
- Mapbox
- Stripe
- Direct DM/comment management (no inbox unification)
- AI agents that send anything autonomously
- Set tracking / playlist features (separate project, lives in your Laravel app)
- Label management / Bandcamp release flow (separate project)
- Beets/Rekordbox integration (separate project)

## 15. Success criteria — updated

- **30 days:** 50+ promoters in DB. 10+ pitches sent. 8+ posts published across platforms (target: 2-3/week per active platform). Dashboard checked weekly. 4+ target parties attended.
- **60 days:** First promoter reply with booking intent. 20+ pitches sent. 25+ posts published. Tech rider PDF used in real outreach. SoundCloud play growth visible in metrics.
- **90 days:** First confirmed booking at a target NYC venue. Post cadence sustained.
- **180 days:** 1-3 confirmed bookings. Decision point on Phase 1 SaaS.

If 30-day metrics aren't hit, stop adding features and audit usage.
