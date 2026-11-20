import { describe, expect, it } from 'vitest';
import { coachesToday, isAdapted, reduceUnits, startingAttendance, todayUnits, zonesWithoutCoach, type Attendance } from './schema';

// Decision 0046: "Groups today" sets the stations; with fewer coaches, fewer groups.

const team = {
  coachesOnIce: 3,
  planning: 'auto' as const,
  groups: [
    { group: 'Sharks' as const, skaters: 3 },
    { group: 'Bears' as const, skaters: 5 },
    { group: 'Eagles' as const, skaters: 4 },
  ],
};
const counts = { Sharks: 3, Bears: 5, Eagles: 4 };
const att = (x: Partial<Attendance>): Attendance => ({ counts, merges: [], ...x });

describe('coaches on the ice', () => {
  it("uses the practice's own number, else the team's", () => {
    expect(coachesToday(team, null)).toBe(3);
    expect(coachesToday(team, att({ coaches: 2 }))).toBe(2);
  });
});

describe('groups today', () => {
  it('keeps every group by default', () => {
    expect(todayUnits(team, null)).toHaveLength(3);
  });
  it('reduces to the chosen number, joining the smallest neighbouring pair', () => {
    // Sharks+Bears = 8, Bears+Eagles = 9.
    const two = todayUnits(team, att({ coaches: 2, groups: 2 }));
    expect(two.map((u) => u.label)).toEqual(['Sharks + Bears', 'Eagles']);
    expect(two[0].skaters).toBe(8);
    expect(todayUnits(team, att({ groups: 1 }))).toHaveLength(1);
  });
  it('a plan never changes on its own: no attendance means every group', () => {
    expect(todayUnits({ ...team, coachesOnIce: 2 }, null)).toHaveLength(3);
  });
  it('a new plan starts with one group per coach when Firstpass updates the plan', () => {
    const a = startingAttendance({ ...team, coachesOnIce: 2 })!;
    expect(a.groups).toBe(2);
    expect(todayUnits({ ...team, coachesOnIce: 2 }, a)).toHaveLength(2);
    expect(startingAttendance({ ...team, coachesOnIce: 2, planning: 'ask' })).toBeNull();
    expect(startingAttendance(team)).toBeNull();
  });
  it('three groups can be chosen again', () => {
    expect(todayUnits({ ...team, coachesOnIce: 2 }, att({ coaches: 2 }))).toHaveLength(3);
  });
  it('reduceUnits never goes below one', () => {
    expect(reduceUnits(todayUnits(team, null), 0)).toHaveLength(1);
  });
});

describe('zones without a coach', () => {
  it('warns when there are more groups than coaches, unless the coach kept them', () => {
    const kept = att({ coaches: 2 });
    expect(zonesWithoutCoach(team, kept, todayUnits(team, kept))).toBe(1);
    const k2 = att({ coaches: 2, keepZones: true });
    expect(zonesWithoutCoach(team, k2, todayUnits(team, k2))).toBe(0);
    const up = att({ coaches: 2, groups: 2 });
    expect(zonesWithoutCoach(team, up, todayUnits(team, up))).toBe(0);
  });
  it('counts a changed number as adapted', () => {
    expect(isAdapted(team, att({ coaches: 2 }))).toBe(true);
    expect(isAdapted(team, att({}))).toBe(false);
  });
});
