import { BLOCK_FOR, PART_LABEL, shapeLabel } from "@/lib/drills/schema";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeam } from "@/lib/auth";
import { getAppStore } from "@/lib/app/store";
import { DrillDetail } from "@/components/drill-detail";
import { SuggestChange } from "@/components/drill-request";
import { FavoriteButton } from "@/components/favorite-button";

export const dynamic = "force-dynamic";

// Read-only drill page for coaches. v1: coaches never edit drills, only their minutes in a plan.
// Opened from a drawer ("Open full page"), ?from=/plans/<id> or /today brings back a link there.
export default async function DrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { team } = await requireTeam("/drills");
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const store = await getAppStore();
  const planId = from?.match(/^\/plans\/([\w-]{1,64})$/)?.[1];
  const [drills, favs, plan] = await Promise.all([
    store.libraryDrills(),
    store.favorites(team.id),
    planId ? store.getPractice(planId).catch(() => null) : null,
  ]);
  const d = drills.find((x) => x.id === id);
  if (!d) notFound();
  const back =
    from === "/today"
      ? { href: "/today", label: "← Back to the practice" }
      : plan && plan.teamId === team.id
      ? {
          href: `/plans/${plan.id}`,
          label: `← Back to ${new Date(plan.date + "T12:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}'s plan`,
        }
      : { href: "/drills", label: "← All drills" };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={back.href}
        className="w-fit text-sm text-ink-200 hover:text-ink-100"
      >
        {back.label}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-[28px] font-extrabold leading-8">{d.funName}</h1>
          <p className="text-ink-200">
            {PART_LABEL[d.part]} · {shapeLabel(d)}, goes in a{" "}
            {BLOCK_FOR[d.groupModel]} block · {d.plainName} ·{" "}
            <span className="font-mono text-sm">{d.minutes} min</span> ·{" "}
            {d.gear}
          </p>
        </div>
        <FavoriteButton
          drillId={d.id}
          drillName={d.funName}
          initial={favs[d.id] ?? null}
          variant="full"
        />
      </div>
      <DrillDetail drill={d} after={<SuggestChange drillId={d.id} drillName={d.funName} />} />
    </div>
  );
}

