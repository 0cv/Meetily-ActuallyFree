'use client';

/**
 * What the recorder page shows behind the record card while nothing is
 * recording: a way into everything else. Search, quick actions, the next
 * meetings of recurring groups, open action items, groups, and people met
 * recently, plus a line on how recording and summaries are set up.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowRight,
  AudioLines,
  CalendarClock,
  CircleCheck,
  FileAudio,
  Layers,
  Library,
  Mic,
  Plus,
  Search,
  Settings2,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useUserName } from '@/hooks/useUserName';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { PermissionWarning } from '@/components/PermissionWarning';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Kbd, Skeleton } from '@/components/ui/surface';
import { ActionItemsList } from '@/components/actions/ActionItemsList';
import { GroupDot } from '@/components/groups/GroupBits';
import { openGroupEditor } from '@/components/groups/GroupEditor';
import { kindLabel, listActionItems, onWorkspaceChange, type ActionItem, type GroupSummary } from '@/lib/workspace-api';
import { describeSchedule, upcomingGroupMeetings } from '@/lib/schedule';
import { formatRelativeFuture, formatRelativePast, formatShortDate, parseDate } from '@/lib/dates';
import { launchRecording } from '@/lib/recording-launch';

const OPEN_ITEMS_SHOWN = 5;

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Start recording straight into a group. */
function recordInto(group: { id: string; name: string }) {
  launchRecording(() => undefined, { group: { id: group.id, name: group.name } });
}

/** Re-renders every minute so relative times ("in 12 min") stay true. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function Card({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-2xl border border-af-border bg-af-panel-2/50 p-4', className)}>
      <header className="mb-2 flex min-h-7 items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-af-text">
          <span className="text-af-text-3 [&_svg]:size-4">{icon}</span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group/link inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-af-text-3 transition-colors hover:bg-af-hover hover:text-af-text"
    >
      {children}
      <ArrowRight className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5" />
    </Link>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[13px] leading-relaxed text-af-text-3">{children}</p>;
}

// ---- Up next -----------------------------------------------------------------

function UpNext({ now }: { now: Date }) {
  const { groups, groupsLoaded } = useWorkspace();
  const { meetings } = useSidebar();
  const upcoming = useMemo(
    () =>
      upcomingGroupMeetings(
        groups,
        meetings.map((meeting) => ({ groupId: meeting.group_id, startedAt: meeting.created_at ?? '' })),
        now,
      ).slice(0, 4),
    [groups, meetings, now],
  );

  return (
    <Card title="Up next" icon={<CalendarClock />}>
      {!groupsLoaded ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : upcoming.length === 0 ? (
        <Quiet>
          Recurring meetings show up here. When a group meets at the same time each week, Meetily notices after a few meetings, or you can set a
          schedule on the group.
        </Quiet>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {upcoming.map(({ group, at, schedule, source, detected }) => {
            const soon = at.getTime() - now.getTime() <= 10 * 60_000;
            return (
              <li
                key={group.id}
                className={cn(
                  'group/row flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-af-hover/60',
                  soon && 'bg-af-accent/[0.07] ring-1 ring-inset ring-af-accent/25',
                )}
              >
                <GroupDot color={group.color} className="h-2.5 w-2.5" />
                <Link href={`/groups?id=${encodeURIComponent(group.id)}`} className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-af-text">{group.name}</p>
                  <p className="truncate text-xs text-af-text-3">
                    <span className={cn('tabular-nums', soon && 'font-medium text-af-accent')}>
                      {soon ? 'Starting now' : formatRelativeFuture(at, now)}
                    </span>
                    {' · '}
                    {at.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
                    {at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </Link>
                {source === 'detected' && !soon && (
                  <button
                    type="button"
                    onClick={() => openGroupEditor({ groupId: group.id, suggestedSchedule: detected })}
                    className="hidden shrink-0 rounded-md px-1.5 py-1 text-[11px] text-af-text-4 transition-colors hover:bg-af-hover hover:text-af-text-2 group-hover/row:inline-flex"
                    title={`${describeSchedule(schedule)}, detected from ${detected?.occurrences ?? 'several'} meetings`}
                  >
                    Detected
                  </button>
                )}
                <Button size="xs" variant={soon ? 'record' : 'secondary'} onClick={() => recordInto(group)} className="shrink-0">
                  <Mic />
                  Record
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---- Open action items -------------------------------------------------------

function OpenActions() {
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listActionItems({ openOnly: true, limit: 60 }));
    } catch (error) {
      console.warn('Could not load open action items', error);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
    // Rows ticked here stay visible (struck through) until something else changes.
    return onWorkspaceChange(['actions', 'meetings', 'people'], (detail) => {
      if (detail?.source !== 'list') void load();
    });
  }, [load]);

  const shown = items && !showAll ? items.slice(0, OPEN_ITEMS_SHOWN) : items;
  const hidden = items ? items.length - OPEN_ITEMS_SHOWN : 0;

  return (
    <Card
      title="Open action items"
      icon={<CircleCheck />}
      action={items && items.length > 0 ? <span className="text-xs tabular-nums text-af-text-4">{items.length}</span> : undefined}
    >
      {items === null ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      ) : items.length === 0 ? (
        <Quiet>Nothing open. Action items from your meetings land here, and you can tick them off from anywhere.</Quiet>
      ) : (
        <>
          <ActionItemsList
            items={shown ?? []}
            onItemsChange={(next) => setItems((current) => mergeShown(current ?? [], shown ?? [], next))}
            className="-mx-2"
          />
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="mt-1 self-start rounded-md px-1.5 py-1 text-xs text-af-text-3 transition-colors hover:bg-af-hover hover:text-af-text"
            >
              {showAll ? 'Show fewer' : `Show ${hidden} more`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

/** Applies edits made to the visible slice (`before` → `after`) to the full list. */
function mergeShown(current: ActionItem[], before: ActionItem[], after: ActionItem[]): ActionItem[] {
  const wasShown = new Set(before.map((item) => item.id));
  const updated = new Map(after.map((item) => [item.id, item]));
  return current.flatMap((item) => {
    if (!wasShown.has(item.id)) return [item];
    const next = updated.get(item.id);
    return next ? [next] : [];
  });
}

// ---- Groups ------------------------------------------------------------------

function GroupsCard() {
  const { groups, groupsLoaded } = useWorkspace();
  const sorted = useMemo(
    () =>
      [...groups]
        .sort((a, b) => (b.lastMeetingAt ?? b.createdAt).localeCompare(a.lastMeetingAt ?? a.createdAt))
        .slice(0, 5),
    [groups],
  );

  return (
    <Card
      title="Groups"
      icon={<Layers />}
      action={
        groups.length > 0 ? <CardLink href="/groups">All groups</CardLink> : undefined
      }
    >
      {!groupsLoaded ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-[13px] leading-relaxed text-af-text-3">
            Keep a series together: a weekly standup, a customer, a team. Each group collects its meetings, people and open items.
          </p>
          <Button size="sm" variant="secondary" onClick={() => openGroupEditor({})}>
            <Plus />
            New group
          </Button>
        </div>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {sorted.map((group) => (
            <GroupRow key={group.id} group={group} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function GroupRow({ group }: { group: GroupSummary }) {
  const last = parseDate(group.lastMeetingAt);
  return (
    <li className="group/row flex items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-af-hover/60">
      <GroupDot color={group.color} className="h-2.5 w-2.5" />
      <Link href={`/groups?id=${encodeURIComponent(group.id)}`} className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-af-text">{group.name}</p>
        <p className="truncate text-xs text-af-text-3">
          {[kindLabel(group.kind), `${group.meetingCount} meeting${group.meetingCount === 1 ? '' : 's'}`, last ? `last ${formatRelativePast(last)}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </Link>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => recordInto(group)}
        className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
        aria-label={`Record a ${group.name} meeting`}
      >
        <Mic />
        Record
      </Button>
    </li>
  );
}

// ---- People ------------------------------------------------------------------

function PeopleCard() {
  const { people, peopleLoaded } = useWorkspace();
  const recent = useMemo(
    () =>
      people
        .filter((person) => person.lastSeenAt)
        .sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''))
        .slice(0, 6),
    [people],
  );

  return (
    <Card
      title="People you met recently"
      icon={<Users />}
      action={people.length > 0 ? <CardLink href="/contacts">All contacts</CardLink> : undefined}
    >
      {!peopleLoaded ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      ) : recent.length === 0 ? (
        <Quiet>People appear here once you name the speakers in a meeting. Click a speaker in any transcript to pick a contact or add a new one.</Quiet>
      ) : (
        <ul className="-mx-1.5 grid gap-0.5 sm:grid-cols-2">
          {recent.map((person) => {
            const seen = parseDate(person.lastSeenAt);
            return (
              <li key={person.id}>
                <Link
                  href={`/person?id=${encodeURIComponent(person.id)}`}
                  className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-af-hover/60"
                >
                  <Avatar name={person.displayName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-af-text">{person.displayName}</span>
                    <span className="block truncate text-xs text-af-text-3">
                      {[person.company || person.role, seen ? formatRelativePast(seen) : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---- Setup -------------------------------------------------------------------

function providerName(provider: string): string {
  const names: Record<string, string> = {
    parakeet: 'Parakeet',
    localWhisper: 'Whisper',
    ollama: 'Ollama',
    builtin: 'Built-in',
    'builtin-ai': 'Built-in',
    claude: 'Claude',
    openai: 'OpenAI',
    groq: 'Groq',
    openrouter: 'OpenRouter',
    gemini: 'Gemini',
  };
  return names[provider] ?? provider;
}

function SetupLine() {
  const { transcriptModelConfig, modelConfig, isAutoSummary } = useConfig();
  const [speakerId, setSpeakerId] = useState<boolean | null>(null);
  useEffect(() => {
    invoke<boolean>('diarization_models_available').then(setSpeakerId).catch(() => setSpeakerId(null));
  }, []);

  const items: Array<{ label: string; value: string; href: string; icon: React.ReactNode; muted?: boolean }> = [
    {
      label: 'Transcription',
      value: [providerName(transcriptModelConfig.provider), transcriptModelConfig.model].filter(Boolean).join(' · ') || 'Not set up',
      href: '/settings?section=transcription',
      icon: <AudioLines />,
    },
    {
      label: 'Summaries',
      value: [providerName(modelConfig.provider), modelConfig.model].filter(Boolean).join(' · ') || 'Not set up',
      href: '/settings?section=summaries',
      icon: <Sparkles />,
    },
    {
      label: 'After each call',
      value: isAutoSummary ? 'Summarize automatically' : 'Summarize when asked',
      href: '/settings?section=summaries',
      icon: <FileAudio />,
    },
    {
      label: 'Speaker names',
      value: speakerId === null ? '…' : speakerId ? 'Voices are told apart' : 'Speaker model not installed',
      href: '/settings?section=transcription',
      icon: <Users />,
      muted: speakerId === false,
    },
  ];

  return (
    <section aria-label="Setup" className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="group/setup flex min-w-0 items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-af-border hover:bg-af-panel-2/60"
        >
          <span className="text-af-text-4 transition-colors group-hover/setup:text-af-text-3 [&_svg]:size-4">{item.icon}</span>
          <span className="min-w-0">
            <span className="block text-[11px] text-af-text-4">{item.label}</span>
            <span className={cn('block truncate text-xs', item.muted ? 'text-af-warning' : 'text-af-text-2')}>{item.value}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

// ---- Page --------------------------------------------------------------------

function QuickAction({ icon, label, onClick, href }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string }) {
  const className =
    'inline-flex h-8 items-center gap-2 rounded-full border border-af-border bg-af-panel-2/50 px-3 text-xs font-medium text-af-text-2 transition-[background-color,border-color,color,transform] hover:border-af-border-strong hover:bg-af-hover hover:text-af-text active:scale-[0.98] [&_svg]:size-3.5 [&_svg]:text-af-text-3';
  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      {label}
    </button>
  );
}

export function HomeDashboard() {
  const now = useNow();
  const router = useRouter();
  const userName = useUserName();
  const { meetings } = useSidebar();
  const { openImportDialog } = useImportDialog();
  const { hasMicrophone, hasSystemAudio, isChecking, requestPermissions } = usePermissionCheck();
  const firstRun = meetings.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[880px] px-8 pb-44 pt-12 animate-af-rise">
        <p className="text-xs font-medium text-af-text-4">
          {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-af-text">
          {greeting(now)}
          {userName ? `, ${userName}` : ''}
        </h1>

        {!isChecking && (
          <PermissionWarning
            hasMicrophone={hasMicrophone}
            hasSystemAudio={hasSystemAudio}
            onRecheck={requestPermissions}
            isRechecking={isChecking}
            className="mt-6"
          />
        )}

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
          className="group/search mt-6 flex h-12 w-full items-center gap-3 rounded-2xl border border-af-border-strong bg-af-panel-2/60 px-4 text-left shadow-sm transition-[border-color,background-color,box-shadow] hover:border-af-text-4 hover:bg-af-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent/60"
        >
          <Search className="h-4 w-4 shrink-0 text-af-text-3" />
          <span className="min-w-0 flex-1 truncate text-sm text-af-text-3 group-hover/search:text-af-text-2">
            Search meetings, people, groups and transcripts, or run a command
          </span>
          <Kbd>Ctrl K</Kbd>
        </button>

        <div className="mt-3 flex flex-wrap gap-2">
          <QuickAction icon={<FileAudio />} label="Import a recording" onClick={() => openImportDialog()} />
          <QuickAction icon={<Layers />} label="New group" onClick={() => openGroupEditor({})} />
          <QuickAction icon={<UserPlus />} label="New contact" onClick={() => router.push('/contacts?new=1')} />
          <QuickAction icon={<Library />} label="All meetings" href="/meetings" />
          <QuickAction icon={<Settings2 />} label="Settings" href="/settings" />
        </div>

        {firstRun ? (
          <section className="mt-8 rounded-2xl border border-af-border bg-af-panel-2/50 p-6">
            <h2 className="text-sm font-semibold text-af-text">Record your first meeting</h2>
            <ol className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-af-text-2">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-af-accent/15 text-[11px] font-semibold text-af-accent">1</span>
                Press the red button below. Meetily records your microphone and the other side of the call, and transcribes on this computer.
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-af-accent/15 text-[11px] font-semibold text-af-accent">2</span>
                Take notes and ask questions about the call while it runs.
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-af-accent/15 text-[11px] font-semibold text-af-accent">3</span>
                When you stop, name the speakers and get a summary with action items.
              </li>
            </ol>
          </section>
        ) : (
          // Two independent columns, so a short card never stretches to match its neighbour.
          <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <UpNext now={now} />
              <GroupsCard />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <OpenActions />
              <PeopleCard />
            </div>
          </div>
        )}

        <SetupLine />
      </div>
    </div>
  );
}
