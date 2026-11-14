"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { loadAll, subscribeAuction, type AuctionState, type Player, type Team } from "@/lib/supabase";
import PitchBackground from "@/components/PitchBackground";
import PlayersSection from "@/components/PlayerSection";
import Image from 'next/image';

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const o = { v: prev.current };
    const tween = gsap.to(o, {
      v: value, duration: reduce ? 0 : 0.6, ease: "power2.out",
      onUpdate: () => { el.textContent = String(Math.round(o.v)); },
    });
    prev.current = value;
    return () => { tween.kill(); el.textContent = String(value); };
  }, [value]);
  return <span ref={ref}>{value}</span>;
}

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<AuctionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [tab, setTab] = useState<"teams" | "players">("teams");

  const refresh = useCallback(async () => {
    try {
      const d = await loadAll();
      setTeams(d.teams); setPlayers(d.players); setState(d.state); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load auction data.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = subscribeAuction(refresh);
    const poll = setInterval(refresh, 4000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      sub.stop();
    };
  }, [refresh]);

  useEffect(() => {
    if (openId === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const onBlock = state?.is_active ? players.find((p) => p.id === state.current_player_id) : undefined;
  const leader = teams.find((t) => t.id === state?.highest_bidder_team_id);
  const signed = (t: Team) => players.filter((p) => p.team_id === t.id);
  const spent = (t: Team) => signed(t).reduce((n, p) => n + (p.sold_price ?? 0), 0);
  const openTeam = teams.find((t) => t.id === openId) ?? null;
  const soldCount = players.filter((p) => p.status === "sold").length;

  const tabBtn = (active: boolean) =>
    `font-display border-b-4 px-1 pb-2 text-2xl uppercase ${active ? "border-cyan text-white" : "border-transparent text-muted hover:text-white"}`;

  return (
    <main className="relative min-h-dvh">
      <PitchBackground />

      <section className="wipe relative overflow-hidden bg-amethyst">
        <svg aria-hidden viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="2"
          className="pointer-events-none absolute -bottom-24 -right-20 h-[26rem] w-[26rem] text-cyan opacity-20">
          <circle cx="200" cy="200" r="150" />
          <circle cx="200" cy="200" r="6" fill="currentColor" />
          <line x1="200" y1="0" x2="200" y2="400" />
        </svg>

        <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex items-center gap-4">
            <img 
              src="/icon.png" 
              alt="KNIT Futsal League Logo" 
              className="h-12 w-auto object-contain" 
            />
            <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wide">
              KNIT Futsal League – Live Auction
            </h1>
          </div>
          <p className="flex items-center gap-2 text-sm text-white/80" aria-live="polite">
            <span className={`h-2.5 w-2.5 rounded-full ${onBlock ? "animate-pulse bg-cyan motion-reduce:animate-none" : "bg-white/30"}`} />
            {onBlock ? "Bidding is open" : "Between players"}
          </p>
        </header>

          <div className="mt-12 grid gap-8 sm:mt-16 lg:grid-cols-[1fr_auto] lg:items-end">
            {onBlock && state ? (
              <>
                <div className="min-w-0">
                  <p className="text-lg text-white/75">
                    {onBlock.year}{onBlock.position ? `, ${onBlock.position}` : ""}, base price {onBlock.base_price} pt
                  </p>
                  <p className="font-display mt-1 break-words text-[clamp(3.5rem,11vw,9rem)] uppercase leading-[.9]">
                    {onBlock.name}
                  </p>
                </div>
                <div className="bg-jet px-6 py-5 lg:min-w-[20rem] lg:text-right">
                  <p className="text-sm text-muted">Current bid</p>
                  <p key={state.current_bid} className="tick font-display text-[clamp(4.5rem,14vw,10rem)] leading-[.9] text-cyan">
                    {state.current_bid}
                  </p>
                  <p className="mt-2 text-white/85">{leader ? `Highest bidder: ${leader.name}` : "No bids yet"}</p>
                </div>
              </>
            ) : (
              <p className="font-display max-w-3xl text-[clamp(2.5rem,7vw,5.5rem)] uppercase leading-[.95] text-white/80">
                The next player is coming up
              </p>
            )}
          </div>
        </div>
      </section>

      <nav aria-label="Sections" className="mx-auto flex max-w-7xl gap-8 px-5 pt-8 sm:px-8">
        <button aria-pressed={tab === "teams"} onClick={() => setTab("teams")} className={tabBtn(tab === "teams")}>
          Teams
        </button>
        <button aria-pressed={tab === "players"} onClick={() => setTab("players")} className={tabBtn(tab === "players")}>
          Players
        </button>
      </nav>

      {error && (
        <p role="alert" className="mx-auto mt-6 max-w-7xl border border-red-400/40 bg-red-950/40 p-4 text-red-200 sm:mx-8 xl:mx-auto">
          {error}
        </p>
      )}
      {!loaded && <p className="mx-auto mt-6 max-w-7xl px-5 text-muted sm:px-8">Loading…</p>}

      {tab === "players" && <PlayersSection players={players} teams={teams} />}

      {tab === "teams" && (
        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          {teams.length > 0 && (
            <p className="text-sm text-muted">{soldCount} players signed across {teams.length} teams</p>
          )}
          {loaded && !error && teams.length === 0 && (
            <p className="text-muted">No teams yet. The auctioneer adds them from the control room.</p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teams.map((t) => {
              const isLeader = leader?.id === t.id && !!onBlock;
              const total = t.budget + spent(t);
              const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((t.budget / total) * 100))) : 0;
              return (
                <button key={t.id} onClick={() => setOpenId(t.id)}
                  className={`flex flex-col gap-4 border border-l-4 p-5 text-left ${isLeader ? "border-cyan bg-amethyst" : "border-line border-l-amethyst bg-ink"}`}>
                  <span className="block">
                    <span className="font-display block break-words text-3xl uppercase leading-none">{t.name}</span>
                    {isLeader && <span className="mt-1 block text-sm text-cyan">Highest bidder</span>}
                  </span>
                  <span className="block">
                    <span className="block text-sm text-muted">Budget left</span>
                    <span className="font-display text-6xl leading-none"><CountUp value={t.budget} /></span>
                    <span className="ml-1 text-white/60">pts</span>
                  </span>
                  <span className="block h-1 w-full bg-white/10">
                    <span className="block h-full bg-cyan transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="block text-sm text-muted">{signed(t).length} signed, {spent(t)} pts spent</span>
                  <span className="text-sm underline underline-offset-4">View squad</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {openTeam && (
        <div role="dialog" aria-modal="true" aria-labelledby="squad-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-6"
          onClick={() => setOpenId(null)}>
          <div className="max-h-[85dvh] w-full max-w-xl overflow-y-auto border border-line bg-ink" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 bg-amethyst p-5">
              <div className="min-w-0">
                <h2 id="squad-title" className="font-display break-words text-4xl uppercase leading-none">{openTeam.name}</h2>
                <p className="mt-2 text-sm text-white/75">{openTeam.budget} pts left, {spent(openTeam)} pts spent</p>
              </div>
              <button autoFocus onClick={() => setOpenId(null)} className="shrink-0 border border-white/30 px-3 py-1 text-sm hover:bg-white/10">
                Close
              </button>
            </div>
            {signed(openTeam).length ? (
              <table className="w-full text-left">
                <thead className="text-sm text-muted">
                  <tr>
                    <th className="p-4 font-medium">Player</th>
                    <th className="p-4 font-medium">Position</th>
                    <th className="p-4 font-medium">Year</th>
                    <th className="p-4 text-right font-medium">Sold for</th>
                  </tr>
                </thead>
                <tbody>
                  {signed(openTeam).map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="p-4">{p.name}</td>
                      <td className="p-4 text-muted">{p.position ?? "-"}</td>
                      <td className="p-4 text-muted">{p.year}</td>
                      <td className="font-display p-4 text-right text-2xl text-cyan">{p.sold_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-5 text-muted">No signings yet. Players show up here the moment they're sold.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}