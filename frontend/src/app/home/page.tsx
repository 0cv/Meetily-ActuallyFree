'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock3, RefreshCw, Search, Users } from 'lucide-react';
import { useSidebar, type CurrentMeeting } from '@/components/Sidebar/SidebarProvider';
import { normalizeSummary } from '@/lib/summary-buckets';

function meetingDate(meeting: CurrentMeeting): Date | null {
  if (meeting.created_at) {
    const date = new Date(meeting.created_at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const match = meeting.title.match(/(\d{4})-(\d{2})-(\d{2})[_ T](\d{2})[-:](\d{2})(?:[-:](\d{2}))?/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function summaryExcerpt(raw?: string): string | null {
  if (!raw) return null;
  const text = raw.split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !/^#{1,6}\s*(AI Generated Summary|Date:)/i.test(line))
    .join(' ')
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\*{0,2}Summary\*{0,2}\s*:?\s*/i, '')
    .replace(/(?:^|\s)[#>*_`~-]+(?=\S)/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return text ? text.length > 360 ? `${text.slice(0, 360).trimEnd()}…` : text : null;
}

function durationLabel(seconds?: number): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} hr ${minutes % 60} min` : `${hours} hr`;
}

interface Card {
  meeting: CurrentMeeting;
  date: Date | null;
  excerpt: string | null;
  topics: string[];
}

export default function MeetingsHome() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { meetings, meetingsLoading, meetingsError, refetchMeetings, setCurrentMeeting, handleRecordingToggle } = useSidebar();

  // Summaries and speaker names may have changed while meeting details was open.
  useEffect(() => { void refetchMeetings(); }, [refetchMeetings]);

  const groups = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const cards: Card[] = meetings.map(meeting => {
      const buckets = normalizeSummary(meeting.summary_data ?? meeting.summary_preview);
      return {
        meeting,
        date: meetingDate(meeting),
        excerpt: summaryExcerpt(buckets.summary.join(' ') || meeting.summary_preview),
        topics: buckets.topics.map(topic => topic.replace(/^[\s\-*•]+/, '').trim()).filter(Boolean),
      };
    }).filter(card => !search || [card.meeting.title, card.excerpt ?? '', ...(card.meeting.named_participants ?? []), ...card.topics]
      .some(value => value.toLocaleLowerCase().includes(search)));
    cards.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    const byDay = new Map<string, { date: Date | null; cards: Card[] }>();
    for (const card of cards) {
      const key = card.date ? `${card.date.getFullYear()}-${card.date.getMonth()}-${card.date.getDate()}` : 'unknown';
      if (!byDay.has(key)) byDay.set(key, { date: card.date, cards: [] });
      byDay.get(key)!.cards.push(card);
    }
    return [...byDay.values()];
  }, [meetings, query]);

  return (
    <div className="h-full overflow-y-auto bg-[var(--af-bg)] text-[var(--af-text)]">
      <div className="mx-auto max-w-5xl px-5 pb-20 pt-8 sm:px-8 lg:px-12">
        <div className="sticky top-0 z-10 mb-9 flex items-center gap-3 bg-[var(--af-bg)] py-3">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--af-border)] bg-[var(--af-panel)] px-4 py-3 text-[var(--af-text-3)] shadow-sm focus-within:border-[var(--af-accent)] focus-within:ring-1 focus-within:ring-[var(--af-accent)]">
            <Search className="h-4 w-4 shrink-0" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search meetings, participants, or topics" aria-label="Search meetings" className="w-full bg-transparent text-sm text-[var(--af-text)] outline-none placeholder:text-[var(--af-text-3)]" />
          </label>
          <button type="button" onClick={() => { void refetchMeetings(); }} aria-label="Refresh meetings" title="Refresh meetings" className="rounded-xl border border-[var(--af-border)] bg-[var(--af-panel)] p-3 text-[var(--af-text-3)] hover:text-[var(--af-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--af-accent)]">
            <RefreshCw className={`h-4 w-4 ${meetingsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {meetingsError ? (
          <div className="rounded-2xl border border-[var(--af-border)] bg-[var(--af-panel)] p-8 text-center">
            <p className="font-medium">Meetings could not be loaded</p>
            <p className="mt-2 text-sm text-[var(--af-text-3)]">{meetingsError}</p>
            <button onClick={() => { void refetchMeetings(); }} className="mt-5 text-sm font-semibold text-[var(--af-accent)] hover:underline">Try again</button>
          </div>
        ) : meetingsLoading && meetings.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--af-text-3)]">Loading your meetings…</p>
        ) : meetings.length === 0 ? (
          <div className="rounded-2xl border border-[var(--af-border)] bg-[var(--af-panel)] px-8 py-16 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Your first meeting starts here</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--af-text-3)]">Record a conversation to see its transcript and AI summary here.</p>
            <button onClick={handleRecordingToggle} className="mt-5 text-sm font-semibold text-[var(--af-accent)] hover:underline">Start a recording <ArrowRight className="inline h-4 w-4" /></button>
          </div>
        ) : groups.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--af-text-3)]">No meetings match “{query}”.</p>
        ) : groups.map(({ date, cards }) => (
          <section key={date?.toDateString() ?? 'unknown'} className="mb-10">
            <h2 className="mb-4 pl-6 text-sm font-semibold text-[var(--af-text-2)]">{date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date unknown'}</h2>
            <div className="relative ml-2 space-y-3 border-l border-[var(--af-border-strong)] pl-6">
              {cards.map(({ meeting, date: started, excerpt, topics }) => {
                const duration = durationLabel(meeting.duration_seconds);
                return (
                  <div key={meeting.id} className="relative">
                    <span aria-hidden="true" className="absolute -left-[31px] top-7 h-2.5 w-2.5 rounded-full border-2 border-[var(--af-accent)] bg-[var(--af-bg)]" />
                    <button type="button" onClick={() => { setCurrentMeeting(meeting); router.push(`/meeting-details?id=${encodeURIComponent(meeting.id)}`); }} className="group w-full rounded-2xl border border-[var(--af-border)] bg-[var(--af-panel)] px-5 py-4 text-left shadow-sm transition-[border-color,box-shadow] hover:border-[var(--af-border-strong)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--af-accent)] sm:px-6">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-5 gap-y-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
                          <h3 className="min-w-0 text-base font-bold leading-snug group-hover:text-[var(--af-accent)]">{meeting.title}</h3>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--af-text-3)]">
                            {started?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) ?? 'Time unknown'}
                            {duration && <><span aria-hidden="true">·</span><Clock3 className="h-3 w-3" />{duration}</>}
                          </span>
                        </div>
                        {!!meeting.named_participants?.length && (
                          <span className="flex max-w-full items-center gap-1.5 text-xs text-[var(--af-text-3)] sm:max-w-[42%]" title={meeting.named_participants.join(', ')}>
                            <Users className="h-3.5 w-3.5 shrink-0" /><span className="truncate whitespace-nowrap">{meeting.named_participants.join(' · ')}</span>
                          </span>
                        )}
                      </div>
                      <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${excerpt ? 'text-[var(--af-text-2)]' : 'text-[var(--af-text-3)]'}`}>{excerpt ?? 'No AI summary yet. Open this meeting to generate one.'}</p>
                      {topics.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs font-semibold text-[var(--af-text-3)]">Key Topics</p>
                          <div className="flex flex-wrap gap-1.5">
                            {topics.slice(0, 4).map((topic, index) => <span key={index} className="max-w-full truncate rounded-md border border-[var(--af-border)] bg-[var(--af-panel-2)] px-2 py-1 text-xs text-[var(--af-text-2)]" title={topic}>{topic.length > 44 ? `${topic.slice(0, 42).trim()}…` : topic}</span>)}
                            {topics.length > 4 && <span className="px-1 py-1 text-xs text-[var(--af-text-3)]">+{topics.length - 4}</span>}
                          </div>
                        </div>
                      )}
                      <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--af-accent)]">Open meeting <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
