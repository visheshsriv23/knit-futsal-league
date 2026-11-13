<div align="center">

# KNIT Futsal League – Live Auction

**A real-time player auction for the KNIT Futsal League. Spectators watch the bidding live on any device while the auctioneer runs the room from a protected control panel.**

![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-3-88CE02?style=for-the-badge&logo=greensock&logoColor=white)

[Features](#features) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Environment variables](#environment-variables) · [Database setup](#database-setup) · [Running the app](#running-the-app) · [Deployment](#deployment)

</div>

---

## Features

### For spectators (`/`)

- **Live board.** The hero shows the player currently on the block, their year and position, the current bid and the team leading the bidding. It updates the moment the auctioneer changes anything.
- **Team cards with live budgets.** Each team shows its remaining budget (animated when it changes), a budget bar, points spent and players signed. The highest bidder is highlighted while a player is on the block.
- **Squad rosters.** Click any team to see every player it has signed, with their position, year and the exact price paid.
- **Players section.** Browse all players as cards, grouped by year (1st to 4th Year). Filter by **sold / unsold** and by **position** (Goalkeeper, Defender, Winger, Pivot).
- **Works everywhere.** Mobile-first layout, keyboard-friendly, and respects reduced-motion settings.

### For the auctioneer (`/auctioneer`)

- **Protected control room.** Login is checked on the server against environment variables. The credentials never reach the browser.
- **Bidding controls.** Put any unsold player on the block, type any custom amount (or use +1 / +5), pick the bidding team and press **Sell player**. Budgets are deducted instantly and a team cannot spend more than it has.
- **Player pool by year.** Switch between 1st, 2nd, 3rd and 4th Year pools, add players and delete them.
- **Positions.** Set a position when adding a player, or change it any time from the Player positions section.
- **Full team management.** Add teams (optionally with already-drafted players), rename them, adjust budgets, see points spent and players signed, release or re-price a signed player (with automatic refund or deduction), and delete teams.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js](https://nextjs.org/) 15 (App Router) with React 19 |
| Language | TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) |
| Real-time sync | Supabase Realtime (WebSockets): Postgres changes plus a broadcast channel named `auction-room` |
| Server logic | Next.js Server Actions with an HttpOnly signed-cookie session |
| Animation | [GSAP](https://gsap.com/) for count-up budgets, CSS for entrance and bid-change motion |
| Fonts | Anton and Barlow via `next/font` |

---

## Getting started

### Prerequisites

- **Node.js** 18.18 or newer (20 LTS recommended)
- **npm** (comes with Node) or yarn
- A free **[Supabase](https://supabase.com/)** account

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/knit-futsal-auction.git
cd knit-futsal-auction

# 2. Install dependencies
npm install
```

Then continue with [Environment variables](#environment-variables) and [Database setup](#database-setup) before starting the app.

---

## Environment variables

Create a file named `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AUCTIONEER_USERNAME=choose-a-username
AUCTIONEER_PASSWORD=choose-a-strong-password
```

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Safe to expose to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Read-only because of the Row Level Security policies below |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **Server only.** Never prefix it with `NEXT_PUBLIC_` and never commit it |
| `AUCTIONEER_USERNAME` | You choose | Used to log in at `/auctioneer` |
| `AUCTIONEER_PASSWORD` | You choose | Use a strong password, especially on a public deployment |

> **Security note:** `.env.local` is already listed in `.gitignore`. Do not commit real keys or passwords, and do not publish your auctioneer credentials in this README or anywhere public.

All writes (selling players, editing budgets, managing teams) go through server actions that use the service role key after checking the auctioneer's session cookie. The public anon key can only read.

---

## Database setup

1. In your Supabase project, open **SQL Editor → New query**.
2. Paste and run the following script (it is also saved as `supabase/schema.sql`):

```sql
-- Teams
create table teams (
  id serial primary key,
  name text not null,
  budget numeric not null default 100,
  logo_url text
);

-- Players
create table players (
  id serial primary key,
  name text not null,
  year text not null default '1st Year',
  position text,
  base_price numeric not null default 1,
  status text not null default 'unsold' check (status in ('unsold', 'sold')),
  sold_price numeric,
  team_id int references teams(id) on delete set null
);

-- The player currently on the block (always a single row)
create table auction_state (
  id int primary key default 1 check (id = 1),
  current_player_id int references players(id) on delete set null,
  current_bid numeric not null default 0,
  highest_bidder_team_id int references teams(id) on delete set null,
  is_active boolean not null default false
);
insert into auction_state (id) values (1);

-- Seed teams (rename these to your real teams, or edit them later in the control room)
insert into teams (name) values ('Team Alpha'), ('Team Bravo'), ('Team Charlie'), ('Team Delta');

-- Row Level Security: the public can read, only server actions can write
alter table teams enable row level security;
alter table players enable row level security;
alter table auction_state enable row level security;
create policy "read teams" on teams for select using (true);
create policy "read players" on players for select using (true);
create policy "read state" on auction_state for select using (true);

-- Turn on Realtime for all three tables
alter publication supabase_realtime add table teams, players, auction_state;
```

**Already have the tables from an earlier version?** Run this instead of the whole script to add positions:

```sql
alter table players add column if not exists position text;
```

| Table | Purpose |
| --- | --- |
| `teams` | Team name, remaining budget and optional logo |
| `players` | Name, year, position, base price, sold/unsold status, sale price and owning team |
| `auction_state` | One row describing the player on the block, the current bid and the highest bidder |

Teams and players can be added from the control room, so you do not need to seed anything else by hand.

---

## Running the app

```bash
npm run dev
```

Next.js starts on <http://localhost:3000> (or the next free port, which it prints in the terminal).

| Route | Who it is for | Description |
| --- | --- | --- |
| `/` | Everyone | Live board, team budgets, squad rosters and the Players section |
| `/auctioneer` | Auctioneer only | Login, then the control room |

Other useful commands:

```bash
npm run build   # production build
npm run start   # serve the production build
```

### Testing live sync across devices

1. Run `npm run dev` and note the **Network** URL (for example `http://192.168.x.x:3000`).
2. Open `/` on a phone connected to the same Wi-Fi.
3. Log in at `/auctioneer` on your computer, put a player on the block and place a bid.
4. The phone's board and budgets should update within a moment, with no refresh.

The home page also re-checks the data every few seconds and when the tab regains focus, so it stays correct even if a Realtime message is missed.

---

## Deployment

The app deploys cleanly to [Vercel](https://vercel.com/):

1. Push the repository to GitHub.
2. Import it on Vercel (it detects Next.js automatically).
3. Add the five environment variables from [above](#environment-variables) in the project settings.
4. Deploy, then redeploy whenever you change a variable.

---

## Project structure

```text
.
├── app/
│   ├── layout.tsx              # Root layout and fonts
│   ├── globals.css             # Tailwind v4 theme and shared styles
│   ├── page.tsx                # Public live board, teams and squad modal
│   └── auctioneer/
│       ├── page.tsx            # Login and control room
│       └── actions.ts          # Server actions: auth, bidding, selling, team and player management
├── components/
│   ├── PitchBackground.tsx     # Futsal court backdrop
│   └── PlayersSection.tsx      # Year-wise player cards with sold/position filters
├── lib/
│   └── supabase.ts             # Supabase client, shared types and realtime helpers
├── supabase/
│   └── schema.sql              # Database schema
└── .env.local                  # Your local secrets (not committed)
```

---

## Roadmap ideas

- Team logos on the team cards
- Bid history and a countdown timer
- Atomic sell/refund updates through a Postgres function

---

<div align="center">

Built for the KNIT Futsal League.

</div>
