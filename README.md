# KNIT Futsal League – Live Auction

1. Open this folder in VS Code.
2. Create a Supabase project, open the SQL editor, and run `supabase/schema.sql`.
3. Edit `.env.local`: paste your Supabase URL, anon key and service role key
   (Project Settings > API). Keep the service role key server-side only.
4. In a terminal: `npm install` then `npm run dev`
5. Home page: http://localhost:3000 — Auctioneer: http://localhost:3000/auctioneer

Rename the 4 seeded teams in the `teams` table, and add players from the auctioneer panel.
