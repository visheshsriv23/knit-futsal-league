create table teams (
  id serial primary key,
  name text not null,
  budget numeric not null default 100,
  logo_url text
);
create table players (
  id serial primary key,
  name text not null,
  year text not null default '1st Year',
  base_price numeric not null default 1,
  status text not null default 'unsold' check (status in ('unsold','sold')),
  sold_price numeric,
  team_id int references teams(id) on delete set null
);
create table auction_state (
  id int primary key default 1 check (id = 1),
  current_player_id int references players(id) on delete set null,
  current_bid numeric not null default 0,
  highest_bidder_team_id int references teams(id) on delete set null,
  is_active boolean not null default false
);
insert into auction_state (id) values (1);
insert into teams (name) values ('Team Alpha'),('Team Bravo'),('Team Charlie'),('Team Delta'); -- rename to your teams

alter table teams enable row level security;
alter table players enable row level security;
alter table auction_state enable row level security;
create policy "read teams" on teams for select using (true);
create policy "read players" on players for select using (true);
create policy "read state" on auction_state for select using (true);

alter publication supabase_realtime add table teams, players, auction_state;
