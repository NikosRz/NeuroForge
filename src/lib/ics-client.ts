import * as ical from 'node-ical';
import { normalizeError } from './errors';
import { toLocalDateStr } from './shared';
import type { CalendarEvent } from './types';

const ICS_TIMEOUT_MS = 8_000;

const parseIcsUrls = (raw: string): string[] =>
  raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const overlapsDay = (start: Date, end: Date, dayStart: Date, dayEnd: Date): boolean =>
  start < dayEnd && end > dayStart;

const isCancelledEvent = (status?: unknown): boolean =>
  typeof status === 'string' && status.trim().toUpperCase() === 'CANCELLED';

const isOccurrenceExcluded = (occStart: Date, exdate?: Record<string, Date>): boolean => {
  if (!exdate || typeof exdate !== 'object') return false;
  const localKey = toLocalDateStr(occStart);
  const utcKey = occStart.toISOString().slice(0, 10);
  const isoKey = occStart.toISOString();

  if (exdate[localKey] || exdate[utcKey] || exdate[isoKey]) {
    return true;
  }

  const occMs = occStart.getTime();
  return Object.values(exdate).some(
    (d) =>
      d instanceof Date &&
      (d.getTime() === occMs || toLocalDateStr(d) === localKey)
  );
};

const findRecurrenceOverride = (
  occStart: Date,
  recurrences?: Record<string, ical.VEvent>
): ical.VEvent | undefined => {
  if (!recurrences || typeof recurrences !== 'object') return undefined;
  const localKey = toLocalDateStr(occStart);
  const utcKey = occStart.toISOString().slice(0, 10);
  const isoKey = occStart.toISOString();
  return recurrences[isoKey] ?? recurrences[localKey] ?? recurrences[utcKey];
};

const toCalendarEvent = (
  uid: string,
  rawTitle: unknown,
  rawLocation: unknown,
  start: Date,
  end: Date,
  allDay: boolean
): CalendarEvent => ({
  uid,
  title: typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : 'Untitled Event',
  start: start.toISOString(),
  end: end.toISOString(),
  allDay,
  location:
    typeof rawLocation === 'string' && rawLocation.trim() ? rawLocation.trim() : undefined,
});

const extractEventsFromFeed = (
  feed: ical.CalendarResponse,
  now: Date
): CalendarEvent[] => {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const results: CalendarEvent[] = [];
  const emittedUids = new Set<string>();

  const pushUnique = (ev: CalendarEvent): void => {
    if (emittedUids.has(ev.uid)) return;
    emittedUids.add(ev.uid);
    results.push(ev);
  };

  for (const rawEntry of Object.values(feed)) {
    if (!rawEntry || rawEntry.type !== 'VEVENT') continue;
    const entry = rawEntry as ical.VEvent;
    if (isCancelledEvent(entry.status)) continue;

    const start = entry.start instanceof Date ? entry.start : null;
    if (!start) continue;

    const end =
      entry.end instanceof Date
        ? entry.end
        : new Date(start.getTime() + 30 * 60_000);

    const isAllDay = entry.datetype === 'date';
    const baseUid =
      typeof entry.uid === 'string' && entry.uid.trim()
        ? entry.uid.trim()
        : `${String(entry.summary ?? 'event')}-${start.toISOString()}`;

    if (entry.rrule) {
      const occurrences = entry.rrule.between(dayStart, dayEnd, true);
      const durationMs = Math.max(0, end.getTime() - start.getTime());
      const handledOverrides = new Set<object>();

      for (const occStart of occurrences) {
        if (isOccurrenceExcluded(occStart, entry.exdate)) continue;

        const override = findRecurrenceOverride(occStart, entry.recurrences);
        if (override) {
          handledOverrides.add(override);
          if (isCancelledEvent(override.status)) continue;
          const ovStart = override.start instanceof Date ? override.start : occStart;
          const ovEnd =
            override.end instanceof Date
              ? override.end
              : new Date(ovStart.getTime() + durationMs);
          if (isSameLocalDay(ovStart, now) || overlapsDay(ovStart, ovEnd, dayStart, dayEnd)) {
            pushUnique(
              toCalendarEvent(
                `${baseUid}-${ovStart.toISOString()}`,
                override.summary ?? entry.summary,
                override.location ?? entry.location,
                ovStart,
                ovEnd,
                override.datetype === 'date'
              )
            );
          }
          continue;
        }

        const occEnd = new Date(occStart.getTime() + durationMs);
        pushUnique(
          toCalendarEvent(
            `${baseUid}-${occStart.toISOString()}`,
            entry.summary,
            entry.location,
            occStart,
            occEnd,
            isAllDay
          )
        );
      }

      // Include any recurrence overrides rescheduled onto today from another date
      if (entry.recurrences && typeof entry.recurrences === 'object') {
        for (const ov of Object.values(entry.recurrences)) {
          if (!ov || handledOverrides.has(ov) || isCancelledEvent(ov.status)) continue;
          const ovStart = ov.start instanceof Date ? ov.start : null;
          if (!ovStart) continue;
          const ovEnd =
            ov.end instanceof Date ? ov.end : new Date(ovStart.getTime() + durationMs);
          if (isSameLocalDay(ovStart, now) || overlapsDay(ovStart, ovEnd, dayStart, dayEnd)) {
            pushUnique(
              toCalendarEvent(
                `${baseUid}-${ovStart.toISOString()}`,
                ov.summary ?? entry.summary,
                ov.location ?? entry.location,
                ovStart,
                ovEnd,
                ov.datetype === 'date'
              )
            );
          }
        }
      }
      continue;
    }

    if (isSameLocalDay(start, now) || overlapsDay(start, end, dayStart, dayEnd)) {
      pushUnique(toCalendarEvent(baseUid, entry.summary, entry.location, start, end, isAllDay));
    }
  }

  return results;
};

const fetchSingleFeed = async (
  url: string,
  now: Date
): Promise<{ events: CalendarEvent[]; error?: string }> => {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ICS_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { events: [], error: `Calendar feed returned HTTP ${res.status}.` };
    }

    const body = await res.text();
    const parsed = ical.sync.parseICS(body);
    return { events: extractEventsFromFeed(parsed, now) };
  } catch (err) {
    return { events: [], error: normalizeError(err, 'Could not load calendar feed') };
  }
};

export const fetchTodayCalendarEvents = async (
  icsUrlsRaw: string,
  now: Date = new Date()
): Promise<{ events: CalendarEvent[]; nextEvent: CalendarEvent | null; errors: string[] }> => {
  const urls = parseIcsUrls(icsUrlsRaw);
  if (urls.length === 0) {
    return { events: [], nextEvent: null, errors: [] };
  }

  const settled = await Promise.all(urls.map((url) => fetchSingleFeed(url, now)));
  const errors = settled
    .map((r) => r.error)
    .filter((e): e is string => typeof e === 'string');

  const events = settled
    .flatMap((r) => r.events)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const nowMs = now.getTime();
  const nextEvent =
    events.find((ev) => !ev.allDay && new Date(ev.end).getTime() > nowMs) ??
    events.find((ev) => new Date(ev.end).getTime() > nowMs) ??
    null;

  return { events, nextEvent, errors };
};
