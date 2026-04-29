# claude.md — Rules of engagement for Claude Code

## What this project is

Stageside is Michael's personal DJ career operating system. It exists for one reason: to get him booked at NYC underground venues this summer, or to help him throw his own event if bookings don't come fast enough. Read `STAGESIDE.md` for the full spec. Read `CONTEXT.md` for what already exists from prior threads.

This is not a SaaS. It is not a product for other users. There is one user. Build accordingly.

## How to work in this repo

### The unit of work is one evening

The build plan in `STAGESIDE.md` is divided into 8 evenings. Each evening is the unit of autonomous work. Within an evening, work continuously and aggressively — handle rate limits, retry, work around blockers, ship the deliverables for that evening end-to-end.

**Between evenings: stop and wait.** Do not start the next evening's work until Michael has verified the previous one works in production. Schema decisions and auth flows cascade; building eight evenings without checkpoints produces a working app that's subtly wrong everywhere.

When you finish an evening:
1. Commit and push.
2. Deploy to Netlify.
3. Write a short summary of what shipped, what's tested, what isn't, and what Michael needs to verify before evening N+1 starts.
4. Stop.

### The unit of correctness is "Michael could send a real pitch tonight"

By end of evening 3, the booking tool must be usable enough that Michael could draft and send a real pitch. By end of evening 8, the full system. Each evening compounds toward that — features that don't move toward "send the real pitch" don't ship in Phase 0.

If you find yourself building infrastructure that doesn't connect to a path that gets Michael booked, stop and ask.

### Scope discipline

- Build only what's specced for the current evening. Do not preemptively scaffold for future evenings.
- If the spec is ambiguous, prefer the smallest working version. Do not add fields, abstractions, or services that "might be useful later."
- If you think the spec is wrong, say so explicitly in your evening summary. Do not silently rewrite it.
- Do not add new dependencies without flagging them in the summary. Use what's in the stack: Next.js, Tailwind, shadcn/ui, Supabase client, Anthropic SDK. That covers 95% of needs.
- Do not introduce new frameworks. No tRPC. No Prisma. Use Supabase's generated types and direct queries. Speed over purity.

### Stopping conditions within an evening

You should stop and ask Michael (rather than working around) when:
- A schema decision needs to change in a way that breaks data already in the DB.
- An external service requires credentials or setup he hasn't done (Supabase project creation, Netlify deploy hooks, Anthropic API key, GitHub Actions secrets).
- The spec contradicts itself.
- A scraping target's structure has changed in a way that requires re-scoping the scraper.
- You need to spend money (paid API tier, paid service signup).
- You're about to delete or migrate data already in production.

You should NOT stop for:
- Rate limits — wait and retry.
- Test failures you can fix.
- Linting/formatting issues.
- Decisions about UI styling, copy, or component layout — make a reasonable call and note it in the summary.
- Library API questions answerable by reading docs.

### Code style

- TypeScript strict mode. No `any`.
- Server components by default in the Next.js app. Use `'use client'` only where state or effects are required.
- Tailwind for styling. shadcn/ui components for primitives. No additional component libraries.
- Direct Supabase queries from server components and route handlers. No ORM layer.
- Python: 3.11+, type hints, `httpx` over `requests`, `selectolax` over BeautifulSoup for scraping.
- Keep functions small. If a file is over 300 lines, it's probably wrong.
- No comments explaining what code does. Comments only for *why* something non-obvious is the way it is.

### Things to never do

- Never write code that auto-sends a pitch, DM, email, or social post. Every outbound action requires a human in the loop.
- Never use headless browser automation for posting to Instagram, TikTok, or any platform. Account ban risk is real and not worth it.
- Never log secrets to console or commit them to the repo. All secrets in Netlify env or GitHub Actions secrets.
- Never delete production data without an explicit instruction. Soft-delete via status flags.
- Never build a generic "user" abstraction. There is one user. His ID can be hardcoded.
- Never introduce a queue, message bus, or background job framework. GitHub Actions cron + Supabase = enough.
- Never use `localStorage` or `sessionStorage` for important state. The DB is the source of truth.
- Never write fake/seed data into production tables that doesn't represent real venues, promoters, or events. Empty tables are fine; fake rows are not.

### Things to always do

- Always read `STAGESIDE.md` and `CONTEXT.md` before starting an evening's work. The context compounds.
- Always run `pnpm typecheck` and `pnpm lint` before committing.
- Always test scraper output against real RA pages before deploying as a GitHub Action. Scrapers that work on stub HTML often fail on real HTML.
- Always upsert in scrapers, never insert. Idempotency is required.
- Always paginate Supabase queries that could return more than 100 rows.
- Always use Server Actions or route handlers for Supabase mutations, never client-side writes (RLS is single-user but habits matter).
- Always handle the empty state in any UI component. The DB starts empty.

## Evening checkpoints

For each evening, the deliverable is a deployed Netlify build where the new functionality works end-to-end. Specifically:

**Evening 1:** Logged in via magic link, see seeded promoters in `/promoters`. No filtering yet.
**Evening 2:** RA scraper has run and populated events. `/promoters/[id]` shows real recent events for that promoter.
**Evening 3:** Drafted, edited, and "sent" (mailto opened) a real pitch. It's in `/pipeline` under Sent.
**Evening 4:** `/content` page renders with placeholder seed clips from a manually-uploaded test video. Storage bucket has files.
**Evening 5:** `csm ingest` on a real video produces clips that appear in `/content` automatically.
**Evening 6:** Scheduled a clip for tomorrow at 7pm. It's in `/calendar`. Caption is editable.
**Evening 7:** Got the scheduled-post notification, copied caption, opened IG, posted manually, marked published. SC metrics fetcher ran and `/metrics` shows real follower count.
**Evening 8:** Generated a tech rider PDF, sent a real pitch with it attached, scheduled a real post, dashboard shows everything.

If an evening's checkpoint can't be hit, do not move on. Either fix the gap or revise the plan with Michael.

## Communication style in evening summaries

Each evening summary should be:
- Brief (under 300 words).
- Honest about what's broken or unfinished.
- Specific about what Michael needs to test before evening N+1.
- No emoji. No celebration language. The product isn't done until it gets him booked.

## On the throw-your-own-event path

`STAGESIDE.md` v2 will get a fourth loop added: **promote** — running your own event end-to-end. This is a Phase 0.5 addition, not Phase 0. Do not build promote features in evenings 1-8.

When the promote loop spec lands, it will include: venue selection (which target rooms accept rentals/co-promotions, capacity, deposit), lineup planning (who from the promoter DB to invite as guests/headliner), ticket flow (DICE, RA, or direct), night-of logistics (sound check, door, settlement), and post-event (thank-yous, footage capture for content loop).

Until then, treat any features that look like "running your own event" as out of scope.

## Final note

This project will succeed or fail on whether Michael actually uses it weekly. If you're spending time on infrastructure he won't see, you're doing the wrong thing. When in doubt, build the smallest version of the user-facing feature and leave the infrastructure rough.
