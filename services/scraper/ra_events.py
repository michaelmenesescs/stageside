#!/usr/bin/env python3
"""
ra_events.py — Scrapes RA NYC event listings and upserts to Supabase.
Runs daily at 6am UTC via GitHub Actions. Pulls 60 days forward.

Usage (local test):
  SUPABASE_URL=... SUPABASE_ANON_KEY=... python3 ra_events.py
"""
import logging
import os
import re
import time
from datetime import date, timedelta
from typing import Optional

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_ANON_KEY"]

RA_GRAPHQL = "https://ra.co/graphql"
RA_AREA_NYC = 8
DAYS_AHEAD = 60
PAGE_SIZE = 50
RATE_LIMIT = 2.0  # seconds between RA pages

RA_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/json",
    "Referer": "https://ra.co/events/us/newyork",
    "Origin": "https://ra.co",
}

SB_READ_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

SB_WRITE_HEADERS = {
    **SB_READ_HEADERS,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

RA_QUERY = """
query RA_NYC_EVENTS($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
  eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
    totalResults
    data {
      id
      listingDate
      event {
        id
        title
        date
        contentUrl
        venue { id name contentUrl }
        artists { id name contentUrl }
        promoters { id name contentUrl }
      }
    }
  }
}
"""

# In-memory caches: RA content URL -> Supabase UUID
_venue_cache: dict[str, str] = {}
_promoter_cache: dict[str, str] = {}
_artist_cache: dict[str, str] = {}  # normalized_name -> uuid


def normalize_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


# ─── Supabase helpers ────────────────────────────────────────────────────────


def sb_select_all(table: str, params: dict, page_size: int = 1000) -> list[dict]:
    """Paginate through all rows (Supabase caps at 1000 per request)."""
    results: list[dict] = []
    offset = 0
    while True:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params={**params, "limit": str(page_size), "offset": str(offset)},
            headers=SB_READ_HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        batch = resp.json()
        results.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return results


def warm_caches() -> None:
    """Pre-load existing entities into caches to avoid N+1 lookups."""
    log.info("Warming entity caches from DB...")

    venues = sb_select_all("venues", {"select": "id,ra_url"})
    for v in venues:
        if v.get("ra_url"):
            _venue_cache[v["ra_url"]] = v["id"]
    log.info("  %d venues cached", len(_venue_cache))

    promoters = sb_select_all("promoters", {"select": "id,ra_url"})
    for p in promoters:
        if p.get("ra_url"):
            _promoter_cache[p["ra_url"]] = p["id"]
    log.info("  %d promoters cached", len(_promoter_cache))

    artists = sb_select_all("artists", {"select": "id,normalized_name"})
    for a in artists:
        if a.get("normalized_name"):
            _artist_cache[a["normalized_name"]] = a["id"]
    log.info("  %d artists cached", len(_artist_cache))


def sb_select(table: str, params: dict) -> list[dict]:
    resp = httpx.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        params=params,
        headers=SB_READ_HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def sb_upsert_batch(table: str, rows: list[dict], on_conflict: str) -> None:
    if not rows:
        return
    resp = httpx.post(
        f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}",
        json=rows,
        headers=SB_WRITE_HEADERS,
        timeout=30,
    )
    if resp.status_code >= 300:
        log.error("Upsert %s error %d: %s", table, resp.status_code, resp.text[:300])
    resp.raise_for_status()


def sb_create_one(table: str, row: dict) -> Optional[str]:
    resp = httpx.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        json=row,
        headers={**SB_WRITE_HEADERS, "Prefer": "return=representation"},
        timeout=15,
    )
    if resp.status_code >= 300:
        log.error("Create %s error %d: %s", table, resp.status_code, resp.text[:200])
        return None
    rows = resp.json()
    return rows[0]["id"] if rows else None


# ─── Entity resolution with caching ──────────────────────────────────────────


def resolve_venue(ra_venue: Optional[dict]) -> Optional[str]:
    if not ra_venue or not ra_venue.get("contentUrl"):
        return None
    ra_url = f"https://ra.co{ra_venue['contentUrl']}"
    if ra_url in _venue_cache:
        return _venue_cache[ra_url]

    # Look up by ra_url
    rows = sb_select("venues", {"ra_url": f"eq.{ra_url}", "select": "id"})
    if rows:
        _venue_cache[ra_url] = rows[0]["id"]
        return rows[0]["id"]

    # Look up by name
    rows = sb_select("venues", {"name": f"eq.{ra_venue['name']}", "select": "id"})
    if rows:
        _venue_cache[ra_url] = rows[0]["id"]
        return rows[0]["id"]

    # Create new
    uid = sb_create_one("venues", {"name": ra_venue["name"], "ra_url": ra_url})
    if uid:
        _venue_cache[ra_url] = uid
    return uid


def resolve_promoter(ra_promoter: Optional[dict]) -> Optional[str]:
    if not ra_promoter or not ra_promoter.get("contentUrl"):
        return None
    ra_url = f"https://ra.co{ra_promoter['contentUrl']}"
    if ra_url in _promoter_cache:
        return _promoter_cache[ra_url]

    rows = sb_select("promoters", {"ra_url": f"eq.{ra_url}", "select": "id"})
    if rows:
        _promoter_cache[ra_url] = rows[0]["id"]
        return rows[0]["id"]

    rows = sb_select("promoters", {"name": f"eq.{ra_promoter['name']}", "select": "id"})
    if rows:
        _promoter_cache[ra_url] = rows[0]["id"]
        return rows[0]["id"]

    uid = sb_create_one("promoters", {"name": ra_promoter["name"], "ra_url": ra_url})
    if uid:
        _promoter_cache[ra_url] = uid
    return uid


def resolve_artist(ra_artist: Optional[dict]) -> Optional[str]:
    if not ra_artist or not ra_artist.get("name"):
        return None
    norm = normalize_name(ra_artist["name"])
    if not norm:
        return None
    if norm in _artist_cache:
        return _artist_cache[norm]

    rows = sb_select("artists", {"normalized_name": f"eq.{norm}", "select": "id"})
    if rows:
        _artist_cache[norm] = rows[0]["id"]
        return rows[0]["id"]

    ra_url = f"https://ra.co{ra_artist['contentUrl']}" if ra_artist.get("contentUrl") else None
    uid = sb_create_one(
        "artists",
        {"name": ra_artist["name"], "normalized_name": norm, "ra_url": ra_url},
    )
    if uid:
        _artist_cache[norm] = uid
    return uid


# ─── RA fetch ─────────────────────────────────────────────────────────────────


def fetch_page(
    session: httpx.Client, page: int, date_from: str, date_to: str
) -> dict:
    payload = {
        "query": RA_QUERY,
        "variables": {
            "filters": {
                "areas": {"eq": RA_AREA_NYC},
                "listingDate": {"gte": date_from, "lte": date_to},
            },
            "pageSize": PAGE_SIZE,
            "page": page,
        },
    }
    for attempt in range(3):
        try:
            resp = session.post(RA_GRAPHQL, json=payload, timeout=30)
            resp.raise_for_status()
            body = resp.json()
            if "errors" in body:
                log.error("GraphQL errors on page %d: %s", page, body["errors"])
                return {}
            return body.get("data", {}).get("eventListings", {})
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                log.warning("Rate limited — sleeping 30s")
                time.sleep(30)
            else:
                raise
        except Exception as exc:
            log.warning("Attempt %d failed: %s", attempt + 1, exc)
            if attempt == 2:
                raise
            time.sleep(5)
    return {}


# ─── Event processing ────────────────────────────────────────────────────────


def process_listing(listing: dict) -> None:
    ev = listing.get("event")
    if not ev or not ev.get("id"):
        return

    ra_id = str(ev["id"])
    date_str = (ev.get("date") or "")[:10]
    if not date_str:
        return

    venue_id = resolve_venue(ev.get("venue"))

    promoters = ev.get("promoters") or []
    promoter_id = resolve_promoter(promoters[0]) if promoters else None

    artists = ev.get("artists") or []
    lineup_raw = ", ".join(a["name"] for a in artists if a.get("name"))

    event_row: dict = {
        "ra_id": ra_id,
        "date": date_str,
        "title": ev.get("title"),
        "lineup_raw": lineup_raw or None,
        "ticket_url": f"https://ra.co{ev['contentUrl']}" if ev.get("contentUrl") else None,
    }
    if venue_id:
        event_row["venue_id"] = venue_id
    if promoter_id:
        event_row["promoter_id"] = promoter_id

    sb_upsert_batch("events", [event_row], "ra_id")

    # Link artists
    if not artists:
        return

    event_rows = sb_select("events", {"ra_id": f"eq.{ra_id}", "select": "id"})
    if not event_rows:
        return
    event_uuid = event_rows[0]["id"]

    for i, ra_artist in enumerate(artists):
        artist_id = resolve_artist(ra_artist)
        if not artist_id:
            continue
        link = {"event_id": event_uuid, "artist_id": artist_id, "slot_position": i}
        sb_upsert_batch("event_artists", [link], "event_id,artist_id")


# ─── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    date_from = date.today().isoformat()
    date_to = (date.today() + timedelta(days=DAYS_AHEAD)).isoformat()
    log.info("Scraping RA NYC events %s → %s", date_from, date_to)
    warm_caches()

    total_processed = 0
    page = 1

    with httpx.Client(headers=RA_HEADERS) as session:
        while True:
            log.info("Fetching page %d", page)
            result = fetch_page(session, page, date_from, date_to)
            if not result:
                log.error("Empty result on page %d — stopping", page)
                break

            listings = result.get("data") or []
            if not listings:
                log.info("No more listings on page %d", page)
                break

            for listing in listings:
                try:
                    process_listing(listing)
                    total_processed += 1
                except Exception as exc:
                    ra_id = (listing.get("event") or {}).get("id", "?")
                    log.error("Error processing event %s: %s", ra_id, exc)

            total = result.get("totalResults", 0)
            fetched_so_far = page * PAGE_SIZE
            log.info(
                "Page %d done — %d processed so far (RA reports %d total)",
                page,
                total_processed,
                total,
            )

            if fetched_so_far >= total or fetched_so_far >= 1000:
                break
            page += 1
            time.sleep(RATE_LIMIT)

    log.info("Scrape complete. Total events processed: %d", total_processed)


if __name__ == "__main__":
    main()
