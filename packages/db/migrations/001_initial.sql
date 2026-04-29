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
