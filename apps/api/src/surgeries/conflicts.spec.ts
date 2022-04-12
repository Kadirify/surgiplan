import { Booking, ConflictContext, detectConflicts, overlaps, peakConcurrency } from './conflicts';

const at = (hhmm: string) => new Date(`2022-11-14T${hhmm}:00.000Z`);

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'existing',
    label: 'Kolesistektomi',
    roomId: 'room-1',
    start: at('08:00'),
    end: at('09:30'),
    surgeonId: 'surgeon-a',
    anesthetistId: 'anest-a',
    teamIds: ['nurse-a'],
    equipmentIds: [],
    ...overrides,
  };
}

function context(existing: Booking[], overrides: Partial<ConflictContext> = {}): ConflictContext {
  return {
    existing,
    turnoverMinutes: () => 30,
    equipmentQuantity: () => 1,
    absences: [],
    names: (id) => id,
    equipmentName: (id) => id,
    ...overrides,
  };
}

const kinds = (list: { kind: string }[]) => list.map((c) => c.kind).sort();

describe('overlaps', () => {
  it('treats intervals as half-open', () => {
    expect(overlaps(at('08:00'), at('09:00'), at('09:00'), at('10:00'))).toBe(false);
    expect(overlaps(at('08:00'), at('09:01'), at('09:00'), at('10:00'))).toBe(true);
  });

  it('detects containment', () => {
    expect(overlaps(at('08:00'), at('12:00'), at('09:00'), at('10:00'))).toBe(true);
  });
});

describe('detectConflicts', () => {
  it('returns nothing for a free slot', () => {
    const result = detectConflicts(
      { roomId: 'room-1', start: at('10:30'), end: at('11:30'), surgeonId: 'surgeon-b', anesthetistId: 'anest-b', teamIds: [], equipmentIds: [] },
      context([booking()]),
    );
    expect(result).toEqual([]);
  });

  it('flags an overlapping case in the same room', () => {
    const result = detectConflicts(
      { roomId: 'room-1', start: at('09:00'), end: at('10:00'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([booking()]),
    );
    expect(kinds(result)).toEqual(['ROOM']);
  });

  it('flags a case that starts inside the previous case turnover window', () => {
    const result = detectConflicts(
      { roomId: 'room-1', start: at('09:45'), end: at('10:45'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([booking()]),
    );
    expect(kinds(result)).toEqual(['TURNOVER']);
  });

  it('flags a case whose own turnover runs into the next case', () => {
    const result = detectConflicts(
      { roomId: 'room-1', start: at('07:00'), end: at('07:45'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([booking()]),
    );
    expect(kinds(result)).toEqual(['TURNOVER']);
  });

  it('accepts a case that starts exactly when turnover ends', () => {
    const result = detectConflicts(
      { roomId: 'room-1', start: at('10:00'), end: at('11:00'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([booking()]),
    );
    expect(result).toEqual([]);
  });

  it('uses the turnover of the target room', () => {
    const result = detectConflicts(
      { roomId: 'room-1', start: at('09:45'), end: at('10:45'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([booking()], { turnoverMinutes: () => 10 }),
    );
    expect(result).toEqual([]);
  });

  it('flags the surgeon being in another room at the same time', () => {
    const result = detectConflicts(
      { roomId: 'room-2', start: at('09:00'), end: at('10:00'), surgeonId: 'surgeon-a', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([booking()]),
    );
    expect(kinds(result)).toEqual(['SURGEON']);
  });

  it('flags the anesthetist and team members double-booked across rooms', () => {
    const result = detectConflicts(
      { roomId: 'room-2', start: at('09:00'), end: at('10:00'), surgeonId: 'surgeon-b', anesthetistId: 'anest-a', teamIds: ['nurse-a'], equipmentIds: [] },
      context([booking()]),
    );
    expect(kinds(result)).toEqual(['ANESTHETIST', 'TEAM_MEMBER']);
  });

  it('flags a team member who is the lead surgeon elsewhere', () => {
    const result = detectConflicts(
      { roomId: 'room-2', start: at('08:30'), end: at('09:00'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: ['surgeon-a'], equipmentIds: [] },
      context([booking()]),
    );
    expect(kinds(result)).toEqual(['TEAM_MEMBER']);
  });

  it('ignores the booking being rescheduled', () => {
    const result = detectConflicts(
      { id: 'existing', roomId: 'room-1', start: at('08:30'), end: at('10:00'), surgeonId: 'surgeon-a', anesthetistId: 'anest-a', teamIds: ['nurse-a'], equipmentIds: [] },
      context([booking()]),
    );
    expect(result).toEqual([]);
  });

  it('allows equipment while units are left', () => {
    const result = detectConflicts(
      { roomId: 'room-2', start: at('08:00'), end: at('09:00'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: ['c-arm'] },
      context([booking({ equipmentIds: ['c-arm'] })], { equipmentQuantity: () => 2 }),
    );
    expect(result).toEqual([]);
  });

  it('flags equipment when every unit is in use', () => {
    const existing = [
      booking({ id: 'a', roomId: 'room-3', surgeonId: 's1', anesthetistId: null, teamIds: [], equipmentIds: ['c-arm'] }),
      booking({ id: 'b', roomId: 'room-4', surgeonId: 's2', anesthetistId: null, teamIds: [], equipmentIds: ['c-arm'], start: at('09:00'), end: at('10:00') }),
    ];
    const result = detectConflicts(
      { roomId: 'room-2', start: at('09:00'), end: at('09:20'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: ['c-arm'] },
      context(existing, { equipmentQuantity: () => 2 }),
    );
    expect(kinds(result)).toEqual(['EQUIPMENT']);
  });

  it('does not count sequential equipment use as concurrent', () => {
    const existing = [
      booking({ id: 'a', roomId: 'room-3', surgeonId: 's1', anesthetistId: null, teamIds: [], equipmentIds: ['c-arm'], start: at('08:00'), end: at('09:00') }),
      booking({ id: 'b', roomId: 'room-4', surgeonId: 's2', anesthetistId: null, teamIds: [], equipmentIds: ['c-arm'], start: at('09:00'), end: at('10:00') }),
    ];
    const result = detectConflicts(
      { roomId: 'room-2', start: at('08:00'), end: at('10:00'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: ['c-arm'] },
      context(existing, { equipmentQuantity: () => 2 }),
    );
    expect(result).toEqual([]);
  });

  it('flags people on leave', () => {
    const result = detectConflicts(
      { roomId: 'room-2', start: at('12:00'), end: at('13:00'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([], { absences: [{ userId: 'surgeon-b', start: at('00:00'), end: at('23:59'), reason: 'Yıllık izin' }] }),
    );
    expect(kinds(result)).toEqual(['UNAVAILABLE']);
  });

  it('reports outside working hours as a warning, not a blocker', () => {
    const result = detectConflicts(
      { roomId: 'room-2', start: at('19:00'), end: at('21:00'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([], { workingHours: { isWithin: () => false } }),
    );
    expect(result).toEqual([expect.objectContaining({ kind: 'OUTSIDE_HOURS', blocking: false })]);
  });

  it('rejects an empty or inverted interval', () => {
    const result = detectConflicts(
      { roomId: 'room-1', start: at('10:00'), end: at('10:00'), surgeonId: 'surgeon-b', anesthetistId: null, teamIds: [], equipmentIds: [] },
      context([]),
    );
    expect(result[0].blocking).toBe(true);
  });
});

describe('peakConcurrency', () => {
  it('counts the maximum simultaneous bookings', () => {
    const items = [
      { start: at('08:00'), end: at('10:00') },
      { start: at('09:00'), end: at('11:00') },
      { start: at('09:30'), end: at('09:45') },
      { start: at('11:00'), end: at('12:00') },
    ];
    expect(peakConcurrency(items, at('08:00'), at('12:00'))).toBe(3);
    expect(peakConcurrency(items, at('10:30'), at('12:00'))).toBe(1);
  });
});
