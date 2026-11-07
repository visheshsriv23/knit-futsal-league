"use server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

const sign = () =>
  createHmac("sha256", process.env.AUCTIONEER_PASSWORD ?? "").update(process.env.AUCTIONEER_USERNAME ?? "").digest("hex");

async function authed() {
  const c = (await cookies()).get("auctioneer")?.value;
  if (!c || !process.env.AUCTIONEER_PASSWORD) return false;
  const a = Buffer.from(c), b = Buffer.from(sign());
  return a.length === b.length && timingSafeEqual(a, b);
}
async function guard() {
  if (!(await authed())) throw new Error("Not authorised");
  return admin();
}

type Result = { ok: boolean; error?: string };

export async function checkAuth() { return authed(); }

export async function login(username: string, password: string): Promise<Result> {
  if (username !== process.env.AUCTIONEER_USERNAME || password !== process.env.AUCTIONEER_PASSWORD)
    return { ok: false, error: "Wrong username or password." };
  (await cookies()).set("auctioneer", sign(), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12,
  });
  return { ok: true };
}
export async function logout() { (await cookies()).delete("auctioneer"); }

export async function putOnBlock(playerId: number): Promise<Result> {
  const db = await guard();
  const { data: p } = await db.from("players").select("base_price,status").eq("id", playerId).single();
  if (!p || p.status !== "unsold") return { ok: false, error: "Player is not available." };
  await db.from("auction_state").update({ current_player_id: playerId, current_bid: p.base_price, highest_bidder_team_id: null, is_active: true }).eq("id", 1);
  return { ok: true };
}

export async function placeBid(teamId: number, amount: number): Promise<Result> {
  const db = await guard();
  const [{ data: s }, { data: t }] = await Promise.all([
    db.from("auction_state").select("*").eq("id", 1).single(),
    db.from("teams").select("budget").eq("id", teamId).single(),
  ]);
  if (!s?.is_active) return { ok: false, error: "No player is on the block." };
  if (!t || amount > t.budget) return { ok: false, error: "Bid exceeds team budget." };
  if (amount < s.current_bid || (s.highest_bidder_team_id && amount === s.current_bid))
    return { ok: false, error: "Bid must beat the current bid." };
  await db.from("auction_state").update({ current_bid: amount, highest_bidder_team_id: teamId }).eq("id", 1);
  return { ok: true };
}

export async function sellPlayer(): Promise<Result> {
  const db = await guard();
  const { data: s } = await db.from("auction_state").select("*").eq("id", 1).single();
  if (!s?.is_active || !s.current_player_id || !s.highest_bidder_team_id)
    return { ok: false, error: "Needs a player on the block and a bidding team." };
  const { data: t } = await db.from("teams").select("budget").eq("id", s.highest_bidder_team_id).single();
  if (!t || t.budget < s.current_bid) return { ok: false, error: "Team can't afford this bid." };
  await db.from("players").update({ status: "sold", sold_price: s.current_bid, team_id: s.highest_bidder_team_id }).eq("id", s.current_player_id);
  await db.from("teams").update({ budget: t.budget - s.current_bid }).eq("id", s.highest_bidder_team_id);
  await db.from("auction_state").update({ current_player_id: null, current_bid: 0, highest_bidder_team_id: null, is_active: false }).eq("id", 1);
  return { ok: true };
}

export async function addPlayer(name: string, year: string, position: string | null = null, basePrice = 1): Promise<Result> {
  const db = await guard();
  if (!name.trim()) return { ok: false, error: "Name is required." };
  const { error } = await db.from("players").insert({ name: name.trim(), year, base_price: basePrice, position });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function releasePlayer(playerId: number): Promise<Result> {
  const db = await guard();
  const { data: p } = await db.from("players").select("*").eq("id", playerId).single();
  if (!p) return { ok: false, error: "Player not found." };
  if (p.status === "sold" && p.team_id) {
    const { data: t } = await db.from("teams").select("budget").eq("id", p.team_id).single();
    await db.from("teams").update({ budget: (t?.budget ?? 0) + (p.sold_price ?? 0) }).eq("id", p.team_id);
  }
  await db.from("players").update({ status: "unsold", sold_price: null, team_id: null }).eq("id", playerId);
  return { ok: true };
}

export async function updateSoldPrice(playerId: number, newPrice: number): Promise<Result> {
  const db = await guard();
  const { data: p } = await db.from("players").select("*").eq("id", playerId).single();
  if (!p || p.status !== "sold" || !p.team_id) return { ok: false, error: "Player isn't sold." };
  const { data: t } = await db.from("teams").select("budget").eq("id", p.team_id).single();
  const diff = newPrice - (p.sold_price ?? 0);
  if (!t || t.budget - diff < 0) return { ok: false, error: "Not enough budget." };
  await db.from("teams").update({ budget: t.budget - diff }).eq("id", p.team_id);
  await db.from("players").update({ sold_price: newPrice }).eq("id", playerId);
  return { ok: true };
}

export async function deletePlayer(playerId: number): Promise<Result> {
  const db = await guard();
  await releasePlayer(playerId);
  await db.from("players").delete().eq("id", playerId);
  return { ok: true };
}

export async function sellToTeam(teamId: number, price: number): Promise<Result> {
  const db = await guard();
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Enter a valid amount." };
  const { data: s } = await db.from("auction_state").select("*").eq("id", 1).single();
  if (!s?.is_active || !s.current_player_id) return { ok: false, error: "No player is on the block." };
  const { data: t } = await db.from("teams").select("budget").eq("id", teamId).single();
  if (!t) return { ok: false, error: "Team not found." };
  if (t.budget < price) return { ok: false, error: `Team only has ${t.budget} pts left.` };
  await db.from("players").update({ status: "sold", sold_price: price, team_id: teamId }).eq("id", s.current_player_id);
  await db.from("teams").update({ budget: t.budget - price }).eq("id", teamId);
  await db.from("auction_state").update({ current_player_id: null, current_bid: 0, highest_bidder_team_id: null, is_active: false }).eq("id", 1);
  return { ok: true };
}

export async function updateTeam(teamId: number, name: string, budget: number): Promise<Result> {
  const db = await guard();
  if (!name.trim()) return { ok: false, error: "Team name is required." };
  if (!Number.isFinite(budget) || budget < 0) return { ok: false, error: "Budget must be 0 or more." };
  const { error } = await db.from("teams").update({ name: name.trim(), budget }).eq("id", teamId);
  return error ? { ok: false, error: error.message } : { ok: true };
}


export async function addTeam(name: string, budget: number): Promise<Result & { id?: number }> {
  const db = await guard();
  if (!name.trim()) return { ok: false, error: "Team name is required." };
  if (!Number.isFinite(budget) || budget < 0) return { ok: false, error: "Budget must be 0 or more." };
  const { data, error } = await db.from("teams").insert({ name: name.trim(), budget }).select("id").single();
  return error || !data ? { ok: false, error: error?.message ?? "Couldn't add team." } : { ok: true, id: data.id };
}

export async function addDraftedPlayers(
  teamId: number,
  list: { name: string; year: string; price: number; position?: string | null }[]
): Promise<Result> {
  const db = await guard();
  const rows = list.filter((p) => p.name.trim());
  if (!rows.length) return { ok: false, error: "No players to add." };
  if (rows.some((p) => !Number.isFinite(p.price) || p.price < 0)) return { ok: false, error: "Prices must be 0 or more." };
  const { data: t } = await db.from("teams").select("budget").eq("id", teamId).single();
  if (!t) return { ok: false, error: "Team not found." };
  const total = rows.reduce((n, p) => n + p.price, 0);
  if (total > t.budget) return { ok: false, error: `Those players cost ${total} pts but the team has ${t.budget}.` };
  const { error } = await db.from("players").insert(
    rows.map((p) => ({ name: p.name.trim(), year: p.year, position: p.position ?? null, status: "sold", sold_price: p.price, team_id: teamId }))
  );
  if (error) return { ok: false, error: error.message };
  await db.from("teams").update({ budget: t.budget - total }).eq("id", teamId);
  return { ok: true };
}

export async function deleteTeam(teamId: number): Promise<Result> {
  const db = await guard();
  await db.from("players").update({ status: "unsold", sold_price: null, team_id: null }).eq("team_id", teamId);
  const { error } = await db.from("teams").delete().eq("id", teamId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setPlayerPosition(playerId: number, position: string | null): Promise<Result> {
  const db = await guard();
  const { error } = await db.from("players").update({ position }).eq("id", playerId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
