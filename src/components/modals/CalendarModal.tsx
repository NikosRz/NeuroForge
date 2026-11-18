'use client';

import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ExternalLink, MapPin } from 'lucide-react';
import { getCalendarEventsAction } from '@/app/actions/roadmap-calendar';
import type { CalendarEvent } from '@/lib/types';
import { ArcadeModalShell } from './ArcadeModalShell';

interface CalendarModalProps {
  onClose: () => void;
  onNextEventLoaded?: (nextEvent: CalendarEvent | null) => void;
}

const formatTimeRange = (ev: CalendarEvent): string => {
  if (ev.allDay) return 'ALL DAY';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(ev.start)} – ${fmt(ev.end)}`;
};

export const CalendarModal: React.FC<CalendarModalProps> = ({
  onClose,
  onNextEventLoaded,
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await getCalendarEventsAction();
      if (!active) return;
      setEvents(res.events);
      setErrors(res.errors);
      onNextEventLoaded?.(res.nextEvent);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [onNextEventLoaded]);

  return (
    <ArcadeModalShell
      title="TODAY'S SCHEDULE (.ICS)"
      subtitle="Object-permanence anchor for your meetings today."
      accentColor="cyan"
      onClose={onClose}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarIcon className="w-4 h-4 text-cyan-400" />
          <span>{new Date().toDateString()}</span>
        </span>
        <div className="flex items-center gap-2">
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 font-pixel text-[10px] text-cyan-300"
          >
            <span>Google Cal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://outlook.office.com/calendar"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 font-pixel text-[10px] text-cyan-300"
          >
            <span>Outlook</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-rose-950/70 border border-rose-500 px-3 py-2 text-xs text-rose-200 space-y-1">
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      {loading ? (
        <p className="font-pixel text-xs text-cyan-300 py-6 text-center">LOADING FEEDS...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          No events scheduled today (or add private `.ics` URLs in Settings).
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.uid}
              className="flex items-start justify-between gap-3 bg-[#1E293B] border border-slate-700 p-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-100">{ev.title}</p>
                {ev.location && (
                  <p className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span>{ev.location}</span>
                  </p>
                )}
              </div>
              <span className="font-mono-code text-xs text-cyan-300 shrink-0">
                {formatTimeRange(ev)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ArcadeModalShell>
  );
};
