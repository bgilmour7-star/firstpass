import { describe, expect, it } from 'vitest';
import { coachesToday, rotationToday, rotationUnits, stationsToday, todayUnits, type RotationBlock } from './schema';

// Decision 0046: a rotation runs no more stations than there are coaches; groups double up.

const team = {
  coachesOnIce: 3,
  groups: [
    { group: 'Sharks' as const, skaters: 4 },
    { group: 'Bears' as const, skaters: 5 },
    { group: 'Eagles' as const, skaters: 3 },
  ],
};
const units = todayUnits(team, null);

describe('coaches on the ice', () => {
  it("uses the practice's own number, else the team's", () => {
    expect(coachesToday(team, null)).toBe(3);
    expect(coachesToday(team, { counts: { Sharks: 4, Bears: 5, Eagles: 3 }, merges: [], coaches: 2 })).toBe(2);
  });
});

describe('rotation groups double up', () => {
  it('keeps every group when there are enough coaches', () => {
    expect(rotationUnits(units, 3).map((u) => u.key)).toEqual(['Sharks', 'Bears', 'Eagles']);
  });
  it('joins the neighbouring pair with the fewest skaters', () => {
    // Sharks+Bears = 9, Bears+Eagles = 8: Bears and Eagles share.
    const two = rotationUnits(units, 2);
    expect(two.map((u) => u.label)).toEqual(['Sharks', 'Bears + Eagles']);
    expect(two[1].skaters).toBe(8);
  });
  it('one coach: everyone together', () => {
    expect(rotationUnits(units, 1)).toHaveLength(1);
    expect(stationsToday(units, 1)).toBe(1);
  });
  it('runs as many stations as coaches', () => {
    const b = { kind: 'rotation', id: 'r', minutes: 7, drillId: 'x', drop: [], stations: ['A', 'B', 'C'].map((station) => ({ station, drillId: null, coach: '' })) } as unknown as RotationBlock;
    expect(rotationToday(b, stationsToday(units, 2)).active).toHaveLength(2);
    expect(rotationToday(b, stationsToday(units, 3)).active).toHaveLength(3);
  });
});
