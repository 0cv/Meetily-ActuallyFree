'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { Contact } from 'lucide-react';

interface ContactRow {
  id: string;
  displayName: string;
  meetingCount: number;
  lastSeenAt?: string;
}

export default function ContactsPage() {
  const router = useRouter();
  const [people, setPeople] = useState<ContactRow[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    invoke<ContactRow[]>('api_list_people')
      .then(setPeople)
      .catch((error) => console.error('Failed to list contacts', error));
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? people.filter((person) => person.displayName.toLowerCase().includes(needle))
    : people;

  return (
    <div className="h-full overflow-y-auto bg-[var(--af-panel)]">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-2 text-[var(--af-accent)]">
          <Contact className="h-4 w-4" />
          <h1 className="text-lg font-semibold text-[var(--af-text)]">Contacts</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--af-text-3)]">
          People you have attached to a speaker. Add one from the speakers list during or after a call.
        </p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search contacts"
          className="mt-4 h-9 w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-panel-2)] px-3 text-sm text-[var(--af-text)] outline-none focus:border-[var(--af-accent)]"
        />
        <div className="mt-4 divide-y divide-[var(--af-border)] overflow-hidden rounded-xl border border-[var(--af-border)]">
          {shown.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[var(--af-text-3)]">No contacts yet.</p>
          ) : shown.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => router.push(`/person?id=${encodeURIComponent(person.id)}`)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--af-hover)]"
            >
              <span className="min-w-0 truncate text-sm font-medium text-[var(--af-text)]">{person.displayName}</span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--af-text-3)]">
                {person.meetingCount} meeting{person.meetingCount === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
