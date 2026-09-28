'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Layers } from 'lucide-react';

interface GroupListItem {
  id: string;
  name: string;
}

export function MeetingGroupControl({ meetingId }: { meetingId: string }) {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    invoke<GroupListItem[]>('api_list_groups').then(setGroups).catch(() => setGroups([]));
    invoke<GroupListItem | null>('api_get_meeting_group', { meetingId })
      .then((group) => setGroupId(group?.id ?? ''))
      .catch(() => setGroupId(''));
  }, [meetingId]);

  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--af-border)] px-2 text-xs text-[var(--af-text-2)]">
      <Layers className="h-3.5 w-3.5 shrink-0" />
      <select
        value={groupId}
        onChange={async (event) => {
          const next = event.target.value;
          setGroupId(next);
          await invoke('api_set_meeting_group', { meetingId, groupId: next || null });
        }}
        className="max-w-[9rem] bg-transparent outline-none"
        aria-label="Meeting group"
      >
        <option value="">No group</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>{group.name}</option>
        ))}
      </select>
    </label>
  );
}
