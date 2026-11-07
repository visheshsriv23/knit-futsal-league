import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const supabase = createClient(url, anon, { realtime: { params: { eventsPerSecond: 20 } } });

export type Team = { id: number; name: string; budget: number; logo_url: string | null };
export type Player = {
  id: number; name: string; year: string; base_price: number;
  status: "unsold" | "sold"; sold_price: number | null; team_id: number | null;
  position: string | null;
};
export type AuctionState = {
  id: number; current_player_id: number | null; current_bid: number;
  highest_bidder_team_id: number | null; is_active: boolean;
};

export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
export const POSITIONS = ["Goalkeeper", "Defender", "Winger", "Midfielder", "Forward"];

export async function loadAll() {
  const [t, p, a] = await Promise.all([
    supabase.from("teams").select("*").order("id"),
    supabase.from("players").select("*").order("id"),
    supabase.from("auction_state").select("*").eq("id", 1).single(),
  ]);
  const err = t.error || p.error || a.error;
  if (err) throw new Error(err.message);
  return { teams: t.data as Team[], players: p.data as Player[], state: a.data as AuctionState };
}

export function subscribeAuction(onChange: () => void) {
  const channel = supabase
    .channel("auction-room")
    .on("postgres_changes", { event: "*", schema: "public" }, onChange)
    .on("broadcast", { event: "refresh" }, onChange)
    .subscribe();
  return {
    channel,
    stop: () => { supabase.removeChannel(channel); },
  };
}
