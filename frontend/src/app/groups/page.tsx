'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { Layers, Mic } from 'lucide-react';
import { writePendingGroup } from '@/lib/groups';

interface GroupListItem {
  id: string;
  name: string;
  meetingCount: number;
  lastMeetingAt?: string;
  lastMeetingId?: string;
  lastMeetingTitle?: string;
}

interface GroupMember {
  personId: string;
  displayName: string;
  meetingCount: number;
}

interface GroupMeeting {
  meetingId: string;
  title: string;
  createdAt: string;
  present: string[];
}

interface GroupDetail {
  id: string;
  name: string;
  meetingCount: number;
  lastMeetingAt?: string;
  lastMeetingId?: string;
  lastMeetingTitle?: string;
  frequent: GroupMember[];
  rare: GroupMember[];
  meetings: GroupMeeting[];
}

function formatWhen(value?: string) {
  if (!value) return 'No meetings yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function GroupsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const groupId = params.get('id');
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState('');

  const loadList = () => {
    invoke<GroupListItem[]>('api_list_groups').then(setGroups).catch((error) => console.error(error));
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (!groupId) {
      setDetail(null);
      return;
    }
    const handle = window.setTimeout(() => {
      invoke<GroupDetail>('api_get_group', { groupId, query: query.trim() || null })
        .then(setDetail)
        .catch((error) => console.error(error));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [groupId, query]);

  const startGroup = (group: { id: string; name: string }) => {
    writePendingGroup(group);
    sessionStorage.setItem('autoStartRecording', 'true');
    router.push('/');
  };

  if (!groupId) {
    return (
      <div className="h-full overflow-y-auto bg-[var(--af-panel)]">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--af-accent)]" />
            <h1 className="text-lg font-semibold text-[var(--af-text)]">Groups</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--af-text-3)]">
            A standing meeting, like a weekly standup. Start the next one from here or from the recording card.
          </p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const name = creating.trim();
              if (!name) return;
              const created = await invoke<GroupListItem>('api_create_group', { name });
              setCreating('');
              router.push(`/groups?id=${encodeURIComponent(created.id)}`);
            }}
          >
            <input
              value={creating}
              onChange={(event) => setCreating(event.target.value)}
              placeholder="New group name"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--af-border)] bg-[var(--af-panel-2)] px-3 text-sm outline-none focus:border-[var(--af-accent)]"
            />
            <button type="submit" className="rounded-lg bg-[var(--af-accent)] px-3 text-sm font-medium text-white">
              Create
            </button>
          </form>
          <div className="mt-4 divide-y divide-[var(--af-border)] overflow-hidden rounded-xl border border-[var(--af-border)]">
            {groups.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[var(--af-text-3)]">No groups yet.</p>
            ) : groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => router.push(`/groups?id=${encodeURIComponent(group.id)}`)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--af-hover)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--af-text)]">{group.name}</span>
                  <span className="block truncate text-xs text-[var(--af-text-3)]">
                    {group.lastMeetingTitle ? `Last: ${group.lastMeetingTitle}` : 'No meetings yet'}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--af-text-3)]">{formatWhen(group.lastMeetingAt)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--af-panel)]">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <button type="button" onClick={() => router.push('/groups')} className="text-xs text-[var(--af-text-3)] hover:text-[var(--af-text)]">
          All groups
        </button>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-[var(--af-text)]">{detail?.name ?? 'Group'}</h1>
            <p className="mt-1 text-sm text-[var(--af-text-3)]">
              {detail?.lastMeetingId ? (
                <button type="button" className="hover:text-[var(--af-text)]" onClick={() => router.push(`/meeting-details?id=${encodeURIComponent(detail.lastMeetingId!)}`)}>
                  Last met {formatWhen(detail.lastMeetingAt)} · {detail.lastMeetingTitle}
                </button>
              ) : 'No meetings yet'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => detail && startGroup({ id: detail.id, name: detail.name })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
          >
            <Mic className="h-4 w-4" /> Start
          </button>
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-[var(--af-text)]">Often here</h2>
          <MemberRow members={detail?.frequent ?? []} onOpen={(id) => router.push(`/person?id=${encodeURIComponent(id)}`)} empty="No one has shown up regularly yet." />
          <h2 className="mt-4 text-sm font-semibold text-[var(--af-text)]">Rarely here</h2>
          <MemberRow members={detail?.rare ?? []} onOpen={(id) => router.push(`/person?id=${encodeURIComponent(id)}`)} empty="No one-off guests." />
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--af-text)]">Meetings</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search words or people"
              className="h-8 w-48 rounded-lg border border-[var(--af-border)] bg-[var(--af-panel-2)] px-2 text-xs outline-none focus:border-[var(--af-accent)]"
            />
          </div>
          <div className="mt-2 divide-y divide-[var(--af-border)] overflow-hidden rounded-xl border border-[var(--af-border)]">
            {(detail?.meetings.length ?? 0) === 0 ? (
              <p className="px-4 py-8 text-sm text-[var(--af-text-3)]">No meetings match.</p>
            ) : detail?.meetings.map((meeting) => (
              <button
                key={meeting.meetingId}
                type="button"
                onClick={() => router.push(`/meeting-details?id=${encodeURIComponent(meeting.meetingId)}`)}
                className="block w-full px-4 py-3 text-left hover:bg-[var(--af-hover)]"
              >
                <span className="block truncate text-sm font-medium text-[var(--af-text)]">{meeting.title}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--af-text-3)]">
                  {formatWhen(meeting.createdAt)}
                  {meeting.present.length > 0 ? ` · ${meeting.present.join(', ')}` : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MemberRow({ members, onOpen, empty }: { members: GroupMember[]; onOpen: (id: string) => void; empty: string }) {
  if (members.length === 0) return <p className="mt-1 text-xs text-[var(--af-text-3)]">{empty}</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {members.map((member) => (
        <button
          key={member.personId}
          type="button"
          onClick={() => onOpen(member.personId)}
          className="rounded-full border border-[var(--af-border)] px-3 py-1 text-xs text-[var(--af-text-2)] hover:bg-[var(--af-hover)]"
        >
          {member.displayName}
          <span className="ml-1 tabular-nums text-[var(--af-text-3)]">{member.meetingCount}</span>
        </button>
      ))}
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[var(--af-panel)]" />}>
      <GroupsPageInner />
    </Suspense>
  );
}
