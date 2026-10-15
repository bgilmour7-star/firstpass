import { describe, expect, it } from 'vitest';
import { mergeIceTimes, type Known } from './merge';
import type { IceEvent } from './ics';

const ev = (uid: string, date: string, startTime = '17:45', minutes = 60): IceEvent => ({ uid, date, startTime, minutes, title: 'Practice', rink: 'Rink 2', kind: 'practice', sharedWith: null, cancelled: false });
const known = (e: IceEvent, extra: Partial<Known> = {}): Known => ({ ...e, id: 'id-' + e.uid, ignored: false, practiceId: null, movedFrom: null, ...extra });

describe('merging a fresh read of the calendar', () => {
  it("keeps the coach's choices", () => {
    const { rows } = mergeIceTimes([ev('a', '2026-10-20')], [known(ev('a', '2026-10-20'), { ignored: true })], '2026-10-14');
    expect(rows[0].ignored).toBe(true);
  });
  it('moves the plan when the ice time moves, and says where it was', () => {
    const { rows, moves } = mergeIceTimes([ev('a', '2026-10-21', '18:15')], [known(ev('a', '2026-10-20'), { practiceId: 'p1' })], '2026-10-14');
    expect(rows[0].movedFrom).toBe('Tue, Oct 20, 5:45');
    expect(moves).toEqual([{ practiceId: 'p1', date: '2026-10-21', startTime: '18:15', minutes: 60 }]);
  });
  it('cancels an upcoming ice time that left the calendar, but not a past one', () => {
    const { rows } = mergeIceTimes([], [known(ev('gone', '2026-10-20')), known(ev('old', '2026-10-01'))], '2026-10-14');
    expect(rows.map((r) => [r.uid, r.cancelled])).toEqual([['gone', true]]);
  });
});
