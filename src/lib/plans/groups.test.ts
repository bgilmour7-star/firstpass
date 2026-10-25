import { describe, expect, it } from 'vitest';
import { rateUnits, type Checkin } from './checkin';
import { activeGroups, groupLabel, groupLabels, isAdapted, teamSchema, todayUnits, usualCounts, type Block } from './schema';
import { suggestions } from './suggest';

// Group names per team and 1 to 3 groups (decision 0026, spec D2). Slots stay the keys; names are labels.
const named = {
  groups: [
    { group: 'Sharks' as const, skaters: 3, name: 'Minnows' },
    { group: 'Bears' as const, skaters: 4, name: 'Wolves' },
    { group: 'Eagles' as const, skaters: 5 },
  ],
};
const twoGroups = {
  groups: [
    { group: 'Sharks' as const, skaters: 0, off: true },
    { group: 'Bears' as const, skaters: 5, name: 'Reds' },
    { group: 'Eagles' as const, skaters: 6, name: 'Blues' },
  ],
};

describe('group names', () => {
  it('default to the slot name', () => {
    expect(groupLabel(named, 'Eagles')).toBe('Eagles');
    expect(groupLabel(null, 'Bears')).toBe('Bears');
    expect(groupLabel({ groups: [{ group: 'Bears', skaters: 4, name: '  ' }] }, 'Bears')).toBe('Bears');
  });
  it("show the team's name", () => {
    expect(groupLabel(named, 'Sharks')).toBe('Minnows');
    expect(groupLabels(named)).toEqual({ Sharks: 'Minnows', Bears: 'Wolves', Eagles: 'Eagles' });
  });
  it("today's groups carry the names; keys stay slots", () => {
    const u = todayUnits(named, { counts: { Sharks: 2, Bears: 3, Eagles: 4 }, merges: [['Sharks', 'Bears']] });
    expect(u.map((x) => [x.key, x.label])).toEqual([
      ['Sharks+Bears', 'Minnows + Wolves'],
      ['Eagles', 'Eagles'],
    ]);
  });
  it('older teams without names, gear or focus still read', () => {
    const t = teamSchema.parse({ id: 't', name: 'U7', ageGroup: 'U7', groups: [{ group: 'Eagles', skaters: 4 }, { group: 'Bears', skaters: 4 }, { group: 'Sharks', skaters: 4 }], coachesOnIce: 3, practiceMinutes: 60, ice: 'half', newDrillsPerWeek: 2 });
    expect(t.gear).toEqual({});
    expect(t.focus).toEqual([]);
    expect(groupLabel(t, 'Sharks')).toBe('Sharks');
  });
});

describe('groups turned off', () => {
  it('are absent everywhere', () => {
    expect(activeGroups(twoGroups)).toEqual(['Bears', 'Eagles']);
    expect(usualCounts(twoGroups)).toEqual({ Sharks: 0, Bears: 5, Eagles: 6 });
    expect(todayUnits(twoGroups, null).map((u) => u.label)).toEqual(['Reds', 'Blues']);
  });
  it('stay absent even if attendance counts someone there', () => {
    expect(todayUnits(twoGroups, { counts: { Sharks: 3, Bears: 5, Eagles: 6 }, merges: [] }).map((u) => u.key)).toEqual(['Bears', 'Eagles']);
    expect(isAdapted(twoGroups, { counts: { Sharks: 3, Bears: 5, Eagles: 6 }, merges: [] })).toBe(false);
  });
  it('a merge with an off group is ignored', () => {
    expect(todayUnits(twoGroups, { counts: { Sharks: 0, Bears: 5, Eagles: 6 }, merges: [['Sharks', 'Bears']] }).map((u) => u.key)).toEqual(['Bears', 'Eagles']);
  });
  it('one group is a team of one group', () => {
    const one = { groups: [{ group: 'Sharks' as const, skaters: 0, off: true }, { group: 'Bears' as const, skaters: 0, off: true }, { group: 'Eagles' as const, skaters: 9, name: 'Everyone' }] };
    expect(todayUnits(one, null).map((u) => u.label)).toEqual(['Everyone']);
  });
  it('a team keeps at least one group', () => {
    const off = (g: 'Sharks' | 'Bears' | 'Eagles') => ({ group: g, skaters: 0, off: true });
    expect(teamSchema.shape.groups.safeParse([off('Sharks'), off('Bears'), off('Eagles')]).success).toBe(false);
  });
  it('names are short labels', () => {
    expect(teamSchema.shape.groups.safeParse([{ group: 'Sharks', skaters: 3, name: 'x'.repeat(25) }, { group: 'Bears', skaters: 3 }, { group: 'Eagles', skaters: 3 }]).success).toBe(false);
  });
});

describe('suggestions use the names', () => {
  const blocks: Block[] = [{ id: 's', kind: 'drill', drillId: 'ski-racer', minutes: 8, levels: [1] }];
  const ready = (r: Checkin['ready']): Checkin => ({ practiceId: 'p', teamId: 't', userId: 'u', editor: 'Brett', savedAt: '', overall: 'ok', steam: 'no', steamFrom: null, ready: r, note: '', marks: [] });
  const byId = new Map([['ski-racer', { id: 'ski-racer', funName: 'Ski Racer', groupModel: 'basic', levels: [{ name: 'Harder gates', adds: '', diagram: {} }] }]]) as unknown as Parameters<typeof suggestions>[0]['byId'];
  const base = { blocks, last: { date: '2026-10-17', blocks }, units: rateUnits({ blocks, startTime: '09:00', attendance: null }, twoGroups, byId), byId, known: new Set(['ski-racer']), feedback: {}, runs: {} };
  it("ready for harder says the team's name", () => {
    expect(suggestions({ ...base, checkins: [ready(['Bears'])], team: twoGroups }).list[0]?.title).toBe('Reds were ready for harder.');
  });
  it('every group the team uses is "every group"', () => {
    expect(suggestions({ ...base, checkins: [ready(['Bears', 'Eagles'])], team: twoGroups }).list[0]?.title).toBe('Every group was ready for harder.');
  });
  it('an off group marked ready is ignored', () => {
    expect(suggestions({ ...base, checkins: [ready(['Sharks'])], team: twoGroups }).list).toEqual([]);
  });
});
