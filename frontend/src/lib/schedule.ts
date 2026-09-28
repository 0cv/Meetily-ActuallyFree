/**
 * Group schedules: a user-set schedule, or a pattern detected from when the
 * group's meetings actually happened. Pure functions over local time, so they
 * are unit tested in tests/lib/schedule.test.ts.
 *
 * Detection is deliberately conservative. A pattern needs at least
 * MIN_OCCURRENCES meetings on the same weekday at about the same time, most of
 * the expected weeks covered (skipped weeks are fine), and a recent last
 * occurrence. One-off or irregular meetings never produce a schedule.
 */

export type Cadence = 'weekly' | 'biweekly';

export interface GroupSchedule {
  /** 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  /** Local start time, "HH:MM" (24h). */
  time: string;
  cadence: Cadence;
  /** A date (YYYY-MM-DD) the meeting happened or will happen; sets biweekly parity. */
  anchorDate?: string | null;
}

export interface DetectedSchedule extends GroupSchedule {
  /** Meetings that match the pattern within the lookback window. */
  occurrences: number;
  /** Share of expected slots that had a meeting, 0–1. */
  coverage: number;
  lastSeen: Date;
}

export const MIN_OCCURRENCES = 3;
const LOOKBACK_DAYS = 84;
const CLUSTER_SPAN_MINUTES = 90;
const MERGE_TIME_MINUTES = 30;
const MIN_COVERAGE = 0.6;
/** A series with nothing for this long has stopped. */
const STALE_AFTER_DAYS: Record<Cadence, number> = { weekly: 17, biweekly: 31 };
const DAY_MS = 86_400_000;

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Days since the epoch for the local calendar date: immune to DST shifts. */
export function localDayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function parseTime(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTime(minutes: number): string {
  const clamped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface Occurrence {
  date: Date;
  day: number;
  minutes: number;
}

interface Candidate {
  weekday: number;
  minutes: number;
  cadence: Cadence;
  days: number[];
  coverage: number;
  last: Date;
}

/** Splits one weekday's meetings into groups that start at about the same time. */
function clusterByTime(entries: Occurrence[]): Occurrence[][] {
  const sorted = [...entries].sort((a, b) => a.minutes - b.minutes);
  const clusters: Occurrence[][] = [];
  for (const entry of sorted) {
    const current = clusters[clusters.length - 1];
    if (current && entry.minutes - current[0].minutes <= CLUSTER_SPAN_MINUTES) {
      current.push(entry);
    } else {
      clusters.push([entry]);
    }
  }
  return clusters;
}

function evaluate(weekday: number, cluster: Occurrence[], nowDay: number): Candidate | null {
  // One meeting per calendar day counts once (a restarted recording is not a second occurrence).
  const byDay = new Map<number, Occurrence>();
  for (const entry of cluster) {
    if (!byDay.has(entry.day)) byDay.set(entry.day, entry);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  if (days.length < MIN_OCCURRENCES) return null;

  const gaps = days.slice(1).map((day, index) => day - days[index]);
  const typical = median(gaps);
  let cadence: Cadence;
  let period: number;
  if (typical >= 6 && typical <= 8) {
    cadence = 'weekly';
    period = 7;
  } else if (typical >= 13 && typical <= 15) {
    cadence = 'biweekly';
    period = 14;
  } else {
    return null;
  }

  const first = days[0];
  const lastDay = days[days.length - 1];
  const expected = Math.floor((lastDay - first) / period) + 1;
  // Count distinct slots hit, so an extra meeting mid-week cannot inflate coverage.
  const slots = new Set(days.map((day) => Math.round((day - first) / period)));
  const coverage = Math.min(1, slots.size / expected);
  if (slots.size < MIN_OCCURRENCES || coverage < MIN_COVERAGE) return null;
  if (nowDay - lastDay > STALE_AFTER_DAYS[cadence]) return null;

  return {
    weekday,
    minutes: median(cluster.map((entry) => entry.minutes)),
    cadence,
    days,
    coverage,
    last: byDay.get(lastDay)!.date,
  };
}

/**
 * Finds a recurring pattern in meeting start times, or null. Several weekdays
 * at the same time with the same cadence (e.g. Mon/Wed/Fri standups) merge
 * into one schedule; otherwise the best-supported weekday wins.
 */
export function detectSchedule(starts: Array<Date | string>, now: Date = new Date()): DetectedSchedule | null {
  const nowDay = localDayNumber(now);
  const occurrences: Occurrence[] = starts
    .map((value) => (value instanceof Date ? value : new Date(value)))
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() <= now.getTime())
    .map((date) => ({ date, day: localDayNumber(date), minutes: minutesOfDay(date) }))
    .filter((entry) => nowDay - entry.day <= LOOKBACK_DAYS);
  if (occurrences.length < MIN_OCCURRENCES) return null;

  const candidates: Candidate[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const onDay = occurrences.filter((entry) => entry.date.getDay() === weekday);
    for (const cluster of clusterByTime(onDay)) {
      const candidate = evaluate(weekday, cluster, nowDay);
      if (candidate) candidates.push(candidate);
    }
  }
  if (candidates.length === 0) return null;

  // Strongest first: most meetings, then best coverage, then most recent.
  candidates.sort(
    (a, b) =>
      b.days.length - a.days.length || b.coverage - a.coverage || b.last.getTime() - a.last.getTime(),
  );
  const best = candidates[0];
  const merged = candidates.filter(
    (candidate) =>
      candidate.cadence === best.cadence && Math.abs(candidate.minutes - best.minutes) <= MERGE_TIME_MINUTES,
  );
  const weekdays = [...new Set(merged.map((candidate) => candidate.weekday))].sort((a, b) => a - b);
  const last = merged.reduce((latest, candidate) => (candidate.last > latest ? candidate.last : latest), best.last);
  return {
    weekdays,
    time: formatTime(median(merged.map((candidate) => candidate.minutes))),
    cadence: best.cadence,
    anchorDate: isoDate(best.last),
    occurrences: merged.reduce((sum, candidate) => sum + candidate.days.length, 0),
    coverage: Math.min(...merged.map((candidate) => candidate.coverage)),
    lastSeen: last,
  };
}

export function isValidSchedule(schedule: GroupSchedule | null | undefined): schedule is GroupSchedule {
  return (
    !!schedule &&
    Array.isArray(schedule.weekdays) &&
    schedule.weekdays.length > 0 &&
    schedule.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    parseTime(schedule.time) !== null &&
    (schedule.cadence === 'weekly' || schedule.cadence === 'biweekly')
  );
}

export interface NextOccurrenceOptions {
  /** Start times of meetings already held, so a slot that happened is skipped. */
  heldAt?: Array<Date | string>;
  /** How far ahead to look, in days. */
  horizonDays?: number;
}

/**
 * The next time the schedule is due. A slot counts as still "due" for an hour
 * after it starts (you may start recording late); a slot with a meeting held
 * within three hours of it is treated as done.
 */
export function nextOccurrence(
  schedule: GroupSchedule,
  now: Date = new Date(),
  options: NextOccurrenceOptions = {},
): Date | null {
  if (!isValidSchedule(schedule)) return null;
  const startMinutes = parseTime(schedule.time)!;
  const held = (options.heldAt ?? [])
    .map((value) => (value instanceof Date ? value : new Date(value)))
    .filter((date) => !Number.isNaN(date.getTime()));
  const horizon = options.horizonDays ?? 28;
  const anchorDay = schedule.anchorDate ? localDayNumber(new Date(`${schedule.anchorDate}T12:00:00`)) : null;

  for (let offset = 0; offset <= horizon; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!schedule.weekdays.includes(day.getDay())) continue;
    if (schedule.cadence === 'biweekly' && anchorDay !== null) {
      const weeks = Math.round((localDayNumber(day) - anchorDay) / 7);
      if (Math.abs(weeks) % 2 !== 0) continue;
    }
    const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(startMinutes / 60), startMinutes % 60);
    if (slot.getTime() < now.getTime() - 60 * 60_000) continue;
    const alreadyHeld = held.some((date) => Math.abs(date.getTime() - slot.getTime()) <= 3 * 60 * 60_000);
    if (alreadyHeld) continue;
    return slot;
  }
  return null;
}

/** "Every Thursday at 12:00", "Every other Mon and Wed at 09:30". */
export function describeSchedule(schedule: GroupSchedule): string {
  const days = schedule.weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => schedule.weekdays.includes(d))
    ? 'weekday'
    : schedule.weekdays.length === 1
      ? WEEKDAY_NAMES[schedule.weekdays[0]]
      : schedule.weekdays.map((day) => WEEKDAY_SHORT[day]).join(', ');
  const minutes = parseTime(schedule.time) ?? 0;
  const time = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${schedule.cadence === 'biweekly' ? 'Every other' : 'Every'} ${days} at ${time}`;
}

/** The schedule to use: the user's own wins over a detected one. */
export function effectiveSchedule(
  userSchedule: GroupSchedule | null | undefined,
  meetingStarts: Array<Date | string>,
  now: Date = new Date(),
): { schedule: GroupSchedule; source: 'user' | 'detected'; detected?: DetectedSchedule } | null {
  if (isValidSchedule(userSchedule)) return { schedule: userSchedule, source: 'user' };
  const detected = detectSchedule(meetingStarts, now);
  return detected ? { schedule: detected, source: 'detected', detected } : null;
}
