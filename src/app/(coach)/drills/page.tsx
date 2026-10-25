import Link from "next/link";
import { requireTeam } from "@/lib/auth";
import { getAppStore } from "@/lib/app/store";
import { FOCUS_ATTRIBUTES, levelCount, shapeLabel, startLevelFor } from "@/lib/drills/schema";
import { drillsForAge } from "@/lib/drills/age";
import { Pips, Rink } from "@/components/ds";
import { FavoriteButton, StarIcon } from "@/components/favorite-button";
import { LibrarySearch } from "./search";
import { RequestDrill } from "@/components/drill-request";
import { getRequestStore } from "@/lib/requests/store";
import { stateLine } from "@/lib/requests/schema";

export const dynamic = "force-dynamic";

export default async function Library({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; fav?: string; q?: string }>;
}) {
  const { coach, team } = await requireTeam("/drills");
  const { focus, fav, q } = await searchParams;
  const filter = FOCUS_ATTRIBUTES.find((a) => a === focus) ?? null;
  const onlyFavs = fav === "1";
  const store = await getAppStore();
  const [live, favs, requests] = await Promise.all([
    store.libraryDrills(),
    store.favorites(team.id),
    getRequestStore()
      .then((r) => r.forTeam(team.id))
      .catch(() => []),
  ]);
  const names = new Map(live.map((d) => [d.id, d.funName]));
  // Only drills for the team's age (decision 0025). No age toggle for coaches.
  const { drills: all, notice } = drillsForAge(live, team.ageGroup);
  const favCount = all.filter((d) => favs[d.id]).length;
  // Team favourites first (decision 0012), then by how much the drill works on the chosen skill.
  const shown = all
    .filter(
      (d) =>
        (!filter || d.focus.some((f) => f.attribute === filter)) &&
        (!onlyFavs || favs[d.id]),
    )
    .sort((a, b) => {
      const lv = (d: typeof a) =>
        d.focus.find((f) => f.attribute === filter)?.level ?? 0;
      return (
        Number(Boolean(favs[b.id])) - Number(Boolean(favs[a.id])) ||
        lv(b) - lv(a) ||
        a.funName.localeCompare(b.funName)
      );
    });

  const filters = (
    <nav
      aria-label="Filter by what it works on"
      className="-mx-1 flex gap-1 overflow-x-auto px-1"
    >
      <Chip href="/drills" on={!filter && !onlyFavs}>
        All
      </Chip>
      <Chip href="/drills?fav=1" on={onlyFavs}>
        <span className="inline-flex items-center gap-1.5">
          <StarIcon on size={15} /> Team favourites{" "}
          <span className="font-mono text-xs opacity-70">{favCount}</span>
        </span>
      </Chip>
      {FOCUS_ATTRIBUTES.map((a) => (
        <Chip
          key={a}
          href={`/drills?focus=${encodeURIComponent(a)}`}
          on={filter === a}
        >
          {a}
        </Chip>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Drills</h1>
          <p className="text-sm text-ink-200">
            {all.length} drill{all.length === 1 ? "" : "s"} for the {team.name}
            {team.ageGroup ? ` (${team.ageGroup})` : ""}, each from a coaching
            source and checked by a coach.
            {coach.isAdmin &&
              " Only drills marked Live in Drill review show here."}
          </p>
          {notice && <p className="mt-1 text-sm">{notice}</p>}
        </div>
        <RequestDrill />
      </div>

      {shown.length === 0 ? (
        <>
          {filters}
          <p className="rounded-md border border-dashed border-border-100 p-8 text-center text-sm text-ink-200">
            {all.length === 0
              ? live.length > 0
                ? `No ${team.ageGroup} drills yet. New ones show up here as they're added.`
                : "No live drills yet. Approve drills in Drill review, then mark them Live."
              : onlyFavs
                ? "No team favourites yet. Star a drill and it shows first for every coach on the team."
                : "No drills work on that yet."}
          </p>
        </>
      ) : (
        <LibrarySearch
          initialQ={q ?? ""}
          scope={onlyFavs ? "Team favourites" : filter}
          filters={filters}
          items={shown.map((d) => {
            const main = d.focus.filter((f) => f.level === 2);
            return {
              id: d.id,
              funName: d.funName,
              plainName: d.plainName,
              card: (
                <>
                  <span className="absolute right-4 top-4 z-10 rounded-full bg-surface-100/90 backdrop-blur">
                    <FavoriteButton
                      drillId={d.id}
                      drillName={d.funName}
                      initial={favs[d.id] ?? null}
                    />
                  </span>
                  <Link
                    href={`/drills/${d.id}`}
                    className="flex h-full flex-col gap-3 rounded-md border border-border-100 p-3 hover:border-ink-200"
                  >
                    <Rink spec={d.diagram} title={d.funName} detail="thumb" />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg font-bold leading-6">
                        {d.funName}
                      </span>
                      <span className="font-mono text-xs text-ink-200">
                        {d.minutes} min
                      </span>
                    </div>
                    <span className="-mt-2 text-sm text-ink-200">
                      {d.plainName}
                    </span>
                    <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {main.map((f) => (
                        <span
                          key={f.attribute}
                          className="inline-flex items-center gap-1.5 font-semibold"
                        >
                          <Pips level={2} /> {f.attribute}
                        </span>
                      ))}
                      <span className="text-ink-200">
                        {startLevelFor(d, team.ageGroup) > 1
                          ? `${team.ageGroup} starts at Level ${startLevelFor(d, team.ageGroup)} of ${levelCount(d)}`
                          : shapeLabel(d)}
                      </span>
                    </span>
                  </Link>
                </>
              ),
            };
          })}
        />
      )}

      {team.ageGroup === "U9" && all.length > 0 && (
        <p className="border-t border-border-100 pt-4 text-sm text-ink-200">
          New U9 drills show up here as they&apos;re added.
        </p>
      )}

      {requests.length > 0 && (
        <section aria-labelledby="your-requests" className="flex flex-col gap-2 border-t border-border-100 pt-5">
          <h2 id="your-requests" className="text-sm font-semibold">
            Your team&apos;s requests
          </h2>
          <ul className="flex flex-col">
            {requests.slice(0, 8).map((r) => (
              <li key={r.id} className="grid gap-x-4 gap-y-0.5 border-b border-border-100 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <span className="min-w-0 truncate">
                  <b className="font-semibold">
                    {r.kind === "change"
                      ? `Change to ${names.get(r.drillId ?? "") ?? "a drill"}`
                      : r.state === "accepted" && r.drillId && names.get(r.drillId)
                        ? names.get(r.drillId)
                        : "New drill"}
                  </b>
                  <span className="text-ink-200"> · “{r.description}”</span>
                </span>
                <span className={r.state === "accepted" ? "text-good-100" : "text-ink-200"}>
                  {r.state === "accepted" && r.kind === "new" && r.drillId && names.get(r.drillId) ? (
                    <Link href={`/drills/${r.drillId}`} className="underline underline-offset-2">
                      Live in the library
                    </Link>
                  ) : (
                    stateLine(r)
                  )}
                  {r.requesterName ? ` · ${r.requesterName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Chip({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm ${on ? "bg-ink-100 text-surface-100" : "text-ink-100 hover:bg-surface-200"}`}
    >
      {children}
    </Link>
  );
}
