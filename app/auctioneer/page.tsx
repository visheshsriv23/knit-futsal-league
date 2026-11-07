"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadAll, subscribeAuction, POSITIONS, YEARS, type AuctionState, type Player, type Team } from "@/lib/supabase";
import PitchBackground from "@/components/PitchBackground";
import * as A from "./actions";

type Result = { ok: boolean; error?: string };

const input = "w-full min-w-0 rounded-lg border border-amethyst/60 bg-black/60 p-3 outline-none focus:border-cyan";
const select = "w-40 shrink-0 rounded-lg border border-amethyst/60 bg-black/60 p-2 outline-none focus:border-cyan";
const btn = "rounded-lg border border-cyan/50 px-3 py-2 text-cyan transition hover:bg-cyan/10 disabled:opacity-40";

function parseLines(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [name, y = "", p = "", pos = ""] = line.split(",").map((s) => s.trim());
    const n = parseInt(y, 10);
    const year = YEARS.includes(y) ? y : n >= 1 && n <= YEARS.length ? YEARS[n - 1] : YEARS[0];
    const position = POSITIONS.find((x) => x.toLowerCase() === pos.toLowerCase()) ?? null;
    return { name, year, price: p === "" ? 0 : Number(p), position };
  });
}

export default function Auctioneer() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loginErr, setLoginErr] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<AuctionState | null>(null);
  const [msg, setMsg] = useState("");
  const [yearTab, setYearTab] = useState(YEARS[0]);
  const [newName, setNewName] = useState("");
  const [newPos, setNewPos] = useState("");
  const [amount, setAmount] = useState("");
  const [selTeam, setSelTeam] = useState<number | null>(null);
  const [newTeam, setNewTeam] = useState("");
  const [newBudget, setNewBudget] = useState("100");
  const [newPlayers, setNewPlayers] = useState("");
  const chanRef = useRef<ReturnType<typeof subscribeAuction>["channel"] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await loadAll();
      setTeams(d.teams); setPlayers(d.players); setState(d.state);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Load failed."); }
  }, []);

  useEffect(() => { A.checkAuth().then(setAuthed); }, []);
  useEffect(() => {
    if (!authed) return;
    refresh();
    const sub = subscribeAuction(refresh);
    chanRef.current = sub.channel;
    return () => { chanRef.current = null; sub.stop(); };
  }, [authed, refresh]);

  useEffect(() => {
    if (state?.is_active) setAmount(String(state.current_bid));
    else { setAmount(""); setSelTeam(null); }
  }, [state?.current_player_id, state?.is_active]);

  const run = async (fn: () => Promise<Result>) => {
    setMsg("");
    try {
      const r = await fn();
      if (!r.ok) { setMsg(r.error ?? "Action failed."); return false; }
      await chanRef.current?.send({ type: "broadcast", event: "refresh", payload: {} });
      refresh();
      return true;
    } catch (e) { setMsg(e instanceof Error ? e.message : "Action failed."); return false; }
  };

  if (authed === null) return <main className="p-8 text-white/60">Loading…</main>;

  if (!authed)
    return (
      <main className="flex min-h-dvh items-center justify-center p-5">
        <PitchBackground />
        <form
          className="scoreboard w-full max-w-sm space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await A.login(String(f.get("u")), String(f.get("p")));
            if (r.ok) setAuthed(true); else setLoginErr(r.error ?? "Login failed.");
          }}
        >
          <h1 className="font-score text-xl">AUCTIONEER LOGIN</h1>
          <input name="u" placeholder="Username" autoComplete="username" required className={input} />
          <input name="p" type="password" placeholder="Password" autoComplete="current-password" required className={input} />
          {loginErr && <p role="alert" className="text-sm text-red-300">{loginErr}</p>}
          <button className="w-full rounded-lg bg-cyan p-3 font-bold text-black">Log in</button>
        </form>
      </main>
    );

  const onBlock = state?.is_active ? players.find((p) => p.id === state.current_player_id) : undefined;
  const leader = teams.find((t) => t.id === state?.highest_bidder_team_id);
  const pool = players.filter((p) => p.status === "unsold" && p.year === yearTab);
  const poolTotal = players.filter((p) => p.status === "unsold").length;
  const amt = Number(amount);
  const team = teams.find((t) => t.id === selTeam);
  const canSell = !!onBlock && !!team && amt > 0 && amt <= team.budget;
  const spent = (t: Team) => players.filter((p) => p.team_id === t.id).reduce((n, p) => n + (p.sold_price ?? 0), 0);
  const signed = (t: Team) => players.filter((p) => p.team_id === t.id);

  const validBid = (t: Team, a: number) =>
    !!state?.is_active && a > 0 && a <= t.budget && a >= state.current_bid &&
    (!state.highest_bidder_team_id || a > state.current_bid);

  const pickTeam = (t: Team) => {
    setSelTeam(t.id);
    if (validBid(t, amt)) run(() => A.placeBid(t.id, amt));
  };
  const bump = (n: number) => {
    const next = (amt || 0) + n;
    setAmount(String(next));
    if (team && validBid(team, next)) run(() => A.placeBid(team.id, next));
  };

  return (
    <main className="relative mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <PitchBackground />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-score text-xl sm:text-2xl">AUCTION CONTROL ROOM</h1>
        <div className="flex items-center gap-3">
          <span className="scoreboard px-3 py-1 text-sm"><span className="font-score text-cyan">{poolTotal}</span> unsold</span>
          <button className={btn} onClick={async () => { await A.logout(); setAuthed(false); }}>Log out</button>
        </div>
      </header>
      {msg && <p role="alert" className="glass rounded-xl p-3 text-red-300">{msg}</p>}

      <section className="scoreboard flex flex-col gap-2 p-5">
        <h2 className="text-sm text-white/60">On the block</h2>
        {onBlock && state ? (
          <>
            <p className="font-score break-words text-2xl sm:text-3xl">
              {onBlock.name} <span className="text-base text-white/50">{onBlock.year}{onBlock.position ? `, ${onBlock.position}` : ""}</span>
            </p>
            <p className="font-score text-xl text-cyan">
              {state.current_bid} pts{leader ? `, ${leader.name} leads` : ", no bids yet"}
            </p>
          </>
        ) : <p className="text-white/60">Pick a player from the pool below.</p>}
      </section>

      <section className="glass flex flex-col gap-4 rounded-2xl p-5">
        <div>
          <h2 className="font-display text-lg">Sell to a team</h2>
          <p className="text-sm text-white/60">Type an amount, then tap the team that bid. The bid shows on the public screen straight away.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {teams.map((t) => (
            <button key={t.id} type="button" disabled={!onBlock} onClick={() => pickTeam(t)} aria-pressed={selTeam === t.id}
              className={`min-w-0 rounded-xl border p-4 text-left transition disabled:opacity-50 ${selTeam === t.id ? "border-cyan bg-cyan/10" : "border-amethyst/50 hover:border-cyan/50"}`}>
              <p className="truncate font-display">{t.name}</p>
              <p className="font-score text-sm text-white/60">{t.budget} pts left</p>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem] flex-1">
            <span className="mb-1 block text-sm text-white/60">Amount (pts)</span>
            <input type="number" inputMode="numeric" min={1} value={amount} disabled={!onBlock}
              onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 12" className={`${input} font-score text-xl`} />
          </label>
          <div className="flex gap-2">
            {[1, 5].map((n) => (
              <button key={n} className={btn} disabled={!onBlock} onClick={() => bump(n)}>+{n}</button>
            ))}
          </div>
          <button className={btn} disabled={!onBlock || !team || amt <= 0}
            onClick={() => team && run(() => A.placeBid(team.id, amt))}>Push bid to screen</button>
        </div>
        {team && amt > team.budget && <p className="text-sm text-red-300">{team.name} only has {team.budget} pts.</p>}
        <button className="w-full rounded-lg bg-cyan p-4 font-display text-lg text-black disabled:opacity-40"
          disabled={!canSell} onClick={() => team && run(() => A.sellToTeam(team.id, amt))}>
          SELL PLAYER{team && amt > 0 ? ` TO ${team.name.toUpperCase()} FOR ${amt}` : ""}
        </button>
      </section>

      <section className="glass flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex flex-wrap gap-2">
          {YEARS.map((y) => (
            <button key={y} onClick={() => setYearTab(y)}
              className={`rounded-full px-4 py-1 ${y === yearTab ? "bg-cyan text-black" : "border border-amethyst/60"}`}>{y}</button>
          ))}
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pool.map((p) => (
            <li key={p.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-amethyst/40 p-3">
              <span className="truncate">
                {p.name} <span className="text-sm text-white/50">{p.position ?? "no position"}, {p.base_price} pt</span>
              </span>
              <span className="flex shrink-0 gap-2">
                <button className={btn} onClick={() => run(() => A.putOnBlock(p.id))}>Bid</button>
                <button className="px-1 text-white/40 hover:text-red-300" aria-label={`Delete ${p.name}`}
                  onClick={() => confirm(`Delete ${p.name}?`) && run(() => A.deletePlayer(p.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
        {!pool.length && <p className="text-white/60">No unsold {yearTab} players.</p>}
        <form className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => A.addPlayer(newName, yearTab, newPos || null))) setNewName("");
          }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Add ${yearTab} player`} className={input} />
          <select value={newPos} onChange={(e) => setNewPos(e.target.value)} aria-label="Position" className={select}>
            <option value="">No position</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className={btn}>Add player</button>
        </form>
      </section>

      <section className="glass flex flex-col gap-4 rounded-2xl p-5">
        <div>
          <h2 className="font-display text-lg">Player positions</h2>
          <p className="text-sm text-white/60">Set or change any player's position. It saves as soon as you pick one.</p>
        </div>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {players.map((p) => (
            <li key={p.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-amethyst/40 p-3">
              <span className="min-w-0 truncate">{p.name} <span className="text-sm text-white/50">{p.year}</span></span>
              <select aria-label={`Position for ${p.name}`} value={p.position ?? ""} className={select}
                onChange={(e) => run(() => A.setPlayerPosition(p.id, e.target.value || null))}>
                <option value="">No position</option>
                {POSITIONS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </li>
          ))}
        </ul>
        {!players.length && <p className="text-white/60">No players yet.</p>}
      </section>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {teams.map((t) => (
          <div key={t.id} className="glass min-w-0 rounded-2xl p-5">
            <h2 className="font-display text-xl">{t.name} <span className="font-score text-cyan">{t.budget} pts</span></h2>
            <ul className="mt-3 divide-y divide-white/10">
              {signed(t).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">{p.name} <span className="text-sm text-white/50">{p.year}</span></span>
                  <span className="flex items-center gap-3">
                    <button className="font-score text-cyan" aria-label={`Edit price of ${p.name}`}
                      onClick={() => { const v = Number(prompt("New price", String(p.sold_price))); if (v > 0) run(() => A.updateSoldPrice(p.id, v)); }}>
                      {p.sold_price} pts
                    </button>
                    <button className="text-white/50 hover:text-red-300" onClick={() => run(() => A.releasePlayer(p.id))}>Release</button>
                  </span>
                </li>
              ))}
            </ul>
            {!signed(t).length && <p className="mt-3 text-white/60">No players yet.</p>}
          </div>
        ))}
      </section>
      <section className="glass flex flex-col gap-4 rounded-2xl p-5">
        <h2 className="font-display text-lg">Teams</h2>

        <form className="flex min-w-0 flex-col gap-3 rounded-xl border border-cyan/40 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(async () => {
              const r = await A.addTeam(newTeam, Number(newBudget));
              if (!r.ok || !r.id) return r;
              const list = parseLines(newPlayers);
              return list.length ? A.addDraftedPlayers(r.id, list) : r;
            });
            if (ok) { setNewTeam(""); setNewPlayers(""); }
          }}>
          <h3 className="font-display">Add a team</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
            <input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Team name" required className={input} />
            <input value={newBudget} onChange={(e) => setNewBudget(e.target.value)} type="number" min={0} step="any" placeholder="Budget" required className={`${input} font-score`} />
          </div>
          <textarea value={newPlayers} onChange={(e) => setNewPlayers(e.target.value)} rows={4}
            placeholder={"Already-drafted players (optional), one per line:\nName, Year, Price, Position\nRahul Singh, 2nd Year, 5, Winger"} className={input} />
          <button className="rounded-lg bg-cyan p-3 font-bold text-black">Add team</button>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {teams.map((t) => (
            <div key={t.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-amethyst/50 p-4">
              <form key={`${t.id}-${t.name}-${t.budget}`} className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  run(() => A.updateTeam(t.id, String(f.get("name")), Number(f.get("budget"))));
                }}>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="scoreboard p-2"><p className="text-xs text-white/50">Spent</p><p className="font-score text-xl text-cyan">{spent(t)}</p></div>
                  <div className="scoreboard p-2"><p className="text-xs text-white/50">Signed</p><p className="font-score text-xl text-cyan">{signed(t).length}</p></div>
                </div>
                <label><span className="mb-1 block text-sm text-white/60">Team name</span>
                  <input name="name" defaultValue={t.name} required className={input} /></label>
                <label><span className="mb-1 block text-sm text-white/60">Remaining budget (pts)</span>
                  <input name="budget" type="number" min={0} step="any" defaultValue={t.budget} required className={`${input} font-score`} /></label>
                <button className={btn}>Save {t.name}</button>
              </form>

              <form key={`draft-${t.id}-${signed(t).length}`} className="flex flex-col gap-2 border-t border-white/10 pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  run(() => A.addDraftedPlayers(t.id, parseLines(String(f.get("list")))));
                }}>
                <span className="text-sm text-white/60">Add drafted players (Name, Year, Price, Position per line)</span>
                <textarea name="list" rows={3} placeholder="Aman Verma, 3, 4, Pivot" className={input} />
                <button className={btn}>Add to {t.name}</button>
              </form>

              <button className="self-start text-sm text-white/40 hover:text-red-300"
                onClick={() => confirm(`Delete ${t.name}? Its players return to the pool.`) && run(() => A.deleteTeam(t.id))}>
                Delete team
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}