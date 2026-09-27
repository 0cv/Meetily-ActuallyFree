'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, AudioLines, CalendarDays, Clock3, FileText, House, RefreshCw } from 'lucide-react';
import { useSidebar, type CurrentMeeting } from '@/components/Sidebar/SidebarProvider';

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
  const text = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !/^#{1,6}\s*(AI Generated Summary|Date:)/i.test(line))
    .join(' ')
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(?:^|\s)[#>*_`~-]+(?=\S)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > 300 ? `${text.slice(0, 300).trimEnd()}…` : text;
}

function durationLabel(seconds?: number): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

export default function MeetingsHome() {
  const router = useRouter();
  const { meetings, meetingsLoading, meetingsError, refetchMeetings, setCurrentMeeting, handleRecordingToggle } = useSidebar();

  // A summary may have been generated or edited on the details page since the
  // library was last visible. Refresh on entry to show the saved version.
  useEffect(() => { void refetchMeetings(); }, [refetchMeetings]);

  const sortedMeetings = useMemo(() => [...meetings].sort((a, b) =>
    (meetingDate(b)?.getTime() ?? 0) - (meetingDate(a)?.getTime() ?? 0)
  ), [meetings]);

  return (
    <div className="h-full overflow-y-auto bg-[var(--af-bg)] text-[var(--af-text)]">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 lg:px-12 lg:pt-14">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--af-accent)]">
              <House className="h-4 w-4" /> Home
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your meetings</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--af-text-3)] sm:text-base">
              Recent conversations and their key takeaways, ready when you need them.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRecordingToggle}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--af-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--af-accent)] focus-visible:ring-offset-2"
          >
            <AudioLines className="h-4 w-4" /> New recording
          </button>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4 border-b border-[var(--af-border)] pb-4">
          <div>
            <h2 className="text-lg font-semibold">Recent meetings</h2>
            <p className="mt-0.5 text-xs text-[var(--af-text-3)]">Newest first · {sortedMeetings.length} {sortedMeetings.length === 1 ? 'meeting' : 'meetings'}</p>
          </div>
          <button
            type="button"
            onClick={() => { void refetchMeetings(); }}
            className="rounded-lg p-2 text-[var(--af-text-3)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--af-accent)]"
            aria-label="Refresh meetings"
            title="Refresh meetings"
          >
            <RefreshCw className={`h-4 w-4 ${meetingsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {meetingsError ? (
          <div className="rounded-2xl border border-[var(--af-border)] bg-[var(--af-panel)] p-8 text-center">
            <p className="font-medium">Meetings could not be loaded</p>
            <p className="mt-2 text-sm text-[var(--af-text-3)]">{meetingsError}</p>
            <button onClick={() => { void refetchMeetings(); }} className="mt-5 text-sm font-semibold text-[var(--af-accent)] hover:underline">Try again</button>
          </div>
        ) : meetingsLoading && sortedMeetings.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--af-text-3)]">Loading your meetings…</p>
        ) : sortedMeetings.length === 0 ? (
          <div className="rounded-2xl border border-[var(--af-border)] bg-[var(--af-panel)] px-8 py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--af-panel-2)] text-[var(--af-accent)]"><AudioLines className="h-6 w-6" /></div>
            <h3 className="text-lg font-semibold">Your first meeting starts here</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--af-text-3)]">Record a conversation to see its transcript and AI summary in your library.</p>
            <button onClick={handleRecordingToggle} className="mt-5 text-sm font-semibold text-[var(--af-accent)] hover:underline">Start a recording <ArrowRight className="inline h-4 w-4" /></button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:gap-5">
            {sortedMeetings.map(meeting => {
              const date = meetingDate(meeting);
              const excerpt = summaryExcerpt(meeting.summary_preview);
              const duration = durationLabel(meeting.duration_seconds);
              return (
                <button
                  key={meeting.id}
                  type="button"
                  onClick={() => {
                    setCurrentMeeting(meeting);
                    router.push(`/meeting-details?id=${encodeURIComponent(meeting.id)}`);
                  }}
                  className="group flex min-h-52 flex-col rounded-2xl border border-[var(--af-border)] bg-[var(--af-panel)] p-5 text-left shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--af-border-strong)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--af-accent)] sm:p-6"
                >
                  <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--af-text-3)]">
                    {date && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>}
                    {duration && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{duration}</span>}
                  </div>
                  <h3 className="line-clamp-2 text-lg font-semibold leading-snug group-hover:text-[var(--af-accent)]">{meeting.title}</h3>
                  <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${excerpt ? 'text-[var(--af-text-2)]' : 'text-[var(--af-text-3)]'}`}>
                    {excerpt ?? 'No AI summary yet. Open this meeting to generate one.'}
                  </p>
                  <span className="mt-auto flex items-center gap-1.5 pt-5 text-xs font-semibold text-[var(--af-accent)]">
                    <FileText className="h-3.5 w-3.5" /> Open meeting <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
