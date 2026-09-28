'use client';

/** Every group as a card: what kind it is, when it meets next, how active it is. */
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Layers, Mic, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/surface';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { openGroupEditor, kindIcon } from '@/components/groups/GroupEditor';
import { describeSchedule, upcomingGroupMeetings } from '@/lib/schedule';
import { formatRelativeFuture, formatRelativePast, parseDate } from '@/lib/dates';
import { groupColorVar } from '@/lib/group-colors';
import { kindLabel, type GroupSummary } from '@/lib/workspace-api';
import { launchRecording } from '@/lib/recording-launch';

export function GroupsList() {
  const router = useRouter();
  const { groups, groupsLoaded } = useWorkspace();
  const { meetings } = useSidebar();

  const upcoming = useMemo(() => {
    const now = new Date();
    const list = upcomingGroupMeetings(
      groups,
      meetings.map((meeting) => ({ groupId: meeting.group_id, startedAt: meeting.created_at ?? '' })),
      now,
      31,
    );
    return new Map(list.map((entry) => [entry.group.id, entry]));
  }, [groups, meetings]);

  const sorted = useMemo(
    () => [...groups].sort((a, b) => (b.lastMeetingAt ?? b.createdAt).localeCompare(a.lastMeetingAt ?? a.createdAt)),
    [groups],
  );

  return (
    <div className="h-full overflow-y-auto bg-af-panel">
      <div className="mx-auto w-full max-w-5xl px-8 pb-24 pt-10 animate-af-rise">
        <PageHeader
          icon={<Layers />}
          title="Groups"
          description="Keep a series of meetings together: a recurring meeting, a customer, a team or a project. Each group gathers its meetings, people and open action items."
          actions={
            <Button size="sm" onClick={() => openGroupEditor({ onSaved: (group) => router.push(`/groups?id=${encodeURIComponent(group.id)}`) })}>
              <Plus />
              New group
            </Button>
          }
        />

        <div className="mt-8">
          {!groupsLoaded ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<Layers />}
              title="No groups yet"
              description="Make one for a standup, a customer, or a team. Then file meetings into it from the meeting page, the sidebar, or All meetings."
              action={
                <Button onClick={() => openGroupEditor({ onSaved: (group) => router.push(`/groups?id=${encodeURIComponent(group.id)}`) })}>
                  <Plus />
                  New group
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((group) => (
                <GroupCard key={group.id} group={group} next={upcoming.get(group.id)?.at ?? null} scheduleText={
                  upcoming.get(group.id) ? describeSchedule(upcoming.get(group.id)!.schedule) : null
                } />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupCard({ group, next, scheduleText }: { group: GroupSummary; next: Date | null; scheduleText: string | null }) {
  const router = useRouter();
  const Icon = kindIcon(group.kind);
  const last = parseDate(group.lastMeetingAt);
  const open = () => router.push(`/groups?id=${encodeURIComponent(group.id)}`);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => event.key === 'Enter' && open()}
      className="group/card relative flex min-h-[9rem] cursor-pointer flex-col overflow-hidden rounded-2xl border border-af-border bg-af-panel-2/50 p-4 outline-none transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-px hover:border-af-border-strong hover:bg-af-panel-2 hover:shadow-md focus-visible:ring-2 focus-visible:ring-af-accent/60"
      style={{ '--chip': groupColorVar(group.color) } as React.CSSProperties}
    >
      <span aria-hidden className="af-tint-dot absolute inset-x-0 top-0 h-1 opacity-80" />
      <div className="flex items-start gap-3">
        <span className="af-tint flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-af-text">{group.name}</p>
          <p className="truncate text-xs text-af-text-3">{kindLabel(group.kind) ?? 'Group'}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              aria-label={`Actions for ${group.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-af-text-3 opacity-0 transition-[opacity,background-color] hover:bg-af-active hover:text-af-text focus-visible:opacity-100 group-hover/card:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onSelect={() => launchRecording((href) => router.push(href), { group: { id: group.id, name: group.name } })}>
              <Mic />
              Record a meeting
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openGroupEditor({ groupId: group.id })}>
              <Pencil />
              Edit group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {group.description && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-af-text-3">{group.description}</p>}

      <div className="mt-auto pt-4">
        {next && scheduleText ? (
          <p className="flex items-center gap-1.5 truncate text-xs text-af-text-2" title={scheduleText}>
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-af-text-4" />
            Next {formatRelativeFuture(next)} · {next.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
            {next.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-af-text-4">
          {group.meetingCount} meeting{group.meetingCount === 1 ? '' : 's'}
          {last ? ` · last ${formatRelativePast(last)}` : ''}
        </p>
      </div>
    </div>
  );
}
