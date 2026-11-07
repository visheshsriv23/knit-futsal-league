"use client";
import { useMemo, useState } from "react";
import { POSITIONS, YEARS, type Player, type Team } from "@/lib/supabase";

type Status = "all" | "unsold" | "sold";
const NONE = "none";
const STATUS_LABEL: Record<Status, string> = { all: "All players", unsold: "Unsold", sold: "Sold" };

const chip = (active: boolean) =>
  `border px-4 py-1.5 text-sm ${active ? "border-cyan bg-cyan text-black" : "border-line hover:border-cyan/60"}`;

export default function PlayersSection({ players, teams }: { players: Player[]; teams: Team[] }) {
  const [status, setStatus] = useState<Status>("all");
  const [pos, setPos] = useState<string>("all");

  const teamName = (id: number | null) => teams.find((t) => t.id === id)?.name;
  const count = (s: Status) => players.filter((p) => s === "all" || p.status === s).length;

  const filtered = useMemo(
    () =>
      players.filter(
        (p) =>
          (status === "all" || p.status === status) &&
          (pos === "all" || (pos === NONE ? !p.position : p.position === pos))
      ),
    [players, status, pos]
  );

  const years = [...YEARS, ...Array.from(new Set(players.map((p) => p.year))).filter((y) => !YEARS.includes(y))];

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-3xl uppercase">Players</h2>
        <p className="text-sm text-muted">{filtered.length} shown</p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {(["all", "unsold", "sold"] as Status[]).map((s) => (
            <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>
              {STATUS_LABEL[s]} ({count(s)})
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filter by position" className="flex flex-wrap gap-2">
          {[["all", "Any position"], ...POSITIONS.map((p) => [p, p]), [NONE, "No position yet"]].map(([v, label]) => (
            <button key={v} aria-pressed={pos === v} onClick={() => setPos(v)} className={chip(pos === v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && <p className="mt-8 text-muted">No players match these filters.</p>}

      {years.map((y) => {
        const list = filtered.filter((p) => p.year === y);
        if (!list.length) return null;
        return (
          <div key={y} className="mt-10">
            <h3 className="font-display text-2xl uppercase">
              {y} <span className="text-base text-muted">{list.length}</span>
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {list.map((p) => (
                <article key={p.id}
                  className={`border border-l-4 border-line bg-ink p-4 ${p.status === "sold" ? "border-l-cyan" : "border-l-amethyst"}`}>
                  <h4 className="font-display break-words text-2xl uppercase leading-none">{p.name}</h4>
                  <p className="mt-1 text-sm text-muted">{p.position ?? "No position yet"}</p>
                  {p.status === "sold" ? (
                    <p className="mt-4">
                      <span className="font-display text-3xl text-cyan">{p.sold_price}</span>
                      <span className="ml-1 text-white/60">pts</span>
                      <span className="block text-sm text-white/80">Sold to {teamName(p.team_id) ?? "a team"}</span>
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-white/80">Available, base price {p.base_price} pt</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}